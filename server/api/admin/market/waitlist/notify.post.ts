import { and, asc, eq, inArray } from 'drizzle-orm'
import { marketProducts, markets, waitlistEntries } from '../../../../database/schema'

interface NotifyBody {
  productId?: string
  count?: number
  /** 覆寫這次通知的窗口長度（小時）；不給就用活動設定 */
  windowHours?: number
}

const MAX_NOTIFY = 20

/**
 * 通知候補者，並開啟「優先購買窗口」。
 *
 * 這是需求 10 最關鍵的設計取捨：通知不會幫任何人建立訂單、也不會把商品
 * 鎖在第一順位名下。它只是讓這件商品在一段時間內「只接受被通知者下單」。
 * 窗口到期後商品自動回到所有人都能買的狀態，不需要額外排程回收。
 *
 * 只有商品已經回到開放選購才允許通知 —— 否則被通知的人點進來還是買不了，
 * 等於發了一封沒有意義的通知。
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event)
  const body = await readBody<NotifyBody>(event)
  const productId = requireUuid(body?.productId, 'product id')

  const requested = Number(body?.count)
  const count = Number.isFinite(requested) ? Math.min(Math.max(Math.trunc(requested), 1), MAX_NOTIFY) : 1

  const db = useDb()
  const now = new Date()

  const [row] = await db
    .select({ product: marketProducts, market: markets })
    .from(marketProducts)
    .innerJoin(markets, eq(marketProducts.marketId, markets.id))
    .where(eq(marketProducts.id, productId))
    .limit(1)

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Product not found' })
  }

  if (row.product.status !== 'available') {
    throw createError({
      statusCode: 409,
      statusMessage: '這件作品目前不是開放選購，請先取消既有訂單並釋放商品'
    })
  }

  const overrideHours = Number(body?.windowHours)
  const windowHours = Number.isFinite(overrideHours) && overrideHours > 0
    ? Math.trunc(overrideHours)
    : row.market.waitlistWindowHours

  const windowExpiresAt = new Date(now.getTime() + windowHours * 60 * 60 * 1000)

  const queue = await db
    .select()
    .from(waitlistEntries)
    .where(and(
      eq(waitlistEntries.productId, productId),
      eq(waitlistEntries.status, 'waiting')
    ))
    .orderBy(asc(waitlistEntries.createdAt))
    .limit(count)

  if (queue.length === 0) {
    return { success: true, notified: 0, windowExpiresAt: null }
  }

  const ids = queue.map(entry => entry.id)

  await db
    .update(waitlistEntries)
    .set({ status: 'notified', notifiedAt: now, windowExpiresAt, updatedAt: now })
    .where(inArray(waitlistEntries.id, ids))

  await writeAuditLog({
    actorId: admin.id,
    action: 'waitlist.notify',
    entityType: 'product',
    entityId: productId,
    newValue: { notifiedEntryIds: ids, windowHours, windowExpiresAt }
  })

  return {
    success: true,
    notified: ids.length,
    windowHours,
    windowExpiresAt: windowExpiresAt.toISOString()
  }
})
