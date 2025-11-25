import { defineStore } from 'pinia'

export const useProductStore = defineStore('product', () => {
    const products = ref<any[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    const fetchProducts = async (spreadsheetId: string, range: string) => {
        loading.value = true
        error.value = null
        try {
            const data = await $fetch<any[]>('/api/getSheet', {
                query: { spreadsheetId, range }
            })
            products.value = data
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
