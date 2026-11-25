// 與 market.ts 同樣的理由：單元測試在純 Node 環境直接 import，沒有 Nitro 的 auto-import。
import { createError } from 'h3'
import type { MarketOrder, MarketOrderStatus, ShippingItemSnapshot, ShippingRequest, ShippingStatus } from '../database/schema'

/**
 * 寄貨單的純邏輯層。
 *
 * 金額怎麼算、哪些訂單可以併單、收件資訊怎麼驗 —— 全部放在這裡而不是 handler 裡，
 * 因為「客人看到的貨到付款金額」算錯是最難被發現也最難善後的那種錯，
 * 必須能被測試直接覆蓋。
 */

/**
 * 運費固定 80 元（以「分」為單位，與全站金額一致）。
 *
 * 一張寄貨單收一次，不是每件作品各收一次 —— 一張寄貨單就是一個包裹。
 * 這個數字是伺服器端的唯一事實來源：前端只顯示 API 回傳的值，
 * 不自己寫死 80，否則哪天調整運費會變成兩邊不一致。
 */
export const SHIPPING_FEE_CENTS = 80 * 100

/**
 * 可以併進寄貨單的訂單狀態。
 *
 * `deposit_confirmed` 是正常情況；`completed` 也收，是因為後台的「確認售出」
 * 可能先按了 —— 你的帳務動作不該讓客人填不了寄貨單。
 */
export const SHIPPABLE_ORDER_STATUSES: MarketOrderStatus[] = ['deposit_confirmed', 'completed']

export function isOrderShippable(
  order: Pick<MarketOrder, 'status' | 'shippingRequestId'>
): boolean {
  return SHIPPABLE_ORDER_STATUSES.includes(order.status) && order.shippingRequestId === null
}

export const SHIPPING_STATUS_LABELS: Record<ShippingStatus, string> = {
  pending: '待出貨',
  shipped: '已寄出',
  cancelled: '已取消'
}

/** 已寄出之後客人就不能再改收件資訊 —— 包裹已經在路上了。 */
export function canCustomerEditShipping(status: ShippingStatus): boolean {
  return status === 'pending'
}

/* -------------------------------------------------------------------------- */
/*  收件資訊                                                                    */
/* -------------------------------------------------------------------------- */

export interface RecipientInput {
  recipientName: string
  recipientPhone: string
  storeName: string
  storeCode: string | null
  note: string | null
}

/**
 * 手機號碼正規化。
 *
 * 客人會打成 0912-345-678、0912 345 678、+886912345678 各種樣子，
 * 先把分隔符號與國碼去掉再驗。7-ELEVEN 貨到付款是用簡訊通知取貨，
 * 所以這裡只收手機、不收市話 —— 填市話的包裹客人收不到取貨通知。
 */
export function normalizePhone(input: unknown): string | null {
  const digits = String(input ?? '')
    .replace(/[\s()-]/g, '')
    .replace(/^\+?886/, '0')

  return /^09\d{8}$/.test(digits) ? digits : null
}

export function normalizeRecipient(body: Record<string, unknown> | null | undefined): RecipientInput {
  const recipientName = String(body?.recipientName ?? '').trim().slice(0, 50)

  if (recipientName.length < 2) {
    throw createError({ statusCode: 400, statusMessage: '請填寫取貨人姓名（需與證件相符）' })
  }

  const recipientPhone = normalizePhone(body?.recipientPhone)

  if (!recipientPhone) {
    throw createError({ statusCode: 400, statusMessage: '請填寫正確的手機號碼（0912345678），超商取貨通知會寄到這支號碼' })
  }

  const storeName = String(body?.storeName ?? '').trim().slice(0, 100)

  if (storeName.length < 2) {
    throw createError({ statusCode: 400, statusMessage: '請填寫取貨的 7-ELEVEN 門市名稱' })
  }

  const storeCode = String(body?.storeCode ?? '').trim().slice(0, 20) || null
  const note = String(body?.note ?? '').trim().slice(0, 500) || null

  return { recipientName, recipientPhone, storeName, storeCode, note }
}

