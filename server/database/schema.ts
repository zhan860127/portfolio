import { relations, sql } from 'drizzle-orm'
import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

/**
 * 訂單狀態。DB 只認這幾個代碼，避免自由字串出現拼寫不一致。
 * 對外顯示字串的轉換放在 server/utils/orders.ts。
 */
export const orderStatus = pgEnum('order_status', [
  'pending_payment',
  'payment_processing',
  'paid',
  'shipped',
  'completed',
  'cancelled'
])

/** 後台權限。第一位管理員由 ADMIN_EMAILS 環境變數在登入時提權，之後可在後台互相指派。 */
export const userRole = pgEnum('user_role', ['user', 'admin'])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // email 是 OAuth 帶回來的唯一識別，用來 upsert；一律以小寫寫入
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  role: userRole('role').notNull().default('user'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  status: orderStatus('status').notNull().default('pending_payment'),
  // 金額一律以「分」為單位的整數保存，避免浮點誤差
  subtotalCents: integer('subtotal_cents').notNull(),
  shippingCents: integer('shipping_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull(),
  lastFiveDigits: text('last_five_digits'),
  note: text('note'),
  // Google Sheet 鏡像的列號，僅供把狀態同步回營運看板使用；不是識別碼
  sheetRow: integer('sheet_row'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  index('orders_user_id_created_at_idx').on(table.userId, table.createdAt)
])

export const orderItems = pgTable('order_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  // 商品目前仍在 Google Sheet，尚無 products 表可以外鍵；先保存來源 id
  productId: text('product_id').notNull(),
  // 快照：商品日後改名改價，歷史訂單仍須維持下單當時的樣子
  titleSnapshot: text('title_snapshot').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  quantity: integer('quantity').notNull()
}, table => [
  index('order_items_order_id_idx').on(table.orderId)
])

/* -------------------------------------------------------------------------- */
/*  線上市集 Online Market                                                     */
/*  與既有的購物車訂單（orders / order_items）刻意分開：                        */
/*  市集是「一單一件、先付訂金、人工核對」，流程與購物車完全不同，               */
/*  硬塞進同一張表只會讓兩邊的狀態機互相污染。                                  */
/* -------------------------------------------------------------------------- */

/** 活動狀態。draft 代表尚未上架，對前台完全不可見。 */
export const marketStatus = pgEnum('market_status', ['draft', 'upcoming', 'live', 'ended'])

/** 前台只認這三種商品狀態（需求 8）。 */
export const marketProductStatus = pgEnum('market_product_status', ['available', 'reserved', 'sold'])

/**
 * 市集訂單狀態。
 * expired 只是「逾期標記」，商品仍然保留中，必須由管理員手動取消才會釋放。
 */
export const marketOrderStatus = pgEnum('market_order_status', [
  'pending_deposit',
  'payment_submitted',
  'deposit_confirmed',
  'completed',
  'expired',
  'cancelled'
])

/** 候補狀態。notified 代表正處於優先購買窗口內。 */
export const waitlistStatus = pgEnum('waitlist_status', [
  'waiting',
  'notified',
  'converted',
  'expired',
  'cancelled'
])

/**
 * 寄貨單狀態。
 * pending 是「客人已送出、等著安排出貨」，shipped 之後就不再接受客人修改。
 */
export const shippingStatus = pgEnum('shipping_status', ['pending', 'shipped', 'cancelled'])

export interface ProductImage {
  src: string
  alt?: string
  /** 用來在詳細資訊頁分組顯示：正面、側面、背面、底部、細節、製程 */
  kind?: 'front' | 'side' | 'back' | 'bottom' | 'detail' | 'process'
}

export interface ProductSpecifications {
  dimensions?: string
  weight?: string
  material?: string
  technique?: string
  firingTemperature?: string
  glaze?: string
  variation?: string
}

export const markets = pgTable('markets', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  description: text('description'),
  coverImage: text('cover_image'),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  status: marketStatus('status').notNull().default('draft'),
  /** 下單後幾小時內要完成訂金匯款。逾期只標記，不自動釋放商品。 */
  depositDueHours: integer('deposit_due_hours').notNull().default(48),
  /** 候補被通知後的「優先購買窗口」長度，窗口內該商品只接受被通知者下單。 */
  waitlistWindowHours: integer('waitlist_window_hours').notNull().default(24),
  /** 商品售出後是否仍開放候補（例如預期會有二次釋出） */
  allowWaitlistWhenSold: integer('allow_waitlist_when_sold').notNull().default(0),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  index('markets_status_starts_at_idx').on(table.status, table.startsAt)
])

