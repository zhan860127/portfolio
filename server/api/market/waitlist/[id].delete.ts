import { and, eq, inArray } from 'drizzle-orm'
import { waitlistEntries } from '../../../database/schema'

/**
 * 取消候補。
 *
 * 用狀態標記而不是真的刪除：保留加入時間與取消紀錄，
 * 之後要查「這件作品曾經排過幾個人」才有資料。
 * 取消後 partial unique index 不再涵蓋這一筆，使用者可以重新加入排到隊尾。
 */
export default defineEventHandler(async (event) => {
  const user = await requireDbUser(event)
  const entryId = requireUuid(getRouterParam(event, 'id'), 'waitlist id')

  const db = useDb()

  const [updated] = await db
    .update(waitlistEntries)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(
      eq(waitlistEntries.id, entryId),
      eq(waitlistEntries.userId, user.id),
      inArray(waitlistEntries.status, ['waiting', 'notified'])
    ))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Waitlist entry not found' })
  }

  return { success: true, id: updated.id }
})
