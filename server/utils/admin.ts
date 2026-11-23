import type { H3Event } from 'h3'
import type { User } from '../database/schema'

/**
 * 後台權限。
 *
 * 權限的「事實來源」是 DB 的 users.role，環境變數只負責種子：
 * ADMIN_EMAILS 裡的信箱在登入時會被自動提權成 admin，讓第一位管理員不必手動跑 SQL。
 * 反過來不成立 —— 從 ADMIN_EMAILS 移除不會自動降權，否則改個環境變數就能把
 * 既有管理員踢掉，而且不會留下任何紀錄。降權一律走後台並寫入 audit log。
 */
export function seedAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? ''

  return raw
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean)
}

export function isSeedAdminEmail(email: string): boolean {
  return seedAdminEmails().includes(email.trim().toLowerCase())
}

export function isAdmin(user: Pick<User, 'role'>): boolean {
  return user.role === 'admin'
}

/**
 * 後台 API 的唯一入口。
 * 回 404 而不是 403：不讓未授權者從狀態碼反推後台端點是否存在。
 */
export async function requireAdminUser(event: H3Event): Promise<User> {
  const user = await requireDbUser(event)

  if (!isAdmin(user)) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return user
}
