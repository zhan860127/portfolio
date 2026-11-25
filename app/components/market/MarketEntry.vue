<script setup lang="ts">
/**
 * 首頁的線上市集入口（需求 2）。
 *
 * 刻意不做成購物平台那種大面積促銷 Banner：維持官網既有的留白與襯線字調性，
 * 品牌色只用在細線、標籤與按鈕上，主視覺交給作品照片本身。
 */
const props = defineProps<{
  /** 沒有進行中的市集時，用首頁既有的作品照片當入口視覺 */
  fallbackImage?: string
}>()

const { data } = await useAsyncData('market-entry', () =>
  $fetch<Array<{
    id: string
    title: string
    coverImage: string | null
    status: string
    statusLabel: string
    productCount: number
    startsAt: string
  }>>('/api/market/markets'), {
  default: () => [],
  // 首頁是靜態為主，市集狀態用 lazy 在客戶端補上，不拖慢首屏
  lazy: true,
  server: false
})

/** 優先顯示進行中的場次，其次即將開始，最後才是最近結束的 */
const featured = computed(() => {
  const markets = data.value ?? []

  return markets.find(market => market.status === 'live')
    ?? markets.find(market => market.status === 'upcoming')
    ?? markets[0]
    ?? null
})

const target = computed(() => featured.value ? `/market/${featured.value.id}` : '/market')
const image = computed(() => featured.value?.coverImage || props.fallbackImage || '/hero/random-3.avif')
</script>

<template>
  <!--
    寬度與左右對齊由這裡決定：卡片現在長在 Hero 的 logo 下方，
    外層是置中的 text-center 版型，所以要自己把文字拉回靠左。
  -->
  <section class="mx-auto w-full max-w-2xl text-left">
    <NuxtLink
      :to="target"
      class="group relative block overflow-hidden rounded-2xl border border-primary-200/70 bg-primary-50/40 transition-colors hover:border-primary-300 dark:border-primary-500/20 dark:bg-primary-500/5"
    >
      <div class="grid items-stretch sm:grid-cols-5">
        <!-- 手機版圖片在上方，確保入口一眼就看得到 -->
        <div class="relative aspect-[16/10] overflow-hidden sm:col-span-2 sm:aspect-auto">
          <img
            :src="image"
            alt="清嶼手記線上市集作品"
            loading="lazy"
            decoding="async"
            class="size-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          >
          <span
            v-if="featured?.status === 'live'"
            class="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-xs text-primary-800 backdrop-blur"
          >
            <span class="size-1.5 animate-pulse rounded-full bg-primary-500" />
            進行中
          </span>
        </div>

        <div class="flex flex-col justify-center gap-3 p-6 sm:col-span-3 sm:p-8">
          <p class="text-xs tracking-[0.3em] text-primary-700 dark:text-primary-400">
            ONLINE MARKET
          </p>
          <h2 class="text-2xl sm:text-3xl">
            線上市集
          </h2>

          <p class="text-pretty text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            <template v-if="featured">
              {{ featured.title }}．本次共 {{ featured.productCount }} 件作品。
            </template>
            <template v-else>
              像翻閱限時動態一樣，慢慢看過每一件手作器物。
            </template>
          </p>

          <span
            class="mt-2 inline-flex items-center gap-2 self-start rounded-full bg-primary-500 px-5 py-2.5 text-sm text-white transition-transform group-hover:gap-3"
          >
            瀏覽本次作品
            <UIcon
              name="i-lucide-arrow-right"
              class="size-4 transition-transform"
            />
          </span>
        </div>
      </div>
    </NuxtLink>
  </section>
</template>
