import type { H3Event } from 'h3'
import { users } from '../database/schema'
import type { User } from '../database/schema'

/**
 * 以 OAuth 帶回來的 email 建立或更新使用者。
 * email 欄位是唯一鍵，一律以小寫寫入以避免大小寫造成重複帳號。
 */
export async function upsertUser(profile: { email: string, name?: string | null, avatar?: string | null }): Promise<User> {
  const db = useDb()
  const email = profile.email.trim().toLowerCase()

  const [user] = await db
    .insert(users)
    .values({
      email,
      name: profile.name ?? null,
      avatarUrl: profile.avatar ?? null
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        name: profile.name ?? null,
        avatarUrl: profile.avatar ?? null,
        updatedAt: new Date()
      }
    })
    .returning()

  if (!user) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to persist user' })
  }

  return user
}

/**
 * 取得目前登入者在 DB 中的資料列。
 * 舊的 session 沒有帶 id，這裡以 email upsert 補齊，登入中的使用者不會被登出。
 */
export async function requireDbUser(event: H3Event): Promise<User> {
  const { user } = await requireUserSession(event)
  const email = (user as { email?: string } | undefined)?.email

  if (!email) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  return await upsertUser({
    email,
    name: (user as { name?: string }).name,
    avatar: (user as { avatar?: string }).avatar
  })
}
