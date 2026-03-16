<script setup lang="ts">
const colorMode = useColorMode()
colorMode.preference = 'light'

const color = computed(() => colorMode.value === 'dark' ? '#020618' : 'white')

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' }
  ],
  htmlAttrs: {
    lang: 'zh-TW'
  }
})

useSeoMeta({
  title: '清嶼',
  titleTemplate: (title) => title ? `${title}｜Tranquil Island` : '清嶼 Tranquil Island',
  description: '清嶼是一個以手作陶瓷為核心的創作品牌，將自然、記憶與生活感受轉化為器物。創作靈感來自農村成長的田野、植物與季節記憶，透過手捏與盤築製作，每件作品皆保留手作的溫度與時間的痕跡。',

  ogTitle: '清嶼 Tranquil Island',
  ogDescription: '清嶼是一個以手作陶瓷為核心的創作品牌，將自然、記憶與生活感受轉化為器物。創作靈感來自農村成長的田野、植物與季節記憶，透過手捏與盤築製作，每件作品皆保留手作的溫度與時間的痕跡。',
  ogImage: 'https://res.cloudinary.com/dzribeyus/image/upload/v1761200635/5-att_lqpkla.jpg',
  ogType: 'website',

  twitterCard: 'summary_large_image',
  twitterTitle: '清嶼 Tranquil Island',
  twitterDescription: '『 美好生活，是與內心的寧靜相遇。』',
  twitterImage: 'https://res.cloudinary.com/dzribeyus/image/upload/v1761200635/5-att_lqpkla.jpg'
})

const [{ data: navigation }, { data: files }] = await Promise.all([
  useAsyncData('navigation', () => {
    return Promise.all([
      queryCollectionNavigation('blog')
    ])
  }, {
    transform: data => data.flat()
  }),
  useLazyAsyncData('search', () => {
    return Promise.all([
      queryCollectionSearchSections('blog')
    ])
  }, {
    server: false,
    transform: data => data.flat()
  })
])
</script>

<template>
  <UApp>
    <NuxtLayout>
      <UMain class="relative">
        <NuxtPage />
      </UMain>
    </NuxtLayout>

    <ClientOnly>
      <LazyUContentSearch
        :files="files"
        :navigation="navigation"
        shortcut="meta_k"
        :links="navLinks"
        :fuse="{ resultLimit: 42 }"
      />
    </ClientOnly>
  </UApp>
</template>
