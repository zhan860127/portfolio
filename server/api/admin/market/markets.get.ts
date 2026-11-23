import { asc, count, desc } from 'drizzle-orm'
import { marketProducts, markets } from '../../../database/schema'

/** 後台活動列表：包含草稿，並附上各狀態的商品數量，方便一眼看出銷售進度。 */
export default defineEventHandler(async (event) => {
  await requireAdminUser(event)

  const db = useDb()
  const now = new Date()

  const rows = await db
    .select()
    .from(markets)
    .orderBy(asc(markets.sortOrder), desc(markets.startsAt))

  const counts = await db
    .select({
      marketId: marketProducts.marketId,
      status: marketProducts.status,
      total: count()
    })
    .from(marketProducts)
    .groupBy(marketProducts.marketId, marketProducts.status)

  type Breakdown = Record<'available' | 'reserved' | 'sold', number>

  const breakdown = new Map<string, Breakdown>()
  for (const row of counts) {
    const bucket: Breakdown = breakdown.get(row.marketId) ?? { available: 0, reserved: 0, sold: 0 }
    bucket[row.status] = Number(row.total)
    breakdown.set(row.marketId, bucket)
  }

  return rows.map((market) => {
    const stats = breakdown.get(market.id) ?? { available: 0, reserved: 0, sold: 0 }
    const total = stats.available + stats.reserved + stats.sold

    return {
      ...toApiMarket(market, total, now),
      // 後台要看得到真實的 draft 狀態，不是對外推導出來的狀態
      storedStatus: market.status,
      sortOrder: market.sortOrder,
      allowWaitlistWhenSold: market.allowWaitlistWhenSold === 1,
      stats
    }
  })
})
