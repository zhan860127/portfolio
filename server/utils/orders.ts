import type { Order, OrderItem, OrderStatus } from '../database/schema'

/**
 * DB 用狀態代碼，對外仍回傳既有的顯示字串，前端與 Google Sheet 看板不需要同步修改。
 * 之後前端改吃代碼時，把這層拿掉即可。
 */
const STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Pending Payment',
  payment_processing: 'Payment Processing',
  paid: 'Paid',
  shipped: 'Shipped',
  completed: 'Completed',
  cancelled: 'Cancelled'
}

/** 顧客本人只能做這些狀態轉換；其餘（出貨、完成、取消）屬於後台權限。 */
const CUSTOMER_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending_payment: ['payment_processing']
}

export function statusLabel(status: OrderStatus) {
  return STATUS_LABELS[status]
}

export function parseStatusLabel(label: string): OrderStatus | null {
  const entry = Object.entries(STATUS_LABELS).find(([, value]) => value === label)

  return entry ? (entry[0] as OrderStatus) : null
}

export function canCustomerTransition(from: OrderStatus, to: OrderStatus) {
  return CUSTOMER_TRANSITIONS[from]?.includes(to) ?? false
}

/** 與改用 DB 之前相同的顯示格式（台北時間） */
export function formatOrderTime(date: Date) {
  return date.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
}

/** 明細組成與舊版 Google Sheet 相同的字串，前端顯示邏輯不必更動 */
export function formatItemsSummary(items: Pick<OrderItem, 'titleSnapshot' | 'quantity'>[]) {
  return items.map(item => `${item.titleSnapshot} *${item.quantity}`).join('\n')
}

/** DB 資料列 → API 回應。維持既有欄位名稱，只把 rowNumber 換成穩定的 id。 */
export function toApiOrder(order: Order, items: OrderItem[], userName: string | null, userEmail: string) {
  return {
    id: order.id,
    email: userEmail,
    name: userName ?? '',
    amount: order.totalCents / 100,
    items: formatItemsSummary(items),
    time: formatOrderTime(order.createdAt),
    status: statusLabel(order.status),
    lastFiveDigits: order.lastFiveDigits ?? ''
  }
}
