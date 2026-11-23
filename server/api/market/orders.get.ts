import { desc, eq, inArray } from 'drizzle-orm'
import { marketOrders, markets, paymentSubmissions } from '../../database/schema'

const MAX_ORDERS = 100

/** 我的市集訂單。含最新一筆匯款資料，個人頁要顯示「已填末五碼、待人工核對」。 */
export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const db = useDb()

  const rows = await db
    .select({ order: marketOrders, marketTitle: markets.title })
    .from(marketOrders)
    .innerJoin(markets, eq(marketOrders.marketId, markets.id))
    .where(eq(marketOrders.userId, user.id))
    .orderBy(desc(marketOrders.createdAt))
    .limit(MAX_ORDERS)

  if (rows.length === 0) {
    return []
  }

  const payments = await db
    .select()
    .from(paymentSubmissions)
    .where(inArray(paymentSubmissions.orderId, rows.map(row => row.order.id)))
    .orderBy(desc(paymentSubmissions.submittedAt))

  // 同一張訂單可能重複提交（填錯末五碼），以最新一筆為準
  const latestByOrder = new Map<string, typeof payments[number]>()
  for (const payment of payments) {
    if (!latestByOrder.has(payment.orderId)) {
      latestByOrder.set(payment.orderId, payment)
    }
  }

  return rows.map(row =>
    toApiMarketOrder(row.order, row.marketTitle, latestByOrder.get(row.order.id) ?? null)
  )
})
