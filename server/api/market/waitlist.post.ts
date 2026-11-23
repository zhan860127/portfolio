import { and, asc, eq, inArray } from 'drizzle-orm'
import { marketProducts, markets, waitlistEntries } from '../../database/schema'

interface WaitlistBody {
  productId?: string
}

const UNIQUE_VIOLATION = '23505'

/**
 * 加入候補排隊。
 *
 * 排隊不是訂單，也不取得任何保留權 —— 只是在佇列尾端記下時間。
 * 順位一律由 created_at 即時計算，所以這裡不需要鎖，也不會有重編號問題。
 */
export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const body = await readBody<WaitlistBody>(event)
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

  if (!canJoinWaitlist(row.market, row.product, now)) {
    throw createError({ statusCode: 409, statusMessage: '這件作品目前不開放候補' })
  }

  try {
    await db
      .insert(waitlistEntries)
      .values({ userId: user.id, productId, status: 'waiting' })
  } catch (error) {
    // partial unique index：同一人對同一件商品只能有一筆進行中的候補
    if ((error as { code?: string } | null)?.code === UNIQUE_VIOLATION) {
      throw createError({ statusCode: 409, statusMessage: '你已經在這件作品的候補名單中' })
    }

    throw error
  }

  const queue = await db
    .select()
    .from(waitlistEntries)
    .where(and(
      eq(waitlistEntries.productId, productId),
      inArray(waitlistEntries.status, ['waiting', 'notified'])
    ))
    .orderBy(asc(waitlistEntries.createdAt))

  const mine = queue.find(entry => entry.userId === user.id)

  if (!mine) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to join waitlist' })
  }

  return {
    success: true,
    entry: {
      id: mine.id,
      productId,
      status: mine.status,
      position: waitlistPosition(queue, mine.id),
      createdAt: mine.createdAt.toISOString()
    }
  }
})
