import { and, eq } from 'drizzle-orm'
import { marketOrders, markets, paymentSubmissions } from '../../../../database/schema'

interface PaymentBody {
  bankLast5?: string
  paidAmount?: number
  paidAt?: string
  note?: string
}

/**
 * 提交匯款資料（末五碼）。
 *
 * 重要：這裡只把訂單推到「待人工核對」，商品狀態一個字都不動。
 * 使用者自己填的末五碼不是付款證明 —— 必須由管理員比對銀行實際入帳後，
 * 才能走 /api/admin/market/orders/[id]/transition 確認訂金與售出。
 */
export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const orderId = requireUuid(getRouterParam(event, 'id'), 'order id')
  const body = await readBody<PaymentBody>(event)

  const bankLast5 = String(body?.bankLast5 ?? '').trim()

  if (!/^\d{5}$/.test(bankLast5)) {
    throw createError({ statusCode: 400, statusMessage: '請輸入正確的匯款帳號末五碼（5 位數字）' })
  }

  const paidAmount = Number(body?.paidAmount)

  if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
    throw createError({ statusCode: 400, statusMessage: '請輸入正確的匯款金額' })
  }

  const paidAt = body?.paidAt ? new Date(body.paidAt) : new Date()

  if (Number.isNaN(paidAt.getTime())) {
    throw createError({ statusCode: 400, statusMessage: '請輸入正確的匯款日期時間' })
  }

  const note = String(body?.note ?? '').trim().slice(0, 500) || null

  const db = useDb()

  const [row] = await db
    .select({ order: marketOrders, marketTitle: markets.title })
    .from(marketOrders)
    .innerJoin(markets, eq(marketOrders.marketId, markets.id))
    .where(and(eq(marketOrders.id, orderId), eq(marketOrders.userId, user.id)))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  if (!canCustomerSubmitPayment(row.order.status)) {
    throw createError({ statusCode: 409, statusMessage: '這張訂單目前不接受匯款資料' })
  }

  const now = new Date()

  const result = await db.transaction(async (tx) => {
    const [payment] = await tx
      .insert(paymentSubmissions)
      .values({
        orderId: row.order.id,
        bankLast5,
        paidAmountCents: Math.round(paidAmount * 100),
        paidAt,
        note
      })
      .returning()

    const [updated] = await tx
      .update(marketOrders)
      .set({ status: 'payment_submitted', updatedAt: now })
      .where(and(eq(marketOrders.id, row.order.id), eq(marketOrders.userId, user.id)))
      .returning()

    return { payment, updated }
  })

  if (!result.updated || !result.payment) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to submit payment' })
  }

  return {
    success: true,
    order: toApiMarketOrder(result.updated, row.marketTitle, result.payment)
  }
})
