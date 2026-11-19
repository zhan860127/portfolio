import { and, eq } from 'drizzle-orm'
import { google } from 'googleapis'
import { orders } from '../../database/schema'
import type { OrderStatus } from '../../database/schema'

interface UpdateStatusBody {
  orderId?: string
  status?: string
  lastFiveDigits?: string
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 狀態同步回 Google Sheet 看板；失敗不影響 DB 的結果。
 * order 分頁欄位：A=ORDERID B=信箱 C=使用者名稱 D=價錢 E=品項 F=時間 G=訂單狀態 H=匯款末五碼
 */
async function mirrorStatusToSheet(sheetRow: number | null, status: OrderStatus, lastFiveDigits: string) {
  const config = useRuntimeConfig()
  const credentialsPath = config.googleCredentialsPath

  if (!sheetRow || !credentialsPath || !config.googleSpreadsheetId) {
    return
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credentialsPath),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })

    const sheets = google.sheets({ version: 'v4', auth })

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.googleSpreadsheetId,
      range: `order!G${sheetRow}:H${sheetRow}`, // G: 訂單狀態, H: 匯款末五碼
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[statusLabel(status), lastFiveDigits]] }
    })
  } catch (error) {
    console.error('[orders/status] failed to mirror status to Google Sheet', error)
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const body = await readBody<UpdateStatusBody>(event)
  const orderId = String(body?.orderId ?? '')

  if (!UUID_PATTERN.test(orderId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid order id' })
  }

  const nextStatus = parseStatusLabel(String(body?.status ?? ''))

  if (!nextStatus) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid status' })
  }

  const lastFiveDigits = String(body?.lastFiveDigits ?? '').trim()

  if (lastFiveDigits && !/^\d{5}$/.test(lastFiveDigits)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid remittance digits' })
  }

  const db = useDb()

  // 關鍵：一定要綁 user_id，否則任何登入者都能改別人的訂單
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.userId, user.id)))
    .limit(1)

  if (!order) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  if (order.status !== nextStatus && !canCustomerTransition(order.status, nextStatus)) {
    throw createError({ statusCode: 409, statusMessage: 'Status transition is not allowed' })
  }

  const [updated] = await db
    .update(orders)
    .set({
      status: nextStatus,
      lastFiveDigits: lastFiveDigits || order.lastFiveDigits,
      updatedAt: new Date()
    })
    .where(and(eq(orders.id, order.id), eq(orders.userId, user.id)))
    .returning()

  await mirrorStatusToSheet(order.sheetRow, nextStatus, updated?.lastFiveDigits ?? '')

  return { success: true, status: statusLabel(nextStatus) }
})
