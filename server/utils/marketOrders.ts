import { and, eq, inArray } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../database/schema'
import { marketOrders, marketProducts, waitlistEntries } from '../database/schema'
import type { Market, MarketOrder, MarketProduct } from '../database/schema'

export type MarketDb = PostgresJsDatabase<typeof schema>

/** Postgres 唯一鍵衝突 */
const UNIQUE_VIOLATION = '23505'

export function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === UNIQUE_VIOLATION
}

export type ReserveResult
  = | { ok: true, order: MarketOrder }
    | { ok: false, reason: 'taken' }

/**
 * 取得商品保留權並建立訂單 —— 市集唯一會發生競爭的動作。
 *
 * 抽出成獨立函式（而不是留在 event handler 裡）有個實際理由：
 * 「同一件商品只能有一筆有效訂單」這條規則必須用真正的併發去驗證，
 * 而 h3 handler 需要完整的 event 才能呼叫，在整合測試裡很難直接打。
 *
 * 保護分兩層，都由資料庫負責：
 *   1. 條件式 UPDATE（WHERE status = 'available'）—— 搶輸的人拿到 0 rows，
 *      而且這個 UPDATE 會在 transaction 結束前鎖住該列，併發請求自然排隊。
 *   2. market_orders 上的 partial unique index —— 就算有人繞過這個函式
 *      直接 insert，第二筆仍然進不來。
 */
export async function reserveProductAndCreateOrder(
  db: MarketDb,
  params: {
    userId: string
    market: Pick<Market, 'id' | 'depositDueHours'>
    product: Pick<MarketProduct, 'id' | 'name' | 'priceCents' | 'depositCents' | 'images'>
    now?: Date
  }
): Promise<ReserveResult> {
  const now = params.now ?? new Date()

  try {
    const order = await db.transaction(async (tx) => {
      const reserved = await tx
        .update(marketProducts)
        .set({ status: 'reserved', updatedAt: now })
        .where(and(
          eq(marketProducts.id, params.product.id),
          eq(marketProducts.status, 'available')
        ))
        .returning()

      if (reserved.length === 0) {
        return null
      }

      const [created] = await tx
        .insert(marketOrders)
        .values({
          userId: params.userId,
          marketId: params.market.id,
          productId: params.product.id,
          amountCents: params.product.priceCents,
          depositCents: params.product.depositCents,
          productNameSnapshot: params.product.name,
          productImageSnapshot: params.product.images?.[0]?.src ?? null,
          status: 'pending_deposit',
          expiresAt: new Date(now.getTime() + params.market.depositDueHours * 60 * 60 * 1000)
        })
        .returning()

      if (!created) {
        throw new Error('Failed to create order')
      }

      // 下單者原本就在候補名單裡（通常就是被通知的那位）：標記為已轉單
      await tx
        .update(waitlistEntries)
        .set({ status: 'converted', updatedAt: now })
        .where(and(
          eq(waitlistEntries.productId, params.product.id),
          eq(waitlistEntries.userId, params.userId),
          inArray(waitlistEntries.status, ['waiting', 'notified'])
        ))

      return created
    })

    if (!order) {
      return { ok: false, reason: 'taken' }
    }

    return { ok: true, order }
  } catch (error) {
    // 唯一索引擋下來的情況，對呼叫端而言與搶輸相同
    if (isUniqueViolation(error)) {
      return { ok: false, reason: 'taken' }
    }

    throw error
  }
}
