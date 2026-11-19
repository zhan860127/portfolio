import { desc, eq, inArray } from 'drizzle-orm'
import { orderItems, orders } from '../database/schema'

const MAX_ORDERS = 100

export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const db = useDb()

  // 只取自己的訂單；不再把整份試算表載進記憶體後才過濾
  const rows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, user.id))
    .orderBy(desc(orders.createdAt))
    .limit(MAX_ORDERS)

  if (rows.length === 0) {
    return []
  }

  const items = await db
    .select()
    .from(orderItems)
    .where(inArray(orderItems.orderId, rows.map(order => order.id)))

  const itemsByOrder = new Map<string, typeof items>()
  for (const item of items) {
    const bucket = itemsByOrder.get(item.orderId) ?? []
    bucket.push(item)
    itemsByOrder.set(item.orderId, bucket)
  }

  return rows.map(order => toApiOrder(order, itemsByOrder.get(order.id) ?? [], user.name, user.email))
})
