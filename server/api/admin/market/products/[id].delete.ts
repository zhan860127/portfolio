import { and, eq, ne } from 'drizzle-orm'
import { marketOrders, marketProducts } from '../../../../database/schema'

/**
 * 刪除商品。
 * 已經有訂單的商品一律不給刪 —— 訂單的外鍵是 restrict，硬刪會整個爆掉，
 * 而且也不該讓已成立的交易憑空消失。要下架請把活動設回草稿或改商品狀態。
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event)
  const productId = requireUuid(getRouterParam(event, 'id'), 'product id')

  const db = useDb()

  const [existing] = await db
    .select()
    .from(marketProducts)
    .where(eq(marketProducts.id, productId))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  }

  const [anyOrder] = await db
    .select({ id: marketOrders.id })
    .from(marketOrders)
    .where(and(eq(marketOrders.productId, productId), ne(marketOrders.status, 'cancelled')))
    .limit(1)

  if (anyOrder) {
    throw createError({ statusCode: 409, statusMessage: '這件作品已有訂單紀錄，無法刪除' })
  }

  await db.delete(marketProducts).where(eq(marketProducts.id, productId))

  await writeAuditLog({
    actorId: admin.id,
    action: 'product.delete',
    entityType: 'product',
    entityId: productId,
    previousValue: { name: existing.name, marketId: existing.marketId }
  })

  return { success: true }
})
