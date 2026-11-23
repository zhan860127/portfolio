import { eq } from 'drizzle-orm'
import { markets } from '../../../../database/schema'
import type { MarketStatus } from '../../../../database/schema'

interface UpdateMarketBody {
  title?: string
  description?: string | null
  coverImage?: string | null
  startsAt?: string
  endsAt?: string
  status?: string
  depositDueHours?: number
  waitlistWindowHours?: number
  allowWaitlistWhenSold?: boolean
  sortOrder?: number
}

const STORED_STATUSES: MarketStatus[] = ['draft', 'upcoming', 'live', 'ended']

/** 編輯活動，含上架（draft → upcoming/live）與下架（→ draft）。 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event)
  const marketId = requireUuid(getRouterParam(event, 'id'), 'market id')
  const body = await readBody<UpdateMarketBody>(event)

  const db = useDb()

  const [existing] = await db
    .select()
    .from(markets)
    .where(eq(markets.id, marketId))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Market not found' })
  }

  const patch: Partial<typeof markets.$inferInsert> = { updatedAt: new Date() }

  if (typeof body?.title === 'string' && body.title.trim()) {
    patch.title = body.title.trim()
  }

  if ('description' in (body ?? {})) {
    patch.description = String(body?.description ?? '').trim() || null
  }

  if ('coverImage' in (body ?? {})) {
    patch.coverImage = String(body?.coverImage ?? '').trim() || null
  }

  if (body?.startsAt || body?.endsAt) {
    const { start, end } = parseMarketDates(
      body?.startsAt ?? existing.startsAt.toISOString(),
      body?.endsAt ?? existing.endsAt.toISOString()
    )
    patch.startsAt = start
    patch.endsAt = end
  }

  if (typeof body?.status === 'string' && STORED_STATUSES.includes(body.status as MarketStatus)) {
    patch.status = body.status as MarketStatus
  }

  if (Number.isFinite(Number(body?.depositDueHours))) {
    patch.depositDueHours = Math.max(1, Number(body?.depositDueHours))
  }

  if (Number.isFinite(Number(body?.waitlistWindowHours))) {
    patch.waitlistWindowHours = Math.max(1, Number(body?.waitlistWindowHours))
  }

  if (typeof body?.allowWaitlistWhenSold === 'boolean') {
    patch.allowWaitlistWhenSold = body.allowWaitlistWhenSold ? 1 : 0
  }

  if (Number.isFinite(Number(body?.sortOrder))) {
    patch.sortOrder = Number(body?.sortOrder)
  }

  const [updated] = await db
    .update(markets)
    .set(patch)
    .where(eq(markets.id, marketId))
    .returning()

  if (!updated) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to update market' })
  }

  const action = patch.status && patch.status !== existing.status
    ? (patch.status === 'draft' ? 'market.unpublish' : 'market.publish')
    : 'market.update'

  await writeAuditLog({
    actorId: admin.id,
    action,
    entityType: 'market',
    entityId: updated.id,
    previousValue: { title: existing.title, status: existing.status, startsAt: existing.startsAt, endsAt: existing.endsAt },
    newValue: { title: updated.title, status: updated.status, startsAt: updated.startsAt, endsAt: updated.endsAt }
  })

  return { success: true, market: toApiMarket(updated, 0) }
})
