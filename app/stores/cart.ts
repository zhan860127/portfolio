import { defineStore } from 'pinia'
import type { Product } from '~/stores/product'

export interface CartItem extends Product {
  quantity: number
}

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  const cartTotal = computed(() =>
    items.value.reduce((total, item) => total + Number(item.price) * item.quantity, 0)
  )

  const itemCount = computed(() =>
    items.value.reduce((count, item) => count + item.quantity, 0)
  )

  function addToCart(product: Product) {
    const existing = items.value.find((item) => item.id === product.id)
    if (existing) {
      existing.quantity++
    } else {
      items.value.push({ ...product, quantity: 1 })
    }
  }

  function removeFromCart(productId: string) {
    const index = items.value.findIndex((item) => item.id === productId)
    if (index !== -1) {
      items.value.splice(index, 1)
    }
  }

  function updateQuantity(productId: string, quantity: number) {
    const item = items.value.find((i) => i.id === productId)
    if (item) {
      item.quantity = quantity
      if (item.quantity <= 0) {
        removeFromCart(productId)
      }
    }
  }

  function clearCart() {
    items.value = []
  }

  async function checkout(): Promise<boolean> {
    await $fetch('/api/checkout', {
      method: 'POST',
      body: { amount: cartTotal.value, items: items.value }
    })
    clearCart()
    return true
  }

  return {
    items,
    cartTotal,
    itemCount,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    checkout
  }
})
