import { and, eq, ne } from 'drizzle-orm'
import { marketCategories } from '../../../../database/schema'

/** 修改分類：改名、改代稱、改排序。 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event)
  const categoryId = requireUuid(getRouterParam(event, 'id'), 'category id')
  const body = await readBody<Record<string, unknown>>(event)

  const db = useDb()

  const [existing] = await db
    .select()
    .from(marketCategories)
    .where(eq(marketCategories.id, categoryId))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Category not found' })
  }

  const name = body?.name === undefined ? existing.name : normalizeCategoryName(body.name)

  let slug = existing.slug

  if (body?.slug !== undefined && String(body.slug).trim().toLowerCase() !== existing.slug) {
    const others = await db
      .select({ slug: marketCategories.slug })
      .from(marketCategories)
      .where(ne(marketCategories.id, categoryId))

    slug = resolveCategorySlug(body.slug, name, others.map(row => row.slug))
  }

  const description = body?.description === undefined
    ? existing.description
    : (String(body.description ?? '').trim().slice(0, 300) || null)

  const sortOrder = Number(body?.sortOrder)

  const [updated] = await db
    .update(marketCategories)
    .set({
      name,
      slug,
      description,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : existing.sortOrder,
      updatedAt: new Date()
    })
    .where(and(eq(marketCategories.id, categoryId)))
    .returning()
    .catch((error) => {
      if (isUniqueViolation(error)) {
        throw createError({ statusCode: 409, statusMessage: `分類「${name}」已經存在` })
      }

      throw error
    })

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: '更新分類失敗' })
  }

  await writeAuditLog({
    actorId: admin.id,
    action: 'category.update',
    entityType: 'category',
    entityId: updated.id,
    previousValue: { name: existing.name, slug: existing.slug, sortOrder: existing.sortOrder },
    newValue: { name: updated.name, slug: updated.slug, sortOrder: updated.sortOrder }
  })

  return { category: toApiCategory(updated) }
})
