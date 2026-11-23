import { asc, eq } from 'drizzle-orm'
import { marketProducts, markets } from '../../../database/schema'

/**
 * 單一活動 + 全部商品（含這位使用者的追蹤 / 訂單 / 候補狀態）。
 *
 * 全螢幕瀏覽器一次就把整場商品拿齊，之後左右切換不再打 API ——
 * 需求 14 要求「避免切換商品時重複請求 API」，做法就是在這裡一次給完。
 */
export default defineEventHandler(async (event) => {
  const marketId = requireUuid(getRouterParam(event, 'id'), 'market id')
  const db = useDb()
  const now = new Date()

  const [market] = await db
    .select()
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1)

  if (!market || !isMarketVisible(market)) {
    throw createError({ statusCode: 404, statusMessage: 'Market not found' })
  }

  const products = await db
    .select()
    .from(marketProducts)
    .where(eq(marketProducts.marketId, marketId))
    .orderBy(asc(marketProducts.sortOrder), asc(marketProducts.createdAt))

  const userId = await optionalUserId(event)
  const viewer = await buildViewerContext(products.map(product => product.id), userId, now)

  return {
    market: toApiMarket(market, products.length, now),
    products: products.map(product => toApiMarketProduct(product, market, viewer, now))
  }
})
