// @vitest-environment nuxt
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { readBody } from 'h3'
import AdminCategoriesPage from '../../app/pages/admin/market/categories.vue'

/**
 * 後台的作品分類管理頁。
 *
 * 這一頁我沒辦法在瀏覽器裡點（要 Google 登入，那是店主的帳號），
 * 所以建立分類送出去的 body 對不對，只能靠這裡鎖住。
 */

let listing = {
  categories: [] as Array<{
    id: string
    name: string
    slug: string
    description: string | null
    sortOrder: number
    productCount: number
  }>,
  uncategorizedCount: 0
}

let posted: Record<string, unknown> | null = null

registerEndpoint('/api/admin/market/categories', async (event) => {
  if (event.method === 'POST') {
    posted = await readBody(event)

    return { category: { id: 'new', name: String(posted?.name ?? ''), slug: 'x', description: null, sortOrder: 0, productCount: 0 } }
  }

  return listing
})

/**
 * useFetch 會依 URL 快取在 Nuxt 的 payload 裡，同一個測試檔共用一個 Nuxt app，
 * 所以不清掉的話第二個案例會看到第一個案例的資料（空清單那個案例就是這樣被騙過去的）。
 */
async function mountPage() {
  clearNuxtData()

  return await mountSuspended(AdminCategoriesPage)
}

beforeEach(() => {
  posted = null
  listing = {
    categories: [
      { id: 'c1', name: '森野', slug: 'senya', description: '以森林為題的手捏系列', sortOrder: 0, productCount: 2 },
      { id: 'c2', name: '林間', slug: 'rinkan', description: null, sortOrder: 10, productCount: 0 }
    ],
    uncategorizedCount: 3
  }
})

describe('後台作品分類', () => {
  it('列出分類、代稱與件數', async () => {
    const wrapper = await mountPage()
    const text = wrapper.text()

    expect(text).toContain('森野')
    expect(text).toContain('senya')
    expect(text).toContain('2 件')
    expect(text).toContain('林間')
    expect(text).toContain('0 件')
  })

  it('把還沒分類的件數講出來，那是整理的進度指標', async () => {
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('沒有分類')
  })

  it('沒有任何分類時給一句能照做的提示', async () => {
    listing = { categories: [], uncategorizedCount: 0 }

    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('還沒有任何分類')
    expect(wrapper.text()).toContain('森野')
  })

  it('新增分類會把名稱與代稱送出去', async () => {
    const wrapper = await mountPage()

    await wrapper.find('input[placeholder="森野"]').setValue('苔色')
    await wrapper.find('input[placeholder="senya"]').setValue('taise')
    await wrapper.find('form').trigger('submit')

    await vi.waitFor(() => expect(posted).not.toBeNull())

    expect(posted).toMatchObject({ name: '苔色', slug: 'taise' })
  })

  it('名稱空白時擋在前端，不白跑一趟', async () => {
    const wrapper = await mountPage()

    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    expect(posted).toBeNull()
    expect(wrapper.text()).toContain('請填寫分類名稱')
  })

  it('代稱留白也能送出，伺服器會自己產生', async () => {
    const wrapper = await mountPage()

    await wrapper.find('input[placeholder="森野"]').setValue('苔色')
    await wrapper.find('form').trigger('submit')

    await vi.waitFor(() => expect(posted).not.toBeNull())

    expect(posted).toMatchObject({ name: '苔色', slug: '' })
  })
})
