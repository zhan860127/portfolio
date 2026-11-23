import { markets } from '../../../database/schema'

interface CreateMarketBody {
  title?: string
  description?: string
  coverImage?: string
  startsAt?: string
  endsAt?: string
  status?: string
  depositDueHours?: number
  waitlistWindowHours?: number
  allowWaitlistWhenSold?: boolean
  sortOrder?: number
}

/** 新增活動。預設建立成草稿，必須另外按上架才會對外出現。 */
export default defineEventHandler(async (event) => {
  const admin = await requireAdminUser(event)
  const body = await readBody<CreateMarketBody>(event)

  const title = String(body?.title ?? '').trim()

  if (!title) {
    throw createError({ statusCode: 400, statusMessage: '請輸入活動名稱' })
  }

  const { start, end } = parseMarketDates(body?.startsAt, body?.endsAt)

  const db = useDb()

  const [created] = await db
    .insert(markets)
    .values({
      title,
      description: String(body?.description ?? '').trim() || null,
      coverImage: String(body?.coverImage ?? '').trim() || null,
      startsAt: start,
      endsAt: end,
      status: body?.status === 'upcoming' || body?.status === 'live' || body?.status === 'ended'
        ? body.status
        : 'draft',
      depositDueHours: Number.isFinite(Number(body?.depositDueHours)) ? Number(body?.depositDueHours) : 48,
      waitlistWindowHours: Number.isFinite(Number(body?.waitlistWindowHours)) ? Number(body?.waitlistWindowHours) : 24,
      allowWaitlistWhenSold: body?.allowWaitlistWhenSold ? 1 : 0,
      sortOrder: Number.isFinite(Number(body?.sortOrder)) ? Number(body?.sortOrder) : 0
    })
    .returning()

  if (!created) {
    throw createError({ statusCode: 500, statusMessage: 'Failed to create market' })
  }

  await writeAuditLog({
    actorId: admin.id,
    action: 'market.create',
    entityType: 'market',
    entityId: created.id,
    newValue: { title: created.title, status: created.status }
  })

  return { success: true, market: toApiMarket(created, 0) }
})
