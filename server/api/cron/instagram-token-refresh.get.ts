/**
 * Vercel Cron 每日呼叫；實際只有在剩餘效期低於 30 天時才會真的去換發。
 * 排程設定在 nuxt.config.ts 的 nitro.vercel.config.crons。
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = typeof config.cronSecret === 'string' ? config.cronSecret.trim() : ''

  // 這支端點會輪換正式 token，沒設 secret 就一律關閉，不允許裸奔
  if (!secret) {
    throw createError({
      statusCode: 503,
      statusMessage: 'CRON_SECRET is not configured'
    })
  }

  if (getRequestHeader(event, 'authorization') !== `Bearer ${secret}`) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  try {
    const result = await refreshInstagramToken({ force: getQuery(event).force === '1' })

    console.info('[instagram-token] refresh result', result)

    return result
  } catch (err) {
    // Graph API 的原始訊息只留在伺服器紀錄
    console.error('[instagram-token] refresh failed.', err instanceof Error ? err.message : String(err))

    throw createError({
      statusCode: 502,
      statusMessage: 'Instagram token refresh failed'
    })
  }
})
