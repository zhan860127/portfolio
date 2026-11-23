<script setup lang="ts">
import type { MarketOrder } from '~/stores/market'

definePageMeta({ layout: 'immersive' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const marketStore = useMarketStore()
const { loggedIn } = useUserSession()
const loginLink = useLoginLink()

const marketId = computed(() => String(route.params.marketId))

const { error: loadError } = await useAsyncData(
  () => `market-${marketId.value}`,
  () => marketStore.fetchMarket(marketId.value)
)

if (loadError.value) {
  throw createError({ statusCode: 404, statusMessage: '找不到這場市集', fatal: true })
}

useSeoMeta({
  title: () => marketStore.currentMarket?.title ?? '線上市集',
  description: () => marketStore.currentMarket?.description ?? '清嶼手記線上市集'
})

// 登入後把未登入期間暫存的追蹤搬進帳號（需求 7）
onMounted(async () => {
  if (!loggedIn.value) {
    return
  }

  const synced = await marketStore.syncGuestFollows()

  if (synced > 0) {
    await marketStore.refreshStatuses(marketId.value)
    toast.add({ title: `已將 ${synced} 件追蹤的作品同步到你的帳號`, color: 'success' })
  }
})

/* ---------------------------------------------------------------- */
/*  下單確認流程                                                     */
/* ---------------------------------------------------------------- */

const confirmProductId = ref<string | null>(null)
const placing = ref(false)
const placedOrder = ref<MarketOrder | null>(null)

const confirmProduct = computed(() =>
  marketStore.products.find(product => product.id === confirmProductId.value) ?? null
)

function requireLogin(): boolean {
  if (loggedIn.value) {
    return true
  }

  toast.add({ title: '請先登入才能繼續', description: '登入後會回到這一件作品', color: 'warning' })
  navigateTo(loginLink.value, { external: true })

  return false
}

async function onFollow(productId: string) {
  try {
    const result = await marketStore.toggleFollow(productId, loggedIn.value)

    toast.add({
      title: result.following ? '已加入追蹤' : '已取消追蹤',
      description: result.guest && result.following
        ? '目前存在這個瀏覽器，登入後會自動同步到你的帳號'
        : undefined,
      color: result.following ? 'success' : 'neutral'
    })
  } catch {
    toast.add({ title: marketStore.error ?? '操作失敗', color: 'error' })
  }
}

function onOrder(productId: string) {
  if (!requireLogin()) {
    return
  }

  confirmProductId.value = productId
}

async function confirmOrder() {
  if (!confirmProductId.value) {
    return
  }

  placing.value = true

  try {
    const order = await marketStore.placeOrder(confirmProductId.value)
    confirmProductId.value = null
    placedOrder.value = order
  } catch {
    // 搶輸的情況 store 已經把商品狀態改成保留中，這裡只要說明原因
    confirmProductId.value = null
    toast.add({
      title: marketStore.error ?? '下單失敗',
      description: '可以改為加入候補排隊，有機會在釋出時收到通知',
      color: 'error'
    })
  } finally {
    placing.value = false
  }
}

async function onWaitlist(productId: string) {
  if (!requireLogin()) {
    return
  }

  try {
    const entry = await marketStore.joinWaitlist(productId)

    toast.add({
      title: '已加入候補名單',
      description: entry.position ? `目前是第 ${entry.position} 順位` : undefined,
      color: 'success'
    })
  } catch {
    toast.add({ title: marketStore.error ?? '加入候補失敗', color: 'error' })
  }
}

function goBack() {
  if (window.history.length > 1) {
    router.back()

    return
  }

  navigateTo('/market')
}
</script>

<template>
  <div>
    <div
      v-if="marketStore.productsLoading && marketStore.products.length === 0"
      class="flex h-dvh items-center justify-center bg-white text-neutral-400"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-6 animate-spin"
      />
    </div>

    <div
      v-else-if="marketStore.products.length === 0"
      class="flex h-dvh flex-col items-center justify-center gap-4 bg-white px-6 text-center text-neutral-500"
    >
      <UIcon
        name="i-lucide-package-open"
        class="size-8"
      />
      <p class="text-sm">
        這場市集還沒有上架任何作品。
      </p>
      <UButton
        to="/market"
        color="neutral"
        variant="outline"
      >
        回到市集列表
      </UButton>
    </div>

    <MarketStoryViewer
      v-else-if="marketStore.currentMarket"
      :market="marketStore.currentMarket"
      :products="marketStore.products"
      @back="goBack"
      @follow="onFollow"
      @order="onOrder"
      @waitlist="onWaitlist"
    />

    <!-- 下單前確認：金額與訂金必須在送出前就讓人看清楚 -->
    <UModal
      :open="Boolean(confirmProduct)"
      title="確認送出訂單"
      @update:open="value => { if (!value) confirmProductId = null }"
    >
      <template #body>
        <div
          v-if="confirmProduct"
          class="space-y-4"
        >
          <div class="flex gap-4">
            <img
              v-if="confirmProduct.images[0]?.src"
              :src="confirmProduct.images[0].src"
              :alt="confirmProduct.name"
              class="size-20 shrink-0 rounded-lg object-cover"
            >
            <div class="min-w-0">
              <p class="truncate">
                {{ confirmProduct.name }}
              </p>
              <p
                v-if="confirmProduct.code"
                class="text-xs text-neutral-500"
              >
                作品編號 {{ confirmProduct.code }}
              </p>
            </div>
          </div>

          <dl class="space-y-2 rounded-lg bg-neutral-50 p-4 text-sm dark:bg-neutral-900">
            <div class="flex justify-between">
              <dt class="text-neutral-500">
                作品金額
              </dt>
              <dd>NT$ {{ confirmProduct.price.toLocaleString('zh-TW') }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-neutral-500">
                應付訂金
              </dt>
              <dd class="text-primary-600 dark:text-primary-400">
                NT$ {{ confirmProduct.deposit.toLocaleString('zh-TW') }}
              </dd>
            </div>
          </dl>

          <p class="text-xs leading-relaxed text-neutral-500">
            送出後這件作品會為你保留，並需要在
            {{ marketStore.currentMarket?.depositDueHours ?? 48 }} 小時內完成訂金匯款。
            匯款後請回到「我的訂單」填寫帳號末五碼，我們核對入帳後會再與你聯繫。
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full gap-2">
          <UButton
            color="neutral"
            variant="outline"
            class="flex-1 justify-center"
            @click="confirmProductId = null"
          >
            再想想
          </UButton>
          <UButton
            color="primary"
            class="flex-1 justify-center"
            :loading="placing"
            @click="confirmOrder"
          >
            確認送出
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- 下單成功：直接把匯款資訊帶出來 -->
    <UModal
      :open="Boolean(placedOrder)"
      title="訂單已成立，請完成訂金付款"
      @update:open="value => { if (!value) placedOrder = null }"
    >
      <template #body>
        <div
          v-if="placedOrder"
          class="space-y-4 text-sm"
        >
          <dl class="space-y-2">
            <div class="flex justify-between">
              <dt class="text-neutral-500">
                訂單編號
              </dt>
              <dd class="font-mono text-xs">
                {{ placedOrder.id.slice(0, 8).toUpperCase() }}
              </dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-neutral-500">
                作品
              </dt>
              <dd>{{ placedOrder.productName }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-neutral-500">
                應付訂金
              </dt>
              <dd class="text-primary-600 dark:text-primary-400">
                NT$ {{ placedOrder.deposit.toLocaleString('zh-TW') }}
              </dd>
            </div>
            <div
              v-if="placedOrder.expiresAt"
              class="flex justify-between"
            >
              <dt class="text-neutral-500">
                付款期限
              </dt>
              <dd>{{ new Date(placedOrder.expiresAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) }}</dd>
            </div>
          </dl>

          <MarketBankInfo />
        </div>
      </template>

      <template #footer>
        <div class="flex w-full gap-2">
          <UButton
            color="neutral"
            variant="outline"
            class="flex-1 justify-center"
            @click="placedOrder = null"
          >
            繼續逛市集
          </UButton>
          <UButton
            to="/me"
            color="primary"
            class="flex-1 justify-center"
          >
            前往填寫匯款資料
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
