import { and, eq, inArray } from 'drizzle-orm'
import { waitlistEntries } from '../../../../database/schema'

/** 管理員取消某一筆候補（例如重複帳號、惡意排隊）。一樣留稽核紀錄。 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event)
  const entryId = requireUuid(getRouterParam(event, 'id'), 'waitlist id')

  const db = useDb()

  const [updated] = await db
    .update(waitlistEntries)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(and(
      eq(waitlistEntries.id, entryId),
      inArray(waitlistEntries.status, ['waiting', 'notified'])
    ))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 404, statusMessage: 'Waitlist entry not found' })
  }

  await writeAuditLog({
    actorId: admin.id,
    action: 'waitlist.cancel',
    entityType: 'waitlist',
    entityId: updated.id,
    newValue: { productId: updated.productId, userId: updated.userId }
  })

  return { success: true }
})