export const marketProducts = pgTable('market_products', {
  id: uuid('id').primaryKey().defaultRandom(),
  marketId: uuid('market_id').notNull().references(() => markets.id, { onDelete: 'cascade' }),
  /** 對外顯示的商品編號（例如 TI-2026-03），與 uuid 分開，方便客服溝通 */
  code: text('code'),
  name: text('name').notNull(),
  description: text('description'),
  priceCents: integer('price_cents').notNull(),
  /** 訂金由每件商品個別設定（不是活動層級的百分比） */
  depositCents: integer('deposit_cents').notNull(),
  images: jsonb('images').$type<ProductImage[]>().notNull().default(sql`'[]'::jsonb`),
  specifications: jsonb('specifications').$type<ProductSpecifications>().notNull().default(sql`'{}'::jsonb`),
  story: text('story'),
  purchaseNotes: text('purchase_notes'),
  status: marketProductStatus('status').notNull().default('available'),
  /** 覆寫活動層級的 allowWaitlistWhenSold：null 表示跟隨活動設定 */
  allowWaitlistWhenSold: integer('allow_waitlist_when_sold'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  index('market_products_market_id_sort_idx').on(table.marketId, table.sortOrder),
  uniqueIndex('market_products_market_code_idx').on(table.marketId, table.code)
])

export const marketOrders = pgTable('market_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  marketId: uuid('market_id').notNull().references(() => markets.id, { onDelete: 'restrict' }),
  productId: uuid('product_id').notNull().references(() => marketProducts.id, { onDelete: 'restrict' }),
  /** 下單當下的金額快照：之後改價不影響已成立的訂單 */
  amountCents: integer('amount_cents').notNull(),
  depositCents: integer('deposit_cents').notNull(),
  productNameSnapshot: text('product_name_snapshot').notNull(),
  productImageSnapshot: text('product_image_snapshot'),
  status: marketOrderStatus('status').notNull().default('pending_deposit'),
  /**
   * 這筆訂單被納入哪一張寄貨單。NULL = 還沒納入任何一張。
   *
   * 用欄位而不是中介表：「一筆訂單最多只能出現在一張寄貨單上」
   * 這件事直接由欄位本身保證，不需要再補一個唯一索引去擋。
   * 寄貨單被取消時這裡會回到 NULL，訂單就能重新併進新的一張。
   */
  shippingRequestId: uuid('shipping_request_id').references(() => shippingRequests.id, { onDelete: 'set null' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  /**
   * 訂單公平性的根基：一件商品最多只能有一筆「未取消」的訂單。
   * 下單時的條件式 UPDATE 已經會擋掉絕大多數競態，這個索引是最後一道防線，
   * 就算未來有人繞過 service 層直接 insert 也進不來。
   */
  uniqueIndex('market_orders_one_active_per_product_idx')
    .on(table.productId)
    .where(sql`status <> 'cancelled'`),
  index('market_orders_user_created_idx').on(table.userId, table.createdAt),
  index('market_orders_status_idx').on(table.status)
])

export const paymentSubmissions = pgTable('payment_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => marketOrders.id, { onDelete: 'cascade' }),
  bankLast5: text('bank_last5').notNull(),
  paidAmountCents: integer('paid_amount_cents').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
  note: text('note'),
  submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  index('payment_submissions_order_id_idx').on(table.orderId)
])

/** 寄貨單成立當下的訂單快照。取消後 market_orders 的連結會被清掉，這份快照是唯一的歷史。 */
export interface ShippingItemSnapshot {
  orderId: string
  productName: string
  amountCents: number
  depositCents: number
}

/**
 * 寄貨單（7-ELEVEN 貨到付款）。
 *
 * 一張寄貨單 = 一個包裹，可以合併同一位客人的多筆訂單。
 * 市集是「一單一件」，所以不合併的話客人買三件就要付三次運費。
 */
export const shippingRequests = pgTable('shipping_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  recipientName: text('recipient_name').notNull(),
  recipientPhone: text('recipient_phone').notNull(),
  storeName: text('store_name').notNull(),
  /** 7-ELEVEN 店號。客人不一定查得到，所以允許空白 */
  storeCode: text('store_code'),
  note: text('note'),
  /**
   * 金額一律快照。運費或商品價格日後調整，都不該改變已經送出的寄貨單 ——
   * 客人看到的「貨到付款應付」必須跟當初送出時一模一樣。
   */
  itemTotalCents: integer('item_total_cents').notNull(),
  depositPaidCents: integer('deposit_paid_cents').notNull(),
  shippingCents: integer('shipping_cents').notNull(),
  /** 貨到付款時實際要收的錢 = 作品金額合計 − 已付訂金 + 運費 */
  codCents: integer('cod_cents').notNull(),
  items: jsonb('items').$type<ShippingItemSnapshot[]>().notNull().default(sql`'[]'::jsonb`),
  status: shippingStatus('status').notNull().default('pending'),
  shippedAt: timestamp('shipped_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  index('shipping_requests_user_created_idx').on(table.userId, table.createdAt),
  index('shipping_requests_status_idx').on(table.status),
  /**
   * 一位客人同時只能有一張「待出貨」的寄貨單。
   * 沒有這條的話，重複點送出就會產生兩張內容幾乎一樣的單子，
   * 而你在後台沒辦法判斷該寄哪一張。
   */
  uniqueIndex('shipping_requests_one_pending_per_user_idx')
    .on(table.userId)
    .where(sql`status = 'pending'`)
])

export const productFollows = pgTable('product_follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => marketProducts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  uniqueIndex('product_follows_user_product_idx').on(table.userId, table.productId),
  index('product_follows_product_id_idx').on(table.productId)
])

