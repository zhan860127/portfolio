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
    image?: string
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
            // 1. Fetch data from Google Sheet
            const sheetData = await $fetch<any[]>('/api/getSheet', {
                query: { range }
            })

            // 2. Fetch images from Cloudinary
            await cloudinaryStore.fetchImages()

            // 3. Transform raw sheet data (2D array) to Product objects
            if (!sheetData || sheetData.length === 0) {
                products.value = []
                return
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
                    product.image = folderImages[0].src
                }

                return product as Product
            })

        } catch (err) {
            error.value = 'Failed to fetch products'
            console.error(err)
        } finally {
            loading.value = false
        }
    }

    return {
        products,
        loading,
        error,
        fetchProducts
    }
})
