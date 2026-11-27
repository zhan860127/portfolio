import { describe, expect, it } from 'vitest'
import {
  UNCATEGORIZED_LABEL,
  nextProductName,
  normalizeCategoryName,
  resolveCategorySlug,
  slugify,
  toApiProductCategory
} from '../../server/utils/categories'

/**
 * 作品分類（品項）的規則層。
 *
 * 這裡擋的是「分類長歪」：「森野」與「森野 」變成兩個分類之後，
 * 件數再也加不起來，而且要一件一件搬回去。
 */

describe('分類名稱', () => {
  it('去掉首尾空白', () => {
    expect(normalizeCategoryName('  森野  ')).toBe('森野')
  })

  it('把中間連續空白收成一個', () => {
    expect(normalizeCategoryName('森野   系列')).toBe('森野 系列')
  })

  it('空白名稱擋下來', () => {
    expect(() => normalizeCategoryName('')).toThrow()
    expect(() => normalizeCategoryName('   ')).toThrow()
    expect(() => normalizeCategoryName(null)).toThrow()
  })

  it('超長名稱截斷在 30 字', () => {
    expect(normalizeCategoryName('森'.repeat(50))).toHaveLength(30)
  })
})

describe('網址代稱', () => {
  it('英文名轉得出代稱', () => {
    expect(slugify('Forest Series')).toBe('forest-series')
    expect(slugify('TQ001')).toBe('tq001')
  })

  it('中文名轉不出東西，回 null', () => {
    expect(slugify('森野')).toBeNull()
    expect(slugify('杯')).toBeNull()
  })

  it('沒填代稱時從名稱產生', () => {
    expect(resolveCategorySlug('', 'Forest', [])).toBe('forest')
  })

  it('中文名又沒填代稱時給一個預設值，不是讓它爆掉', () => {
    expect(resolveCategorySlug('', '森野', [])).toBe('c')
  })

  it('撞到既有代稱會往後加序號', () => {
    // 「森野」與「森野二代」轉出來都是空的，中文店家這是常態
    expect(resolveCategorySlug('', '森野', ['c'])).toBe('c-2')
    expect(resolveCategorySlug('', '森野', ['c', 'c-2'])).toBe('c-3')
  })

  it('管理員自己填的代稱優先', () => {
    expect(resolveCategorySlug('senya', '森野', [])).toBe('senya')
    expect(resolveCategorySlug('  SENYA  ', '森野', [])).toBe('senya')
  })

  it('自己填的代稱撞號時直接報錯，不默默改掉', () => {
    expect(() => resolveCategorySlug('senya', '森野', ['senya'])).toThrow()
  })

  it('自己填的代稱不合法時報錯', () => {
    expect(() => resolveCategorySlug('森野', '森野', [])).toThrow()
    expect(() => resolveCategorySlug('!!!', '森野', [])).toThrow()
  })
})

describe('同分類底下的下一個作品名稱', () => {
  it('森野 01、森野 02 之後是森野 03', () => {
    expect(nextProductName('森野', ['森野 01', '森野 02'])).toBe('森野 03')
  })

  it('還沒有任何一件時從 01 開始', () => {
    expect(nextProductName('森野', [])).toBe('森野 01')
  })

  it('沒有空格的寫法也認得', () => {
    expect(nextProductName('森野', ['森野01', '森野02'])).toBe('森野 03')
  })

  it('中間刪掉一件時接最大號，不是接件數', () => {
    // 用件數的話這裡會算出 03，直接撞到既有的森野 03
    expect(nextProductName('森野', ['森野 01', '森野 03'])).toBe('森野 04')
  })

  it('不是這個分類命名規則的作品不影響編號', () => {
    expect(nextProductName('森野', ['森野 01', '隨手捏的小杯'])).toBe('森野 02')
  })

  it('名稱帶正則特殊字元時不會爆掉', () => {
    expect(nextProductName('森野(A)', ['森野(A) 01'])).toBe('森野(A) 02')
  })

  it('超過 9 件之後不再補零', () => {
    expect(nextProductName('森野', ['森野 09'])).toBe('森野 10')
    expect(nextProductName('森野', ['森野 99'])).toBe('森野 100')
  })
})

describe('序列化', () => {
  it('沒有分類時回 null，前台自己顯示成其他', () => {
    expect(toApiProductCategory(null)).toBeNull()
    expect(UNCATEGORIZED_LABEL).toBe('其他')
  })

  it('只帶前台需要的三個欄位出去', () => {
    const category = {
      id: 'c1',
      name: '森野',
      slug: 'senya',
      description: '內部備註',
      sortOrder: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    expect(toApiProductCategory(category)).toEqual({ id: 'c1', name: '森野', slug: 'senya' })
  })
})
