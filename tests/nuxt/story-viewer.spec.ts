// @vitest-environment nuxt
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import MarketStoryViewer from '../../app/components/market/MarketStoryViewer.vue'
import type { MarketProduct, MarketSummary } from '../../app/stores/market'

/**
 * 對應需求 15 的測試項目 3（活動詳情）、12（追蹤）、
 * 13 / 15（開放與保留中的操作）、16（候補）、21（已售完不能購買）。
 */

const MARKET_ID = '33333333-3333-4333-8333-333333333333'

const market: MarketSummary = {
  id: MARKET_ID,
  title: '春季限定市集',
  description: null,
  coverImage: null,
  startsAt: '2026-06-01T00:00:00.000Z',
  endsAt: '2026-06-30T00:00:00.000Z',
  status: 'live',
  statusLabel: '進行中',
  productCount: 2,
  waitlistWindowHours: 24,
  depositDueHours: 48
}

registerEndpoint(`/api/market/markets/${MARKET_ID}/statuses`, () => ({
  marketStatus: 'live',
  products: []
}))

function makeProduct(overrides: Partial<MarketProduct> = {}): MarketProduct {
  return {
    id: 'product-1',
    code: 'TI-01',
    name: '手捏湯碗',
    description: null,
    price: 1800,
    deposit: 500,
    images: [{ src: 'https://example.com/a.jpg' }],
    specifications: {},
    story: null,
    purchaseNotes: null,
    status: 'available',
    statusLabel: '開放選購',
    sortOrder: 0,
    isFollowing: false,
    myOrderId: null,
    myWaitlistId: null,
    waitlistPosition: null,
    canPurchase: true,
    canWaitlist: false,
    priorityWindowActive: false,
    ...overrides
  }
}

let mounted: Array<{ unmount: () => void }> = []

afterEach(() => {
  for (const wrapper of mounted) {
    wrapper.unmount()
  }

  mounted = []
  document.body.innerHTML = ''
})

async function mountViewer(products: MarketProduct[]) {
  setActivePinia(createPinia())

  const wrapper = await mountSuspended(MarketStoryViewer, {
    props: { market, products },
    attachTo: document.body
  })

  mounted.push(wrapper)

  return wrapper
}

type ViewerWrapper = Awaited<ReturnType<typeof mountViewer>>

/**
 * 瀏覽進度改看 progressbar 的 aria 屬性。
 * 原本斷言的是 header 上那行「01 / 02」文字，那段已經拿掉了，
 * 而 aria-valuenow 本來就是這個狀態對外的正式說法。
 */
function progressOf(wrapper: ViewerWrapper) {
  const bar = wrapper.find('[role="progressbar"]')

  return `${bar.attributes('aria-valuenow')} / ${bar.attributes('aria-valuemax')}`
}

describe('測試項目 3：活動詳情顯示', () => {
  it('顯示活動名稱、瀏覽進度與商品資訊', async () => {
    const wrapper = await mountViewer([makeProduct(), makeProduct({ id: 'product-2', name: '釉燒小皿' })])
    const text = wrapper.text()

    expect(text).toContain('春季限定市集')
    expect(progressOf(wrapper)).toBe('1 / 2')
    expect(text).toContain('手捏湯碗')
    expect(text).toContain('1,800')
    expect(text).toContain('訂金 NT$ 500')
    expect(text).toContain('作品編號 TI-01')
  })

  it('進度條的段數等於商品件數', async () => {
    const wrapper = await mountViewer([
      makeProduct(),
      makeProduct({ id: 'p2' }),
      makeProduct({ id: 'p3' })
    ])

    const bar = wrapper.find('[role="progressbar"]')

    expect(bar.exists()).toBe(true)
    expect(bar.attributes('aria-valuemax')).toBe('3')
    expect(bar.element.children).toHaveLength(3)
  })
})

describe('測試項目 13 / 15 / 16 / 21：底部主要操作', () => {
  it('開放選購 → 送出訂單', async () => {
    const wrapper = await mountViewer([makeProduct()])

    expect(wrapper.text()).toContain('送出訂單')
    expect(wrapper.text()).toContain('開放選購')
  })

  it('測試項目 15：別人保留中 → 不提供送出訂單，改為排隊候補', async () => {
    const wrapper = await mountViewer([makeProduct({
      status: 'reserved',
      statusLabel: '保留中',
      canPurchase: false,
      canWaitlist: true
    })])

    const text = wrapper.text()

    expect(text).toContain('保留中')
    expect(text).toContain('排隊候補')
    expect(text).not.toContain('送出訂單')
  })

  it('測試項目 14：自己訂走的商品顯示待付訂金', async () => {
    const wrapper = await mountViewer([makeProduct({
      status: 'reserved',
      statusLabel: '保留中',
      canPurchase: false,
      canWaitlist: false,
      myOrderId: 'order-1'
    })])

    expect(wrapper.text()).toContain('待付訂金')
  })

  it('測試項目 17：已在候補中顯示順位且不能重複排隊', async () => {
    const wrapper = await mountViewer([makeProduct({
      status: 'reserved',
      statusLabel: '保留中',
      canPurchase: false,
      canWaitlist: false,
      myWaitlistId: 'entry-1',
      waitlistPosition: 2
    })])

    const text = wrapper.text()

    expect(text).toContain('候補中')
    expect(text).toContain('第 2 順位')
    expect(text).not.toContain('排隊候補')
  })

  it('測試項目 21：已售完時購買按鈕停用', async () => {
    const wrapper = await mountViewer([makeProduct({
      status: 'sold',
      statusLabel: '已售完',
      canPurchase: false,
      canWaitlist: false
    })])

    expect(wrapper.text()).toContain('已售完')

    const disabled = wrapper.findAll('button').filter(button =>
      button.text().includes('已售完') && button.attributes('disabled') !== undefined
    )

    expect(disabled.length).toBeGreaterThan(0)
  })

  it('候補優先購買時段對非候補者顯示鎖定', async () => {
    const wrapper = await mountViewer([makeProduct({
      canPurchase: false,
      canWaitlist: false,
      priorityWindowActive: true
    })])

    expect(wrapper.text()).toContain('候補優先購買時段')
  })
})

