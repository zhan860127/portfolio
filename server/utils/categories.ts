// 與 market.ts 同樣的理由：單元測試在純 Node 環境直接 import，沒有 Nitro 的 auto-import。
import { createError } from 'h3'
import type { MarketCategory } from '../database/schema'

/**
 * 作品分類（品項）的純邏輯層。
 *
 * 名稱怎麼正規化、代稱怎麼產生、同一個分類底下的下一個流水號是多少 ——
 * 全部放這裡而不是 handler 裡，因為分類一旦長歪（「森野」與「森野 」變成兩個）
 * 就要一件一件搬回去，而那正是這些規則在擋的事。
 */

export const CATEGORY_NAME_MAX = 30
export const CATEGORY_SLUG_MAX = 32

/** 還沒分類的作品在前台顯示成這個，而不是消失 */
export const UNCATEGORIZED_LABEL = '其他'

/**
 * 分類名稱正規化。
 *
 * 內部連續空白收成一個、首尾去掉 —— 「森野」與「森野 」看起來一樣，
 * 但在唯一索引眼裡是兩筆，不收斂的話重複分類會從這裡長出來。
 */
export function normalizeCategoryName(input: unknown): string {
  const name = String(input ?? '').trim().replace(/\s+/g, ' ').slice(0, CATEGORY_NAME_MAX)

  if (name.length === 0) {
    throw createError({ statusCode: 400, statusMessage: '請填寫分類名稱' })
  }

  return name
}

/**
 * 把名稱轉成網址用的代稱。
 * 中文轉不出東西（回 null），由呼叫端改用流水代稱。
 */
export function slugify(input: string): string | null {
  const slug = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CATEGORY_SLUG_MAX)

  return /^[a-z0-9][a-z0-9-]*$/.test(slug) ? slug : null
}

/**
 * 決定這個分類的代稱。
 *
 * 優先用管理員自己填的；沒填就從名稱轉；中文名轉不出來就給 c1、c2…。
 * 撞到既有代稱時往後加序號，而不是直接讓唯一索引丟錯 ——
 * 「森野」與「森野二代」轉出來都是空的，這種情況在中文店家是常態。
 */
export function resolveCategorySlug(
  requested: unknown,
  name: string,
  taken: Iterable<string>
): string {
  const used = new Set(taken)
  const asked = String(requested ?? '').trim().toLowerCase()

  if (asked) {
    const slug = slugify(asked)

    if (!slug) {
      throw createError({ statusCode: 400, statusMessage: '網址代稱只能用英文小寫、數字與連字號' })
    }

    if (used.has(slug)) {
      throw createError({ statusCode: 409, statusMessage: `代稱「${slug}」已經有人用了` })
    }

    return slug
  }

  const base = slugify(name) ?? 'c'

  if (!used.has(base)) {
    return base
  }

  for (let suffix = 2; suffix < 1000; suffix++) {
    const candidate = `${base}-${suffix}`.slice(0, CATEGORY_SLUG_MAX)

    if (!used.has(candidate)) {
      return candidate
    }
  }

  throw createError({ statusCode: 500, statusMessage: '無法產生分類代稱' })
}

/**
 * 同一個分類底下的下一個作品名稱，例如「森野 01」「森野 02」之後給「森野 03」。
 *
 * 只是後台新增時的預填值，管理員可以直接改掉。
 * 認得「森野 01」「森野01」兩種寫法，取最大的號碼往上加，
 * 而不是用件數 —— 刪掉中間一件之後用件數會撞號。
 */
export function nextProductName(categoryName: string, existingNames: string[]): string {
  const escaped = categoryName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^${escaped}\\s*(\\d+)$`)

  const highest = existingNames.reduce((max, current) => {
    const matched = pattern.exec(current.trim())

    if (!matched) {
      return max
    }

    return Math.max(max, Number(matched[1]))
  }, 0)

  return `${categoryName} ${String(highest + 1).padStart(2, '0')}`
}

/* -------------------------------------------------------------------------- */
/*  序列化                                                                      */
/* -------------------------------------------------------------------------- */

export interface ApiCategory {
  id: string
  name: string
  slug: string
  description: string | null
  sortOrder: number
  /** 這個分類底下有幾件作品。沒有件數的分類膠囊對客人沒有用。 */
  productCount: number
}

export function toApiCategory(category: MarketCategory, productCount = 0): ApiCategory {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
    sortOrder: category.sortOrder,
    productCount
  }
}

/** 掛在商品上的精簡分類資訊，前台只需要這三個欄位 */
export interface ApiProductCategory {
  id: string
  name: string
  slug: string
}

export function toApiProductCategory(category: MarketCategory | null | undefined): ApiProductCategory | null {
  if (!category) {
    return null
  }

  return { id: category.id, name: category.name, slug: category.slug }
}
