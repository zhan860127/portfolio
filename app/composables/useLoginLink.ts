/**
 * 登入連結一律帶上目前頁面，讓 /auth/google 登入完能把人送回原地。
 * 伺服器端會再驗一次這個值，只接受站內相對路徑。
 */
export function useLoginLink() {
  const route = useRoute()

  return computed(() => `/auth/google?redirect=${encodeURIComponent(route.fullPath)}`)
}
