import { and, eq } from 'drizzle-orm'
import { marketOrders, shippingRequests } from '../../../database/schema'

/**
 * 客人自己取消寄貨單。
 *
 * 取消時一定要把訂單的 shipping_request_id 清回 NULL，訂單才能重新併進新的一張；
 * 寄貨單本身保留（狀態改成 cancelled），裡面的 items 快照就是這張單唯一的歷史。
 */
export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const requestId = requireUuid(getRouterParam(event, 'id'), 'shipping request id')
  const db = useDb()
  const now = new Date()

  const request = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(shippingRequests)
      .where(and(eq(shippingRequests.id, requestId), eq(shippingRequests.userId, user.id)))
      .limit(1)

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Shipping request not found' })
    }

    if (!canCustomerEditShipping(existing.status)) {
      throw createError({ statusCode: 409, statusMessage: '這張寄貨單已經寄出或取消，無法再更動' })
    }

    await tx
      .update(marketOrders)
      .set({ shippingRequestId: null, updatedAt: now })
      .where(eq(marketOrders.shippingRequestId, existing.id))

    const [cancelled] = await tx
      .update(shippingRequests)
      .set({ status: 'cancelled', updatedAt: now })
      .where(and(eq(shippingRequests.id, existing.id), eq(shippingRequests.status, 'pending')))
      .returning()

    if (!cancelled) {
      throw createError({ statusCode: 409, statusMessage: '這張寄貨單剛剛被更動過，請重新整理' })
    }

    return cancelled
  })

  return { request: toApiShippingRequest(request) }
})
