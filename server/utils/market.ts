// Nitro 會自動注入 createError，但單元測試是在純 Node 環境直接 import 這個檔案，
// 沒有 Nitro 的 auto-import。明確 import 讓這些規則可以被測試覆蓋。
import { createError } from 'h3'
import type { ApiProductCategory } from './categories'
import { toApiProductCategory } from './categories'
import type {
  Market,
  MarketCategory,
  MarketOrder,
  MarketOrderStatus,
  MarketProduct,
  MarketStatus,
  PaymentSubmission,
  ProductImage,
  ProductSpecifications,
  WaitlistEntry,
  WaitlistStatus
} from '../database/schema'

/**
 * 市集的純邏輯層。
 *
 * 這裡刻意只放不碰 DB 的函式：狀態推導、權限判斷、序列化。
 * 原因是訂單公平性的規則必須能被測試覆蓋，而這些規則一旦混進 handler，
 * 就只能靠整合測試驗證，實務上等於沒測。
 */

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

export function requireUuid(value: unknown, label: string): string {
  if (!isUuid(value)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid ${label}` })
  }

  return value
}

const IMAGE_KINDS = ['front', 'side', 'back', 'bottom', 'detail', 'process'] as const
const SPEC_KEYS = ['dimensions', 'weight', 'material', 'technique', 'firingTemperature', 'glaze', 'variation'] as const

/** 後台送上來的圖片陣列只保留認得的欄位，避免任意 JSON 直接落進 jsonb。 */
export function normalizeProductImages(input: unknown): ProductImage[] {
  if (!Array.isArray(input)) {
    return []
  }

  return input.flatMap((raw) => {
    const item = raw as { src?: unknown, alt?: unknown, kind?: unknown }
    const src = String(item?.src ?? '').trim()

    if (!src) {
      return []
    }

    const kind = IMAGE_KINDS.includes(item?.kind as typeof IMAGE_KINDS[number])
      ? (item.kind as ProductImage['kind'])
      : undefined

    return [{ src, alt: String(item?.alt ?? '').trim() || undefined, kind }]
  })
}

export function normalizeSpecifications(input: unknown): ProductSpecifications {
  if (!input || typeof input !== 'object') {
    return {}
  }

  const source = input as Record<string, unknown>
  const result: ProductSpecifications = {}

  for (const key of SPEC_KEYS) {
    const value = String(source[key] ?? '').trim()

    if (value) {
      result[key] = value
    }
  }

  return result
}

export function parseMarketDates(startsAt: unknown, endsAt: unknown) {
  const start = new Date(String(startsAt ?? ''))
  const end = new Date(String(endsAt ?? ''))

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw createError({ statusCode: 400, statusMessage: '請輸入正確的活動起訖時間' })
  }

  if (end <= start) {
    throw createError({ statusCode: 400, statusMessage: '活動結束時間必須晚於開始時間' })
  }

  return { start, end }
}

/* -------------------------------------------------------------------------- */
/*  活動狀態                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * 活動對外顯示的狀態。
 *
 * draft 是後台概念，永遠不對外；其餘狀態一律以「現在時間」為準重新推導，
 * 不信任 DB 裡那一欄 — 否則只要排程沒跑，已結束的活動就會一直顯示進行中。
 */
export function resolveMarketStatus(
  market: Pick<Market, 'status' | 'startsAt' | 'endsAt'>,
  now: Date = new Date()
): MarketStatus {
  if (market.status === 'draft') {
    return 'draft'
  }

  if (now < market.startsAt) {
    return 'upcoming'
  }

  if (now > market.endsAt) {
    return 'ended'
  }

  return 'live'
}

/** 前台可見的活動：排除草稿。已結束的活動仍然可看，只是不能買。 */
export function isMarketVisible(market: Pick<Market, 'status'>): boolean {
  return market.status !== 'draft'
}

/** 只有進行中的活動可以成立新訂單。 */
export function isMarketPurchasable(
  market: Pick<Market, 'status' | 'startsAt' | 'endsAt'>,
  now: Date = new Date()
): boolean {
  return resolveMarketStatus(market, now) === 'live'
}

export const MARKET_STATUS_LABELS: Record<MarketStatus, string> = {
  draft: '未上架',
  upcoming: '即將開始',
  live: '進行中',
  ended: '已結束'
}

/* -------------------------------------------------------------------------- */
/*  商品狀態與可用操作                                                         */
/* -------------------------------------------------------------------------- */

export const PRODUCT_STATUS_LABELS = {
  available: '開放選購',
  reserved: '保留中',
  sold: '已售完'
} as const

/**
 * 商品是否開放候補。
 * 商品層級的設定（null 代表未覆寫）優先於活動層級。
 */
export function resolveAllowWaitlistWhenSold(
  market: Pick<Market, 'allowWaitlistWhenSold'>,
  product: Pick<MarketProduct, 'allowWaitlistWhenSold'>
): boolean {
  if (product.allowWaitlistWhenSold !== null && product.allowWaitlistWhenSold !== undefined) {
    return product.allowWaitlistWhenSold === 1
  }

  return market.allowWaitlistWhenSold === 1
}

export function canJoinWaitlist(
  market: Pick<Market, 'status' | 'startsAt' | 'endsAt' | 'allowWaitlistWhenSold'>,
  product: Pick<MarketProduct, 'status' | 'allowWaitlistWhenSold'>,
  now: Date = new Date()
): boolean {
  if (resolveMarketStatus(market, now) === 'ended') {
    return false
  }

  if (product.status === 'reserved') {
    return true
  }

  // 需求 8.4：已售完商品是否允許排隊，由活動及商品設定決定
  if (product.status === 'sold') {
    return resolveAllowWaitlistWhenSold(market, product)
  }

  return false
}

/* -------------------------------------------------------------------------- */
/*  候補的優先購買窗口                                                         */
/* -------------------------------------------------------------------------- */

export interface PriorityWindow {
  /** 窗口是否生效。false 代表這件商品目前對所有人開放 */
  active: boolean
  /** 窗口生效時，允許下單的使用者 id */
  allowedUserIds: string[]
  expiresAt: Date | null
}

/**
 * 計算某件商品目前的「優先購買窗口」。
 *
 * 設計取捨（需求 10 明確要求不可自動保留給第一順位）：
 * 通知候補者時不會幫他建立訂單、也不會把商品鎖在他名下，
 * 而是開啟一段限時窗口，窗口內只有被通知的人能對這件商品下單。
 * 窗口過期後商品自動回到所有人都能買的狀態，不需要額外排程介入。
 */
export function resolvePriorityWindow(
  entries: Pick<WaitlistEntry, 'userId' | 'status' | 'windowExpiresAt'>[],
  now: Date = new Date()
): PriorityWindow {
  const live = entries.filter(entry =>
    entry.status === 'notified'
    && entry.windowExpiresAt !== null
    && entry.windowExpiresAt > now
  )

  if (live.length === 0) {
    return { active: false, allowedUserIds: [], expiresAt: null }
  }

  const expiresAt = live.reduce<Date | null>((latest, entry) => {
    if (!entry.windowExpiresAt) {
      return latest
    }

    return !latest || entry.windowExpiresAt > latest ? entry.windowExpiresAt : latest
  }, null)

  return {
    active: true,
    allowedUserIds: [...new Set(live.map(entry => entry.userId))],
    expiresAt
  }
}

/**
 * 候補順位。一律以加入時間排序即時計算，不存 position 欄位：
 * 存欄位的話，任何一筆取消都要把後面整串重編號，併發下必然算錯。
 */
export function waitlistPosition(
  entries: Pick<WaitlistEntry, 'id' | 'status' | 'createdAt'>[],
  entryId: string
): number | null {
  const queue = entries
    .filter(entry => entry.status === 'waiting' || entry.status === 'notified')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())

  const index = queue.findIndex(entry => entry.id === entryId)

  return index === -1 ? null : index + 1
}

/* -------------------------------------------------------------------------- */
/*  訂單                                                                       */
/* -------------------------------------------------------------------------- */

export const ORDER_STATUS_LABELS: Record<MarketOrderStatus, string> = {
  pending_deposit: '待付訂金',
  payment_submitted: '待人工核對',
  deposit_confirmed: '已確認訂金',
  completed: '已完成',
  expired: '已逾期',
  cancelled: '已取消'
}

/** 訂金繳款期限。逾期只會被標記，不會自動釋放商品（由管理員決定）。 */
export function computeDepositDueAt(
  market: Pick<Market, 'depositDueHours'>,
  from: Date = new Date()
): Date {
  return new Date(from.getTime() + market.depositDueHours * 60 * 60 * 1000)
}

/** 這些狀態代表訂單仍然握有商品，商品不可以被別人買走。 */
const ORDER_HOLDS_PRODUCT: MarketOrderStatus[] = [
  'pending_deposit',
  'payment_submitted',
  'deposit_confirmed',
  'completed',
  'expired'
]

export function orderHoldsProduct(status: MarketOrderStatus): boolean {
  return ORDER_HOLDS_PRODUCT.includes(status)
}

/** 顧客本人只能把「待付訂金」推進到「待人工核對」。其餘轉換都是後台權限。 */
export function canCustomerSubmitPayment(status: MarketOrderStatus): boolean {
  return status === 'pending_deposit' || status === 'expired'
}

/**
 * 管理員可執行的狀態轉換。
 * 刻意不允許 payment_submitted 直接跳到 completed：
 * 「確認訂金入帳」與「確認售出」是兩個不同的人工動作，必須分兩步留下兩筆紀錄。
 */
const ADMIN_TRANSITIONS: Record<MarketOrderStatus, MarketOrderStatus[]> = {
  pending_deposit: ['deposit_confirmed', 'expired', 'cancelled'],
  payment_submitted: ['deposit_confirmed', 'pending_deposit', 'cancelled'],
  deposit_confirmed: ['completed', 'cancelled'],
  expired: ['deposit_confirmed', 'cancelled'],
  completed: [],
  cancelled: []
}

export function canAdminTransition(from: MarketOrderStatus, to: MarketOrderStatus): boolean {
  return ADMIN_TRANSITIONS[from]?.includes(to) ?? false
}

/* -------------------------------------------------------------------------- */
/*  序列化                                                                     */
/* -------------------------------------------------------------------------- */

export interface ApiMarket {
  id: string
  title: string
  description: string | null
  coverImage: string | null
  startsAt: string
  endsAt: string
  status: MarketStatus
  statusLabel: string
  productCount: number
  waitlistWindowHours: number
  depositDueHours: number
}

export function toApiMarket(market: Market, productCount: number, now: Date = new Date()): ApiMarket {
  const status = resolveMarketStatus(market, now)

  return {
    id: market.id,
    title: market.title,
    description: market.description,
    coverImage: market.coverImage,
    startsAt: market.startsAt.toISOString(),
    endsAt: market.endsAt.toISOString(),
    status,
    statusLabel: MARKET_STATUS_LABELS[status],
    productCount,
    waitlistWindowHours: market.waitlistWindowHours,
    depositDueHours: market.depositDueHours
  }
}

export interface ApiMarketProduct {
  id: string
  code: string | null
  /** 所屬分類（品項）。null = 未分類 */
  category: ApiProductCategory | null
  name: string
  description: string | null
  price: number
  deposit: number
  images: ProductImage[]
  specifications: Record<string, string | undefined>
  story: string | null
  purchaseNotes: string | null
  status: MarketProduct['status']
  statusLabel: string
  sortOrder: number
  /** 以下為「這個使用者」的個人化狀態，未登入時一律為 false/null */
  isFollowing: boolean
  myOrderId: string | null
  myWaitlistId: string | null
  waitlistPosition: number | null
  canPurchase: boolean
  canWaitlist: boolean
  priorityWindowActive: boolean
}

export interface ViewerContext {
  userId: string | null
  followedProductIds: Set<string>
  ordersByProductId: Map<string, MarketOrder>
  waitlistByProductId: Map<string, WaitlistEntry>
  waitlistPositions: Map<string, number>
  priorityWindows: Map<string, PriorityWindow>
}

export function emptyViewerContext(userId: string | null = null): ViewerContext {
  return {
    userId,
    followedProductIds: new Set(),
    ordersByProductId: new Map(),
    waitlistByProductId: new Map(),
    waitlistPositions: new Map(),
    priorityWindows: new Map()
  }
}

export function toApiMarketProduct(
  product: MarketProduct,
  market: Market,
  viewer: ViewerContext,
  now: Date = new Date(),
  /** 由呼叫端查好後帶進來，避免在序列化裡再打一次 DB（N+1） */
  category: MarketCategory | null = null
): ApiMarketProduct {
  const window = viewer.priorityWindows.get(product.id) ?? { active: false, allowedUserIds: [], expiresAt: null }
  const marketLive = isMarketPurchasable(market, now)

  // 窗口生效時，只有被通知的候補者能買這件商品
  const blockedByWindow = window.active
    && (!viewer.userId || !window.allowedUserIds.includes(viewer.userId))

  const myOrder = viewer.ordersByProductId.get(product.id) ?? null
  const myWaitlist = viewer.waitlistByProductId.get(product.id) ?? null

  return {
    id: product.id,
    code: product.code,
    category: toApiProductCategory(category),
    name: product.name,
    description: product.description,
    price: product.priceCents / 100,
    deposit: product.depositCents / 100,
    images: product.images ?? [],
    specifications: (product.specifications ?? {}) as Record<string, string | undefined>,
    story: product.story,
    purchaseNotes: product.purchaseNotes,
    status: product.status,
    statusLabel: PRODUCT_STATUS_LABELS[product.status],
    sortOrder: product.sortOrder,
    isFollowing: viewer.followedProductIds.has(product.id),
    myOrderId: myOrder?.id ?? null,
    myWaitlistId: myWaitlist?.id ?? null,
    waitlistPosition: viewer.waitlistPositions.get(product.id) ?? null,
    canPurchase: marketLive && product.status === 'available' && !blockedByWindow,
    canWaitlist: canJoinWaitlist(market, product, now) && !myWaitlist,
    priorityWindowActive: window.active
  }
}

export interface ApiMarketOrder {
  id: string
  marketId: string
  marketTitle: string | null
  productId: string
  productName: string
  productImage: string | null
  amount: number
  deposit: number
  status: MarketOrderStatus
  statusLabel: string
  expiresAt: string | null
  createdAt: string
  payment: {
    bankLast5: string
    paidAmount: number
    paidAt: string
    note: string | null
    submittedAt: string
  } | null
}

export function toApiMarketOrder(
  order: MarketOrder,
  marketTitle: string | null,
  payment: PaymentSubmission | null
): ApiMarketOrder {
  return {
    id: order.id,
    marketId: order.marketId,
    marketTitle,
    productId: order.productId,
    productName: order.productNameSnapshot,
    productImage: order.productImageSnapshot,
    amount: order.amountCents / 100,
    deposit: order.depositCents / 100,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    expiresAt: order.expiresAt?.toISOString() ?? null,
    createdAt: order.createdAt.toISOString(),
    payment: payment
      ? {
          bankLast5: payment.bankLast5,
          paidAmount: payment.paidAmountCents / 100,
          paidAt: payment.paidAt.toISOString(),
          note: payment.note,
          submittedAt: payment.submittedAt.toISOString()
        }
      : null
  }
}

export interface ApiWaitlistEntry {
  id: string
  productId: string
  productName: string
  productImage: string | null
  marketId: string
  status: WaitlistStatus
  position: number | null
  notifiedAt: string | null
  windowExpiresAt: string | null
  createdAt: string
}
