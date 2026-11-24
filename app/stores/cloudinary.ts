import { defineStore } from 'pinia'

interface CloudinaryResource {
  public_id: string
  secure_url: string
  url: string
  format: string
  width: number
  height: number
  bytes: number
  asset_folder: string
}

interface CloudinaryResponse {
  resources?: CloudinaryResource[]
  error?: string
}

export const useCloudinaryStore = defineStore('cloudinary', () => {
  const images = ref<CloudinaryResource[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 取得圖片列表
  const fetchImages = async () => {
    if (images.value.length > 0) {
      return // 如果已經有圖片就不重複獲取
    }

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<CloudinaryResponse>('/api/cloudinary')

      if (data.resources) {
        images.value = data.resources
      } else if (data.error) {
        error.value = data.error
      }
    } catch (err) {
      error.value = 'Failed to fetch images from Cloudinary'
      console.error('Cloudinary fetch error:', err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 取某個資料夾的圖片。
   *
   * 比對的是完整的路徑片段，不是子字串：資料夾叫 hero 時不該連 hero-old
   * 或 market/hero-ish 都一起撈進來。巢狀資料夾（products/TQ001）仍然認得。
   */
  const matchesFolder = (assetFolder: string | undefined, folder: string) => {
    const path = assetFolder ?? ''

    return path === folder || path.split('/').includes(folder)
  }

  const getFolderImages = (folder: string = '') => {
    return computed(() => {
      // 沒指定資料夾就回空陣列。回「全部圖片」會讓呼叫端拿到另一種形狀的資料，
      // 而且剛好就是這個 composable 要避免的「抓到最新的隨便幾張」。
      if (!folder) {
        return []
      }

      return images.value
        .filter(image => matchesFolder(image.asset_folder, folder))
        .map(resource => ({
          src: resource.secure_url,
          alt: resource.public_id
        }))
    })
  }

  return {
    images,
    loading,
    error,
    fetchImages,
    getFolderImages
  }
})
