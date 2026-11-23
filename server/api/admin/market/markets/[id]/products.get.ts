import { and, asc, count, eq, inArray, ne } from 'drizzle-orm'
import { marketOrders, marketProducts, markets, waitlistEntries } from '../../../../../database/schema'

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

  if (products.length === 0) {
    return { market: toApiMarket(market, 0), products: [] }
  }

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
    products: products.map((product) => {
      const order = orderByProduct.get(product.id)

      return {
        id: product.id,
        code: product.code,
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