export const waitlistEntries = pgTable('waitlist_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').notNull().references(() => marketProducts.id, { onDelete: 'cascade' }),
  status: waitlistStatus('status').notNull().default('waiting'),
  notifiedAt: timestamp('notified_at', { withTimezone: true }),
  /** 優先購買窗口的截止時間；只有窗口內的被通知者能對該商品下單 */
  windowExpiresAt: timestamp('window_expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  /**
   * 同一使用者對同一商品只能有一筆「進行中」的候補。
   * 取消過之後可以重新加入，所以用 partial index 而不是整表唯一。
   */
  uniqueIndex('waitlist_entries_active_user_product_idx')
    .on(table.userId, table.productId)
    .where(sql`status in ('waiting', 'notified')`),
  // 順位一律以 created_at 排序計算，不存 position 欄位，避免取消時整列重編號的競態
  index('waitlist_entries_product_created_idx').on(table.productId, table.createdAt)
])

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  previousValue: jsonb('previous_value'),
  newValue: jsonb('new_value'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
}, table => [
  index('audit_logs_entity_idx').on(table.entityType, table.entityId),
  index('audit_logs_created_at_idx').on(table.createdAt)
])

export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders)
}))

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems)
}))

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] })
}))

export const marketsRelations = relations(markets, ({ many }) => ({
  products: many(marketProducts)
}))

export const marketProductsRelations = relations(marketProducts, ({ one, many }) => ({
  market: one(markets, { fields: [marketProducts.marketId], references: [markets.id] }),
  follows: many(productFollows),
  waitlist: many(waitlistEntries)
}))

export const marketOrdersRelations = relations(marketOrders, ({ one, many }) => ({
  user: one(users, { fields: [marketOrders.userId], references: [users.id] }),
  product: one(marketProducts, { fields: [marketOrders.productId], references: [marketProducts.id] }),
  market: one(markets, { fields: [marketOrders.marketId], references: [markets.id] }),
  shippingRequest: one(shippingRequests, { fields: [marketOrders.shippingRequestId], references: [shippingRequests.id] }),
  payments: many(paymentSubmissions)
}))

export const paymentSubmissionsRelations = relations(paymentSubmissions, ({ one }) => ({
  order: one(marketOrders, { fields: [paymentSubmissions.orderId], references: [marketOrders.id] })
}))

export const shippingRequestsRelations = relations(shippingRequests, ({ one, many }) => ({
  user: one(users, { fields: [shippingRequests.userId], references: [users.id] }),
  orders: many(marketOrders)
}))

export const productFollowsRelations = relations(productFollows, ({ one }) => ({
  user: one(users, { fields: [productFollows.userId], references: [users.id] }),
  product: one(marketProducts, { fields: [productFollows.productId], references: [marketProducts.id] })
}))

export const waitlistEntriesRelations = relations(waitlistEntries, ({ one }) => ({
  user: one(users, { fields: [waitlistEntries.userId], references: [users.id] }),
  product: one(marketProducts, { fields: [waitlistEntries.productId], references: [marketProducts.id] })
}))

export type User = typeof users.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderItem = typeof orderItems.$inferSelect
export type OrderStatus = (typeof orderStatus.enumValues)[number]
export type UserRole = (typeof userRole.enumValues)[number]

export type Market = typeof markets.$inferSelect
export type MarketProduct = typeof marketProducts.$inferSelect
export type MarketOrder = typeof marketOrders.$inferSelect
export type PaymentSubmission = typeof paymentSubmissions.$inferSelect
export type ShippingRequest = typeof shippingRequests.$inferSelect
export type ProductFollow = typeof productFollows.$inferSelect
export type WaitlistEntry = typeof waitlistEntries.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect

export type MarketStatus = (typeof marketStatus.enumValues)[number]
export type MarketProductStatus = (typeof marketProductStatus.enumValues)[number]
export type MarketOrderStatus = (typeof marketOrderStatus.enumValues)[number]
export type ShippingStatus = (typeof shippingStatus.enumValues)[number]
export type WaitlistStatus = (typeof waitlistStatus.enumValues)[number]
