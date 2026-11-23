import { describe, expect, it } from 'vitest'
import type { Market, MarketProduct, WaitlistEntry } from '../../server/database/schema'
import {
  ORDER_STATUS_LABELS,
  canAdminTransition,
  canCustomerSubmitPayment,
  canJoinWaitlist,
  computeDepositDueAt,
  emptyViewerContext,
  isMarketPurchasable,
  isMarketVisible,
  normalizeProductImages,
  normalizeSpecifications,
  orderHoldsProduct,
  resolveAllowWaitlistWhenSold,
  resolveMarketStatus,
  resolvePriorityWindow,
  toApiMarketProduct,
  waitlistPosition
} from '../../server/utils/market'

/**
 * 對應需求 15 的測試項目 12～23 的規則層。
 * 真正要資料庫才能驗證的部分（原子保留、唯一約束）放在 tests/db。
 */

const NOW = new Date('2026-06-15T12:00:00Z')

function makeMarket(overrides: Partial<Market> = {}): Market {
  return {
    id: 'market-1',
    title: '春季市集',
    description: null,
    coverImage: null,
    startsAt: new Date('2026-06-01T00:00:00Z'),
    endsAt: new Date('2026-06-30T00:00:00Z'),
    status: 'live',
    depositDueHours: 48,
    waitlistWindowHours: 24,
    allowWaitlistWhenSold: 0,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  } as Market
}

function makeProduct(overrides: Partial<MarketProduct> = {}): MarketProduct {
  return {
    id: 'product-1',
    marketId: 'market-1',
    code: 'TI-01',
    name: '手捏湯碗',
    description: null,
    priceCents: 180000,
    depositCents: 50000,
    images: [{ src: 'https://example.com/a.jpg' }],
    specifications: {},
    story: null,
    purchaseNotes: null,
    status: 'available',
    allowWaitlistWhenSold: null,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  } as MarketProduct
}

function makeEntry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    id: 'entry-1',
    userId: 'user-1',
    productId: 'product-1',
    status: 'waiting',
    notifiedAt: null,
    windowExpiresAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  } as WaitlistEntry
}

describe('活動狀態', () => {
  it('依現在時間推導，不信任 DB 那一欄', () => {
    const market = makeMarket({ status: 'upcoming' })

    expect(resolveMarketStatus(market, new Date('2026-05-01T00:00:00Z'))).toBe('upcoming')
    expect(resolveMarketStatus(market, NOW)).toBe('live')
    expect(resolveMarketStatus(market, new Date('2026-07-01T00:00:00Z'))).toBe('ended')
  })

  it('草稿永遠是草稿，不會因為時間到了就自己上架', () => {
    const draft = makeMarket({ status: 'draft' })

    expect(resolveMarketStatus(draft, NOW)).toBe('draft')
    expect(isMarketVisible(draft)).toBe(false)
    expect(isMarketPurchasable(draft, NOW)).toBe(false)
  })

  it('只有進行中的活動可以下單', () => {
    expect(isMarketPurchasable(makeMarket(), NOW)).toBe(true)
    expect(isMarketPurchasable(makeMarket(), new Date('2026-07-01T00:00:00Z'))).toBe(false)
  })
})

describe('測試項目 13 / 15：商品可購買狀態', () => {
  const viewer = emptyViewerContext('user-1')

  it('開放選購且活動進行中 → 可以下單', () => {
    const api = toApiMarketProduct(makeProduct(), makeMarket(), viewer, NOW)

    expect(api.canPurchase).toBe(true)
    expect(api.statusLabel).toBe('開放選購')
  })

  it('其他人保留後，所有人看到的都是「保留中」且不能下單', () => {
    const api = toApiMarketProduct(makeProduct({ status: 'reserved' }), makeMarket(), viewer, NOW)

    expect(api.canPurchase).toBe(false)
    expect(api.statusLabel).toBe('保留中')
  })

  it('測試項目 21：已售完不能再次購買', () => {
    const api = toApiMarketProduct(makeProduct({ status: 'sold' }), makeMarket(), viewer, NOW)

    expect(api.canPurchase).toBe(false)
    expect(api.statusLabel).toBe('已售完')
  })

  it('活動結束後即使商品開放也不能下單', () => {
    const api = toApiMarketProduct(
      makeProduct(),
      makeMarket(),
      viewer,
      new Date('2026-07-01T00:00:00Z')
    )

    expect(api.canPurchase).toBe(false)
  })
})

