import { eq, sql } from 'drizzle-orm'
import { marketCategories, marketProducts } from '../../../../database/schema'

/**
 * 刪除分類。
 *
 * 底下的作品不會跟著消失 —— 外鍵是 ON DELETE SET NULL，它們會回到未分類。
 * 回傳受影響的件數，後台才能老實告訴管理員「這會讓 12 件作品變成未分類」。
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event)
  const categoryId = requireUuid(getRouterParam(event, 'id'), 'category id')

  const db = useDb()

  const [existing] = await db
    .select()
    .from(marketCategories)
    .where(eq(marketCategories.id, categoryId))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  const [counted] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(marketProducts)
    .where(eq(marketProducts.categoryId, categoryId))

  await db.delete(marketCategories).where(eq(marketCategories.id, categoryId))

  await writeAuditLog({
    actorId: admin.id,
    action: 'category.delete',
    entityType: 'category',
    entityId: existing.id,
    previousValue: { name: existing.name, slug: existing.slug, productCount: counted?.n ?? 0 }
  })

  return { success: true, uncategorizedNow: counted?.n ?? 0 }
})
