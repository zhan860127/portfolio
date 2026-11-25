import { desc, eq } from 'drizzle-orm'
import { shippingRequests, users } from '../../../database/schema'
import type { ShippingStatus } from '../../../database/schema'

const SHIPPING_STATUSES: ShippingStatus[] = ['pending', 'shipped', 'cancelled']

/**
 * 後台寄貨單列表。
 *
 * 預設只看「待出貨」—— 後台打開這一頁的目的就是「現在有哪幾張要寄」，
 * 把已寄出的混在一起只會讓人每次都要先篩選一次。
 */
export default defineEventHandler(async (event) => {
  await requireAdminUser(event)

  const query = getQuery(event)
  const raw = String(query.status ?? 'pending').trim()
  const statusFilter = SHIPPING_STATUSES.includes(raw as ShippingStatus)
    ? (raw as ShippingStatus)
    : null

  const db = useDb()

  const rows = await db
    .select({
      request: shippingRequests,
      buyerEmail: users.email,
      buyerName: users.name
    })
    .from(shippingRequests)
    .innerJoin(users, eq(shippingRequests.userId, users.id))
    .where(statusFilter ? eq(shippingRequests.status, statusFilter) : undefined)
    .orderBy(desc(shippingRequests.createdAt))
    .limit(500)

  return rows.map(row => ({
    ...toApiShippingRequest(row.request),
    buyerEmail: row.buyerEmail,
    buyerName: row.buyerName,
    itemCount: (row.request.items ?? []).length
  }))
})
