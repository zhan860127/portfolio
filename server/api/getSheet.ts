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

export default defineCachedEventHandler(async (event) => {
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
}, {
  /*
   * 每次有人進商品頁都要往 Google Sheets 跑一趟，實測一趟 300～360ms，
   * 而且那段時間畫面是停著的。商品資料不需要即時到那個程度。
   *
   * 60 秒：改完試算表很快就會反映，又能把短時間內的重複請求收斂成一次。
   * 丟出錯誤的情況 Nitro 不會快取，所以 502 之後下一次仍然會真的重試。
   */
  maxAge: 60,
  name: 'sheet-values',
  // 一定要把 range 放進 key，否則 schedule 和 product 會共用同一份快取
  getKey: (event) => {
    const range = String(getQuery(event).range ?? '')

    return ALLOWED_RANGES.includes(range as AllowedRange) ? range : 'invalid'
  }
})
