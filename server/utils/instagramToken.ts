/**
 * Instagram 長效 token 每 60 天到期，而且必須在到期「之前」換發；
 * 一旦逾期就只能重跑一次 Business Login 授權，無法補救。
 *
 * Vercel 的環境變數在執行期無法寫入，所以換發後的 token 改存 Upstash KV，
 * 由 /api/cron/instagram-token-refresh 每日觸發檢查。
 */

const GRAPH_BASE = 'https://graph.instagram.com'
const KV_KEY = 'instagram:access-token'

/** 剩餘效期低於 30 天就換發，留下約四週的重試空間 */
const REFRESH_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000
/** Graph API 要求 token 至少存在 24 小時才可換發 */
const MIN_TOKEN_AGE_MS = 24 * 60 * 60 * 1000
/** Graph API 沒回 expires_in 時的保守預設（60 天） */
const DEFAULT_TTL_SECONDS = 60 * 24 * 60 * 60
const DAY_MS = 24 * 60 * 60 * 1000

export interface StoredInstagramToken {
  token: string
  /** epoch ms */
  expiresAt: number
  /** epoch ms */
  refreshedAt: number
}

export type RefreshStatus
  = | 'refreshed'
    | 'not_due'
    | 'too_soon'
    | 'missing_token'
    | 'store_unavailable'
    | 'store_failed'

export interface RefreshResult {
  status: RefreshStatus
  expiresAt?: number
  expiresInDays?: number
}

function kvConfig() {
  const config = useRuntimeConfig()
  const url = typeof config.kvRestApiUrl === 'string' ? config.kvRestApiUrl.trim() : ''
  const token = typeof config.kvRestApiToken === 'string' ? config.kvRestApiToken.trim() : ''

  if (!url || !token) {
    return null
  }

  return { url: url.replace(/\/+$/, ''), token }
}

/** Upstash REST：直接 POST 指令陣列，免去自行處理 URL 編碼 */
async function kvCommand<T>(command: (string | number)[]): Promise<T | null> {
  const kv = kvConfig()

  if (!kv) {
    return null
  }

  try {
    const response = await $fetch<{ result?: T }>(kv.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${kv.token}` },
      body: command,
      timeout: 5000
    })

    return response?.result ?? null
  } catch (err) {
    // 指令名稱可記錄，值不可以（第三個元素是 token 本體）
    console.warn('[instagram-token] KV command failed.', {
      command: command[0],
      message: err instanceof Error ? err.message : String(err)
    })

    return null
  }
}

function parseStored(raw: unknown): StoredInstagramToken | null {
  if (typeof raw !== 'string' || !raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredInstagramToken>

    if (typeof parsed.token !== 'string' || !parsed.token) {
      return null
    }

    return {
      token: parsed.token,
      expiresAt: typeof parsed.expiresAt === 'number' ? parsed.expiresAt : 0,
      refreshedAt: typeof parsed.refreshedAt === 'number' ? parsed.refreshedAt : 0
    }
  } catch {
    return null
  }
}

function describeExpiry(expiresAt: number, now: number) {
  return {
    expiresAt,
    expiresInDays: Math.max(0, Math.round((expiresAt - now) / DAY_MS))
  }
}

function envToken() {
  const config = useRuntimeConfig()

  return typeof config.instagramAccessToken === 'string' ? config.instagramAccessToken.trim() : ''
}

export async function readStoredToken() {
  return parseStored(await kvCommand<string>(['GET', KV_KEY]))
}

async function writeStoredToken(value: StoredInstagramToken) {
  return await kvCommand<string>(['SET', KV_KEY, JSON.stringify(value)]) === 'OK'
}

/**
 * KV 裡換發過的 token 優先；KV 尚未啟用、讀取失敗或內容已過期時退回環境變數，
 * 讓這套機制上線前後的行為一致。
 */
export async function getInstagramToken(): Promise<string> {
  const stored = await readStoredToken()

  if (stored?.token && stored.expiresAt > Date.now()) {
    return stored.token
  }

  return envToken()
}

export async function refreshInstagramToken(options: { force?: boolean } = {}): Promise<RefreshResult> {
  // KV 不可用時不要去動 Meta：換發完沒地方存，等於把新 token 直接丟掉
  if (!kvConfig()) {
    return { status: 'store_unavailable' }
  }

  const now = Date.now()
  const stored = await readStoredToken()
  const current = stored?.token || envToken()

  if (!current) {
    return { status: 'missing_token' }
  }

  if (stored && !options.force) {
    if (now - stored.refreshedAt < MIN_TOKEN_AGE_MS) {
      return { status: 'too_soon', ...describeExpiry(stored.expiresAt, now) }
    }

    if (stored.expiresAt - now > REFRESH_THRESHOLD_MS) {
      return { status: 'not_due', ...describeExpiry(stored.expiresAt, now) }
    }
  }

  const response = await $fetch<{ access_token?: string, expires_in?: number }>(`${GRAPH_BASE}/refresh_access_token`, {
    params: {
      grant_type: 'ig_refresh_token',
      access_token: current
    },
    timeout: 8000
  })

  if (!response?.access_token) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Instagram refresh returned no access token'
    })
  }

  const ttlSeconds = typeof response.expires_in === 'number' && response.expires_in > 0
    ? response.expires_in
    : DEFAULT_TTL_SECONDS

  const next: StoredInstagramToken = {
    token: response.access_token,
    expiresAt: now + ttlSeconds * 1000,
    refreshedAt: now
  }

  if (!await writeStoredToken(next)) {
    // 新 token 已換發卻存不進 KV：舊 token 仍可用到原到期日，但必須盡快人工處理
    console.error('[instagram-token] Refreshed token could not be persisted to KV.')

    return { status: 'store_failed', ...describeExpiry(next.expiresAt, now) }
  }

  return { status: 'refreshed', ...describeExpiry(next.expiresAt, now) }
}
