import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as schema from '../../server/database/schema'
import {
  marketOrders,
  marketProducts,
  markets,
  productFollows,
  users,
  waitlistEntries
} from '../../server/database/schema'
import { isUniqueViolation, reserveProductAndCreateOrder } from '../../server/utils/marketOrders'

/**
 * 需要真實 Postgres 的整合測試，對應需求 15 的測試項目 18、22，
 * 以及 13、16、17 當中「只有資料庫能保證」的部分。
 *
 * 執行方式：
 *   DATABASE_URL_TEST=postgres://... pnpm run test:db
 *
 * 沒設定時整組跳過 —— 這些測試會真的寫入資料表，不應該誤連到正式資料庫。
 * 請務必指向一個可以被清空的測試資料庫。
 */
const CONNECTION = process.env.DATABASE_URL_TEST

describe.skipIf(!CONNECTION)('市集訂單的資料庫保證', () => {
  let client: postgres.Sql
  let db: ReturnType<typeof drizzle<typeof schema>>

  const ids = {
    market: '',
    product: '',
    buyers: [] as string[]
  }

  beforeAll(async () => {
    // max > 1 才會有真正的併發連線，用單一連線測不出競爭
    client = postgres(CONNECTION!, { max: 10, prepare: false })
    db = drizzle(client, { schema })

    await migrate(db, { migrationsFolder: './server/database/migrations' })

    const buyers = await db
      .insert(users)
      .values([
        { email: 'race-buyer-1@test.local', name: '買家一' },
        { email: 'race-buyer-2@test.local', name: '買家二' },
        { email: 'race-buyer-3@test.local', name: '買家三' },
        { email: 'race-buyer-4@test.local', name: '買家四' },
        { email: 'race-buyer-5@test.local', name: '買家五' }
      ])
      .onConflictDoUpdate({ target: users.email, set: { updatedAt: new Date() } })
      .returning()

    ids.buyers = buyers.map(buyer => buyer.id)

    const [market] = await db
      .insert(markets)
      .values({
        title: '[test] 併發測試市集',
        startsAt: new Date(Date.now() - 86400000),
        endsAt: new Date(Date.now() + 86400000),
        status: 'live',
        depositDueHours: 48,
        waitlistWindowHours: 24
      })
      .returning()

    ids.market = market!.id
  })

  afterAll(async () => {
    if (!client) {
      return
    }

    // 外鍵有 restrict，刪除順序不能顛倒
    await db.delete(marketOrders).where(eq(marketOrders.marketId, ids.market))
    await db.delete(marketProducts).where(eq(marketProducts.marketId, ids.market))
    await db.delete(markets).where(eq(markets.id, ids.market))

    if (ids.buyers.length > 0) {
      await db.delete(users).where(inArray(users.id, ids.buyers))
    }

    await client.end()
  })

  /** 每個測試都換一件全新的商品，彼此不互相干擾 */
  beforeEach(async () => {
    const [product] = await db
      .insert(marketProducts)
      .values({
        marketId: ids.market,
        name: `[test] 作品 ${Date.now()}`,
        priceCents: 180000,
        depositCents: 50000,
        images: [{ src: 'https://example.com/a.jpg' }],
        status: 'available'
      })
      .returning()

    ids.product = product!.id
  })

  async function loadProduct() {
    const [product] = await db
      .select()
      .from(marketProducts)
      .where(eq(marketProducts.id, ids.product))
      .limit(1)

    return product!
  }

  async function loadMarket() {
    const [market] = await db
      .select()
      .from(markets)
      .where(eq(markets.id, ids.market))
      .limit(1)

    return market!
  }

  it('測試項目 18：五位使用者同時購買，只有一筆有效訂單成立', async () => {
    const market = await loadMarket()
    const product = await loadProduct()

    const results = await Promise.all(
      ids.buyers.map(userId =>
        reserveProductAndCreateOrder(db, { userId, market, product })
      )
    )

    const succeeded = results.filter(result => result.ok)
    const failed = results.filter(result => !result.ok)

    expect(succeeded).toHaveLength(1)
    expect(failed).toHaveLength(ids.buyers.length - 1)
    expect(failed.every(result => !result.ok && result.reason === 'taken')).toBe(true)

    // 資料庫裡實際只有一筆訂單
    const orders = await db
      .select()
      .from(marketOrders)
      .where(eq(marketOrders.productId, ids.product))

    expect(orders).toHaveLength(1)
    expect((await loadProduct()).status).toBe('reserved')
  })

  it('同一個人連點兩次也只會成立一筆訂單', async () => {
    const market = await loadMarket()
    const product = await loadProduct()
    const buyer = ids.buyers[0]!

    const results = await Promise.all([
      reserveProductAndCreateOrder(db, { userId: buyer, market, product }),
      reserveProductAndCreateOrder(db, { userId: buyer, market, product })
    ])

    expect(results.filter(result => result.ok)).toHaveLength(1)
  })

  it('partial unique index 擋得住繞過保留流程的直接 insert', async () => {
    const market = await loadMarket()
    const product = await loadProduct()

    const first = await reserveProductAndCreateOrder(db, {
      userId: ids.buyers[0]!,
      market,
      product
    })

    expect(first.ok).toBe(true)

    // 模擬有人把商品狀態改回開放（繞過正常流程），訂單唯一索引仍必須擋下第二筆
    await db
      .update(marketProducts)
      .set({ status: 'available' })
      .where(eq(marketProducts.id, ids.product))

    let error: unknown = null

    try {
      await db.insert(marketOrders).values({
        userId: ids.buyers[1]!,
        marketId: ids.market,
        productId: ids.product,
        amountCents: product.priceCents,
        depositCents: product.depositCents,
        productNameSnapshot: product.name,
        status: 'pending_deposit'
      })
    } catch (caught) {
      error = caught
    }

    expect(error).not.toBeNull()
    expect(isUniqueViolation(error)).toBe(true)
  })

  it('測試項目 22：取消訂單後商品可以再次被購買', async () => {
    const market = await loadMarket()
    const product = await loadProduct()

    const first = await reserveProductAndCreateOrder(db, {
      userId: ids.buyers[0]!,
      market,
      product
    })

    expect(first.ok).toBe(true)

    // 後台的「取消訂單並釋放商品」
    await db
      .update(marketOrders)
      .set({ status: 'cancelled' })
      .where(eq(marketOrders.id, first.ok ? first.order.id : ''))

    await db
      .update(marketProducts)
      .set({ status: 'available' })
      .where(eq(marketProducts.id, ids.product))

    const second = await reserveProductAndCreateOrder(db, {
      userId: ids.buyers[1]!,
      market,
      product: await loadProduct()
    })

    expect(second.ok).toBe(true)

    // 已取消的那筆不在唯一索引的涵蓋範圍，所以兩筆可以並存
    const orders = await db
      .select()
      .from(marketOrders)
      .where(eq(marketOrders.productId, ids.product))

    expect(orders).toHaveLength(2)
    expect(orders.filter(order => order.status !== 'cancelled')).toHaveLength(1)
  })

  it('測試項目 17：同一使用者不能重複加入同一件商品的候補', async () => {
    await db.insert(waitlistEntries).values({
      userId: ids.buyers[0]!,
      productId: ids.product,
      status: 'waiting'
    })

    let error: unknown = null

    try {
      await db.insert(waitlistEntries).values({
        userId: ids.buyers[0]!,
        productId: ids.product,
        status: 'waiting'
      })
    } catch (caught) {
      error = caught
    }

    expect(isUniqueViolation(error)).toBe(true)

    // 取消之後可以重新加入（排到隊尾）
    await db
      .update(waitlistEntries)
      .set({ status: 'cancelled' })
      .where(and(
        eq(waitlistEntries.userId, ids.buyers[0]!),
        eq(waitlistEntries.productId, ids.product)
      ))

    await expect(
      db.insert(waitlistEntries).values({
        userId: ids.buyers[0]!,
        productId: ids.product,
        status: 'waiting'
      })
    ).resolves.toBeDefined()

    await db.delete(waitlistEntries).where(eq(waitlistEntries.productId, ids.product))
  })

  it('同一使用者不能重複追蹤同一件商品', async () => {
    await db.insert(productFollows).values({
      userId: ids.buyers[0]!,
      productId: ids.product
    })

    let error: unknown = null

    try {
      await db.insert(productFollows).values({
        userId: ids.buyers[0]!,
        productId: ids.product
      })
    } catch (caught) {
      error = caught
    }

    expect(isUniqueViolation(error)).toBe(true)

    await db.delete(productFollows).where(eq(productFollows.productId, ids.product))
  })

  it('下單會把下單者自己的候補標記為已轉單', async () => {
    const market = await loadMarket()
    const product = await loadProduct()
    const buyer = ids.buyers[2]!

    await db.insert(waitlistEntries).values({
      userId: buyer,
      productId: ids.product,
      status: 'notified',
      notifiedAt: new Date(),
      windowExpiresAt: new Date(Date.now() + 3600000)
    })

    const result = await reserveProductAndCreateOrder(db, { userId: buyer, market, product })

    expect(result.ok).toBe(true)

    const [entry] = await db
      .select()
      .from(waitlistEntries)
      .where(and(
        eq(waitlistEntries.productId, ids.product),
        eq(waitlistEntries.userId, buyer)
      ))
      .limit(1)

    expect(entry?.status).toBe('converted')

    await db.delete(waitlistEntries).where(eq(waitlistEntries.productId, ids.product))
  })
})
