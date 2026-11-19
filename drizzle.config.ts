import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dbCredentials: {
    // Vercel Postgres 會注入 DATABASE_URL / POSTGRES_URL；
    // 執行 migration 建議使用未經連線池的網址（DATABASE_URL_UNPOOLED / POSTGRES_URL_NON_POOLING）
    url: process.env.DATABASE_URL_UNPOOLED
      || process.env.POSTGRES_URL_NON_POOLING
      || process.env.DATABASE_URL
      || process.env.POSTGRES_URL
      || ''
  }
})
