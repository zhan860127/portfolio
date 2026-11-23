<script setup lang="ts">
const marketStore = useMarketStore()

await useAsyncData('market-list', () => marketStore.fetchMarkets())

useSeoMeta({
  title: '線上市集 Online Market',
  description: '清嶼手記線上市集，像翻閱限時動態一樣瀏覽本次的陶藝作品，追蹤、選購與候補都在同一個介面完成。',
  ogTitle: '線上市集 Online Market｜清嶼 Tranquil Island',
  ogDescription: '像翻閱限時動態一樣瀏覽本次的陶藝作品。'
})

const statusTone: Record<string, string> = {
  upcoming: 'text-amber-700 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300',
  live: 'text-primary-800 bg-primary-100 dark:bg-primary-500/15 dark:text-primary-300',
  ended: 'text-neutral-600 bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-400'
}

function formatRange(startsAt: string, endsAt: string) {
  const options: Intl.DateTimeFormatOptions = {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Taipei'
  }

  const start = new Date(startsAt).toLocaleString('zh-TW', options)
  const end = new Date(endsAt).toLocaleString('zh-TW', options)

  return `${start} – ${end}`
}
</script>

<template>
  <div class="py-20 sm:py-24">
    <header class="mb-12 text-center">
      <p class="text-sm tracking-[0.3em] text-primary-600 dark:text-primary-400">
        ONLINE MARKET
      </p>
      <h1 class="mt-3 text-3xl sm:text-4xl">
        線上市集
      </h1>
      <p class="mx-auto mt-4 max-w-lg text-pretty text-sm leading-relaxed text-neutral-500">
        每一場市集都是一次限量的相遇。像翻閱限時動態一樣瀏覽本次作品，
        看見細節、追蹤喜歡的器物，也可以直接留下訂單。
      </p>
    </header>

    <div
      v-if="marketStore.marketsLoading"
      class="grid gap-6 sm:grid-cols-2"
    >
      <USkeleton
        v-for="n in 2"
        :key="n"
        class="h-72 w-full rounded-2xl"
      />
    </div>

    <div
      v-else-if="marketStore.markets.length === 0"
      class="rounded-2xl border border-dashed border-neutral-300 py-20 text-center dark:border-neutral-700"
    >
      <UIcon
        name="i-lucide-calendar-clock"
        class="size-8 text-neutral-400"
      />
      <p class="mt-4 text-sm text-neutral-500">
        目前沒有進行中的市集，歡迎追蹤 Instagram 掌握下一場消息。
      </p>
    </div>

    <ul
      v-else
      class="grid gap-6 sm:grid-cols-2"
    >
      <li
        v-for="market in marketStore.markets"
        :key="market.id"
        class="group overflow-hidden rounded-2xl border border-neutral-200 bg-white transition-shadow hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
      >
        <NuxtLink
          :to="`/market/${market.id}`"
          class="block"
        >
          <div class="relative aspect-[4/3] overflow-hidden bg-neutral-100 dark:bg-neutral-800">
            <img
              v-if="market.coverImage"
              :src="market.coverImage"
              :alt="market.title"
              loading="lazy"
              decoding="async"
              class="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            >
            <span
              class="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs"
              :class="statusTone[market.status]"
            >
              {{ market.statusLabel }}
            </span>
          </div>

          <div class="space-y-3 p-5">
            <h2 class="text-lg">
              {{ market.title }}
            </h2>
            <p
              v-if="market.description"
              class="line-clamp-2 text-sm leading-relaxed text-neutral-500"
            >
              {{ market.description }}
            </p>

            <dl class="space-y-1 text-xs text-neutral-500">
              <div class="flex items-center gap-1.5">
                <UIcon
                  name="i-lucide-clock"
                  class="size-3.5"
                />
                <dd>{{ formatRange(market.startsAt, market.endsAt) }}</dd>
              </div>
              <div class="flex items-center gap-1.5">
                <UIcon
                  name="i-lucide-package"
                  class="size-3.5"
                />
                <dd>本次共 {{ market.productCount }} 件作品</dd>
              </div>
            </dl>

            <UButton
              block
              :color="market.status === 'live' ? 'primary' : 'neutral'"
              :variant="market.status === 'live' ? 'solid' : 'outline'"
              trailing-icon="i-lucide-arrow-right"
              class="mt-2"
            >
              {{ market.status === 'upcoming' ? '搶先瀏覽作品' : market.status === 'ended' ? '回顧本次作品' : '進入市集' }}
            </UButton>
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
