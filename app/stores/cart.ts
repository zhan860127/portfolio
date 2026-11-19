import { defineStore } from 'pinia'
import type { Product } from '~/stores/product'

export interface CartItem extends Product {
  quantity: number
}

/** 從 $fetch 丟出的錯誤裡取出 HTTP 狀態碼與伺服器寫的訊息 */
function readFetchError(error: unknown): { status: number | null, message: string | null } {
  const err = error as {
    statusCode?: number
    statusMessage?: string
    response?: { status?: number }
    data?: { statusCode?: number, statusMessage?: string, message?: string }
  }

  return {
    status: err?.statusCode ?? err?.response?.status ?? err?.data?.statusCode ?? null,
    message: err?.data?.statusMessage ?? err?.data?.message ?? err?.statusMessage ?? null
  }
}

export const useCartStore = defineStore('cart', {
  state: () => ({
    items: [] as CartItem[],
    submitting: false
  }),
  getters: {
    cartTotal: (state) => {
      return state.items.reduce((total, item) => total + Number(item.price) * item.quantity, 0)
    },
    itemCount: (state) => {
      return state.items.reduce((count, item) => count + item.quantity, 0)
    }
  },
  actions: {
    addToCart(product: Product) {
      const existingItem = this.items.find(item => item.id === product.id)
      if (existingItem) {
        existingItem.quantity++
      } else {
        this.items.push({ ...product, quantity: 1 })
      }
    },
    removeFromCart(productId: string) {
      const index = this.items.findIndex(item => item.id === productId)
      if (index !== -1) {
        this.items.splice(index, 1)
      }
    },
    updateQuantity(productId: string, quantity: number) {
      const item = this.items.find(item => item.id === productId)
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
    async checkout() {
      // 搶購時連點兩下就是兩張單；登入往返回來後再按一次也會撞到這裡
      if (this.submitting) {
        return
      }

      this.submitting = true

      try {
        await $fetch('/api/checkout', {
          method: 'POST',
          body: {
            // 金額由 server 依商品來源重算，這裡只送商品與數量
            items: this.items.map(item => ({ id: item.id, quantity: item.quantity }))
          }
        })
        this.clearCart()
        alert('Order placed successfully!')
      } catch (error) {
        const { status, message } = readFetchError(error)

        // 未登入：/api/checkout 回 401。先前這裡一律顯示「Checkout failed」，
        // 使用者會以為商品賣完或網站壞了。改成直接帶去登入，並記住回來要停在哪一頁。
        if (status === 401) {
          const back = window.location.pathname + window.location.search
          await navigateTo(`/auth/google?redirect=${encodeURIComponent(back)}`, { external: true })

          return
        }

        console.error('Checkout failed:', error)
        // 其餘錯誤把伺服器寫的原因顯示出來（例如商品不存在、數量不合法）
        alert(message ? `Checkout failed: ${message}` : 'Checkout failed. Please try again.')
      } finally {
        this.submitting = false
      }
    }
  }
})
