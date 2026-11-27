import { and, asc, count, eq, inArray, ne } from 'drizzle-orm'
import { marketCategories, marketOrders, marketProducts, markets, waitlistEntries } from '../../../../../database/schema'

/**
 * 後台的商品列表。
 * 與前台端點分開，因為後台看得到草稿活動，而且需要候補人數與訂單 id 才能操作。
 */
export default defineEventHandler(async (event) => {
  await requireAdminUser(event)

  const marketId = requireUuid(getRouterParam(event, 'id'), 'market id')
  const db = useDb()

  const [market] = await db
    .select()
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1)

  if (!market) {
    throw createError({ statusCode: 404, statusMessage: 'Market not found' })
  }

  const products = await db
    .select()
    .from(marketProducts)
    .where(eq(marketProducts.marketId, marketId))
    .orderBy(asc(marketProducts.sortOrder), asc(marketProducts.createdAt))

  // 分類清單與商品一起回傳，後台的下拉與批次指定才不用再打一次 API
  const categories = await db
    .select()
    .from(marketCategories)
    .orderBy(asc(marketCategories.sortOrder), asc(marketCategories.name))

  if (products.length === 0) {
    return {
      market: toApiMarket(market, 0),
      products: [],
      categories: categories.map(category => toApiCategory(category)),
      nextNames: Object.fromEntries(categories.map(category => [
        category.id,
        nextProductName(category.name, [])
      ]))
    }
  }

  const categoryById = new Map(categories.map(category => [category.id, category]))

  /**
   * 每個分類「下一件該叫什麼」，例如森野 01、森野 02 之後給森野 03。
   *
   * 刻意跨活動統計：上一場做過森野 01、02，這一場的新作品應該接著 03，
   * 而不是從 01 重來。只是後台新增時的預填值，管理員可以直接改掉。
   */
  const namesByCategory = new Map<string, string[]>()

  if (categories.length > 0) {
    const named = await db
      .select({ categoryId: marketProducts.categoryId, name: marketProducts.name })
      .from(marketProducts)
      .where(inArray(marketProducts.categoryId, categories.map(category => category.id)))

    for (const row of named) {
      if (!row.categoryId) {
        continue
      }

      const bucket = namesByCategory.get(row.categoryId) ?? []
      bucket.push(row.name)
      namesByCategory.set(row.categoryId, bucket)
    }
  }

  const nextNames = Object.fromEntries(categories.map(category => [
    category.id,
    nextProductName(category.name, namesByCategory.get(category.id) ?? [])
  ]))

  const productIds = products.map(product => product.id)

  const [waitingCounts, activeOrders] = await Promise.all([
    db
      .select({ productId: waitlistEntries.productId, total: count() })
      .from(waitlistEntries)
      .where(and(
        inArray(waitlistEntries.productId, productIds),
        eq(waitlistEntries.status, 'waiting')
      ))
      .groupBy(waitlistEntries.productId),
    db
      .select({ productId: marketOrders.productId, orderId: marketOrders.id, status: marketOrders.status })
      .from(marketOrders)
      .where(and(
        inArray(marketOrders.productId, productIds),
        ne(marketOrders.status, 'cancelled')
      ))
  ])

  const waitingByProduct = new Map(waitingCounts.map(row => [row.productId, Number(row.total)]))
  const orderByProduct = new Map(activeOrders.map(row => [row.productId, row]))

  return {
    market: toApiMarket(market, products.length),
    nextNames,
    categories: categories.map(category => toApiCategory(
      category,
      products.filter(product => product.categoryId === category.id).length
    )),
    products: products.map((product) => {
      const order = orderByProduct.get(product.id)

      return {
        id: product.id,
        code: product.code,
        categoryId: product.categoryId,
        category: toApiProductCategory(product.categoryId ? categoryById.get(product.categoryId) : null),
        name: product.name,
        description: product.description,
        price: product.priceCents / 100,
        deposit: product.depositCents / 100,
        images: product.images ?? [],
        specifications: product.specifications ?? {},
        story: product.story,
        purchaseNotes: product.purchaseNotes,
        status: product.status,
        statusLabel: PRODUCT_STATUS_LABELS[product.status],
        sortOrder: product.sortOrder,
        allowWaitlistWhenSold: product.allowWaitlistWhenSold,
        waitingCount: waitingByProduct.get(product.id) ?? 0,
        activeOrderId: order?.orderId ?? null,
        activeOrderStatus: order?.status ?? null
      }
    })
  }
})
