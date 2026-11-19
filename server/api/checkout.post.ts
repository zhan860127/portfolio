import { eq } from 'drizzle-orm'
import { google } from 'googleapis'
import { orderItems, orders } from '../database/schema'

const MAX_QUANTITY_PER_ITEM = 99

interface CheckoutItemInput {
  id?: string
  quantity?: number
}

/**
 * 把訂單同步一份到 Google Sheet 的 order 分頁，讓營運維持原本的看板。
 * DB 才是權威來源，因此這裡失敗只記錄、不讓結帳失敗。
 * 回傳寫入的列號，供之後同步狀態使用。
 *
 * order 分頁欄位：A=ORDERID B=信箱 C=使用者名稱 D=價錢 E=品項 F=時間 G=訂單狀態 H=匯款末五碼
 * append 會依既有資料表從 B 欄開始寫，因此這裡只送 B~H 七欄，
 * 再以一次 update 把訂單 id 補進 A 欄（原本長期空白），讓看板能與 DB 對帳。
 */
async function mirrorToSheet(orderId: string, values: (string | number)[]): Promise<number | null> {
  const config = useRuntimeConfig()
  const credentialsPath = config.googleCredentialsPath

  if (!credentialsPath || !config.googleSpreadsheetId) {
    return null
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(credentialsPath),
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: config.googleSpreadsheetId,
      range: 'order!B:H',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] }
    })

    // updatedRange 形如 order!B14:H14，取出列號
    const updatedRange = response.data.updates?.updatedRange ?? ''
    const row = Number(updatedRange.match(/![A-Z]+(\d+)/)?.[1])

    if (!Number.isInteger(row)) {
      return null
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: config.googleSpreadsheetId,
      range: `order!A${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[orderId]] }
    })

    return row
  } catch (error) {
    console.error('[checkout] failed to mirror order to Google Sheet', error)

    return null
  }
}

export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const body = await readBody<{ items?: CheckoutItemInput[] }>(event)
  const rawItems = Array.isArray(body?.items) ? body.items : []

  if (rawItems.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Cart is empty' })
  }

  // 價格一律由 server 依商品來源重算，body 傳來的 amount / price 一概不採用
  const catalog = await getCatalogMap()

  const lineItems = rawItems.map((item) => {
    const productId = String(item?.id ?? '').trim()
    const quantity = Number(item?.quantity)
    const product = catalog.get(productId)

    if (!product) {
      throw createError({ statusCode: 400, statusMessage: `Unknown product: ${productId || 'unknown'}` })
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
      throw createError({ statusCode: 400, statusMessage: `Invalid quantity for product: ${productId}` })
    }

    return {
      productId: product.id,
      titleSnapshot: product.title,
      unitPriceCents: product.unitPriceCents,
      quantity
    }
  })

  const subtotalCents = lineItems.reduce((total, item) => total + item.unitPriceCents * item.quantity, 0)
  const shippingCents = 0
  const totalCents = subtotalCents + shippingCents

  const db = useDb()
  const order = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(orders)
      .values({
        userId: user.id,
        subtotalCents,
        shippingCents,
        totalCents
      })
      .returning()

    if (!created) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to create order' })
    }

    await tx.insert(orderItems).values(
      lineItems.map(item => ({ ...item, orderId: created.id }))
    )

    return created
  })

  const sheetRow = await mirrorToSheet(order.id, [
    user.email,
    user.name ?? '',
    totalCents / 100,
    formatItemsSummary(lineItems),
    formatOrderTime(order.createdAt),
    statusLabel(order.status),
    ''
  ])

  if (sheetRow) {
    await db.update(orders).set({ sheetRow }).where(eq(orders.id, order.id))
  }

  return { success: true, orderId: order.id }
})
