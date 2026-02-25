import { defineStore } from 'pinia'

export interface Order {
  email: string
  name: string
  amount: number
  items: string
  time: string
}

export const useOrderStore = defineStore('order', () => {
  const orders = ref<Order[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchOrders = async () => {
    if (orders.value.length > 0) {
      return
    }

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<Order[]>('/api/orders')
      orders.value = data
    } catch (err) {
      error.value = 'Failed to fetch orders'
      console.error('Orders fetch error:', err)
    } finally {
      loading.value = false
    }
  }

  const getOrders = () => {
    return computed(() => orders.value)
  }

  return {
    orders,
    loading,
    error,
    fetchOrders,
    getOrders
  }
})

