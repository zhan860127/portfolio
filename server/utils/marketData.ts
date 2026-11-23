import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import { marketOrders, productFollows, waitlistEntries } from '../database/schema'
import type { MarketOrder, WaitlistEntry } from '../database/schema'

/**
 * 組出「這位使用者看到的商品狀態」所需要的全部資料。
 *
 * 一次把追蹤、訂單、候補三張表撈完再在記憶體裡組裝，而不是每件商品各查一次 ——
 * 市集一場十幾件商品，逐件查就是 N+1，瀏覽器左右滑動時會把 DB 打爆。
 */
export async function buildViewerContext(
  productIds: string[],
  userId: string | null,
  now: Date = new Date()
): Promise<ViewerContext> {
  const context = emptyViewerContext(userId)

  if (productIds.length === 0) {
    return context
  }

  const db = useDb()

  // 候補名單要撈「所有人的」，因為順位與優先購買窗口都得看整個佇列
  const allWaitlist = await db
    .select()
    .from(waitlistEntries)
    .where(and(
      inArray(waitlistEntries.productId, productIds),
      inArray(waitlistEntries.status, ['waiting', 'notified'])
    ))
    .orderBy(asc(waitlistEntries.createdAt))

  const waitlistByProduct = new Map<string, WaitlistEntry[]>()
  for (const entry of allWaitlist) {
    const bucket = waitlistByProduct.get(entry.productId) ?? []
    bucket.push(entry)
    waitlistByProduct.set(entry.productId, bucket)
  }

  for (const [productId, entries] of waitlistByProduct) {
    context.priorityWindows.set(productId, resolvePriorityWindow(entries, now))
  }

  if (!userId) {
    return context
  }

  const [follows, orders] = await Promise.all([
    db
      .select({ productId: productFollows.productId })
      .from(productFollows)
      .where(and(
        eq(productFollows.userId, userId),
        inArray(productFollows.productId, productIds)
      )),
    db
      .select()
      .from(marketOrders)
      .where(and(
        eq(marketOrders.userId, userId),
        inArray(marketOrders.productId, productIds),
        ne(marketOrders.status, 'cancelled')
      ))
  ])

  for (const follow of follows) {
    context.followedProductIds.add(follow.productId)
  }

  for (const order of orders) {
    context.ordersByProductId.set(order.productId, order as MarketOrder)
  }

  for (const [productId, entries] of waitlistByProduct) {
    const mine = entries.find(entry => entry.userId === userId)

    if (mine) {
      context.waitlistByProductId.set(productId, mine)

      const position = waitlistPosition(entries, mine.id)

      if (position !== null) {
        context.waitlistPositions.set(productId, position)
      }
    }
  }

  return context
}

/** session 裡不一定有 id（舊 session），所以統一走這裡拿「可能為 null」的使用者 id。 */
export async function optionalUserId(event: Parameters<typeof getUserSession>[0]): Promise<string | null> {
  const session = await getUserSession(event)
  const email = (session?.user as { email?: string } | undefined)?.email

  if (!email) {
    return null
  }

  try {
    const user = await upsertUser({
      email,
      name: (session.user as { name?: string }).name,
      avatar: (session.user as { avatar?: string }).avatar
    })

    return user.id
  } catch {
    return null
  }
}
