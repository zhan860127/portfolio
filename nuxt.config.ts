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
   devServer: {
    host: "0.0.0.0"
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

  nitro: {
    prerender: {
      routes: [
        '/'
      ],
      crawlLinks: true
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
      apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
    googleCredentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || `./secrets/credentials.json`,
    googleSpreadsheetId: process.env.GOOGLE_SPREADSHEET_ID
  }

})
