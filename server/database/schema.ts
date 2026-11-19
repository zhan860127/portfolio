import { relations } from 'drizzle-orm'
import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

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

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  // email 是 OAuth 帶回來的唯一識別，用來 upsert；一律以小寫寫入
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
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

export type User = typeof users.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderItem = typeof orderItems.$inferSelect
export type OrderStatus = (typeof orderStatus.enumValues)[number]
