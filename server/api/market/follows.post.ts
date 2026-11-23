import { and, eq } from 'drizzle-orm'
import { marketProducts, productFollows } from '../../database/schema'

interface FollowBody {
  productId?: string
  following?: boolean
}

/**
 * 追蹤 / 取消追蹤。
 *
 * 追蹤純粹是書籤：不碰商品狀態、不建立訂單、不影響任何購買順位。
 * 已售完的作品也允許追蹤（需求 8.4），因為之後可能有二次釋出要通知。
 */
export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const body = await readBody<FollowBody>(event)
  const productId = requireUuid(body?.productId, 'product id')

  const db = useDb()

  const [product] = await db
    .select({ id: marketProducts.id })
    .from(marketProducts)
    .where(eq(marketProducts.id, productId))
    .limit(1)

  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  }

  const [existing] = await db
    .select({ id: productFollows.id })
    .from(productFollows)
    .where(and(eq(productFollows.userId, user.id), eq(productFollows.productId, productId)))
    .limit(1)

  // 沒指定就是切換；指定了就以指定值為準（登入後同步會明確帶 true）
  const shouldFollow = typeof body?.following === 'boolean' ? body.following : !existing

  if (shouldFollow && !existing) {
    await db
      .insert(productFollows)
      .values({ userId: user.id, productId })
      // 連點兩下或多分頁同時送出時，唯一鍵會擋下第二筆，這裡直接忽略
      .onConflictDoNothing()
  }

  if (!shouldFollow && existing) {
    await db
      .delete(productFollows)
      .where(and(eq(productFollows.userId, user.id), eq(productFollows.productId, productId)))
  }

  return { success: true, productId, following: shouldFollow }
})
