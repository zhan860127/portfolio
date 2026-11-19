const REDIRECT_COOKIE = 'auth-redirect'

/**
 * 只接受站內的相對路徑，避免 ?redirect= 被拿來當成 open redirect 跳去外站。
 * 必須以單一 / 開頭：`//evil.com` 與 `/\evil.com` 會被瀏覽器解讀成協定相對網址，一律擋掉。
 */
function sanitizeRedirectTarget(value: unknown): string | null {
  const path = typeof value === 'string' ? value.trim() : ''

  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) {
    return null
  }

  // 控制字元可能被用來拆解 Location 標頭（含 CR/LF）
  const hasControlChar = [...path].some((char) => {
    const code = char.charCodeAt(0)

    return code < 0x20 || code === 0x7f
  })

  if (hasControlChar) {
    return null
  }

  return path
}

const oauthHandler = defineOAuthGoogleEventHandler({
  async onSuccess(event, { user }) {
    // 建立/更新 DB 的使用者資料列，並把 id 放進 session 供後續 API 使用
    const dbUser = await upsertUser({
      email: user.email,
      name: user.name,
      avatar: user.picture
    })

    await setUserSession(event, {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        avatar: dbUser.avatarUrl
      }
    })

    // 回到使用者當初按下登入的那一頁；IG 導流大多直接落在商品頁，丟回首頁等於要他重找一次
    const target = sanitizeRedirectTarget(getCookie(event, REDIRECT_COOKIE)) ?? '/'
    deleteCookie(event, REDIRECT_COOKIE)

    return sendRedirect(event, target)
  },
  onError(event, error) {
    console.error('Google OAuth error:', error)
    deleteCookie(event, REDIRECT_COOKIE)

    return sendRedirect(event, '/')
  }
})

export default defineEventHandler(async (event) => {
  // 沒有 code 代表這一次是「出發去 Google」，把來源頁先記在短效 cookie；
  // Google 導回時是跨站的頂層導航，必須 SameSite=Lax 才帶得回來。
  if (!getQuery(event).code) {
    const target = sanitizeRedirectTarget(getQuery(event).redirect)

    if (target) {
      setCookie(event, REDIRECT_COOKIE, target, {
        httpOnly: true,
        secure: !import.meta.dev,
        sameSite: 'lax',
        path: '/',
        maxAge: 600
      })
    } else {
      deleteCookie(event, REDIRECT_COOKIE)
    }
  }

  return oauthHandler(event)
})
