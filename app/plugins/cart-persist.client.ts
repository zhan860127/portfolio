import { useCartStore } from '~/stores/cart'

const STORAGE_KEY = 'cart:v1'

/**
 * 購物車原本只存在記憶體裡，一旦離開頁面（例如被導去 Google 登入）就會整台清空。
 * 未登入結帳現在會導去登入，所以這份保存是那條動線能成立的前提。
 * 隱私模式或 storage 被鎖時讀寫都會丟例外，一律忽略並維持可用。
 */
export default defineNuxtPlugin(() => {
  const cart = useCartStore()

  try {
    const raw = localStorage.getItem(STORAGE_KEY)

    if (raw) {
      const items = JSON.parse(raw)

      if (Array.isArray(items)) {
        cart.items = items
      }
    }
  } catch {
    // 讀不到就當作空購物車
  }

  cart.$subscribe((_mutation, state) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items))
    } catch {
      // 寫不進去不影響結帳
    }
  })
})
