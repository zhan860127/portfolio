import { asc, eq, sql } from 'drizzle-orm'
import { marketCategories, marketProducts } from '../../../database/schema'

/**
 * 後台分類列表。
 *
 * 一定要帶件數：沒有件數就看不出哪些分類是空的、哪一個該合併，
 * 整理 50 件作品的時候那是唯一的進度指標。
 */
export default defineEventHandler(async (event) => {
  await requireAdminUser(event)

  const db = useDb()

  const rows = await db
    .select({
      category: marketCategories,
      productCount: sql<number>`count(${marketProducts.id})::int`
    })
    .from(marketCategories)
    .leftJoin(marketProducts, eq(marketProducts.categoryId, marketCategories.id))
    .groupBy(marketCategories.id)
    .orderBy(asc(marketCategories.sortOrder), asc(marketCategories.name))

  const [uncategorized] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(marketProducts)
    .where(sql`${marketProducts.categoryId} is null`)

  return {
    categories: rows.map(row => toApiCategory(row.category, row.productCount)),
    // 未分類的件數歸零才算整理完，所以它跟分類一起回傳
    uncategorizedCount: uncategorized?.n ?? 0
  }
})
