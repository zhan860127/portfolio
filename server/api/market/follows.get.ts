import { desc, eq } from 'drizzle-orm'
import { marketProducts, markets, productFollows } from '../../database/schema'

/** 我的追蹤。個人頁要能和「我訂購的」「我排隊的」清楚區分，所以各自有獨立端點。 */
export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const db = useDb()

  const rows = await db
    .select({
      followId: productFollows.id,
      createdAt: productFollows.createdAt,
      product: marketProducts,
      marketTitle: markets.title,
      marketId: markets.id
    })
    .from(productFollows)
    .innerJoin(marketProducts, eq(productFollows.productId, marketProducts.id))
    .innerJoin(markets, eq(marketProducts.marketId, markets.id))
    .where(eq(productFollows.userId, user.id))
    .orderBy(desc(productFollows.createdAt))

  return rows.map(row => ({
    id: row.followId,
    productId: row.product.id,
    productName: row.product.name,
    productImage: row.product.images?.[0]?.src ?? null,
    price: row.product.priceCents / 100,
    status: row.product.status,
    statusLabel: PRODUCT_STATUS_LABELS[row.product.status],
    marketId: row.marketId,
    marketTitle: row.marketTitle,
    createdAt: row.createdAt.toISOString()
  }))
})
