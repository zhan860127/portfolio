export default defineAppConfig({
  hero: {
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
