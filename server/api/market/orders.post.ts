import { and, asc, eq, inArray } from 'drizzle-orm'
import { marketProducts, markets, waitlistEntries } from '../../database/schema'

interface CreateOrderBody {
  productId?: string
}

/**
 * 送出訂單 —— 市集唯一真正會發生競爭的地方。
 *
 * 這支只負責「能不能下單」的判斷（活動期間、候補優先購買窗口）；
 * 真正搶保留權的那段在 reserveProductAndCreateOrder，
 * 因為那條規則必須用真實併發去驗證（見 tests/db/market-orders.spec.ts）。
 */
export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const body = await readBody<CreateOrderBody>(event)
  const productId = requireUuid(body?.productId, 'product id')

  const db = useDb()
  const now = new Date()

  const [row] = await db
    .select({ product: marketProducts, market: markets })
    .from(marketProducts)
    .innerJoin(markets, eq(marketProducts.marketId, markets.id))
    .where(eq(marketProducts.id, productId))
    .limit(1)

  if (!row || !isMarketVisible(row.market)) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  }

  const { product, market } = row

  if (!isMarketPurchasable(market, now)) {
    throw createError({ statusCode: 409, statusMessage: '目前不在活動期間，無法下單' })
  }

  // 候補優先購買窗口：窗口生效時，這件商品只接受被通知者下單
  const queue = await db
    .select()
    .from(waitlistEntries)
    .where(and(
      eq(waitlistEntries.productId, productId),
      inArray(waitlistEntries.status, ['waiting', 'notified'])
    ))
    .orderBy(asc(waitlistEntries.createdAt))

  const window = resolvePriorityWindow(queue, now)

  if (window.active && !window.allowedUserIds.includes(user.id)) {
    throw createError({
      statusCode: 403,
      statusMessage: '這件作品正在候補優先購買時段，暫時只開放給已收到通知的候補者'
    })
  }

  const result = await reserveProductAndCreateOrder(db, {
    userId: user.id,
    market,
    product,
    now
  })

  if (!result.ok) {
    throw createError({ statusCode: 409, statusMessage: '這件作品剛剛已被其他人保留' })
  }

  return {
    success: true,
    order: toApiMarketOrder(result.order, market.title, null)
  }
})
