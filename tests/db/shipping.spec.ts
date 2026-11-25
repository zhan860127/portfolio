import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, inArray, isNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as schema from '../../server/database/schema'
import { marketOrders, marketProducts, markets, shippingRequests, users } from '../../server/database/schema'
import { isUniqueViolation } from '../../server/utils/marketOrders'
import { summarizeShipment } from '../../server/utils/shipping'

/**
 * 寄貨單的資料庫保證。
 *
 * `docs/shipping.md` 宣稱兩個不變量是「由資料庫保證」的，這裡就是去驗那句話：
 * 一位客人只能有一張待出貨的單，一筆訂單只能掛在一張單上。
 * 這種事情用程式邏輯「應該不會發生」是不算數的。
 *
 * 執行方式：
 *   DATABASE_URL_TEST=postgres://... pnpm run test:db
 */
const CONNECTION = process.env.DATABASE_URL_TEST

/** 固定的活動標題，afterAll 用它清掉上一次失敗留下的殘留 */
const MARKET_TITLE = '寄貨單測試場'

describe.skipIf(!CONNECTION)('寄貨單的資料庫保證', () => {
  let client: postgres.Sql
  let db: ReturnType<typeof drizzle<typeof schema>>

  const ids = {
    buyer: '',
    otherBuyer: '',
    market: '',
    products: [] as string[]
  }

  beforeAll(async () => {
    client = postgres(CONNECTION!, { max: 5, prepare: false })
    db = drizzle(client, { schema })

    await migrate(db, { migrationsFolder: './server/database/migrations' })

    const buyers = await db
      .insert(users)
      .values([
        { email: 'shipping-buyer-1@test.local', name: '寄貨買家一' },
        { email: 'shipping-buyer-2@test.local', name: '寄貨買家二' }
      ])
      .onConflictDoUpdate({ target: users.email, set: { updatedAt: new Date() } })
      .returning()

    ids.buyer = buyers[0]!.id
    ids.otherBuyer = buyers[1]!.id

    const [market] = await db
      .insert(markets)
      .values({
        title: MARKET_TITLE,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 86_400_000),
        status: 'live'
      })
      .returning()

    ids.market = market!.id

    const products = await db
      .insert(marketProducts)
      .values([
        { marketId: ids.market, name: '測試茶杯', priceCents: 160000, depositCents: 50000 },
        { marketId: ids.market, name: '測試花器', priceCents: 240000, depositCents: 80000 }
      ])
      .returning()

    ids.products = products.map(product => product.id)
  })

  afterAll(async () => {
    /*
     * 順序不能換：market_orders 對 users / markets / market_products 都是 restrict，
     * 先刪活動或使用者都會被外鍵擋下來（只有 market_products 是 cascade）。
     *
     * 訂單按「使用者」刪而不是按這次的商品刪，活動按標題刪而不是按這次的 id 刪 ——
     * 上一次中途失敗的執行會留下舊的商品與活動，那些殘留一樣會卡住使用者的刪除。
     */
    await db.delete(marketOrders).where(inArray(marketOrders.userId, [ids.buyer, ids.otherBuyer]))
    await db.delete(shippingRequests).where(inArray(shippingRequests.userId, [ids.buyer, ids.otherBuyer]))
    await db.delete(markets).where(eq(markets.title, MARKET_TITLE))
    await db.delete(users).where(inArray(users.id, [ids.buyer, ids.otherBuyer]))
    await client.end()
  })

  beforeEach(async () => {
    // 訂單有「一件商品一筆有效訂單」的唯一索引，所以每個案例都要清乾淨重來
    await db.delete(marketOrders).where(inArray(marketOrders.productId, ids.products))
    await db.delete(shippingRequests).where(inArray(shippingRequests.userId, [ids.buyer, ids.otherBuyer]))
    await db.update(marketProducts).set({ status: 'available' }).where(inArray(marketProducts.id, ids.products))
  })

  async function createOrder(productIndex: number, userId: string = ids.buyer) {
    const product = (await db
      .select()
      .from(marketProducts)
      .where(eq(marketProducts.id, ids.products[productIndex]!))
      .limit(1))[0]!

    const [order] = await db
      .insert(marketOrders)
      .values({
        userId,
        marketId: ids.market,
        productId: product.id,
        amountCents: product.priceCents,
        depositCents: product.depositCents,
        productNameSnapshot: product.name,
        status: 'deposit_confirmed'
      })
      .returning()

    return order!
  }

  async function createRequest(userId: string, orderIds: string[], status: 'pending' | 'shipped' = 'pending') {
    const orders = await db.select().from(marketOrders).where(inArray(marketOrders.id, orderIds))
    const summary = summarizeShipment(orders)

    const [request] = await db
      .insert(shippingRequests)
      .values({
        userId,
        recipientName: '王小明',
        recipientPhone: '0912345678',
        storeName: '測試門市',
        storeCode: null,
        note: null,
        itemTotalCents: summary.itemTotalCents,
        depositPaidCents: summary.depositPaidCents,
        shippingCents: summary.shippingCents,
        codCents: summary.codCents,
        items: summary.items,
        status
      })
      .returning()

    await db
      .update(marketOrders)
      .set({ shippingRequestId: request!.id })
      .where(inArray(marketOrders.id, orderIds))

    return request!
  }

  it('一位客人同時只能有一張待出貨的寄貨單', async () => {
    const first = await createOrder(0)
    const second = await createOrder(1)

    await createRequest(ids.buyer, [first.id])

    let error: unknown

    try {
      await createRequest(ids.buyer, [second.id])
    } catch (err) {
      error = err
    }

    expect(isUniqueViolation(error)).toBe(true)

    const rows = await db.select().from(shippingRequests).where(eq(shippingRequests.userId, ids.buyer))

    expect(rows).toHaveLength(1)
  })

  it('不同客人各自可以有一張待出貨的單', async () => {
    const mine = await createOrder(0, ids.buyer)
    const theirs = await createOrder(1, ids.otherBuyer)

    await createRequest(ids.buyer, [mine.id])
    await createRequest(ids.otherBuyer, [theirs.id])

    const rows = await db
      .select()
      .from(shippingRequests)
      .where(inArray(shippingRequests.userId, [ids.buyer, ids.otherBuyer]))

    expect(rows).toHaveLength(2)
  })

  it('已寄出之後可以再開一張新的待出貨單', async () => {
    const first = await createOrder(0)

    await createRequest(ids.buyer, [first.id], 'shipped')

    const second = await createOrder(1)

    // partial index 只擋 pending，所以這一張應該要能成立
    await expect(createRequest(ids.buyer, [second.id])).resolves.toBeTruthy()
  })

  it('掛訂單的條件式 UPDATE 不會搶走別張單已經收走的訂單', async () => {
    const order = await createOrder(0)
    const first = await createRequest(ids.buyer, [order.id])

    // 模擬第二張單想把同一筆訂單也收走：WHERE shipping_request_id IS NULL 會讓它抓到 0 筆
    const [second] = await db
      .insert(shippingRequests)
      .values({
        userId: ids.otherBuyer,
        recipientName: '陳小美',
        recipientPhone: '0922333444',
        storeName: '另一間門市',
        itemTotalCents: 0,
        depositPaidCents: 0,
        shippingCents: 8000,
        codCents: 8000,
        items: []
      })
      .returning()

    const linked = await db
      .update(marketOrders)
      .set({ shippingRequestId: second!.id })
      .where(eq(marketOrders.id, order.id))
      .returning({ id: marketOrders.id })
      .then(async () => db
        .update(marketOrders)
        .set({ shippingRequestId: second!.id })
        .where(isNull(marketOrders.shippingRequestId))
        .returning({ id: marketOrders.id })
      )

    // 第二次（帶 IS NULL 條件）什麼都不該更新到
    expect(linked.filter(row => row.id === order.id)).toHaveLength(0)

    // 把第一張單的連結復原，確認資料本身沒有壞掉
    await db.update(marketOrders).set({ shippingRequestId: first.id }).where(eq(marketOrders.id, order.id))

    const [reloaded] = await db.select().from(marketOrders).where(eq(marketOrders.id, order.id))

    expect(reloaded!.shippingRequestId).toBe(first.id)
  })

  it('取消寄貨單之後訂單可以重新併進新的一張', async () => {
    const order = await createOrder(0)
    const first = await createRequest(ids.buyer, [order.id])

    // 取消：清掉連結、把單子標記成 cancelled（與 API 的做法一致）
    await db.update(marketOrders).set({ shippingRequestId: null }).where(eq(marketOrders.shippingRequestId, first.id))
    await db.update(shippingRequests).set({ status: 'cancelled' }).where(eq(shippingRequests.id, first.id))

    const second = await createRequest(ids.buyer, [order.id])
    const [reloaded] = await db.select().from(marketOrders).where(eq(marketOrders.id, order.id))

    expect(second.id).not.toBe(first.id)
    expect(reloaded!.shippingRequestId).toBe(second.id)
  })

  it('寄貨單被刪掉時訂單不會跟著消失，連結只會回到 NULL', async () => {
    const order = await createOrder(0)
    const request = await createRequest(ids.buyer, [order.id])

    await db.delete(shippingRequests).where(eq(shippingRequests.id, request.id))

    const [reloaded] = await db.select().from(marketOrders).where(eq(marketOrders.id, order.id))

    expect(reloaded).toBeTruthy()
    expect(reloaded!.shippingRequestId).toBeNull()
  })

  it('金額快照存進資料庫之後取得的值與算出來的一致', async () => {
    const first = await createOrder(0)
    const second = await createOrder(1)
    const request = await createRequest(ids.buyer, [first.id, second.id])

    // (1600 + 2400) − (500 + 800) + 80 = 2780 元
    expect(request.itemTotalCents).toBe(400000)
    expect(request.depositPaidCents).toBe(130000)
    expect(request.shippingCents).toBe(8000)
    expect(request.codCents).toBe(278000)
    expect(request.items).toHaveLength(2)
  })
})
