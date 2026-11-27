/**
 * 前台的分類篩選。
 *
 * 抽成純函式而不是寫在元件裡，是因為「選了分類之後看到哪幾件」這件事
 * 要能被測試直接驗證 —— 篩錯的後果是客人以為作品賣完了。
 */

/**
 * 未分類作品的膠囊代稱。
 *
 * 用一個不可能撞到真實 slug 的值：真的 slug 只會是英文小寫、數字與連字號
 * （伺服器端的 resolveCategorySlug 保證），所以前面兩個底線不會衝突。
 */
export const OTHER_CATEGORY = '__other'

export interface CategorizedProduct {
  category: { id: string, name: string, slug: string } | null
}

/**
 * 依分類代稱篩選。
 *
 * - null：全部
 * - OTHER_CATEGORY：只看未分類
 * - 其他字串：比對 slug
 *
 * 認不得的代稱一律當成「全部」，不要報錯也不要回空清單 ——
 * 網址是可以被亂改、也可能在分類改名後失效的。
 */
export function filterByCategory<T extends CategorizedProduct>(
  products: T[],
  active: string | null
): T[] {
  if (!active) {
    return products
  }

  if (active === OTHER_CATEGORY) {
    return products.filter(product => product.category === null)
  }

  return products.filter(product => product.category?.slug === active)
}

/**
 * 把網址上的 ?c= 收斂成合法的分類代稱。
 * 不存在的分類（例如改名後的舊連結）回 null，也就是顯示全部。
 */
export function normalizeCategoryQuery(
  value: unknown,
  knownSlugs: string[],
  hasUncategorized: boolean
): string | null {
  const slug = String(Array.isArray(value) ? value[0] ?? '' : value ?? '').trim()

  if (!slug) {
    return null
  }

  if (slug === OTHER_CATEGORY) {
    return hasUncategorized ? OTHER_CATEGORY : null
  }

  return knownSlugs.includes(slug) ? slug : null
}
