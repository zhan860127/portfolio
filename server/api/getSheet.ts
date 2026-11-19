import { google } from 'googleapis'

const config = useRuntimeConfig()

const credentialsPath = config.googleCredentialsPath

if (!credentialsPath) {
  throw new Error('Missing Google credentials path')
}

const credentials = JSON.parse(credentialsPath)

// 僅開放前端實際使用的分頁，避免以任意 range 讀取同一份試算表的其他資料
const ALLOWED_RANGES = ['schedule', 'product'] as const

type AllowedRange = (typeof ALLOWED_RANGES)[number]

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const range = query.range as string
  const spreadsheetId = config.googleSpreadsheetId

  if (!ALLOWED_RANGES.includes(range as AllowedRange)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid range' })
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
  })

  const sheets = google.sheets({ version: 'v4', auth })

  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range })

    return response.data.values ?? []
  } catch (err) {
    // 詳細錯誤只留在伺服器端，不回傳給 client
    console.error('[getSheet] failed to read spreadsheet', { range, err })
    throw createError({ statusCode: 502, statusMessage: 'Failed to read spreadsheet' })
  }
})
