import { and, asc, eq, inArray } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../database/schema'
import { marketOrders, marketProducts, users, waitlistEntries } from '../database/schema'
import type { Market, MarketOrder, MarketProduct } from '../database/schema'

export type MarketDb = PostgresJsDatabase<typeof schema>

/**
 * db.transaction() 交出來的 tx。型別和 db 不同，但這裡用到的 API 一樣。
 * 收 tx 是為了讓呼叫端可以把「保留商品」和自己的其他寫入綁在同一個 transaction，
 * 中間不會出現對外可見的空檔（見後台的取消並釋放）。
 */
export type MarketTx = Parameters<Parameters<MarketDb['transaction']>[0]>[0]

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
  db: MarketDb | MarketTx,
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

export interface PromotedWaitlistEntry {
  order: MarketOrder
  userId: string
  email: string
}

/**
 * 把作品直接保留給候補第一順位，並建立他的訂單。
 *
 * 抽出來的理由和 reserveProductAndCreateOrder 一樣：這段的正確性
 * （誰排第一、搶輸的時候會怎樣）只有真正的資料庫能驗，而 event handler
 * 需要完整的 event 才叫得動，在整合測試裡打不到。
 *
 * 呼叫端若把自己的 tx 傳進來，整段會和呼叫端的寫入同屬一個 transaction，
 * 商品不會出現對外可見的「開放選購」空檔。
 *
 * 回 null 有兩種情況：沒有人在候補，或商品在這之前就被別人搶走了。
 */
export async function promoteFirstWaitlistEntry(
  db: MarketDb | MarketTx,
  params: {
    market: Pick<Market, 'id' | 'depositDueHours'>
    product: Pick<MarketProduct, 'id' | 'name' | 'priceCents' | 'depositCents' | 'images'>
    now?: Date
  }
): Promise<PromotedWaitlistEntry | null> {
  const now = params.now ?? new Date()

  const [next] = await db
    .select({ entry: waitlistEntries, email: users.email })
    .from(waitlistEntries)
    .innerJoin(users, eq(waitlistEntries.userId, users.id))
    .where(and(
      eq(waitlistEntries.productId, params.product.id),
      eq(waitlistEntries.status, 'waiting')
    ))
    .orderBy(asc(waitlistEntries.createdAt))
    .limit(1)

  if (!next) {
    return null
  }

  // 這支會順便把他的候補紀錄標成 converted
  const reserved = await reserveProductAndCreateOrder(db, {
    userId: next.entry.userId,
    market: params.market,
    product: params.product,
    now
  })

  if (!reserved.ok) {
    return null
  }

  return { order: reserved.order, userId: next.entry.userId, email: next.email }
}
