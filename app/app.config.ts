export default defineAppConfig({
  hero: {
    /**
     * 首頁 Hero 跑馬燈要抓 Cloudinary 哪一個資料夾。
     *
     * 不指定資料夾的話抓的是「最新的 N 張」—— 後台每上傳一張作品照，
     * 首頁的精選圖就會被擠掉一張，所以這裡必須固定一個資料夾。
     * 資料夾不存在或還沒放圖，會退回 content/index.yml 的靜態圖
     * （那組是範本附的風景照，不是陶藝照，所以不該長期靠它）。
     *
     * TQ001 本來是商品資料夾，現在暫時兼任首頁精選。想換成專門的首頁相簿時，
     * 在 Cloudinary 開一個資料夾把圖放進去，改這裡一個字串就好。
     */
    cloudinaryFolder: 'TQ001',
    instagram: {
      'icon': 'i-simple-icons-instagram',
      'to': 'https://www.instagram.com/tranquil._.island/',
      'target': '_blank',
      'aria-label': 'Tranquil Island on Instagram'
    }
  },
  /**
   * 線上市集的匯款資訊。放在 app.config 而不是寫死在元件裡，
   * 換銀行或換帳號時只要改這裡一處。
   * 這些是對外公開的收款資訊，不是機密，不需要走環境變數。
   */
  market: {
    bank: {
      bankName: '請於後台設定銀行名稱',
      bankCode: '',
      accountName: '清嶼手記',
      accountNumber: '',
      note: '匯款後請回到「我的訂單」填寫帳號末五碼，我們核對入帳後會再與你聯繫。'
    }
  },
  global: {
    picture: {
      dark: '/hero/logo.jpg',
      light: '/hero/logo.jpg',
      alt: 'My profile picture'
    },
    meetingLink: 'https://cal.com/',
    email: 'ui-pro@nuxt.com',
    available: true
  },
  ui: {
    colors: {
      // brand 的 500 就是品牌色 #a7be8c（定義在 assets/css/main.css 的 @theme）。
      // 先前用 Tailwind 內建的 green 只是近似值，與實際品牌色有明顯色偏。
      primary: 'brand',
      neutral: 'stone' // 中性色：米灰色 (#f5f5f0)
    },
    pageHero: {
      slots: {
        container: 'py-18 sm:py-24 lg:py-32',
        title: 'mx-auto max-w-xl text-pretty text-3xl sm:text-4xl lg:text-5xl',
        description: 'mt-2 text-md mx-auto max-w-2xl text-pretty sm:text-md text-muted',
        footer: 'mt-0'
      }
    }
  },
  footer: {
    credits: `Built with Tranquil Island • © ${new Date().getFullYear()}`,
    colorMode: false,
    links: [
      { label: '隱私政策', to: '/privacy' },
      { label: '用戶資料刪除', to: '/data-deletion' },
      {
        'icon': 'i-simple-icons-instagram',
        'to': 'https://www.instagram.com/tranquil._.island/',
        'target': '_blank',
        'aria-label': 'Tranquil Island on Instagram'
      }
    ]
  }
})
