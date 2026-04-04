// https://nuxt.com/docs/api/configuration/nuxt-config
import svgLoader from 'vite-svg-loader'

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/ui',
    '@nuxt/content',
    '@vueuse/nuxt',
    '@pinia/nuxt',
    'nuxt-og-image',
    'motion-v/nuxt',
    'nuxt-auth-utils',
    '@nuxtjs/i18n'
  ],
  i18n: {
    locales: [
      { code: 'zh-TW', name: '中文', file: 'zh-TW.json' },
      { code: 'en', name: 'English', file: 'en.json' }
    ],
    defaultLocale: 'zh-TW',
    langDir: 'locales',
    strategy: 'no_prefix'
  },
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
    
    publicAssets: [
    {
      dir: 'secrets',
      maxAge: 60 * 60 * 24 * 365
    }
  ],serverAssets: [{
    baseName: 'secrets',
    dir: './secrets'
  }],
    // 確保 Nitro 知道它是部署在 Vercel
    preset: 'vercel',
    prerender: {
      // 避免 build 時爬蟲去抓虛擬路徑導致失敗
      ignore: ['/_vercel', '/_ipx']
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
    instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
    // Feature flags - override via NUXT_PUBLIC_FEATURE_FLAGS_* env vars
    public: {
      featureFlags: {
        /** 市集經驗區塊的公司連結是否可點擊 */
        experienceLinks: process.env.NUXT_PUBLIC_FEATURE_FLAGS_EXPERIENCE_LINKS !== 'false'
      }
    }
  }

})
