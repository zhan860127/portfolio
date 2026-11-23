import { inArray } from 'drizzle-orm'
import { marketProducts, productFollows } from '../../../database/schema'

interface SyncBody {
  productIds?: unknown
}

const MAX_SYNC = 100

/**
 * 把未登入期間暫存在瀏覽器的追蹤，在登入後同步進帳號。
 *
 * 需求 7 要求未登入也能追蹤，所以前台先寫 localStorage；
 * 登入後呼叫這支一次搬過來。只新增不刪除 —— 本機的暫存資料不該有權力
 * 把使用者在別台裝置上追蹤的作品清掉。
 */
export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const body = await readBody<SyncBody>(event)
  const raw = Array.isArray(body?.productIds) ? body.productIds : []

  const productIds = [...new Set(raw.filter(isUuid))].slice(0, MAX_SYNC)

  if (productIds.length === 0) {
    return { success: true, synced: 0 }
  }

  const db = useDb()

  // 只同步真的存在的商品，避免偽造 id 灌進追蹤表
  const existing = await db
    .select({ id: marketProducts.id })
    .from(marketProducts)
    .where(inArray(marketProducts.id, productIds))

  if (existing.length === 0) {
    return { success: true, synced: 0 }
  }

  await db
    .insert(productFollows)
    .values(existing.map(product => ({ userId: user.id, productId: product.id })))
    .onConflictDoNothing()

  return { success: true, synced: existing.length }
})
