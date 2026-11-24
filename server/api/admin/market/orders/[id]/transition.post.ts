import { and, eq, inArray } from 'drizzle-orm'
import { marketOrders, marketProducts, markets, waitlistEntries } from '../../../../../database/schema'
import type { AuditAction } from '../../../../../utils/audit'
import type { MarketOrderStatus } from '../../../../../database/schema'

type TransitionAction = 'confirm_deposit' | 'confirm_sold' | 'cancel' | 'mark_expired' | 'revert_payment'

interface TransitionBody {
  action?: string
  note?: string
}

/**
 * 每個動作對應的目標狀態、商品要變成什麼、以及要寫哪一種稽核紀錄。
 * 把它攤成資料表而不是一串 if，是為了讓「哪些轉換存在」一眼看得完。
 */
const ACTIONS: Record<TransitionAction, {
  to: MarketOrderStatus
  /** null 代表不動商品狀態 */
  product: 'available' | 'sold' | null
  audit: AuditAction
}> = {
  // 確認訂金入帳：商品仍然保留中，還沒正式售出
  confirm_deposit: { to: 'deposit_confirmed', product: null, audit: 'order.confirm_deposit' },
  // 確認售出：這一步才讓商品變成已售完
  confirm_sold: { to: 'completed', product: 'sold', audit: 'order.confirm_sold' },
  // 取消訂單並釋放商品：唯一會把商品放回市場的途徑。
  // 有人在候補的話，作品不會停在開放選購，而是直接保留給第一順位（見下方）
  cancel: { to: 'cancelled', product: 'available', audit: 'order.cancel' },
  // 標記逾期：只貼標籤，商品仍保留，由管理員之後決定要不要取消
  mark_expired: { to: 'expired', product: null, audit: 'order.mark_expired' },
  // 末五碼填錯時退回待付訂金，讓買家重填
  revert_payment: { to: 'pending_deposit', product: null, audit: 'order.confirm_deposit' }
}

/**
 * 訂單狀態轉換 —— 後台唯一能改動訂單與商品狀態的入口。
 *
 * 需求 9 的核心：使用者填末五碼只會到 payment_submitted，
 * 一定要管理員在這裡確認銀行入帳，才會往下走。
 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event)
  const orderId = requireUuid(getRouterParam(event, 'id'), 'order id')
  const body = await readBody<TransitionBody>(event)

  const action = String(body?.action ?? '') as TransitionAction
  const config = ACTIONS[action]

  if (!config) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid action' })
  }

  const db = useDb()
  const now = new Date()

  const [existing] = await db
    .select()
    .from(marketOrders)
    .where(eq(marketOrders.id, orderId))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Order not found' })
  }

  if (!canAdminTransition(existing.status, config.to)) {
    throw createError({
      statusCode: 409,
      statusMessage: `無法從「${ORDER_STATUS_LABELS[existing.status]}」轉為「${ORDER_STATUS_LABELS[config.to]}」`
    })
  }

  // 釋放商品時要把作品交給第一順位候補，商品與活動設定先撈出來備用
  const [context] = await db
    .select({ product: marketProducts, market: markets })
    .from(marketProducts)
    .innerJoin(markets, eq(marketProducts.marketId, markets.id))
    .where(eq(marketProducts.id, existing.productId))
    .limit(1)

  const outcome = await db.transaction(async (tx) => {
    const [order] = await tx
      .update(marketOrders)
      .set({
        status: config.to,
        note: typeof body?.note === 'string' ? body.note.trim().slice(0, 500) || existing.note : existing.note,
        updatedAt: now
      })
      // 帶上原狀態，兩個管理員同時按不同按鈕時只有一個會成功
      .where(and(eq(marketOrders.id, orderId), eq(marketOrders.status, existing.status)))
      .returning()

    if (!order) {
      return null
    }

    if (config.product) {
      await tx
        .update(marketProducts)
        .set({ status: config.product, updatedAt: now })
        .where(eq(marketProducts.id, existing.productId))
    }

    // 需求 10.2：商品轉為已售完後，既有候補名單結束
    if (config.product === 'sold') {
      await tx
        .update(waitlistEntries)
        .set({ status: 'expired', updatedAt: now })
        .where(and(
          eq(waitlistEntries.productId, existing.productId),
          inArray(waitlistEntries.status, ['waiting', 'notified'])
        ))
    }

    /**
     * 取消並釋放之後，作品直接保留給第一順位候補，而不是停在「開放選購」
     * 等管理員另外發通知。
     *
     * 會這樣改是因為通知目前沒有實際寄送管道（見 docs 10.1）：優先購買窗口
     * 對收不到通知的人等於不存在，窗口到期後作品就落到剛好在重新整理的人手上。
     *
     * 整段和取消放在同一個 transaction 裡，所以商品不會有對外可見的
     * 「開放選購」瞬間，也就沒有別人搶先下單的空檔。
     */
    if (config.product !== 'available' || !context || !isMarketPurchasable(context.market, now)) {
      return { order, promoted: null }
    }

    return {
      order,
      promoted: await promoteFirstWaitlistEntry(tx, {
        market: context.market,
        product: context.product,
        now
      })
    }
  })

  if (!outcome) {
    throw createError({ statusCode: 409, statusMessage: '訂單狀態剛剛已被其他人變更，請重新整理' })
  }

  const updated = outcome.order

  await writeAuditLog({
    actorId: admin.id,
    action: config.audit,
    entityType: 'order',
    entityId: updated.id,
    previousValue: { status: existing.status },
    newValue: {
      status: updated.status,
      productStatus: outcome.promoted ? 'reserved' : config.product
    }
  })

  if (outcome.promoted) {
    await writeAuditLog({
      actorId: admin.id,
      action: 'waitlist.promote',
      entityType: 'order',
      entityId: outcome.promoted.order.id,
      newValue: {
        productId: existing.productId,
        releasedOrderId: updated.id,
        userId: outcome.promoted.order.userId
      }
    })
  }

  // 釋放商品後，後台要知道還有多少人在等，才能決定要不要發通知
  let waitingCount = 0

  if (config.product === 'available') {
    const queue = await db
      .select({ id: waitlistEntries.id })
      .from(waitlistEntries)
      .where(and(
        eq(waitlistEntries.productId, existing.productId),
        eq(waitlistEntries.status, 'waiting')
      ))

    waitingCount = queue.length
  }

  return {
    success: true,
    status: updated.status,
    statusLabel: ORDER_STATUS_LABELS[updated.status],
    productId: existing.productId,
    waitingCount,
    promoted: outcome.promoted
      ? { orderId: outcome.promoted.order.id, userEmail: outcome.promoted.email }
      : null
  }
})