/* -------------------------------------------------------------------------- */
/*  金額                                                                        */
/* -------------------------------------------------------------------------- */

export interface ShipmentSummary {
  itemTotalCents: number
  depositPaidCents: number
  shippingCents: number
  codCents: number
  items: ShippingItemSnapshot[]
}

/**
 * 併單的金額統計。
 *
 * 貨到付款要收的錢 = 作品金額合計 − 已付訂金 + 運費。
 * 訂金是下單時就付掉的，所以取貨時只收尾款；少扣這一段客人會被收兩次訂金。
 */
export function summarizeShipment(
  orders: Pick<MarketOrder, 'id' | 'amountCents' | 'depositCents' | 'productNameSnapshot'>[],
  feeCents: number = SHIPPING_FEE_CENTS
): ShipmentSummary {
  const itemTotalCents = orders.reduce((sum, order) => sum + order.amountCents, 0)
  const depositPaidCents = orders.reduce((sum, order) => sum + order.depositCents, 0)

  return {
    itemTotalCents,
    depositPaidCents,
    shippingCents: feeCents,
    // 理論上訂金不會超過售價，但真的設錯時寧可收 0 元尾款也不要出現負數
    codCents: Math.max(0, itemTotalCents - depositPaidCents) + feeCents,
    items: orders.map(order => ({
      orderId: order.id,
      productName: order.productNameSnapshot,
      amountCents: order.amountCents,
      depositCents: order.depositCents
    }))
  }
}

/* -------------------------------------------------------------------------- */
/*  序列化                                                                      */
/* -------------------------------------------------------------------------- */

export interface ApiShippingRequest {
  id: string
  recipientName: string
  recipientPhone: string
  storeName: string
  storeCode: string | null
  note: string | null
  itemTotal: number
  depositPaid: number
  shipping: number
  cod: number
  items: Array<{ orderId: string, productName: string, amount: number, deposit: number }>
  status: ShippingStatus
  statusLabel: string
  canEdit: boolean
  shippedAt: string | null
  createdAt: string
  updatedAt: string
}

export function toApiShippingRequest(request: ShippingRequest): ApiShippingRequest {
  return {
    id: request.id,
    recipientName: request.recipientName,
    recipientPhone: request.recipientPhone,
    storeName: request.storeName,
    storeCode: request.storeCode,
    note: request.note,
    itemTotal: request.itemTotalCents / 100,
    depositPaid: request.depositPaidCents / 100,
    shipping: request.shippingCents / 100,
    cod: request.codCents / 100,
    items: (request.items ?? []).map(item => ({
      orderId: item.orderId,
      productName: item.productName,
      amount: item.amountCents / 100,
      deposit: item.depositCents / 100
    })),
    status: request.status,
    statusLabel: SHIPPING_STATUS_LABELS[request.status],
    canEdit: canCustomerEditShipping(request.status),
    shippedAt: request.shippedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString()
  }
}

/* -------------------------------------------------------------------------- */
/*  後台狀態轉換                                                                */
/* -------------------------------------------------------------------------- */

/**
 * 管理員可執行的寄貨單狀態轉換。
 *
 * 刻意不做「已寄出 → 待出貨」的回頭路：包裹已經交給超商之後要改，
 * 該走的是重新開一張單並在備註寫明原因，而不是把紀錄改掉。
 */
const ADMIN_SHIPPING_TRANSITIONS: Record<ShippingStatus, ShippingStatus[]> = {
  pending: ['shipped', 'cancelled'],
  shipped: [],
  cancelled: []
}

export function canAdminTransitionShipping(from: ShippingStatus, to: ShippingStatus): boolean {
  return ADMIN_SHIPPING_TRANSITIONS[from]?.includes(to) ?? false
}
