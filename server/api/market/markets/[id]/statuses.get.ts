import { asc, eq } from 'drizzle-orm'
import { marketProducts, markets } from '../../../../database/schema'

/**
 * 輕量狀態輪詢端點（需求 14）。
 *
 * 全螢幕瀏覽器進場時一次拿完整資料，之後只輪詢這支：
 * 只回狀態相關欄位，不帶圖片、規格、故事，所以可以用比較短的間隔重新驗證，
 * 而不會每次都把整場商品的 payload 再傳一遍。
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
    marketStatus: resolveMarketStatus(market, now),
    products: products.map((product) => {
      const api = toApiMarketProduct(product, market, viewer, now)

      return {
        id: api.id,
        status: api.status,
        statusLabel: api.statusLabel,
        isFollowing: api.isFollowing,
        myOrderId: api.myOrderId,
        myWaitlistId: api.myWaitlistId,
        waitlistPosition: api.waitlistPosition,
        canPurchase: api.canPurchase,
        canWaitlist: api.canWaitlist,
        priorityWindowActive: api.priorityWindowActive
      }
    })
  }
})
