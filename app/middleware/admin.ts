/**
 * 後台頁面的導航守衛。
 *
 * 這只是「不要把後台畫面渲染給沒權限的人」而已，不是授權。
 * 真正的授權在每一支 /api/admin/** 的 requireAdminUser —— 前端守衛任何人都繞得過。
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const { data } = await useFetch<{ loggedIn: boolean, user: { isAdmin: boolean } | null }>('/api/me', {
    key: 'admin-guard-me'
  })

  if (!data.value?.loggedIn) {
    return navigateTo(`/auth/google?redirect=${encodeURIComponent(to.fullPath)}`, { external: true })
  }

  if (!data.value.user?.isAdmin) {
    // 與後端一致回 404，不透露後台路徑存在
    throw createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true })
  }
})
