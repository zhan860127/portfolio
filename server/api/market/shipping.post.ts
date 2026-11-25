import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm'
import { marketOrders, shippingRequests } from '../../database/schema'

/** 一個包裹塞 20 件已經很多了；更多筆請分成兩張單。 */
const MAX_ITEMS = 20

/**
 * 送出或修改寄貨單。
 *
 * 刻意做成 upsert 而不是分成 POST／PATCH 兩個端點：客人同時只能有一張待出貨的
 * 寄貨單（DB 的 partial unique index 保證），所以「送出」與「改地址」在客人眼裡
 * 是同一個動作 —— 分成兩個端點只會讓前端得先判斷現在算新增還是修改。
 */
export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const body = await readBody<Record<string, unknown>>(event)

  const recipient = normalizeRecipient(body)

  const rawIds = Array.isArray(body?.orderIds) ? body.orderIds : []
  const orderIds = [...new Set(rawIds.map(id => requireUuid(id, 'order id')))]

  if (orderIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '請至少選擇一筆要寄送的訂單' })
  }

  if (orderIds.length > MAX_ITEMS) {
    throw createError({ statusCode: 400, statusMessage: '一張寄貨單最多 20 筆訂單，請分成兩張' })
  }

  const db = useDb()
  const now = new Date()

  const request = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(shippingRequests)
      .where(and(eq(shippingRequests.userId, user.id), eq(shippingRequests.status, 'pending')))
      .limit(1)

    const orders = await tx
      .select()
      .from(marketOrders)
      .where(and(eq(marketOrders.userId, user.id), inArray(marketOrders.id, orderIds)))

    if (orders.length !== orderIds.length) {
      throw createError({ statusCode: 404, statusMessage: '有訂單找不到，請重新整理後再試' })
    }

    for (const order of orders) {
      if (!SHIPPABLE_ORDER_STATUSES.includes(order.status)) {
        throw createError({
          statusCode: 409,
          statusMessage: '「' + order.productNameSnapshot + '」要等訂金確認之後才能安排寄送'
        })
      }

      if (order.shippingRequestId !== null && order.shippingRequestId !== existing?.id) {
        throw createError({
          statusCode: 409,
          statusMessage: '「' + order.productNameSnapshot + '」已經在另一張寄貨單上了'
        })
      }
    }

    const summary = summarizeShipment(orders)

    const values = {
      ...recipient,
      itemTotalCents: summary.itemTotalCents,
      depositPaidCents: summary.depositPaidCents,
      shippingCents: summary.shippingCents,
      codCents: summary.codCents,
      items: summary.items,
      updatedAt: now
    }

    let saved: typeof shippingRequests.$inferSelect | undefined

    if (existing) {
      const [updated] = await tx
        .update(shippingRequests)
        .set(values)
        .where(and(eq(shippingRequests.id, existing.id), eq(shippingRequests.status, 'pending')))
        .returning()

      saved = updated

      // 這張單原本收走、但這次沒再勾選的訂單要放回去，否則它們會永遠卡著
      await tx
        .update(marketOrders)
        .set({ shippingRequestId: null, updatedAt: now })
        .where(and(
          eq(marketOrders.shippingRequestId, existing.id),
          notInArray(marketOrders.id, orderIds)
        ))
    } else {
      const [created] = await tx
        .insert(shippingRequests)
        .values({ userId: user.id, ...values })
        .returning()

      saved = created
    }

    if (!saved) {
      throw createError({ statusCode: 500, statusMessage: '寄貨單儲存失敗' })
    }

    /**
     * 條件式 UPDATE：只掛上「目前還沒被任何寄貨單收走」的訂單。
     * 跟下單搶保留權同一招 —— 併發時搶輸的那邊 affected rows 會少，
     * 下面就會對不起來而整筆 rollback，不會出現兩張單寄同一件作品。
     */
    const linked = await tx
      .update(marketOrders)
      .set({ shippingRequestId: saved.id, updatedAt: now })
      .where(and(
        eq(marketOrders.userId, user.id),
        inArray(marketOrders.id, orderIds),
        isNull(marketOrders.shippingRequestId)
      ))
      .returning({ id: marketOrders.id })

    // 已經掛在這張單上的訂單不會被上面那段更新到，要分開算才對得起來
    const alreadyLinked = orders.filter(order => order.shippingRequestId === saved?.id).length

    if (linked.length + alreadyLinked !== orderIds.length) {
      throw createError({ statusCode: 409, statusMessage: '有訂單剛剛被併進其他寄貨單，請重新整理後再試' })
    }

    return saved
  })

  return { request: toApiShippingRequest(request) }
})
