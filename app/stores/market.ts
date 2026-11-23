import { defineStore } from 'pinia'

export interface MarketProductImage {
  src: string
  alt?: string
  kind?: 'front' | 'side' | 'back' | 'bottom' | 'detail' | 'process'
}

export interface MarketSummary {
  id: string
  title: string
  description: string | null
  coverImage: string | null
  startsAt: string
  endsAt: string
  status: 'draft' | 'upcoming' | 'live' | 'ended'
  statusLabel: string
  productCount: number
  waitlistWindowHours: number
  depositDueHours: number
}

export interface MarketProduct {
  id: string
  code: string | null
  name: string
  description: string | null
  price: number
  deposit: number
  images: MarketProductImage[]
  specifications: Record<string, string | undefined>
  story: string | null
  purchaseNotes: string | null
  status: 'available' | 'reserved' | 'sold'
  statusLabel: string
  sortOrder: number
  isFollowing: boolean
  myOrderId: string | null
  myWaitlistId: string | null
  waitlistPosition: number | null
  canPurchase: boolean
  canWaitlist: boolean
  priorityWindowActive: boolean
}

export interface MarketOrder {
  id: string
  marketId: string
  marketTitle: string | null
  productId: string
  productName: string
  productImage: string | null
  amount: number
  deposit: number
  status: 'pending_deposit' | 'payment_submitted' | 'deposit_confirmed' | 'completed' | 'expired' | 'cancelled'
  statusLabel: string
  expiresAt: string | null
  createdAt: string
  payment: {
    bankLast5: string
    paidAmount: number
    paidAt: string
    note: string | null
    submittedAt: string
  } | null
}

export interface MarketFollow {
  id: string
  productId: string
  productName: string
  productImage: string | null
  price: number
  status: 'available' | 'reserved' | 'sold'
  statusLabel: string
  marketId: string
  marketTitle: string
  createdAt: string
}

export interface MarketWaitlistEntry {
  id: string
  productId: string
  productName: string
  productImage: string | null
  marketId: string
  status: 'waiting' | 'notified' | 'converted' | 'expired' | 'cancelled'
  position: number | null
  notifiedAt: string | null
  windowExpiresAt: string | null
  createdAt: string
}

