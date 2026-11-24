import type { MaybeRefOrGetter } from 'vue'

export interface UploadedImage {
  src: string
  alt: string
  kind: string
}

interface UploadSignature {
  cloudName: string
  apiKey: string
  allowedFormats: string
  folder: string
  timestamp: number
  signature: string
}

interface CloudinaryUploadResult {
  secure_url?: string
}

/** 和後端簽章裡的 allowed_formats 對齊；這邊只是為了給看得懂的錯誤訊息，真正的把關在簽章。 */
const ACCEPTED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'avif'] as const

/** 給 <input accept> 用，和上面同一份來源。 */
export const ACCEPTED_IMAGE_TYPES = ACCEPTED_EXTENSIONS.map(extension => `.${extension}`).join(',')

/** Cloudinary 免費方案單檔上限 10MB。先在瀏覽器擋掉，不然使用者只會收到一句英文的 400。 */
const MAX_BYTES = 10 * 1024 * 1024

/** $fetch 失敗時，Cloudinary 的訊息在 data.error.message，自家 API 的在 statusMessage。 */
function messageOf(cause: unknown): string {
  const data = (cause as { data?: { error?: { message?: string } } })?.data

  return data?.error?.message
    ?? (cause as { statusMessage?: string })?.statusMessage
    ?? (cause instanceof Error ? cause.message : '上傳失敗')
}

/**
 * 後台作品照片上傳。
 *
 * 流程是「跟自己的伺服器要簽章 → 瀏覽器直接把檔案送去 Cloudinary」，
 * 為什麼不走自己的伺服器寫在 server/api/admin/upload-signature.post.ts。
 *
 * 同一批檔案共用一張簽章：Cloudinary 的簽章綁的是參數與時間，不是單一檔案。
 *
 * 單張失敗不會拖垮整批 —— 傳十張壞一張時，其他九張照樣要留下來，
 * 失敗的那張只會出現在 error 裡。
 */
export function useCloudinaryUpload(marketId: MaybeRefOrGetter<string>) {
  const uploading = ref(false)
  const error = ref<string | null>(null)
  const done = ref(0)
  const total = ref(0)

  function rejectReason(file: File): string | null {
    const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

    if (!ACCEPTED_EXTENSIONS.includes(extension as typeof ACCEPTED_EXTENSIONS[number])) {
      return `${file.name}：只接受 ${ACCEPTED_EXTENSIONS.join('、')}`
    }

    if (file.size > MAX_BYTES) {
      return `${file.name}：超過 ${MAX_BYTES / 1024 / 1024}MB 上限`
    }

    return null
  }

  async function sendOne(file: File, signature: UploadSignature): Promise<UploadedImage> {
    const payload = new FormData()

    // 這些欄位必須和簽章當初簽的參數一字不差，否則 Cloudinary 回 401
    payload.append('file', file)
    payload.append('api_key', signature.apiKey)
    payload.append('timestamp', String(signature.timestamp))
    payload.append('folder', signature.folder)
    payload.append('allowed_formats', signature.allowedFormats)
    payload.append('signature', signature.signature)

    const result = await $fetch<CloudinaryUploadResult>(
      `https://api.cloudinary.com/v1_1/${signature.cloudName}/image/upload`,
      { method: 'POST', body: payload }
    )

    if (!result.secure_url) {
      throw new Error('Cloudinary 沒有回傳圖片網址')
    }

    return { src: result.secure_url, alt: '', kind: '' }
  }

  async function upload(files: File[]): Promise<UploadedImage[]> {
    const problems: string[] = []
    const accepted: File[] = []

    for (const file of files) {
      const reason = rejectReason(file)

      if (reason) {
        problems.push(reason)
      } else {
        accepted.push(file)
      }
    }

    uploading.value = true
    error.value = null
    done.value = 0
    total.value = accepted.length

    try {
      if (accepted.length === 0) {
        return []
      }

      const signature = await $fetch<UploadSignature>('/api/admin/upload-signature', {
        method: 'POST',
        body: { marketId: toValue(marketId) }
      })

      const settled = await Promise.allSettled(accepted.map(async (file) => {
        try {
          return await sendOne(file, signature)
        } catch (cause) {
          throw new Error(`${file.name}：${messageOf(cause)}`)
        } finally {
          done.value += 1
        }
      }))

      const images: UploadedImage[] = []

      for (const outcome of settled) {
        if (outcome.status === 'fulfilled') {
          images.push(outcome.value)
        } else {
          problems.push(messageOf(outcome.reason))
        }
      }

      return images
    } catch (cause) {
      // 連簽章都拿不到（沒權限、Cloudinary 沒設定）就整批都別送了
      problems.push(messageOf(cause))

      return []
    } finally {
      uploading.value = false
      error.value = problems.length > 0 ? problems.join('\n') : null
    }
  }

  return {
    uploading: readonly(uploading),
    error: readonly(error),
    done: readonly(done),
    total: readonly(total),
    upload
  }
}
