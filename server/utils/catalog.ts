export interface CatalogProduct {
  id: string
  title: string
  unitPriceCents: number
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, '_')
}

function toCents(value: string | undefined) {
  const amount = Number(String(value ?? '').replace(/[^\d.-]/g, ''))

  if (!Number.isFinite(amount) || amount < 0) {
    return null
  }

  return Math.round(amount * 100)
}

/**
 * 商品目前仍以 Google Sheet 為權威來源（DB 化是第二步）。
 * 這裡在 server 端讀取價格，結帳金額一律由 server 重算，不信任 client 傳來的 amount。
 */
export async function getCatalogMap(): Promise<Map<string, CatalogProduct>> {
  const rows = await $fetch<string[][]>('/api/getSheet', {
    query: { range: 'product' }
  })

  const catalog = new Map<string, CatalogProduct>()

  if (!Array.isArray(rows) || rows.length < 2) {
    return catalog
  }

  const headers = (rows[0] ?? []).map(normalizeHeader)
  const idIndex = headers.indexOf('id')
  const titleIndex = headers.indexOf('title')
  const priceIndex = headers.indexOf('price')

  if (idIndex === -1 || priceIndex === -1) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Product sheet is missing required columns'
    })
  }

  for (const row of rows.slice(1)) {
    const id = String(row[idIndex] ?? '').trim()
    const unitPriceCents = toCents(row[priceIndex])

    if (!id || unitPriceCents === null) {
      continue
    }

    catalog.set(id, {
      id,
      title: String(row[titleIndex] ?? '').trim() || id,
      unitPriceCents
    })
  }

  return catalog
}
