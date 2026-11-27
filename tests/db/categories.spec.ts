import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import * as schema from '../../server/database/schema'
import { marketCategories, marketProducts, markets } from '../../server/database/schema'
import { isUniqueViolation } from '../../server/utils/marketOrders'

/**
 * 作品分類的資料庫保證。
 *
 * 兩件事必須由資料庫擋，而不是靠後台畫面「應該不會按到」：
 * 同名分類不能存在（否則件數加不起來），以及刪分類不能連帶刪掉作品。
 *
 * 執行方式：
 *   DATABASE_URL_TEST=postgres://... pnpm run test:db
 */
const CONNECTION = process.env.DATABASE_URL_TEST

const MARKET_TITLE = '分類測試場'

describe.skipIf(!CONNECTION)('作品分類的資料庫保證', () => {
  let client: postgres.Sql
  let db: ReturnType<typeof drizzle<typeof schema>>

  let marketId = ''

  beforeAll(async () => {
    client = postgres(CONNECTION!, { max: 5, prepare: false })
    db = drizzle(client, { schema })

    await migrate(db, { migrationsFolder: './server/database/migrations' })

    const [market] = await db
      .insert(markets)
      .values({
        title: MARKET_TITLE,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 86_400_000),
        status: 'live'
      })
      .returning()

    marketId = market!.id
  })

  afterAll(async () => {
    await db.delete(markets).where(eq(markets.title, MARKET_TITLE))
    await db.delete(marketCategories).where(inArray(marketCategories.name, ['森野', '林間']))
    await client.end()
  })

  beforeEach(async () => {
    await db.delete(marketProducts).where(eq(marketProducts.marketId, marketId))
    await db.delete(marketCategories).where(inArray(marketCategories.name, ['森野', '林間']))
  })

  async function createCategory(name: string, slug: string) {
    const [category] = await db.insert(marketCategories).values({ name, slug }).returning()

    return category!
  }

  async function createProduct(name: string, categoryId: string | null) {
    const [product] = await db
      .insert(marketProducts)
      .values({ marketId, categoryId, name, priceCents: 160000, depositCents: 50000 })
      .returning()

    return product!
  }

  it('同名分類不能存在', async () => {
    await createCategory('森野', 'senya')

    let error: unknown

    try {
      await createCategory('森野', 'senya-2')
    } catch (err) {
      error = err
    }

    expect(isUniqueViolation(error)).toBe(true)
  })

  it('同代稱分類不能存在', async () => {
    await createCategory('森野', 'senya')

    let error: unknown

    try {
      await createCategory('林間', 'senya')
    } catch (err) {
      error = err
    }

    expect(isUniqueViolation(error)).toBe(true)
  })

  it('一個分類底下可以有多件各自獨立的作品', async () => {
    const category = await createCategory('森野', 'senya')

    await createProduct('森野 01', category.id)
    await createProduct('森野 02', category.id)

    const rows = await db
      .select()
      .from(marketProducts)
      .where(eq(marketProducts.categoryId, category.id))

    expect(rows).toHaveLength(2)
    // 每一件仍然是獨立的商品，各自有狀態
    expect(new Set(rows.map(row => row.id)).size).toBe(2)
    expect(rows.every(row => row.status === 'available')).toBe(true)
  })

  it('刪掉分類時作品不會跟著消失，只是回到未分類', async () => {
    const category = await createCategory('森野', 'senya')
    const first = await createProduct('森野 01', category.id)

    await db.delete(marketCategories).where(eq(marketCategories.id, category.id))

    const [reloaded] = await db.select().from(marketProducts).where(eq(marketProducts.id, first.id))

    expect(reloaded).toBeTruthy()
    expect(reloaded!.categoryId).toBeNull()
    expect(reloaded!.name).toBe('森野 01')
  })

  it('批次指定之後件數對得起來', async () => {
    const category = await createCategory('森野', 'senya')
    const loose = await Promise.all([
      createProduct('待分類 A', null),
      createProduct('待分類 B', null),
      createProduct('待分類 C', null)
    ])

    const updated = await db
      .update(marketProducts)
      .set({ categoryId: category.id })
      .where(inArray(marketProducts.id, loose.slice(0, 2).map(product => product.id)))
      .returning({ id: marketProducts.id })

    expect(updated).toHaveLength(2)

    const inCategory = await db
      .select()
      .from(marketProducts)
      .where(eq(marketProducts.categoryId, category.id))

    expect(inCategory).toHaveLength(2)
  })
})