describe('測試項目 12：追蹤', () => {
  it('點追蹤按鈕會送出 follow 事件與商品 id', async () => {
    const wrapper = await mountViewer([makeProduct()])

    const followButton = wrapper.findAll('button').find(button =>
      button.attributes('aria-label') === '追蹤這件作品'
    )

    expect(followButton).toBeTruthy()
    await followButton!.trigger('click')

    expect(wrapper.emitted('follow')?.[0]).toEqual(['product-1'])
  })

  it('已追蹤時按鈕的無障礙標籤變成取消追蹤', async () => {
    const wrapper = await mountViewer([makeProduct({ isFollowing: true })])

    const button = wrapper.findAll('button').find(item =>
      item.attributes('aria-label') === '取消追蹤'
    )

    expect(button).toBeTruthy()
  })

  it('追蹤按鈕與購買按鈕是分開的兩顆，不會互相觸發', async () => {
    const wrapper = await mountViewer([makeProduct()])

    const follow = wrapper.findAll('button').find(b => b.attributes('aria-label') === '追蹤這件作品')
    const order = wrapper.findAll('button').find(b => b.text().includes('送出訂單'))

    expect(follow).toBeTruthy()
    expect(order).toBeTruthy()
    expect(follow!.element).not.toBe(order!.element)

    await order!.trigger('click')

    expect(wrapper.emitted('order')?.[0]).toEqual(['product-1'])
    expect(wrapper.emitted('follow')).toBeUndefined()
  })
})

describe('連點右側快速翻閱（手動測試發現的回歸）', () => {
  /** 模擬一次沒有位移的點擊：pointerdown → pointerup 同一個座標 */
  function tap(surface: Element, clientX: number, clientY = 400) {
    const options = { bubbles: true, pointerId: 1, clientX, clientY }

    surface.dispatchEvent(new PointerEvent('pointerdown', options))
    surface.dispatchEvent(new PointerEvent('pointerup', options))
  }

  it('連續點兩下右側會前進兩件，不會被雙擊縮放吃掉', async () => {
    const wrapper = await mountViewer([
      makeProduct({ id: 'p1', name: '第一件' }),
      makeProduct({ id: 'p2', name: '第二件' }),
      makeProduct({ id: 'p3', name: '第三件' })
    ])

    const surface = wrapper.find('.market-gesture-surface').element

    // happy-dom 量不到版面，手動給一個寬度讓 resolveTapZone 算得出左右區
    surface.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 400, height: 800, right: 400, bottom: 800, x: 0, y: 0,
      toJSON: () => ({})
    })

    expect(wrapper.text()).toContain('第一件')

    // 兩下都在 300ms 內，先前會被判成雙擊縮放而停在第二件
    tap(surface, 380)
    await nextTick()
    tap(surface, 380)
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('第三件')
    expect(progressOf(wrapper)).toBe('3 / 3')
  })

  it('點左側回到上一件', async () => {
    const wrapper = await mountViewer([
      makeProduct({ id: 'p1', name: '第一件' }),
      makeProduct({ id: 'p2', name: '第二件' })
    ])

    const surface = wrapper.find('.market-gesture-surface').element

    surface.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 400, height: 800, right: 400, bottom: 800, x: 0, y: 0,
      toJSON: () => ({})
    })

    tap(surface, 380)
    await nextTick()
    await nextTick()
    expect(wrapper.text()).toContain('第二件')

    tap(surface, 20)
    await nextTick()
    await nextTick()
    expect(wrapper.text()).toContain('第一件')
  })

  it('點中央不切換商品，才不會干擾底部按鈕', async () => {
    const wrapper = await mountViewer([
      makeProduct({ id: 'p1', name: '第一件' }),
      makeProduct({ id: 'p2', name: '第二件' })
    ])

    const surface = wrapper.find('.market-gesture-surface').element

    surface.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 400, height: 800, right: 400, bottom: 800, x: 0, y: 0,
      toJSON: () => ({})
    })

    tap(surface, 200)
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('第一件')
  })
})

describe('鍵盤操作（需求 14）', () => {
  it('左右方向鍵切換商品', async () => {
    const wrapper = await mountViewer([
      makeProduct({ id: 'p1', name: '第一件' }),
      makeProduct({ id: 'p2', name: '第二件' })
    ])

    expect(wrapper.text()).toContain('第一件')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('第二件')
    expect(progressOf(wrapper)).toBe('2 / 2')

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    await nextTick()
    await nextTick()

    expect(wrapper.text()).toContain('第一件')
  })

  it('第一件再按左鍵不會越界', async () => {
    const wrapper = await mountViewer([makeProduct({ name: '唯一一件' })])

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    await nextTick()

    expect(progressOf(wrapper)).toBe('1 / 1')
  })
})
