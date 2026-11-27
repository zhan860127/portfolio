import { describe, expect, it } from 'vitest'
import { OTHER_CATEGORY, filterByCategory, normalizeCategoryQuery } from '../../app/utils/categoryFilter'

/**
 * 前台的分類篩選。
 *
 * 篩錯的後果是客人以為作品賣完了，所以每一種輸入都要有案例：
 * 沒選、選了、選到未分類、網址被亂改、分類改名後的舊連結。
 */

function product(slug: string | null) {
  return {
    name: slug ?? '未分類',
    category: slug ? { id: slug, name: slug, slug } : null
  }
}

const products = [
  product('senya'),
  product('senya'),
  product('rinkan'),
  product(null)
]

describe('依分類篩選', () => {
  it('沒選分類時回傳全部', () => {
    expect(filterByCategory(products, null)).toHaveLength(4)
  })

  it('選了分類只留那一類', () => {
    const result = filterByCategory(products, 'senya')

    expect(result).toHaveLength(2)
    expect(result.every(item => item.category?.slug === 'senya')).toBe(true)
  })

  it('選「其他」只留沒有分類的', () => {
    const result = filterByCategory(products, OTHER_CATEGORY)

    expect(result).toHaveLength(1)
    expect(result[0]?.category).toBeNull()
  })

  it('不改動原本的陣列', () => {
    const copy = [...products]

    filterByCategory(products, 'senya')

    expect(products).toEqual(copy)
  })

  it('空清單不會爆', () => {
    expect(filterByCategory([], 'senya')).toEqual([])
  })
})

describe('網址上的分類參數', () => {
  const known = ['senya', 'rinkan']

  it('空值代表全部', () => {
    expect(normalizeCategoryQuery(undefined, known, true)).toBeNull()
    expect(normalizeCategoryQuery('', known, true)).toBeNull()
    expect(normalizeCategoryQuery('   ', known, true)).toBeNull()
  })

  it('認得的代稱原樣留著', () => {
    expect(normalizeCategoryQuery('senya', known, true)).toBe('senya')
  })

  it('不認得的代稱當成全部，不報錯也不給空白', () => {
    // 分類改名之後的舊連結會走到這裡
    expect(normalizeCategoryQuery('ghost', known, true)).toBeNull()
    expect(normalizeCategoryQuery('<script>', known, true)).toBeNull()
  })

  it('「其他」只有在真的有未分類作品時才算數', () => {
    expect(normalizeCategoryQuery(OTHER_CATEGORY, known, true)).toBe(OTHER_CATEGORY)
    expect(normalizeCategoryQuery(OTHER_CATEGORY, known, false)).toBeNull()
  })

  it('網址帶了兩個 c 時取第一個', () => {
    expect(normalizeCategoryQuery(['senya', 'rinkan'], known, true)).toBe('senya')
  })
})