describe('測試項目 16 / 17：候補規則', () => {
  it('保留中的商品可以加入候補', () => {
    expect(canJoinWaitlist(makeMarket(), makeProduct({ status: 'reserved' }), NOW)).toBe(true)
  })

  it('開放選購的商品不需要候補', () => {
    expect(canJoinWaitlist(makeMarket(), makeProduct({ status: 'available' }), NOW)).toBe(false)
  })

  it('已售完是否可候補由活動設定決定', () => {
    const sold = makeProduct({ status: 'sold' })

    expect(canJoinWaitlist(makeMarket({ allowWaitlistWhenSold: 0 }), sold, NOW)).toBe(false)
    expect(canJoinWaitlist(makeMarket({ allowWaitlistWhenSold: 1 }), sold, NOW)).toBe(true)
  })

  it('商品層級設定可以覆寫活動設定', () => {
    expect(resolveAllowWaitlistWhenSold(
      makeMarket({ allowWaitlistWhenSold: 0 }),
      makeProduct({ allowWaitlistWhenSold: 1 })
    )).toBe(true)

    expect(resolveAllowWaitlistWhenSold(
      makeMarket({ allowWaitlistWhenSold: 1 }),
      makeProduct({ allowWaitlistWhenSold: 0 })
    )).toBe(false)

    // null 代表跟隨活動設定
    expect(resolveAllowWaitlistWhenSold(
      makeMarket({ allowWaitlistWhenSold: 1 }),
      makeProduct({ allowWaitlistWhenSold: null })
    )).toBe(true)
  })

  it('活動結束後不再開放候補', () => {
    expect(canJoinWaitlist(
      makeMarket(),
      makeProduct({ status: 'reserved' }),
      new Date('2026-07-01T00:00:00Z')
    )).toBe(false)
  })

  it('測試項目 17：已在候補名單的人看不到「加入候補」', () => {
    const viewer = emptyViewerContext('user-1')
    viewer.waitlistByProductId.set('product-1', makeEntry())

    const api = toApiMarketProduct(makeProduct({ status: 'reserved' }), makeMarket(), viewer, NOW)

    expect(api.canWaitlist).toBe(false)
    expect(api.myWaitlistId).toBe('entry-1')
  })
})

describe('候補順位', () => {
  const entries = [
    makeEntry({ id: 'a', createdAt: new Date('2026-06-10T00:00:00Z') }),
    makeEntry({ id: 'b', createdAt: new Date('2026-06-11T00:00:00Z') }),
    makeEntry({ id: 'c', createdAt: new Date('2026-06-12T00:00:00Z') })
  ]

  it('依加入時間排序', () => {
    expect(waitlistPosition(entries, 'a')).toBe(1)
    expect(waitlistPosition(entries, 'b')).toBe(2)
    expect(waitlistPosition(entries, 'c')).toBe(3)
  })

  it('取消的人不佔順位，後面的人自動遞補', () => {
    const withCancelled = [
      { ...entries[0]!, status: 'cancelled' as const },
      entries[1]!,
      entries[2]!
    ]

    expect(waitlistPosition(withCancelled, 'b')).toBe(1)
    expect(waitlistPosition(withCancelled, 'c')).toBe(2)
    expect(waitlistPosition(withCancelled, 'a')).toBeNull()
  })

  it('輸入順序顛倒也會先排序再算', () => {
    expect(waitlistPosition([...entries].reverse(), 'a')).toBe(1)
  })
})

describe('測試項目 23：候補優先購買窗口', () => {
  const notified = makeEntry({
    id: 'e1',
    userId: 'user-1',
    status: 'notified',
    notifiedAt: NOW,
    windowExpiresAt: new Date('2026-06-16T12:00:00Z')
  })

  it('通知後窗口生效，只有被通知者能買', () => {
    const window = resolvePriorityWindow([notified], NOW)

    expect(window.active).toBe(true)
    expect(window.allowedUserIds).toEqual(['user-1'])
  })

  it('窗口過期後自動失效，不需要排程回收', () => {
    const window = resolvePriorityWindow([notified], new Date('2026-06-17T00:00:00Z'))

    expect(window.active).toBe(false)
    expect(window.allowedUserIds).toEqual([])
  })

  it('只是排隊中（未被通知）不會產生窗口', () => {
    expect(resolvePriorityWindow([makeEntry()], NOW).active).toBe(false)
  })

  it('窗口生效時，非被通知者的 canPurchase 為 false', () => {
    const other = emptyViewerContext('user-2')
    other.priorityWindows.set('product-1', resolvePriorityWindow([notified], NOW))

    const api = toApiMarketProduct(makeProduct(), makeMarket(), other, NOW)

    expect(api.canPurchase).toBe(false)
    expect(api.priorityWindowActive).toBe(true)
  })

  it('窗口生效時，被通知者仍然可以下單', () => {
    const lucky = emptyViewerContext('user-1')
    lucky.priorityWindows.set('product-1', resolvePriorityWindow([notified], NOW))

    const api = toApiMarketProduct(makeProduct(), makeMarket(), lucky, NOW)

    expect(api.canPurchase).toBe(true)
  })

  it('未登入者在窗口生效時一律不能下單', () => {
    const guest = emptyViewerContext(null)
    guest.priorityWindows.set('product-1', resolvePriorityWindow([notified], NOW))

    expect(toApiMarketProduct(makeProduct(), makeMarket(), guest, NOW).canPurchase).toBe(false)
  })

  it('同時通知多人時，每一位都在允許名單內', () => {
    const window = resolvePriorityWindow([
      notified,
      { ...notified, id: 'e2', userId: 'user-9' }
    ], NOW)

    expect(window.allowedUserIds).toHaveLength(2)
    expect(window.allowedUserIds).toContain('user-9')
  })
})

