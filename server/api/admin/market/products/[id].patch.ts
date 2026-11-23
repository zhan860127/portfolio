import { and, eq, ne } from 'drizzle-orm'
import { marketOrders, marketProducts } from '../../../../database/schema'
import type { MarketProductStatus } from '../../../../database/schema'

const PRODUCT_STATUSES: MarketProductStatus[] = ['available', 'reserved', 'sold']

/** 編輯商品。狀態只在「沒有有效訂單」時才允許手動改，否則必須走訂單流程。 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event)
  const productId = requireUuid(getRouterParam(event, 'id'), 'product id')
  const body = await readBody<Record<string, unknown>>(event)

  const db = useDb()

  const [existing] = await db
    .select()
    .from(marketProducts)
    .where(eq(marketProducts.id, productId))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  }

  const patch: Partial<typeof marketProducts.$inferInsert> = { updatedAt: new Date() }

  if (typeof body?.name === 'string' && body.name.trim()) {
    patch.name = body.name.trim()
  }

  if ('code' in (body ?? {})) {
    patch.code = String(body?.code ?? '').trim() || null
  }

  if ('description' in (body ?? {})) {
    patch.description = String(body?.description ?? '').trim() || null
  }

  if ('story' in (body ?? {})) {
    patch.story = String(body?.story ?? '').trim() || null
  }

  if ('purchaseNotes' in (body ?? {})) {
    patch.purchaseNotes = String(body?.purchaseNotes ?? '').trim() || null
  }

  if (Number.isFinite(Number(body?.price))) {
    patch.priceCents = Math.round(Number(body?.price) * 100)
  }

  if (Number.isFinite(Number(body?.deposit))) {
    patch.depositCents = Math.round(Number(body?.deposit) * 100)
  }

  const nextPrice = patch.priceCents ?? existing.priceCents
  const nextDeposit = patch.depositCents ?? existing.depositCents

  if (nextDeposit < 0 || nextDeposit > nextPrice) {
    throw createError({ statusCode: 400, statusMessage: '訂金必須介於 0 與商品價格之間' })
  }

  if ('images' in (body ?? {})) {
    patch.images = normalizeProductImages(body?.images)
  }

  if ('specifications' in (body ?? {})) {
    patch.specifications = normalizeSpecifications(body?.specifications)
  }

  if (Number.isFinite(Number(body?.sortOrder))) {
    patch.sortOrder = Number(body?.sortOrder)
  }

  if ('allowWaitlistWhenSold' in (body ?? {})) {
    patch.allowWaitlistWhenSold = typeof body?.allowWaitlistWhenSold === 'boolean'
      ? (body.allowWaitlistWhenSold ? 1 : 0)
      : null
  }

  if (typeof body?.status === 'string' && PRODUCT_STATUSES.includes(body.status as MarketProductStatus)) {
    const [activeOrder] = await db
      .select({ id: marketOrders.id })
      .from(marketOrders)
      .where(and(eq(marketOrders.productId, productId), ne(marketOrders.status, 'cancelled')))
      .limit(1)

    // 有有效訂單時手改狀態，會讓訂單與商品狀態脫節（例如訂單還在、商品卻開放選購）
    if (activeOrder) {
      throw createError({
        statusCode: 409,
        statusMessage: '這件作品已有有效訂單，請改用訂單管理的「取消訂單並釋放商品」'
      })
    }

    patch.status = body.status as MarketProductStatus
  }

  const [updated] = await db
    .update(marketProducts)
    .set(patch)
    .where(eq(marketProducts.id, productId))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update product' })
  }

  await writeAuditLog({
    actorId: admin.id,
    action: 'product.update',
    entityType: 'product',
    entityId: updated.id,
    previousValue: { name: existing.name, status: existing.status, priceCents: existing.priceCents, depositCents: existing.depositCents },
    newValue: { name: updated.name, status: updated.status, priceCents: updated.priceCents, depositCents: updated.depositCents }
  })

  return { success: true, productId: updated.id }
})
