// @vitest-environment nuxt
import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import MarketSnapshotSheet from '../../app/components/market/MarketSnapshotSheet.vue'
import type { MarketProduct } from '../../app/stores/market'

/** 對應需求 15 的測試項目 10、11。 */

function makeProduct(id: string, overrides: Partial<MarketProduct> = {}): MarketProduct {
  return {
    id,
    code: null,
    name: `作品 ${id}`,
    description: null,
    price: 1800,
    deposit: 500,
    images: [{ src: `https://example.com/${id}.jpg` }],
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

const products = [makeProduct('a'), makeProduct('b'), makeProduct('c')]

// 這個元件用 Teleport 把內容掛到 body，不會隨 wrapper 自動消失，
// 殘留下來會讓下一個測試查到上一個測試的 DOM。
let mounted: Array<{ unmount: () => void }> = []

afterEach(() => {
  for (const wrapper of mounted) {
    wrapper.unmount()
  }

  mounted = []
  document.body.innerHTML = ''
})

async function mountSheet(props: {
  open?: boolean
  products?: MarketProduct[]
  currentIndex?: number
  viewed?: Set<number>
} = {}) {
  const wrapper = await mountSuspended(MarketSnapshotSheet, {
    props: {
      open: props.open ?? true,
      products: props.products ?? products,
      currentIndex: props.currentIndex ?? 0,
      viewed: props.viewed ?? new Set([0])
    },
    attachTo: document.body
  })

  mounted.push(wrapper)

  return wrapper
}

function thumbnails() {
  return [...document.body.querySelectorAll('button')].filter(button => button.querySelector('img'))
}

describe('測試項目 10：點擊快照跳轉商品', () => {
  it('點其他商品的縮圖會送出該商品的索引', async () => {
    const wrapper = await mountSheet({ currentIndex: 1 })
    const thumbs = thumbnails()

    expect(thumbs).toHaveLength(products.length)

    thumbs[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('select')?.[0]).toEqual([2])
  })

  it('點第一件會回到索引 0', async () => {
    const wrapper = await mountSheet({ currentIndex: 2 })

    thumbnails()[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('select')?.[0]).toEqual([0])
  })
})

describe('測試項目 11：關閉後回到正確商品', () => {
  it('點目前這件商品等於關閉列表，不會跳到別件', async () => {
    const wrapper = await mountSheet({ currentIndex: 1 })

    thumbnails()[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(wrapper.emitted('close')).toBeTruthy()
    // 關鍵：不能同時送出 select，否則目前索引會被重設
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('目前商品的縮圖帶 aria-current，使用者不會失去位置', async () => {
    await mountSheet({ currentIndex: 2 })
    const current = document.body.querySelector('button[aria-current="true"]')

    expect(current).not.toBeNull()
    expect(current?.textContent).toContain('作品 c')
  })
})

describe('快照列表內容', () => {
  it('列出本次全部商品，含名稱、價格與狀態', async () => {
    await mountSheet()
    const text = document.body.textContent ?? ''

    expect(text).toContain('本次作品 3 件')
    expect(text).toContain('作品 a')
    expect(text).toContain('作品 b')
    expect(text).toContain('作品 c')
    expect(text).toContain('1,800')
    expect(text).toContain('開放選購')
  })

  it('保留中與已售完的狀態標籤正確顯示', async () => {
    await mountSheet({
      products: [
        makeProduct('x', { status: 'reserved', statusLabel: '保留中' }),
        makeProduct('y', { status: 'sold', statusLabel: '已售完' })
      ]
    })

    const text = document.body.textContent ?? ''

    expect(text).toContain('保留中')
    expect(text).toContain('已售完')
  })

  it('關閉時不渲染任何縮圖', async () => {
    await mountSheet({ open: false })

    expect(thumbnails()).toHaveLength(0)
  })
})

describe('縮圖上的標記', () => {
  it('追蹤中的作品顯示實心愛心', async () => {
    await mountSheet({
      products: [makeProduct('a', { isFollowing: true }), makeProduct('b')]
    })

    const badges = document.body.querySelectorAll('[aria-label="已追蹤"]')

    expect(badges).toHaveLength(1)
    // 實心靠 svg 模式 + fill-current，lucide 本身沒有實心愛心
    expect(badges[0]?.querySelector('svg')?.getAttribute('class')).toContain('fill-current')
  })

  it('沒追蹤的作品不顯示愛心，也不帶陰影', async () => {
    await mountSheet({ products: [makeProduct('a')] })

    expect(document.body.querySelectorAll('[aria-label="已追蹤"]')).toHaveLength(0)
    expect(document.body.innerHTML).not.toContain('shadow-sm')
  })

  it('看過的作品不再標示已瀏覽', async () => {
    await mountSheet({ viewed: new Set([0, 1]), currentIndex: 2 })

    expect(document.body.querySelectorAll('[aria-label="已瀏覽"]')).toHaveLength(0)
  })
})
