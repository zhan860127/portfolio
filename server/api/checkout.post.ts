import type { sheets_v4 } from 'googleapis'

interface CartItem {
  id: string
  title: string
  quantity: number
}

interface StockEntry {
  rowIndex: number
  stock: number
}

async function validateStock(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  items: CartItem[]
): Promise<{ stockMap: Map<string, StockEntry>; quantityColIndex: number }> {
  const productRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: 'product' })

  const rows = productRes.data.values
  if (!rows || rows.length < 2) {
    throw createError({ statusCode: 500, message: 'Product sheet is empty' })
  }

  const headers = rows[0].map((h: string) => h.toLowerCase().replace(' ', '_'))
  const idCol = headers.indexOf('id')
  const qtyCol = headers.indexOf('quantity')

  if (idCol === -1 || qtyCol === -1) {
    throw createError({ statusCode: 500, message: 'Product sheet missing id or quantity column' })
  }

  const stockMap = new Map<string, StockEntry>()
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    stockMap.set(String(row[idCol]), {
      rowIndex: i,
      stock: Number(row[qtyCol]) || 0
    })
  }

  const outOfStock: string[] = []
  for (const item of items) {
    const entry = stockMap.get(String(item.id))
    if (!entry) {
      outOfStock.push(`${item.title}（商品不存在）`)
    } else if (item.quantity > entry.stock) {
      outOfStock.push(`${item.title}（庫存 ${entry.stock}，需求 ${item.quantity}）`)
    }
  }

  if (outOfStock.length > 0) {
    throw createError({ statusCode: 400, message: `庫存不足：${outOfStock.join('、')}` })
  }

  return { stockMap, quantityColIndex: qtyCol }
}

async function deductStock(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  items: CartItem[],
  stockMap: Map<string, StockEntry>,
  quantityColIndex: number
) {
  const colLetter = String.fromCharCode(65 + quantityColIndex)

  const data = items.map((item) => {
    const entry = stockMap.get(String(item.id))!
    const sheetRow = entry.rowIndex + 1
    return {
      range: `product!${colLetter}${sheetRow}`,
      values: [[entry.stock - item.quantity]]
    }
  })

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: 'USER_ENTERED', data }
  })
}

async function createOrder(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  user: { email?: string; name?: string },
  amount: number,
  items: CartItem[]
) {
  const itemsSummary = items.map((i) => `${i.title} *${i.quantity}`).join('\n')
  const orderTime = new Date().toLocaleString('sv-SE', { 
    timeZone: 'Asia/Taipei' 
  }).replace('T', ' ');

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'order',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[
        user?.email ?? 'unknown',
        user?.name ?? 'unknown',
        amount,
        itemsSummary,
        orderTime,
        'Pending Payment'
      ]]
    }
  })
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event) as any
  const { amount, items } = await readBody<{ amount: number; items: CartItem[] }>(event)

  const { sheets, spreadsheetId } = useGoogleSheets()

  const { stockMap, quantityColIndex } = await validateStock(sheets, spreadsheetId, items)

  try {
    await deductStock(sheets, spreadsheetId, items, stockMap, quantityColIndex)
  } catch (error) {
    console.error('Error updating product stock:', error)
    throw createError({ statusCode: 500, message: 'Failed to update stock' })
  }

  try {
    await createOrder(sheets, spreadsheetId, user, amount, items)
  } catch (error) {
    console.error('Error recording order:', error)
    throw createError({ statusCode: 500, message: 'Failed to record order' })
  }

  return { success: true }
})
