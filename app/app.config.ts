export default defineAppConfig({
  hero: {
    instagram: {
      icon: 'i-simple-icons-instagram',
      to: 'https://www.instagram.com/tranquil._.island/',
      target: '_blank',
      'aria-label': 'Tranquil Island on Instagram'
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
      primary: 'green',     // 主色調：自然綠 (如 #a7be8c)
      neutral: 'stone'      // 中性色：米灰色 (#f5f5f0)
    },
    pageHero: {
      slots: {
        container: 'py-18 sm:py-24 lg:py-32',
        title: 'mx-auto max-w-xl text-pretty text-3xl sm:text-4xl lg:text-5xl',
        description: 'mt-2 text-md mx-auto max-w-2xl text-pretty sm:text-md text-muted',
        footer: 'mt-0',
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
        icon: 'i-simple-icons-instagram',
        to: 'https://www.instagram.com/tranquil._.island/',
        target: '_blank',
        'aria-label': 'Tranquil Island on Instagram'
      }
    ]
  }
})
