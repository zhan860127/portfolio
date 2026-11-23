import { asc, desc, eq, inArray } from 'drizzle-orm'
import { marketProducts, waitlistEntries } from '../../database/schema'
import type { ApiWaitlistEntry } from '../../utils/market'

/** 我的候補排隊。順位要看整個佇列，所以先撈出我所在商品的完整名單再計算。 */
export default defineEventHandler(async (event): Promise<ApiWaitlistEntry[]> => {
  const user = await requireDbUser(event)
  const db = useDb()

  const mine = await db
    .select()
    .from(waitlistEntries)
    .where(eq(waitlistEntries.userId, user.id))
    .orderBy(desc(waitlistEntries.createdAt))

  if (mine.length === 0) {
    return []
  }

  const productIds = [...new Set(mine.map(entry => entry.productId))]

  const [queues, products] = await Promise.all([
    db
      .select()
      .from(waitlistEntries)
      .where(inArray(waitlistEntries.productId, productIds))
      .orderBy(asc(waitlistEntries.createdAt)),
    db
      .select()
      .from(marketProducts)
      .where(inArray(marketProducts.id, productIds))
  ])

  const queueByProduct = new Map<string, typeof queues>()
  for (const entry of queues) {
    const bucket = queueByProduct.get(entry.productId) ?? []
    bucket.push(entry)
    queueByProduct.set(entry.productId, bucket)
  }

  const productById = new Map(products.map(product => [product.id, product]))

  return mine.map((entry) => {
    const product = productById.get(entry.productId)
    const queue = queueByProduct.get(entry.productId) ?? []

    return {
      id: entry.id,
      productId: entry.productId,
      productName: product?.name ?? '',
      productImage: product?.images?.[0]?.src ?? null,
      marketId: product?.marketId ?? '',
      status: entry.status,
      position: waitlistPosition(queue, entry.id),
      notifiedAt: entry.notifiedAt?.toISOString() ?? null,
      windowExpiresAt: entry.windowExpiresAt?.toISOString() ?? null,
      createdAt: entry.createdAt.toISOString()
    }
  })
})
