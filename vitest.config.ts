import { defineVitestConfig } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

/**
 * 兩組測試刻意分開跑：
 *
 * - unit：不啟動 Nuxt，直接測純邏輯（手勢裁決、縮放數學、訂單狀態機）。
 *   這些是訂單公平性與手勢衝突的規則所在，必須跑得夠快才會有人真的去跑。
 * - nuxt：啟動 Nuxt runtime 測元件，成本高，只放真的需要渲染的案例。
 * - db：需要真實 Postgres 的整合測試，沒設定 DATABASE_URL_TEST 時整個跳過。
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['tests/unit/**/*.spec.ts']
        }
      },
      {
        test: {
          name: 'db',
          environment: 'node',
          include: ['tests/db/**/*.spec.ts'],
          // 併發測試需要真的連線池，不能被平行化切開
          fileParallelism: false,
          testTimeout: 30000
        }
      },
      defineVitestConfig({
        test: {
          name: 'nuxt',
          environment: 'nuxt',
          include: ['tests/nuxt/**/*.spec.ts'],
          /*
           * 每個測試檔都會在自己的 worker 裡啟動一次 Nuxt runtime。
           * 專案長大之後那段啟動已經會超過 vitest 預設的 10 秒，
           * 症狀是 HookTimeoutError 而且整個檔案被標成 skipped ——
           * 看起來像壞掉，其實只是還沒開完。
           */
          hookTimeout: 60000
        }
      })
    ]
  }
})