describe('測試項目 12：追蹤狀態', () => {
  it('追蹤只影響顯示，不影響能不能買', () => {
    const viewer = emptyViewerContext('user-1')
    viewer.followedProductIds.add('product-1')

    const api = toApiMarketProduct(makeProduct({ status: 'sold' }), makeMarket(), viewer, NOW)

    expect(api.isFollowing).toBe(true)
    expect(api.canPurchase).toBe(false)
  })
})

describe('測試項目 19 / 20：訂單狀態機', () => {
  it('顧客只能在待付訂金（或逾期）時提交匯款資料', () => {
    expect(canCustomerSubmitPayment('pending_deposit')).toBe(true)
    expect(canCustomerSubmitPayment('expired')).toBe(true)
    expect(canCustomerSubmitPayment('payment_submitted')).toBe(false)
    expect(canCustomerSubmitPayment('deposit_confirmed')).toBe(false)
    expect(canCustomerSubmitPayment('completed')).toBe(false)
  })

  it('測試項目 19：提交末五碼不會讓訂單直接變成已完成', () => {
    // payment_submitted 不能直接跳到 completed，中間必須有人工確認訂金
    expect(canAdminTransition('payment_submitted', 'completed')).toBe(false)
    expect(canAdminTransition('payment_submitted', 'deposit_confirmed')).toBe(true)
  })

  it('測試項目 20：確認訂金後才能確認售出', () => {
    expect(canAdminTransition('deposit_confirmed', 'completed')).toBe(true)
    expect(canAdminTransition('pending_deposit', 'completed')).toBe(false)
  })

  it('已完成與已取消是終點，不能再轉換', () => {
    expect(canAdminTransition('completed', 'cancelled')).toBe(false)
    expect(canAdminTransition('cancelled', 'pending_deposit')).toBe(false)
  })

  it('測試項目 22：任何活躍狀態都可以取消並釋放商品', () => {
    for (const from of ['pending_deposit', 'payment_submitted', 'deposit_confirmed', 'expired'] as const) {
      expect(canAdminTransition(from, 'cancelled')).toBe(true)
    }
  })

  it('末五碼填錯可以退回重填', () => {
    expect(canAdminTransition('payment_submitted', 'pending_deposit')).toBe(true)
  })

  it('逾期訂單仍然握有商品，不會自動釋放', () => {
    expect(orderHoldsProduct('expired')).toBe(true)
    expect(orderHoldsProduct('payment_submitted')).toBe(true)
    expect(orderHoldsProduct('completed')).toBe(true)
    expect(orderHoldsProduct('cancelled')).toBe(false)
  })

  it('每個狀態都有中文標籤，後台不會出現生代碼', () => {
    for (const status of Object.keys(ORDER_STATUS_LABELS)) {
      expect(ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS]).toBeTruthy()
    }
  })
})

describe('訂金繳款期限', () => {
  it('依活動設定計算', () => {
    expect(computeDepositDueAt(makeMarket({ depositDueHours: 48 }), NOW).toISOString())
      .toBe('2026-06-17T12:00:00.000Z')

    expect(computeDepositDueAt(makeMarket({ depositDueHours: 12 }), NOW).toISOString())
      .toBe('2026-06-16T00:00:00.000Z')
  })
})

describe('後台輸入正規化', () => {
  it('圖片只保留認得的欄位，沒有 src 的直接丟掉', () => {
    const result = normalizeProductImages([
      { src: ' https://a.jpg ', alt: '正面', kind: 'front' },
      { src: '', alt: '空的' },
      { src: 'https://b.jpg', kind: 'not-a-kind', evil: 'drop me' }
    ])

    expect(result).toEqual([
      { src: 'https://a.jpg', alt: '正面', kind: 'front' },
      { src: 'https://b.jpg', alt: undefined, kind: undefined }
    ])
  })

  it('非陣列輸入回空陣列', () => {
    expect(normalizeProductImages(null)).toEqual([])
    expect(normalizeProductImages('nope')).toEqual([])
  })

  it('規格只收白名單欄位，空字串不寫入', () => {
    expect(normalizeSpecifications({
      dimensions: ' 直徑 12cm ',
      weight: '',
      injected: 'should not appear'
    })).toEqual({ dimensions: '直徑 12cm' })
  })

  it('非物件輸入回空物件', () => {
    expect(normalizeSpecifications(null)).toEqual({})
  })
})
