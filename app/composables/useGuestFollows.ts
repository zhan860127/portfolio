const STORAGE_KEY = 'market:guest-follows'
const MAX_ENTRIES = 100

/**
 * 未登入期間的追蹤暫存（需求 7）。
 *
 * 追蹤不涉及庫存與順位，所以放在瀏覽器是安全的 —— 就算被竄改，
 * 最多只是多同步幾個不存在的 id，伺服器端 sync 會過濾掉。
 * 登入後由 marketStore.syncGuestFollows() 搬進帳號並清空本機。
 */
export function useGuestFollows() {
  function read(): string[] {
    if (!import.meta.client) {
      return []
    }

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []

      return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string') : []
    } catch {
      // 無痕模式或 storage 被鎖住時讀不到，當作沒有暫存即可
      return []
    }
  }

  function write(ids: string[]) {
    if (!import.meta.client) {
      return
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids.slice(0, MAX_ENTRIES)))
    } catch {
      // 寫不進去就放棄暫存，不影響當下的畫面操作
    }
  }

  return {
    list: read,
    has(productId: string) {
      return read().includes(productId)
    },
    toggle(productId: string, following: boolean) {
      const current = read()

      if (following && !current.includes(productId)) {
        write([...current, productId])

        return
      }

      if (!following) {
        write(current.filter(id => id !== productId))
      }
    },
    clear() {
      if (!import.meta.client) {
        return
      }

      try {
        window.localStorage.removeItem(STORAGE_KEY)
      } catch {
        // 清不掉也沒關係，下次 sync 會再送一次，伺服器端是 upsert
      }
    }
  }
}
