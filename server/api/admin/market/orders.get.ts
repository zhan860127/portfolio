import { and, desc, eq, inArray } from 'drizzle-orm'
import { marketOrders, marketProducts, markets, paymentSubmissions, users } from '../../../database/schema'
import type { MarketOrderStatus } from '../../../database/schema'

const ORDER_STATUSES: MarketOrderStatus[] = [
  'pending_deposit',
  'payment_submitted',
  'deposit_confirmed',
  'completed',
  'expired',
  'cancelled'
]

/**
 * 後台訂單列表。
 * 預設依建立時間新到舊，可用 ?status= 與 ?marketId= 過濾；
 * 「逾期」在這裡是即時算出來的旗標，不依賴排程有沒有跑過。
 */
export default defineEventHandler(async (event) => {
  await requireAdminUser(event)

  const query = getQuery(event)
  const statusFilter = String(query.status ?? '').trim()
  const marketFilter = String(query.marketId ?? '').trim()

  const conditions = []

  if (ORDER_STATUSES.includes(statusFilter as MarketOrderStatus)) {
    conditions.push(eq(marketOrders.status, statusFilter as MarketOrderStatus))
  }

  if (isUuid(marketFilter)) {
    conditions.push(eq(marketOrders.marketId, marketFilter))
  }

  const db = useDb()
  const now = new Date()

  const rows = await db
    .select({
      order: marketOrders,
      marketTitle: markets.title,
      productStatus: marketProducts.status,
      productCode: marketProducts.code,
      buyerEmail: users.email,
      buyerName: users.name
    })
    .from(marketOrders)
    .innerJoin(markets, eq(marketOrders.marketId, markets.id))
    .innerJoin(marketProducts, eq(marketOrders.productId, marketProducts.id))
    .innerJoin(users, eq(marketOrders.userId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(marketOrders.createdAt))
    .limit(500)

  if (rows.length === 0) {
    return []
  }

  const payments = await db
    .select()
    .from(paymentSubmissions)
    .where(inArray(paymentSubmissions.orderId, rows.map(row => row.order.id)))
    .orderBy(desc(paymentSubmissions.submittedAt))

  const latestByOrder = new Map<string, typeof payments[number]>()
  for (const payment of payments) {
    if (!latestByOrder.has(payment.orderId)) {
      latestByOrder.set(payment.orderId, payment)
    }
  }

  return rows.map((row) => {
    const api = toApiMarketOrder(row.order, row.marketTitle, latestByOrder.get(row.order.id) ?? null)

    return {
      ...api,
      productCode: row.productCode,
      productStatus: row.productStatus,
      buyerEmail: row.buyerEmail,
      buyerName: row.buyerName,
      // 已過繳款期限但狀態還沒被標記：後台要能一眼看到，不等排程
      overdue: row.order.status === 'pending_deposit'
        && row.order.expiresAt !== null
        && row.order.expiresAt < now
    }
  })
})
