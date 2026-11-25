import { desc, eq } from 'drizzle-orm'
import { marketOrders, markets, shippingRequests } from '../../database/schema'

const MAX_HISTORY = 20

/**
 * 我的寄貨單。
 *
 * 一次把「現在這張」「歷史」「可以併進來的訂單」「運費」全部回傳，
 * 讓前端不需要自己算錢、也不需要把 80 寫死在畫面上。
 */
export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const db = useDb()

  const requests = await db
    .select()
    .from(shippingRequests)
    .where(eq(shippingRequests.userId, user.id))
    .orderBy(desc(shippingRequests.createdAt))
    .limit(MAX_HISTORY)

  // 待出貨的最多只會有一張（partial unique index 保證）
  const current = requests.find(request => request.status === 'pending') ?? null

  const orderRows = await db
    .select({ order: marketOrders, marketTitle: markets.title })
    .from(marketOrders)
    .innerJoin(markets, eq(marketOrders.marketId, markets.id))
    .where(eq(marketOrders.userId, user.id))
    .orderBy(desc(marketOrders.createdAt))
    .limit(100)

  /**
   * 可以勾選的訂單 = 狀態允許寄送，而且還沒被別張寄貨單收走。
   * 「正在編輯的這張自己收走的」也要算進來，否則客人一打開就看不到已經選過的項目。
   */
  const selectable = orderRows.filter(row =>
    SHIPPABLE_ORDER_STATUSES.includes(row.order.status)
    && (row.order.shippingRequestId === null || row.order.shippingRequestId === current?.id)
  )

  return {
    shippingFee: SHIPPING_FEE_CENTS / 100,
    current: current ? toApiShippingRequest(current) : null,
    history: requests
      .filter(request => request.status !== 'pending')
      .map(toApiShippingRequest),
    eligibleOrders: selectable.map(row => ({
      ...toApiMarketOrder(row.order, row.marketTitle, null),
      includedInCurrent: row.order.shippingRequestId !== null && row.order.shippingRequestId === current?.id
    }))
  }
})
