/**
 * 目前登入者的權威資料（主要是 role）。
 * session 裡的 role 只是舊 cookie 的快取，舊 session 可能根本沒這個欄位，
 * 所以前台判斷要不要顯示後台入口時以這支為準。
 */
export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)

  if (!session?.user) {
    return { loggedIn: false, user: null }
  }

  const user = await requireDbUser(event)

  return {
    loggedIn: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatarUrl,
      role: user.role,
      isAdmin: isAdmin(user)
    }
  }
})
