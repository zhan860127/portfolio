<script setup lang="ts">
const { locale } = useI18n()

const contentPath = computed(() => locale.value === 'zh-TW' ? '/' : '/index.en')

const { data: page } = await useAsyncData('index', () => {
  return queryCollection('index').path(contentPath.value).first()
}, { watch: [locale] })

if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page not found',
    fatal: true
  })
}

const seo = computed(() => page.value?.seo || {})
const siteUrl = useRequestURL().origin
const ogLocale = computed(() => locale.value === 'zh-TW' ? 'zh_TW' : 'en_US')

useSeoMeta({
  title: () => seo.value.title || page.value?.title,
  description: () => seo.value.description || page.value?.description,
  ogTitle: () => seo.value.title || page.value?.title,
  ogDescription: () => seo.value.description || page.value?.description,
  ogImage: () => seo.value.ogImage || 'https://res.cloudinary.com/dzribeyus/image/upload/v1761200635/5-att_lqpkla.jpg',
  ogUrl: siteUrl,
  ogType: 'website',
  ogLocale: () => ogLocale.value,
  twitterCard: 'summary_large_image',
  twitterTitle: () => seo.value.title || page.value?.title,
  twitterDescription: () => seo.value.description || page.value?.description,
  twitterImage: () => seo.value.ogImage || 'https://res.cloudinary.com/dzribeyus/image/upload/v1761200635/5-att_lqpkla.jpg'
})

const jsonLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: '清嶼 Tranquil Island',
  description: seo.value.description || '手作陶瓷創作品牌，專注於將自然、記憶與生活感受轉化為器物。',
  url: siteUrl,
  image: seo.value.ogImage || 'https://res.cloudinary.com/dzribeyus/image/upload/v1761200635/5-att_lqpkla.jpg',
  sameAs: ['https://www.instagram.com/tranquil._.island/'],
  keywords: seo.value.keywords || '手作陶瓷,陶藝,手捏,盤築,手感器皿,文創陶瓷'
}))

useHead({
  htmlAttrs: { lang: () => locale.value },
  meta: () => seo.value.keywords ? [{ name: 'keywords', content: String(seo.value.keywords) }] : [],
  link: [{ rel: 'canonical', href: siteUrl }],
  script: () => [{ type: 'application/ld+json', innerHTML: JSON.stringify(jsonLd.value) }]
})
</script>

<template>
  <UPage v-if="page">
    <LandingHero :page />
       <LandingMappage :page>
      <LandingWorkExperience :page />
    </LandingMappage>
    <UPageSection
      :ui="{
        container: '!pt-0 lg:grid lg:grid-cols-2 lg:gap-0'
      }"
    >
      <LandingAbout :page />
      <LandingAboutQuote :page />
    </UPageSection>
 
    <LandingInstagram :page />
    <!-- <LandingBlog :page />
    <LandingTestimonials :page /> -->
    <!-- <LandingFAQ :page /> -->
  </UPage>
</template>
