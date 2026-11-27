import { eq, inArray } from 'drizzle-orm'
import { marketCategories, marketProducts } from '../../../../database/schema'

/** 一次最多指定 100 件，再多請分批 —— 也避免一個誤送把整場市集改掉。 */
const MAX_PRODUCTS = 100

/**
 * 批次指定分類。
 *
 * 50 件作品逐一點進去改是 50 次往返，實務上改到第 10 件就會放棄，
 * 然後前台出現一個分了一半的篩選器。這個端點就是為了讓那件事不會發生。
 *
 * categoryId 傳 null 代表「拿掉分類」，不是「略過不改」。
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  const rawIds = Array.isArray(body?.productIds) ? body.productIds : []
  const productIds = [...new Set(rawIds.map(id => requireUuid(id, 'product id')))]

  if (productIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '請至少選擇一件作品' })
  }

  if (productIds.length > MAX_PRODUCTS) {
    throw createError({ statusCode: 400, statusMessage: '一次最多指定 100 件，請分批' })
  }

  const db = useDb()

  let categoryId: string | null = null
  let categoryName: string | null = null

  if (body?.categoryId) {
    categoryId = requireUuid(body.categoryId, 'category id')

    const [category] = await db
      .select()
      .from(marketCategories)
      .where(eq(marketCategories.id, categoryId))
      .limit(1)

    if (!category) {
      throw createError({ statusCode: 404, statusMessage: '找不到這個分類' })
    }

    categoryName = category.name
  }

  const updated = await db
    .update(marketProducts)
    .set({ categoryId, updatedAt: new Date() })
    .where(inArray(marketProducts.id, productIds))
    .returning({ id: marketProducts.id })

  await writeAuditLog({
    actorId: admin.id,
    action: 'product.set_category',
    entityType: 'category',
    entityId: categoryId ?? 'uncategorized',
    newValue: { categoryName, productIds: updated.map(row => row.id) }
  })

  return { success: true, updated: updated.length }
})
