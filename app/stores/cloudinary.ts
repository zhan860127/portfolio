import { defineStore } from 'pinia'

interface CloudinaryResource {
  public_id: string
  secure_url: string
  url: string
  format: string
  width: number
  height: number
  bytes: number
  asset_folder:string
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
    console.log(data) // ✅ 正確，data 是物件本身
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

  // 取得前 N 張圖片
  const getFolderImages = (folder: string = "") => {
  return computed(() => {
    // 如果 folder 有指定，就只回傳那個資料夾的圖片
    if (folder) {
      return images.value.filter(img => img.asset_folder.includes(folder)).map((resource) => ({
        src: resource.secure_url,
        alt: resource.public_id,
        // width: resource.width,
        // height: resource.height
      }))
    }
    return images.value
  })
  }

  // 轉換為 Hero 使用的格式
  const getFormattedImages = (count: number = 9) => {
    return computed(() => {
      return images.value.slice(0, count).map((resource) => ({
        src: resource.secure_url,
        alt: resource.public_id,
        // width: resource.width,
        // height: resource.height
      }))
    })
  }

  return {
    images,
    loading,
    error,
    fetchImages,
    getFolderImages,
    getFormattedImages
  }
})