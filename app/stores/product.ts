import { defineStore } from 'pinia'

export interface Product {
    id: string
    title: string
    description: string
    created_dated: string
    tags: string
    is_published: string
    price: number
    quantity: number
    image?: { src: string; alt?: string }[]
}

export const useProductStore = defineStore('product', () => {
    const products = ref<Product[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)
    const cloudinaryStore = useCloudinaryStore()

    const fetchProducts = async (range: string) => {
        loading.value = true
        error.value = null
        try {
            // 1 & 2. 試算表與 Cloudinary 沒有先後關係，序列跑等於把兩段延遲相加
            const [sheetData] = await Promise.all([
                $fetch<any[]>('/api/getSheet', { query: { range } }),
                cloudinaryStore.fetchImages()
            ])

            // 3. Transform raw sheet data (2D array) to Product objects
            if (!sheetData || sheetData.length === 0) {
                products.value = []
                return products.value
            }

            const headers = sheetData[0] // First row is headers
            const rows = sheetData.slice(1) // Rest are data

            products.value = rows.map((row: any[]) => {
                const product: any = {}
                headers.forEach((header: string, index: number) => {
                    const key = header.toLowerCase().replace(' ', '_')
                    let value = row[index]

                    // Convert price and quantity to numbers
                    if (key === 'price' || key === 'quantity') {
                        value = Number(value) || 0
                    }

                    product[key] = value
                })

                // 4. Link Image from Cloudinary
                // Use getFolderImages as requested

                const folderImages = cloudinaryStore.getFolderImages(product.id).value as any[]
                    
                if (folderImages && folderImages.length > 0) {
                    product.image = folderImages
                }

                return product as Product
            })

        } catch (err) {
            error.value = 'Failed to fetch products'
            console.error(err)
        } finally {
            loading.value = false
        }

        // 回傳結果而不是只寫進 store，呼叫端包 useAsyncData 時才有 data 可用，
        // SSR payload 也才帶得到這份清單。
        return products.value
    }

    return {
        products,
        loading,
        error,
        fetchProducts
    }
})
