import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from '../database/schema'

let client: postgres.Sql | undefined
let db: ReturnType<typeof drizzle<typeof schema>> | undefined

/**
 * Vercel Postgres（底層為 Neon）會注入 DATABASE_URL / POSTGRES_URL，
 * 兩者都接受；本機開發則用 .env 裡的 DATABASE_URL。
 */
function connectionString() {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL

  if (!url) {
    throw createError({
      statusCode: 500,
      statusMessage: 'DATABASE_URL is not configured'
    })
  }

  return url
}

export function useDb() {
  if (!db) {
    // serverless 環境每個 instance 只開少量連線，並走連線池網址
    client = postgres(connectionString(), { max: 1, prepare: false })
    db = drizzle(client, { schema })
  }

  return db
}
