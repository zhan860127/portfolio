import { eq } from 'drizzle-orm'
import { marketCategories, marketProducts, markets } from '../../../database/schema'

/** 新增市集商品。價格與訂金一律以「元」輸入，存 DB 時換成整數分。 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  const marketId = requireUuid(body?.marketId, 'market id')
  const name = String(body?.name ?? '').trim()

  if (!name) {
    throw createError({ statusCode: 400, statusMessage: '請輸入作品名稱' })
  }

  const price = Number(body?.price)
  const deposit = Number(body?.deposit)

  if (!Number.isFinite(price) || price < 0) {
    throw createError({ statusCode: 400, statusMessage: '請輸入正確的價格' })
  }

  if (!Number.isFinite(deposit) || deposit < 0 || deposit > price) {
    throw createError({ statusCode: 400, statusMessage: '訂金必須介於 0 與商品價格之間' })
  }

  const db = useDb()

  const [market] = await db
    .select({ id: markets.id })
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1)

  if (!market) {
    throw createError({ statusCode: 404, statusMessage: 'Market not found' })
  }

  // 分類可以不選（NULL = 未分類），但選了就必須真的存在
  let categoryId: string | null = null

  if (body?.categoryId) {
    categoryId = requireUuid(body.categoryId, 'category id')

    const [category] = await db
      .select({ id: marketCategories.id })
      .from(marketCategories)
      .where(eq(marketCategories.id, categoryId))
      .limit(1)

    if (!category) {
      throw createError({ statusCode: 404, statusMessage: '找不到這個分類' })
    }
  }

  const [created] = await db
    .insert(marketProducts)
    .values({
      marketId,
      categoryId,
      code: String(body?.code ?? '').trim() || null,
      name,
      description: String(body?.description ?? '').trim() || null,
      priceCents: Math.round(price * 100),
      depositCents: Math.round(deposit * 100),
      images: normalizeProductImages(body?.images),
      specifications: normalizeSpecifications(body?.specifications),
      story: String(body?.story ?? '').trim() || null,
      purchaseNotes: String(body?.purchaseNotes ?? '').trim() || null,
      sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Number(body?.sortOrder) : 0,
      allowWaitlistWhenSold: typeof body?.allowWaitlistWhenSold === 'boolean'
        ? (body.allowWaitlistWhenSold ? 1 : 0)
        : null
    })
    .returning()

  if (!created) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create product' })
  }

  await writeAuditLog({
    actorId: admin.id,
    action: 'product.create',
    entityType: 'product',
    entityId: created.id,
    newValue: { name: created.name, marketId, categoryId, priceCents: created.priceCents }
  })

  return { success: true, productId: created.id }
})
