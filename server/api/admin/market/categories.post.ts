import { marketCategories } from '../../../database/schema'

/** 新增分類（例如「森野」）。 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  const name = normalizeCategoryName(body?.name)
  const description = String(body?.description ?? '').trim().slice(0, 300) || null

  const db = useDb()

  const existing = await db.select({ slug: marketCategories.slug }).from(marketCategories)
  const slug = resolveCategorySlug(body?.slug, name, existing.map(row => row.slug))

  const sortOrder = Number(body?.sortOrder)

  const [created] = await db
    .insert(marketCategories)
    .values({
      name,
      slug,
      description,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : existing.length * 10
    })
    .returning()
    .catch((error) => {
      // 名稱唯一索引：同名分類在送出的瞬間被別人建走了
      if (isUniqueViolation(error)) {
        throw createError({ statusCode: 409, statusMessage: `分類「${name}」已經存在` })
      }

      throw error
    })

  if (!created) {
    throw createError({ statusCode: 500, statusMessage: '建立分類失敗' })
  }

  await writeAuditLog({
    actorId: admin.id,
    action: 'category.create',
    entityType: 'category',
    entityId: created.id,
    newValue: { name: created.name, slug: created.slug }
  })

  return { category: toApiCategory(created, 0) }
})
