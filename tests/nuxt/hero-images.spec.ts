// @vitest-environment nuxt
import { describe, expect, it } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import type { IndexCollectionItem } from '@nuxt/content'
import LandingHero from '../../app/components/landing/Hero.vue'
import { useCloudinaryStore } from '../../app/stores/cloudinary'
import appConfig from '../../app/app.config'

/** 跟著設定走，之後換資料夾名稱時這份測試不用改。 */
const HERO_FOLDER = appConfig.hero.cloudinaryFolder

/**
 * 首頁 Hero 的圖片來源。
 *
 * 兩個分支都要測：資料夾有圖就用 Cloudinary，沒圖要退回 content/index.yml
 * 的靜態圖。退路這件事原本是壞的 —— displayImages 算了卻沒接到畫面上，
 * 所以 Cloudinary 一旦回空的，首頁就只剩九塊灰方塊。
 */

const MARKET_FOLDER = 'market/55555555-5555-4555-8555-555555555555'

function makeResource(publicId: string, assetFolder: string) {
  return {
    public_id: publicId,
    secure_url: `https://res.cloudinary.com/test/${publicId}.jpg`,
    url: `http://res.cloudinary.com/test/${publicId}.jpg`,
    format: 'jpg',
    width: 1000,
    height: 1000,
    bytes: 2048,
    asset_folder: assetFolder
  }
}

let resources: ReturnType<typeof makeResource>[] = []

registerEndpoint('/api/cloudinary', () => ({ resources }))

const page = {
  title: '清嶼 Tranquil Island',
  description: '手作陶瓷',
  hero: {
    links: [],
    images: [
      { src: '/hero/random-1.avif', alt: '靜態圖 1' },
      { src: '/hero/random-2.avif', alt: '靜態圖 2' }
    ]
  }
} as unknown as IndexCollectionItem

async function mountHero() {
  const wrapper = await mountSuspended(LandingHero, { props: { page } })

  // mountSuspended 共用同一個 Nuxt app 的 pinia，store 會跨測試留著，
  // 而 fetchImages 抓過就不再抓。先清掉快取再抓一次，每個案例才是乾淨的。
  const store = useCloudinaryStore()

  store.images = []
  await store.fetchImages()
  await wrapper.vm.$nextTick()

  return wrapper
}

describe('LandingHero 的圖片來源', () => {
  it('設定的資料夾有圖時就用 Cloudinary 的圖', async () => {
    resources = [makeResource('curated-one', HERO_FOLDER), makeResource('curated-two', HERO_FOLDER)]

    const html = (await mountHero()).html()

    expect(html).toContain('curated-one')
    expect(html).not.toContain('/hero/random-1.avif')
  })

  it('後台上傳的市集照片不會出現在首頁', async () => {
    resources = [makeResource('bowl', MARKET_FOLDER), makeResource('cup', MARKET_FOLDER)]

    const html = (await mountHero()).html()

    expect(html).not.toContain('bowl')
    expect(html).not.toContain('cup')
  })

  it('設定的資料夾沒圖時退回 content 的靜態圖，不是一片空白', async () => {
    resources = [makeResource('bowl', MARKET_FOLDER)]

    const html = (await mountHero()).html()

    expect(html).toContain('random-1.avif')
    expect(html).toContain('random-2.avif')
  })

  it('Cloudinary 整支掛掉時也還有靜態圖可以顯示', async () => {
    resources = []

    const html = (await mountHero()).html()

    expect(html).toContain('random-1.avif')
  })
})

/**
 * 市集入口的位置（「logo 下面就是市集」）。
 *
 * 位置本身就是需求，所以用 DOM 順序鎖住：卡片必須在 logo 之後、
 * 而且仍然在 headline 這一塊裡面，不能被改回「整個 Hero 之後」。
 */
describe('LandingHero 的 afterLogo 插槽', () => {
  it('插槽內容渲染在 logo 正下方', async () => {
    resources = []

    const wrapper = await mountSuspended(LandingHero, {
      props: { page },
      slots: { afterLogo: () => h('div', { 'data-test': 'market-slot' }, '線上市集') }
    })

    const html = wrapper.html()
    const logoAt = html.indexOf('My profile picture')
    const slotAt = html.indexOf('data-test="market-slot"')

    expect(logoAt).toBeGreaterThan(-1)
    expect(slotAt).toBeGreaterThan(-1)
    expect(logoAt).toBeLessThan(slotAt)

    // 直向堆疊：logo 一列、卡片一列，而不是擠在同一列
    const headline = wrapper.find('.flex-col')

    expect(headline.exists()).toBe(true)
    expect(headline.find('[data-test="market-slot"]').exists()).toBe(true)
  })

  it('沒有傳插槽時版型維持原本的單列置中', async () => {
    resources = []

    const wrapper = await mountSuspended(LandingHero, { props: { page } })

    expect(wrapper.html()).toContain('flex items-center justify-center')
    expect(wrapper.html()).not.toContain('flex-col items-center justify-center')
  })
})
