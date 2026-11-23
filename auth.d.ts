/**
 * nuxt-auth-utils 預設把 session 的 User 當成空物件，
 * 所以 `user.name` / `user.avatar` 在 template 裡一律型別錯誤。
 * 這裡補上本專案實際放進 session 的欄位。
 *
 * role 只是給前端決定要不要顯示後台入口用的提示，
 * 真正的授權一律由伺服器端的 requireAdminUser 查 DB。
 */
declare module '#auth-utils' {
  interface User {
    id?: string
    email: string
    name?: string | null
    avatar?: string | null
    role?: 'user' | 'admin'
  }
}

export {}
