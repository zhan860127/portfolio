import { defineStore } from 'pinia'
import type { Product } from '~/utils/products'

export interface CartItem extends Product {
    quantity: number
}

export const useCartStore = defineStore('cart', {
    state: () => ({
        items: [] as CartItem[],
    }),
    getters: {
        cartTotal: (state) => {
            return state.items.reduce((total, item) => total + item.price * item.quantity, 0)
        },
        itemCount: (state) => {
            return state.items.reduce((count, item) => count + item.quantity, 0)
        },
    },
    actions: {
        addToCart(product: Product) {
            const existingItem = this.items.find((item) => item.id === product.id)
            if (existingItem) {
                existingItem.quantity++
            } else {
                this.items.push({ ...product, quantity: 1 })
            }
        },
        removeFromCart(productId: number) {
            const index = this.items.findIndex((item) => item.id === productId)
            if (index !== -1) {
                this.items.splice(index, 1)
            }
        },
        updateQuantity(productId: number, quantity: number) {
            const item = this.items.find((item) => item.id === productId)
            if (item) {
                item.quantity = quantity
                if (item.quantity <= 0) {
                    this.removeFromCart(productId)
                }
            }
        },
        clearCart() {
            this.items = []
        },
    },
})
