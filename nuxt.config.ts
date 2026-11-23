// https://nuxt.com/docs/api/configuration/nuxt-config
import svgLoader from 'vite-svg-loader'

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/content',
    '@vueuse/nuxt',
    '@pinia/nuxt',  // 添加 Pinia 模組
    'nuxt-og-image',
    'motion-v/nuxt',
    'nuxt-auth-utils'
  ],
  image: {
    // 確保 provider 是預設的 ipx 或 vercel
    provider: process.env.VERCEL ? 'vercel' : 'ipx',
    },
   devServer: {
    host: "0.0.0.0",
    port: 3000   // 固定使用 3000
  },
  devtools: {
    enabled: true
  },
  vite: {
    plugins: [svgLoader()],
   server: {
       hmr: {
        protocol: "wss",
        host: process.env.NGROK_HOST,
        port: 443
      },

      allowedHosts: [
        ".*\.ngrok-free\.app$",
        ".*\.ngrok\.io$",
      ]
    }
  },
  css: ['~/assets/css/main.css'],

  compatibilityDate: '2024-11-01',
  content: {
   
  },
 
  nitro: {
    externals: {
      external: ['better-sqlite3']
    },
    
    // secrets/ 僅供 server 端讀取，不可放進 publicAssets（會被掛在站台根路徑對外提供）
    serverAssets: [{
    baseName: 'secrets',
    dir: './secrets'
  }],
    // 確保 Nitro 知道它是部署在 Vercel
    preset: 'vercel',
    prerender: {
      // 避免 build 時爬蟲去抓虛擬路徑導致失敗
      ignore: ['/_vercel', '/_ipx']
    },
    vercel: {
      config: {
        version: 3,
        // Instagram 長效 token 每 60 天到期，必須在到期前換發；
        // 端點本身會判斷是否真的到了該換的時候，每天空跑成本極低
        crons: [{
          path: '/api/cron/instagram-token-refresh',
          schedule: '0 4 * * *'
        }]
      }
    }

  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },
  runtimeConfig: {
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET
    },
    googleCredentialsPath: process.env.NUXT_GOOGLE_APPLICATION_CREDENTIALS_JSON || `./secrets/credentials.json`,
    googleSpreadsheetId: process.env.GOOGLE_SPREADSHEET_ID,
    // 首次授權取得的 token；換發後以 KV 的版本為準
    instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    // Vercel KV（Upstash）整合注入，用來存放換發後的 token
    kvRestApiUrl: process.env.KV_REST_API_URL,
    kvRestApiToken: process.env.KV_REST_API_TOKEN,
    // Vercel Cron 觸發時帶的 Bearer token
    cronSecret: process.env.CRON_SECRET
  }

})
