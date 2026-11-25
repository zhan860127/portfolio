import { describe, expect, it } from 'vitest'
import type { MarketOrder } from '../../server/database/schema'
import {
  SHIPPING_FEE_CENTS,
  canAdminTransitionShipping,
  canCustomerEditShipping,
  isOrderShippable,
  normalizePhone,
  normalizeRecipient,
  summarizeShipment
} from '../../server/utils/shipping'

/**
 * 寄貨單的規則層。
 *
 * 這裡最重要的是金額：客人取貨時要付多少錢算錯，是事後最難善後的那種錯
 * （人已經在超商櫃台了）。所以公式的每一段都要有案例鎖住。
 */

function makeOrder(overrides: Partial<MarketOrder> = {}): MarketOrder {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    userId: '22222222-2222-4222-8222-222222222222',
    marketId: '33333333-3333-4333-8333-333333333333',
    productId: '44444444-4444-4444-8444-444444444444',
    amountCents: 160000,
    depositCents: 50000,
    productNameSnapshot: '手捏茶杯',
    productImageSnapshot: null,
    status: 'deposit_confirmed',
    shippingRequestId: null,
    expiresAt: null,
    note: null,
    createdAt: new Date('2026-06-01T00:00:00Z'),
    updatedAt: new Date('2026-06-01T00:00:00Z'),
    ...overrides
  }
}

describe('運費', () => {
  it('固定 80 元', () => {
    expect(SHIPPING_FEE_CENTS).toBe(8000)
  })

  it('一張寄貨單只收一次，不是每件各收一次', () => {
    const one = summarizeShipment([makeOrder()])
    const three = summarizeShipment([
      makeOrder({ id: 'a' }),
      makeOrder({ id: 'b' }),
      makeOrder({ id: 'c' })
    ])

    expect(one.shippingCents).toBe(8000)
    expect(three.shippingCents).toBe(8000)
  })
})

describe('貨到付款金額', () => {
  it('= 作品金額合計 − 已付訂金 + 運費', () => {
    const summary = summarizeShipment([
      makeOrder({ id: 'a', amountCents: 160000, depositCents: 50000 }),
      makeOrder({ id: 'b', amountCents: 240000, depositCents: 80000 })
    ])

    expect(summary.itemTotalCents).toBe(400000)
    expect(summary.depositPaidCents).toBe(130000)
    // (4000 − 1300) + 80 = 2780 元
    expect(summary.codCents).toBe(278000)
  })

  it('訂金已經付清時仍然要收運費', () => {
    const summary = summarizeShipment([makeOrder({ amountCents: 160000, depositCents: 160000 })])

    expect(summary.codCents).toBe(8000)
  })

  it('訂金被設定得比售價還高時不會出現負數', () => {
    const summary = summarizeShipment([makeOrder({ amountCents: 100000, depositCents: 150000 })])

    expect(summary.codCents).toBe(8000)
  })

  it('留下每一筆訂單的快照，取消後還查得到這張單寄過什麼', () => {
    const summary = summarizeShipment([makeOrder({ id: 'a', productNameSnapshot: '盤築花器' })])

    expect(summary.items).toEqual([
      { orderId: 'a', productName: '盤築花器', amountCents: 160000, depositCents: 50000 }
    ])
  })
})

describe('哪些訂單可以併單', () => {
  it('已確認訂金可以', () => {
    expect(isOrderShippable(makeOrder({ status: 'deposit_confirmed' }))).toBe(true)
  })

  it('已完成也可以 —— 後台先按了確認售出，不該害客人填不了寄貨單', () => {
    expect(isOrderShippable(makeOrder({ status: 'completed' }))).toBe(true)
  })

  it('還沒確認訂金的不行', () => {
    expect(isOrderShippable(makeOrder({ status: 'pending_deposit' }))).toBe(false)
    expect(isOrderShippable(makeOrder({ status: 'payment_submitted' }))).toBe(false)
  })

  it('已取消的不行', () => {
    expect(isOrderShippable(makeOrder({ status: 'cancelled' }))).toBe(false)
  })

  it('已經被別張寄貨單收走的不行', () => {
    expect(isOrderShippable(makeOrder({ shippingRequestId: 'some-request' }))).toBe(false)
  })
})

describe('手機號碼', () => {
  it('接受常見的分隔寫法', () => {
    expect(normalizePhone('0912345678')).toBe('0912345678')
    expect(normalizePhone('0912-345-678')).toBe('0912345678')
    expect(normalizePhone('0912 345 678')).toBe('0912345678')
    expect(normalizePhone('+886912345678')).toBe('0912345678')
    expect(normalizePhone('886912345678')).toBe('0912345678')
  })

  it('拒絕市話 —— 超商取貨通知是簡訊，市話收不到', () => {
    expect(normalizePhone('0223456789')).toBeNull()
    expect(normalizePhone('02-2345-6789')).toBeNull()
  })

  it('拒絕長度不對或帶文字的輸入', () => {
    expect(normalizePhone('091234567')).toBeNull()
    expect(normalizePhone('09123456789')).toBeNull()
    expect(normalizePhone('0912abcdef')).toBeNull()
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
  })
})

describe('收件資訊驗證', () => {
  const valid = {
    recipientName: '王小明',
    recipientPhone: '0912-345-678',
    storeName: '台北市信義區松青門市',
    storeCode: '123456',
    note: '  平日下午比較方便  '
  }

  it('正規化之後回傳乾淨的欄位', () => {
    expect(normalizeRecipient(valid)).toEqual({
      recipientName: '王小明',
      recipientPhone: '0912345678',
      storeName: '台北市信義區松青門市',
      storeCode: '123456',
      note: '平日下午比較方便'
    })
  })

  it('店號與備註可以不填', () => {
    const result = normalizeRecipient({ ...valid, storeCode: '', note: '   ' })

    expect(result.storeCode).toBeNull()
    expect(result.note).toBeNull()
  })

  it('姓名、手機、門市缺一不可', () => {
    expect(() => normalizeRecipient({ ...valid, recipientName: '王' })).toThrow()
    expect(() => normalizeRecipient({ ...valid, recipientPhone: '0223456789' })).toThrow()
    expect(() => normalizeRecipient({ ...valid, storeName: '' })).toThrow()
    expect(() => normalizeRecipient(null)).toThrow()
  })
})

describe('狀態轉換', () => {
  it('客人只能改待出貨的單子', () => {
    expect(canCustomerEditShipping('pending')).toBe(true)
    expect(canCustomerEditShipping('shipped')).toBe(false)
    expect(canCustomerEditShipping('cancelled')).toBe(false)
  })

  it('後台可以把待出貨標記成已寄出或取消', () => {
    expect(canAdminTransitionShipping('pending', 'shipped')).toBe(true)
    expect(canAdminTransitionShipping('pending', 'cancelled')).toBe(true)
  })

  it('已寄出之後沒有回頭路', () => {
    expect(canAdminTransitionShipping('shipped', 'pending')).toBe(false)
    expect(canAdminTransitionShipping('shipped', 'cancelled')).toBe(false)
    expect(canAdminTransitionShipping('cancelled', 'pending')).toBe(false)
  })
})
