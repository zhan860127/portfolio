// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCloudinaryUpload } from '../../app/composables/useCloudinaryUpload'

/**
 * 後台作品照片上傳。
 *
 * 重點不在「有沒有打到 Cloudinary」，而在三件會讓人丟圖丟到一半的事：
 * 擋掉不該送的檔案、一批只簽一次、以及單張失敗不能把整批拖下水。
 */

const MARKET_ID = '44444444-4444-4444-8444-444444444444'
const SIGNATURE_URL = '/api/admin/upload-signature'

const signature = {
  cloudName: 'test-cloud',
  apiKey: 'test-key',
  allowedFormats: 'jpg,jpeg,png,webp,avif',
  folder: `market/${MARKET_ID}`,
  timestamp: 1700000000,
  signature: 'test-signature'
}

/** 直接蓋掉 size，免得為了測 10MB 上限真的配置 10MB 記憶體。 */
function makeFile(name: string, bytes = 1024): File {
  const file = new File(['x'], name)

  Object.defineProperty(file, 'size', { value: bytes })

  return file
}

interface FetchCall {
  url: string
  body?: FormData
}

function stubFetch(onUpload: (file: File) => unknown = file => ({
  secure_url: `https://res.cloudinary.com/test-cloud/${file.name}`
})) {
  const calls: FetchCall[] = []

  vi.stubGlobal('$fetch', vi.fn(async (url: string, options?: { body?: FormData }) => {
    calls.push({ url, body: options?.body })

    if (url === SIGNATURE_URL) {
      return signature
    }

    return onUpload(options!.body!.get('file') as File)
  }))

  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useCloudinaryUpload', () => {
  it('把成功上傳的圖片網址帶回來', async () => {
    stubFetch()

    const { upload, error } = useCloudinaryUpload(MARKET_ID)
    const images = await upload([makeFile('bowl.jpg'), makeFile('cup.png')])

    expect(images).toEqual([
      { src: 'https://res.cloudinary.com/test-cloud/bowl.jpg', alt: '', kind: '' },
      { src: 'https://res.cloudinary.com/test-cloud/cup.png', alt: '', kind: '' }
    ])
    expect(error.value).toBeNull()
  })

  it('整批只跟伺服器要一次簽章', async () => {
    const calls = stubFetch()

    const { upload } = useCloudinaryUpload(MARKET_ID)
    await upload([makeFile('a.jpg'), makeFile('b.jpg'), makeFile('c.jpg')])

    expect(calls.filter(call => call.url === SIGNATURE_URL)).toHaveLength(1)
    expect(calls.filter(call => call.url !== SIGNATURE_URL)).toHaveLength(3)
  })

  it('送出的欄位和簽章簽的參數一致，否則 Cloudinary 會回 401', async () => {
    const calls = stubFetch()

    const { upload } = useCloudinaryUpload(MARKET_ID)
    await upload([makeFile('bowl.jpg')])

    const body = calls.find(call => call.url !== SIGNATURE_URL)!.body!

    expect(body.get('api_key')).toBe(signature.apiKey)
    expect(body.get('timestamp')).toBe(String(signature.timestamp))
    expect(body.get('folder')).toBe(signature.folder)
    expect(body.get('allowed_formats')).toBe(signature.allowedFormats)
    expect(body.get('signature')).toBe(signature.signature)
  })

  it('擋掉超過 10MB 的檔案，而且不浪費一次簽章', async () => {
    const calls = stubFetch()

    const { upload, error } = useCloudinaryUpload(MARKET_ID)
    const images = await upload([makeFile('huge.jpg', 11 * 1024 * 1024)])

    expect(images).toEqual([])
    expect(error.value).toContain('超過 10MB')
    expect(calls).toHaveLength(0)
  })

  it('擋掉不支援的副檔名', async () => {
    stubFetch()

    const { upload, error } = useCloudinaryUpload(MARKET_ID)
    const images = await upload([makeFile('notes.pdf')])

    expect(images).toEqual([])
    expect(error.value).toContain('只接受')
  })

  it('單張失敗不會把整批拖下水', async () => {
    stubFetch((file) => {
      if (file.name === 'broken.jpg') {
        throw Object.assign(new Error('fail'), { data: { error: { message: '檔案損毀' } } })
      }

      return { secure_url: `https://res.cloudinary.com/test-cloud/${file.name}` }
    })

    const { upload, error } = useCloudinaryUpload(MARKET_ID)
    const images = await upload([makeFile('good.jpg'), makeFile('broken.jpg')])

    expect(images).toEqual([
      { src: 'https://res.cloudinary.com/test-cloud/good.jpg', alt: '', kind: '' }
    ])
    expect(error.value).toContain('broken.jpg')
    expect(error.value).toContain('檔案損毀')
  })

  it('拿不到簽章時整批都不送', async () => {
    const calls: string[] = []

    vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
      calls.push(url)

      throw Object.assign(new Error('forbidden'), { statusMessage: 'Not found' })
    }))

    const { upload, error } = useCloudinaryUpload(MARKET_ID)
    const images = await upload([makeFile('a.jpg'), makeFile('b.jpg')])

    expect(images).toEqual([])
    expect(calls).toEqual([SIGNATURE_URL])
    expect(error.value).toBe('Not found')
  })

  it('上傳過程中 uploading 為 true，結束後歸位', async () => {
    stubFetch()

    const { upload, uploading, done, total } = useCloudinaryUpload(MARKET_ID)

    expect(uploading.value).toBe(false)

    const pending = upload([makeFile('a.jpg'), makeFile('b.jpg')])

    expect(uploading.value).toBe(true)
    expect(total.value).toBe(2)

    await pending

    expect(uploading.value).toBe(false)
    expect(done.value).toBe(2)
  })
})
