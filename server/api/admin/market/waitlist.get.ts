import { asc, eq } from 'drizzle-orm'
import { marketProducts, users, waitlistEntries } from '../../../database/schema'

/** 某件商品的候補名單，依加入時間排序（順位就是這個順序）。 */
export default defineEventHandler(async (event) => {
  await requireAdminUser(event)

  const productId = requireUuid(getQuery(event).productId, 'product id')
  const db = useDb()
  const now = new Date()

  const [product] = await db
    .select()
    .from(marketProducts)
    .where(eq(marketProducts.id, productId))
    .limit(1)

  if (!product) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  }

  const rows = await db
    .select({ entry: waitlistEntries, email: users.email, name: users.name })
    .from(waitlistEntries)
    .innerJoin(users, eq(waitlistEntries.userId, users.id))
    .where(eq(waitlistEntries.productId, productId))
    .orderBy(asc(waitlistEntries.createdAt))

  const active = rows.filter(row => row.entry.status === 'waiting' || row.entry.status === 'notified')

  return {
    product: {
      id: product.id,
      name: product.name,
      status: product.status,
      statusLabel: PRODUCT_STATUS_LABELS[product.status]
    },
    entries: rows.map(row => ({
      id: row.entry.id,
      userEmail: row.email,
      userName: row.name,
      status: row.entry.status,
      position: active.findIndex(item => item.entry.id === row.entry.id) + 1 || null,
      notifiedAt: row.entry.notifiedAt?.toISOString() ?? null,
      windowExpiresAt: row.entry.windowExpiresAt?.toISOString() ?? null,
      // 窗口是否還有效，直接算給後台看，免得管理員自己換算時區
      windowActive: row.entry.status === 'notified'
        && row.entry.windowExpiresAt !== null
        && row.entry.windowExpiresAt > now,
      createdAt: row.entry.createdAt.toISOString()
    }))
  }
})
