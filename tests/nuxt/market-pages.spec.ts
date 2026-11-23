// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import MarketEntry from '../../app/components/market/MarketEntry.vue'
import MarketIndexPage from '../../app/pages/market/index.vue'

/** 對應需求 15 的測試項目 1（首頁入口）與 2（活動列表）。 */

const MARKETS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    title: '春季限定市集',
    description: '十二件手捏器物',
    coverImage: 'https://example.com/cover.jpg',
    startsAt: '2026-06-01T00:00:00.000Z',
    endsAt: '2026-06-30T00:00:00.000Z',
    status: 'live',
    statusLabel: '進行中',
    productCount: 12,
    waitlistWindowHours: 24,
    depositDueHours: 48
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    title: '秋日預告場',
    description: null,
    coverImage: null,
    startsAt: '2026-09-01T00:00:00.000Z',
    endsAt: '2026-09-10T00:00:00.000Z',
    status: 'upcoming',
    statusLabel: '即將開始',
    productCount: 5,
    waitlistWindowHours: 24,
    depositDueHours: 48
  }
]

registerEndpoint('/api/market/markets', () => MARKETS)

describe('測試項目 1：首頁線上市集入口', () => {
  it('顯示品牌文案並連到進行中的市集', async () => {
    const wrapper = await mountSuspended(MarketEntry)
    await nextTick()

    const text = wrapper.text()

    expect(text).toContain('線上市集')
    expect(text).toContain('ONLINE MARKET')
    expect(text).toContain('瀏覽本次作品')
  })

  it('有進行中的場次時直接連進該場，而不是停在列表頁', async () => {
    const wrapper = await mountSuspended(MarketEntry)
    await nextTick()
    await nextTick()

    const link = wrapper.find('a')

    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe(`/market/${MARKETS[0]!.id}`)
  })

  it('沒有活動資料時仍然渲染入口，連到市集列表', async () => {
    const wrapper = await mountSuspended(MarketEntry, {
      props: { fallbackImage: '/hero/random-1.avif' }
    })

    expect(wrapper.text()).toContain('線上市集')
    expect(wrapper.find('img').exists()).toBe(true)
  })
})

describe('測試項目 2：活動列表', () => {
  it('列出每一場活動的名稱、介紹、商品數量與狀態', async () => {
    const wrapper = await mountSuspended(MarketIndexPage)
    await nextTick()
    await nextTick()

    const text = wrapper.text()

    expect(text).toContain('春季限定市集')
    expect(text).toContain('十二件手捏器物')
    expect(text).toContain('本次共 12 件作品')
    expect(text).toContain('進行中')

    expect(text).toContain('秋日預告場')
    expect(text).toContain('本次共 5 件作品')
    expect(text).toContain('即將開始')
  })

  it('每一場都連到自己的活動頁', async () => {
    const wrapper = await mountSuspended(MarketIndexPage)
    await nextTick()
    await nextTick()

    const hrefs = wrapper.findAll('a').map(link => link.attributes('href'))

    expect(hrefs).toContain(`/market/${MARKETS[0]!.id}`)
    expect(hrefs).toContain(`/market/${MARKETS[1]!.id}`)
  })

  it('進行中與即將開始的按鈕文案不同，使用者能分辨能不能買', async () => {
    const wrapper = await mountSuspended(MarketIndexPage)
    await nextTick()
    await nextTick()

    const text = wrapper.text()

    expect(text).toContain('進入市集')
    expect(text).toContain('搶先瀏覽作品')
  })
})
