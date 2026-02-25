import { defineStore } from 'pinia'

export interface Order {
  rowNumber: number
  email: string
  name: string
  amount: number
  items: string
  time: string
  status?: string
  lastFiveDigits?: string
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

  const updateOrderStatus = async (orderIndex: number, status: string, lastFiveDigits?: string) => {
    const order = orders.value[orderIndex]
    if (!order) {
      return
    }

    const previousStatus = order.status
    const previousLastFiveDigits = order.lastFiveDigits
    order.status = status
    if (lastFiveDigits !== undefined) {
      order.lastFiveDigits = lastFiveDigits
    }

    try {
      await $fetch('/api/orders/status', {
        method: 'POST',
        body: {
          rowNumber: order.rowNumber,
          status,
          lastFiveDigits
        }
      })
    } catch (err) {
      order.status = previousStatus
      order.lastFiveDigits = previousLastFiveDigits
      console.error('Update order status error:', err)
      throw err
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
    getOrders,
    updateOrderStatus
  }
})

