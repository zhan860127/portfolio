import { and, eq } from 'drizzle-orm'
import { marketOrders, shippingRequests } from '../../../../../database/schema'
import type { ShippingStatus } from '../../../../../database/schema'

type Action = 'mark_shipped' | 'cancel'

const ACTIONS: Record<Action, { status: ShippingStatus, audit: 'shipping.mark_shipped' | 'shipping.cancel' }> = {
  mark_shipped: { status: 'shipped', audit: 'shipping.mark_shipped' },
  cancel: { status: 'cancelled', audit: 'shipping.cancel' }
}

/**
 * 後台處理寄貨單：標記已寄出、或取消。
 *
 * 刻意不在這裡順手把訂單改成「已完成」——「包裹寄出」與「這筆交易結案」
 * 是兩個不同的人工確認時點，跟訂金／售出分兩步是同一個理由。
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event)
  const requestId = requireUuid(getRouterParam(event, 'id'), 'shipping request id')
  const body = await readBody<{ action?: string }>(event)
  const action = String(body?.action ?? '') as Action

  if (!(action in ACTIONS)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
  }

  const config = ACTIONS[action]
  const db = useDb()
  const now = new Date()

  const result = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(shippingRequests)
      .where(eq(shippingRequests.id, requestId))
      .limit(1)

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Shipping request not found' })
    }

    if (!canAdminTransitionShipping(existing.status, config.status)) {
      throw createError({
        statusCode: 409,
        statusMessage: '這張寄貨單目前是「' + SHIPPING_STATUS_LABELS[existing.status] + '」，不能執行這個動作'
      })
    }

    // 取消時把訂單放回去，客人才能重新併單；已寄出則維持連結
    if (config.status === 'cancelled') {
      await tx
        .update(marketOrders)
        .set({ shippingRequestId: null, updatedAt: now })
        .where(eq(marketOrders.shippingRequestId, existing.id))
    }

    const [updated] = await tx
      .update(shippingRequests)
      .set({
        status: config.status,
        shippedAt: config.status === 'shipped' ? now : existing.shippedAt,
        updatedAt: now
      })
      .where(and(eq(shippingRequests.id, existing.id), eq(shippingRequests.status, existing.status)))
      .returning()

    if (!updated) {
      throw createError({ statusCode: 409, statusMessage: '這張寄貨單剛剛被其他人更動過，請重新整理' })
    }

    return { previous: existing, updated }
  })

  await writeAuditLog({
    actorId: admin.id,
    action: config.audit,
    entityType: 'shipping',
    entityId: result.updated.id,
    previousValue: { status: result.previous.status },
    newValue: { status: result.updated.status }
  })

  return { request: toApiShippingRequest(result.updated) }
})
