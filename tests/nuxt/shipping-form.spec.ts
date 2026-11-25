// @vitest-environment nuxt
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import MarketShippingForm from '../../app/components/market/MarketShippingForm.vue'
import { useMarketStore } from '../../app/stores/market'
import type { ShippableOrder, ShippingOverview } from '../../app/stores/market'

/**
 * 寄貨單表單。
 *
 * 重點在兩件事：畫面上算出來的「取貨時要付」要跟伺服器的公式一致，
 * 以及送出去的 body 真的帶著客人勾選的那幾筆訂單 —— 這兩個出錯都會
 * 直接變成客人在超商櫃台被收錯錢。
 */

function makeOrder(id: string, amount: number, deposit: number): ShippableOrder {
  return {
    id,
    marketId: '33333333-3333-4333-8333-333333333333',
    marketTitle: '春季限定市集',
    productId: `product-${id}`,
    productName: `作品 ${id}`,
    productImage: null,
    amount,
    deposit,
    status: 'deposit_confirmed',
    statusLabel: '已確認訂金',
    expiresAt: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    payment: null,
    includedInCurrent: false
  }
}

let overview: ShippingOverview = {
  shippingFee: 80,
  current: null,
  history: [],
  eligibleOrders: []
}

let posted: Record<string, unknown> | null = null

registerEndpoint('/api/market/shipping', async (event) => {
  if (event.method === 'POST') {
    posted = await readBody(event)

    return {
      request: {
        id: '99999999-9999-4999-8999-999999999999',
        recipientName: String(posted?.recipientName ?? ''),
        recipientPhone: String(posted?.recipientPhone ?? ''),
        storeName: String(posted?.storeName ?? ''),
        storeCode: null,
        note: null,
        itemTotal: 0,
        depositPaid: 0,
        shipping: 80,
        cod: 80,
        items: [],
        status: 'pending',
        statusLabel: '待出貨',
        canEdit: true,
        shippedAt: null,
        createdAt: '2026-06-02T00:00:00.000Z',
        updatedAt: '2026-06-02T00:00:00.000Z'
      }
    }
  }

  return overview
})

/**
 * mountSuspended 共用同一個 Nuxt app 的 pinia，store 會跨測試留著。
 * 每個案例都先清空再抓一次，才不會看到上一個案例的資料。
 */
async function mountForm() {
  const store = useMarketStore()

  store.shipping = null
  await store.fetchShipping()

  const wrapper = await mountSuspended(MarketShippingForm)
  await wrapper.vm.$nextTick()

  return wrapper
}

beforeEach(() => {
  posted = null
  overview = {
    shippingFee: 80,
    current: null,
    history: [],
    eligibleOrders: [makeOrder('a', 1600, 500), makeOrder('b', 2400, 800)]
  }
})