export const useMarketStore = defineStore('market', () => {
  const markets = ref<MarketSummary[]>([])
  const marketsLoading = ref(false)

  const currentMarket = ref<MarketSummary | null>(null)
  const products = ref<MarketProduct[]>([])
  const productsLoading = ref(false)

  const myOrders = ref<MarketOrder[]>([])
  const myFollows = ref<MarketFollow[]>([])
  const myWaitlist = ref<MarketWaitlistEntry[]>([])

  const error = ref<string | null>(null)

  const guestFollows = useGuestFollows()

  function readError(err: unknown): string {
    const typed = err as {
      statusMessage?: string
      data?: { statusMessage?: string, message?: string }
      statusCode?: number
      response?: { status?: number }
    }

    return typed?.data?.statusMessage
      ?? typed?.data?.message
      ?? typed?.statusMessage
      ?? '操作失敗，請稍後再試'
  }

  function statusOf(err: unknown): number | null {
    const typed = err as { statusCode?: number, response?: { status?: number }, data?: { statusCode?: number } }

    return typed?.statusCode ?? typed?.response?.status ?? typed?.data?.statusCode ?? null
  }

  async function fetchMarkets() {
    marketsLoading.value = true
    error.value = null

    try {
      markets.value = await $fetch<MarketSummary[]>('/api/market/markets')
    } catch (err) {
      error.value = readError(err)
    } finally {
      marketsLoading.value = false
    }
  }

  /** 進場時一次拿完整資料；之後切換商品不再打 API（需求 14）。 */
  async function fetchMarket(marketId: string) {
    productsLoading.value = true
    error.value = null

    try {
      const data = await $fetch<{ market: MarketSummary, products: MarketProduct[] }>(
        `/api/market/markets/${marketId}`
      )

      currentMarket.value = data.market
      products.value = data.products.map(product => ({
        ...product,
        // 未登入期間的追蹤存在瀏覽器，這裡合併回畫面狀態
        isFollowing: product.isFollowing || guestFollows.has(product.id)
      }))
    } catch (err) {
      error.value = readError(err)
      throw err
    } finally {
      productsLoading.value = false
    }
  }

  /**
   * 只重抓狀態欄位，不動圖片與文案。
   * 別人把作品買走時，瀏覽中的使用者需要看到狀態變成「保留中」。
   */
  async function refreshStatuses(marketId: string) {
    try {
      const data = await $fetch<{
        marketStatus: MarketSummary['status']
        products: Array<Pick<MarketProduct,
        'id' | 'status' | 'statusLabel' | 'isFollowing' | 'myOrderId' | 'myWaitlistId'
        | 'waitlistPosition' | 'canPurchase' | 'canWaitlist' | 'priorityWindowActive'>>
      }>(`/api/market/markets/${marketId}/statuses`)

      const byId = new Map(data.products.map(item => [item.id, item]))

      products.value = products.value.map((product) => {
        const next = byId.get(product.id)

        if (!next) {
          return product
        }

        return {
          ...product,
          ...next,
          isFollowing: next.isFollowing || guestFollows.has(product.id)
        }
      })

      if (currentMarket.value) {
        currentMarket.value = { ...currentMarket.value, status: data.marketStatus }
      }
    } catch {
      // 輪詢失敗不打擾使用者，畫面維持上一次的狀態
    }
  }

  function patchProduct(productId: string, patch: Partial<MarketProduct>) {
    products.value = products.value.map(product =>
      product.id === productId ? { ...product, ...patch } : product
    )
  }

  /**
   * 追蹤 / 取消追蹤。
   * 未登入時只寫瀏覽器暫存，登入後由 syncGuestFollows 一次搬進帳號 —— 需求 7。
   */
  async function toggleFollow(productId: string, loggedIn: boolean) {
    const product = products.value.find(item => item.id === productId)
    const next = !(product?.isFollowing ?? false)

    patchProduct(productId, { isFollowing: next })

    if (!loggedIn) {
      guestFollows.toggle(productId, next)

      return { following: next, guest: true }
    }

    try {
      const result = await $fetch<{ following: boolean }>('/api/market/follows', {
        method: 'POST',
        body: { productId, following: next }
      })

      patchProduct(productId, { isFollowing: result.following })

      return { following: result.following, guest: false }
    } catch (err) {
      patchProduct(productId, { isFollowing: !next })
      error.value = readError(err)
      throw err
    }
  }

  /** 登入後把瀏覽器暫存的追蹤同步進帳號，成功才清空本機。 */
  async function syncGuestFollows() {
    const pending = guestFollows.list()

    if (pending.length === 0) {
      return 0
    }

    try {
      const result = await $fetch<{ synced: number }>('/api/market/follows/sync', {
        method: 'POST',
        body: { productIds: pending }
      })

      guestFollows.clear()

      return result.synced
    } catch {
      return 0
    }
  }

  async function placeOrder(productId: string) {
    error.value = null

    try {
      const result = await $fetch<{ order: MarketOrder }>('/api/market/orders', {
        method: 'POST',
        body: { productId }
      })

      patchProduct(productId, {
        status: 'reserved',
        statusLabel: '保留中',
        myOrderId: result.order.id,
        canPurchase: false,
        canWaitlist: false
      })

      myOrders.value = [result.order, ...myOrders.value]

      return result.order
    } catch (err) {
      // 搶輸了：把這件商品的狀態同步成最新，讓畫面立刻顯示「保留中」
      if (statusOf(err) === 409) {
        patchProduct(productId, {
          status: 'reserved',
          statusLabel: '保留中',
          canPurchase: false,
          canWaitlist: true
        })
      }

      error.value = readError(err)
      throw err
    }
  }

  async function joinWaitlist(productId: string) {
    error.value = null

    try {
      const result = await $fetch<{ entry: { id: string, position: number | null } }>('/api/market/waitlist', {
        method: 'POST',
        body: { productId }
      })

      patchProduct(productId, {
        myWaitlistId: result.entry.id,
        waitlistPosition: result.entry.position,
        canWaitlist: false
      })

      return result.entry
    } catch (err) {
      error.value = readError(err)
      throw err
    }
  }

  async function cancelWaitlist(entryId: string, productId?: string) {
    try {
      await $fetch(`/api/market/waitlist/${entryId}`, { method: 'DELETE' })

      if (productId) {
        patchProduct(productId, { myWaitlistId: null, waitlistPosition: null, canWaitlist: true })
      }

      myWaitlist.value = myWaitlist.value.filter(entry => entry.id !== entryId)
    } catch (err) {
      error.value = readError(err)
      throw err
    }
  }

  async function submitPayment(orderId: string, payload: {
    bankLast5: string
    paidAmount: number
    paidAt: string
    note?: string
  }) {
    const result = await $fetch<{ order: MarketOrder }>(`/api/market/orders/${orderId}/payment`, {
      method: 'POST',
      body: payload
    })

    myOrders.value = myOrders.value.map(order => order.id === orderId ? result.order : order)

    return result.order
  }

  async function fetchMyOrders() {
    myOrders.value = await $fetch<MarketOrder[]>('/api/market/orders')
  }

  async function fetchMyFollows() {
    myFollows.value = await $fetch<MarketFollow[]>('/api/market/follows')
  }

  async function fetchMyWaitlist() {
    myWaitlist.value = await $fetch<MarketWaitlistEntry[]>('/api/market/waitlist')
  }

  return {
    markets,
    marketsLoading,
    currentMarket,
    products,
    productsLoading,
    myOrders,
    myFollows,
    myWaitlist,
    error,
    fetchMarkets,
    fetchMarket,
    refreshStatuses,
    toggleFollow,
    syncGuestFollows,
    placeOrder,
    joinWaitlist,
    cancelWaitlist,
    submitPayment,
    fetchMyOrders,
    fetchMyFollows,
    fetchMyWaitlist
  }
})
