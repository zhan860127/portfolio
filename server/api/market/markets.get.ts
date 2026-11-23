import { asc, count, desc, ne } from 'drizzle-orm'
import { marketProducts, markets } from '../../database/schema'

/**
 * 活動列表。草稿活動永遠不出現在這裡。
 * 商品數量用一次 group by 取得，不逐場查。
 */
export default defineEventHandler(async () => {
  const db = useDb()
  const now = new Date()

  const rows = await db
    .select()
    .from(markets)
    .where(ne(markets.status, 'draft'))
    .orderBy(asc(markets.sortOrder), desc(markets.startsAt))

  if (rows.length === 0) {
    return []
  }

  const counts = await db
    .select({ marketId: marketProducts.marketId, total: count() })
    .from(marketProducts)
    .groupBy(marketProducts.marketId)

  const countByMarket = new Map(counts.map(row => [row.marketId, Number(row.total)]))

  return rows.map(market => toApiMarket(market, countByMarket.get(market.id) ?? 0, now))
})