describe('寄貨單表單', () => {
  it('列出可以寄送的作品，並且預設全部勾選', async () => {
    const wrapper = await mountForm()
    const boxes = wrapper.findAll('input[type="checkbox"]')

    expect(boxes).toHaveLength(2)
    expect(boxes.every(box => (box.element as HTMLInputElement).checked)).toBe(true)
    expect(wrapper.text()).toContain('作品 a')
    expect(wrapper.text()).toContain('作品 b')
  })

  it('取貨時要付 = 作品金額合計 − 已付訂金 + 運費', async () => {
    const wrapper = await mountForm()
    const text = wrapper.text()

    // (1600 + 2400) − (500 + 800) + 80 = 2780
    expect(text).toContain('NT$ 4,000')
    expect(text).toContain('NT$ 1,300')
    expect(text).toContain('NT$ 2,780')
  })

  it('運費是伺服器給的，不是畫面寫死的 80', async () => {
    overview.shippingFee = 120

    const wrapper = await mountForm()

    expect(wrapper.text()).toContain('運費固定 NT$ 120')
    // (4000 − 1300) + 120
    expect(wrapper.text()).toContain('NT$ 2,820')
  })

  it('取消勾選其中一件會重新算金額', async () => {
    const wrapper = await mountForm()
    const boxes = wrapper.findAll('input[type="checkbox"]')

    await boxes[1]!.setValue(false)
    await wrapper.vm.$nextTick()

    // 只剩 a：1600 − 500 + 80 = 1180
    expect(wrapper.text()).toContain('已選 1 件作品')
    expect(wrapper.text()).toContain('NT$ 1,180')
  })

  it('送出時帶著勾選的訂單與收件資訊', async () => {
    const wrapper = await mountForm()

    await wrapper.find('input[placeholder="王小明"]').setValue('陳小美')
    await wrapper.find('input[placeholder="0912345678"]').setValue('0912-345-678')
    await wrapper.find('input[placeholder="台北市信義區 ○○門市"]').setValue('台北市大安區和平門市')
    await wrapper.find('form').trigger('submit')

    // 送出是非同步的，$nextTick 只等 Vue 的渲染佇列、不等這趟請求
    await vi.waitFor(() => expect(posted).not.toBeNull())

    expect(posted).toMatchObject({
      orderIds: ['a', 'b'],
      recipientName: '陳小美',
      recipientPhone: '0912-345-678',
      storeName: '台北市大安區和平門市'
    })
  })

  it('手機號碼格式不對時擋在前端，不白跑一趟', async () => {
    const wrapper = await mountForm()

    await wrapper.find('input[placeholder="王小明"]').setValue('陳小美')
    await wrapper.find('input[placeholder="0912345678"]').setValue('02-2345-6789')
    await wrapper.find('input[placeholder="台北市信義區 ○○門市"]').setValue('台北市大安區和平門市')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(posted).toBeNull()
    expect(wrapper.text()).toContain('請填寫正確的手機號碼')
  })

  it('沒有可寄送的作品時說清楚什麼時候會出現', async () => {
    overview.eligibleOrders = []

    const wrapper = await mountForm()

    expect(wrapper.text()).toContain('還沒有可以安排寄送的作品')
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('已經送出的寄貨單顯示金額與狀態，而不是再給一次空白表單', async () => {
    overview.current = {
      id: '99999999-9999-4999-8999-999999999999',
      recipientName: '陳小美',
      recipientPhone: '0912345678',
      storeName: '台北市大安區和平門市',
      storeCode: '123456',
      note: null,
      itemTotal: 4000,
      depositPaid: 1300,
      shipping: 80,
      cod: 2780,
      items: [
        { orderId: 'a', productName: '作品 a', amount: 1600, deposit: 500 },
        { orderId: 'b', productName: '作品 b', amount: 2400, deposit: 800 }
      ],
      status: 'pending',
      statusLabel: '待出貨',
      canEdit: true,
      shippedAt: null,
      createdAt: '2026-06-02T00:00:00.000Z',
      updatedAt: '2026-06-02T00:00:00.000Z'
    }

    const wrapper = await mountForm()
    const text = wrapper.text()

    expect(text).toContain('待出貨')
    expect(text).toContain('陳小美')
    expect(text).toContain('台北市大安區和平門市')
    expect(text).toContain('NT$ 2,780')
    expect(text).toContain('修改')
    // 已經有單子的時候不該同時攤開一份空白表單
    expect(wrapper.find('form').exists()).toBe(false)
  })

  it('已寄出之後不給修改', async () => {
    overview.current = {
      id: '99999999-9999-4999-8999-999999999999',
      recipientName: '陳小美',
      recipientPhone: '0912345678',
      storeName: '台北市大安區和平門市',
      storeCode: null,
      note: null,
      itemTotal: 1600,
      depositPaid: 500,
      shipping: 80,
      cod: 1180,
      items: [{ orderId: 'a', productName: '作品 a', amount: 1600, deposit: 500 }],
      status: 'shipped',
      statusLabel: '已寄出',
      canEdit: false,
      shippedAt: '2026-06-03T00:00:00.000Z',
      createdAt: '2026-06-02T00:00:00.000Z',
      updatedAt: '2026-06-03T00:00:00.000Z'
    }

    const wrapper = await mountForm()

    expect(wrapper.text()).toContain('已經寄出的單子不能再修改')
  })
})
