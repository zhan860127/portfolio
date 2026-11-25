<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: '寄貨單管理', robots: 'noindex' })

/**
 * 後台寄貨單。
 *
 * 這一頁的用途很窄：把客人填的收件資訊，原封不動地搬進 7-ELEVEN 的出貨系統。
 * 所以每張單都附一個「複製收件資訊」—— 手動重打一次姓名電話門市，
 * 是這個流程裡最容易出錯、而且錯了最難補救的一步。
 */

interface AdminShippingRequest {
  id: string
  recipientName: string
  recipientPhone: string
  storeName: string
  storeCode: string | null
  note: string | null
  itemTotal: number
  depositPaid: number
  shipping: number
  cod: number
  items: Array<{ orderId: string, productName: string, amount: number, deposit: number }>
  status: 'pending' | 'shipped' | 'cancelled'
  statusLabel: string
  shippedAt: string | null
  createdAt: string
  buyerEmail: string
  buyerName: string | null
  itemCount: number
}

const toast = useToast()
const statusFilter = ref('pending')

const { data: requests, refresh, status } = await useFetch<AdminShippingRequest[]>(
  '/api/admin/market/shipping',
  { query: { status: statusFilter } }
)

const STATUS_OPTIONS = [
  { value: 'pending', label: '待出貨' },
  { value: 'shipped', label: '已寄出' },
  { value: 'cancelled', label: '已取消' }
]

const pendingAction = ref<string | null>(null)

async function transition(request: AdminShippingRequest, action: 'mark_shipped' | 'cancel') {
  if (action === 'cancel' && !confirm('取消這張寄貨單？裡面的訂單會放回去，客人可以重新併單。')) {
    return
  }

  pendingAction.value = request.id

  try {
    await $fetch(`/api/admin/market/shipping/${request.id}/transition`, {
      method: 'POST',
      body: { action }
    })

    await refresh()
    toast.add({
      title: action === 'mark_shipped' ? '已標記為寄出' : '已取消寄貨單',
      color: action === 'mark_shipped' ? 'success' : 'neutral'
    })
  } catch (error) {
    toast.add({
      title: (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? '操作失敗',
      color: 'error'
    })
  } finally {
    pendingAction.value = null
  }
}

/** 給 7-ELEVEN 出貨系統貼上用的純文字。欄位順序照著平常輸入的順序排。 */
function shippingText(request: AdminShippingRequest) {
  return [
    `取貨人：${request.recipientName}`,
    `手機：${request.recipientPhone}`,
    `門市：${request.storeName}${request.storeCode ? `（${request.storeCode}）` : ''}`,
    `代收金額：${request.cod}`,
    request.note ? `備註：${request.note}` : null
  ].filter(Boolean).join('\n')
}

async function copyShipping(request: AdminShippingRequest) {
  try {
    await navigator.clipboard.writeText(shippingText(request))
    toast.add({ title: '已複製收件資訊', color: 'success' })
  } catch {
    toast.add({ title: '複製失敗，請手動選取', color: 'error' })
  }
}

function money(value: number) {
  return 'NT$ ' + value.toLocaleString('zh-TW')
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
}
</script>

<template>
  <div class="py-20 sm:py-24">
    <header class="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl">
          寄貨單管理
        </h1>
        <p class="mt-1 text-sm text-neutral-500">
          客人填的 7-ELEVEN 貨到付款資訊，運費固定 NT$ 80
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          to="/admin/market"
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
        >
          回後台
        </UButton>
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          :loading="status === 'pending'"
          @click="refresh()"
        >
          重新整理
        </UButton>
      </div>
    </header>

    <div class="mb-6 flex gap-2">
      <button
        v-for="option in STATUS_OPTIONS"
        :key="option.value"
        type="button"
        class="rounded-full border px-4 py-1.5 text-sm transition-colors"
        :class="statusFilter === option.value
          ? 'border-primary-400 bg-primary-50 text-primary-800 dark:bg-primary-500/15 dark:text-primary-300'
          : 'border-neutral-200 text-neutral-500 hover:border-neutral-300 dark:border-neutral-800'"
        @click="statusFilter = option.value"
      >
        {{ option.label }}
      </button>
    </div>

    <p
      v-if="!requests || requests.length === 0"
      class="py-20 text-center text-sm text-neutral-500"
    >
      這個狀態下沒有寄貨單。
    </p>

    <div
      v-else
      class="space-y-4"
    >
      <article
        v-for="request in requests"
        :key="request.id"
        class="rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"
      >
        <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm">
              {{ request.buyerName || '（未填姓名）' }}
              <span class="text-neutral-500">{{ request.buyerEmail }}</span>
            </p>
            <p class="text-xs text-neutral-500">
              寄貨單 {{ request.id.slice(0, 8).toUpperCase() }}．
              送出於 {{ formatTime(request.createdAt) }}．
              共 {{ request.itemCount }} 件
            </p>
          </div>
          <span class="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            {{ request.statusLabel }}
          </span>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <dl class="space-y-1.5 rounded-xl bg-neutral-50 p-4 text-sm dark:bg-neutral-900">
            <div class="flex justify-between gap-4">
              <dt class="text-neutral-500">
                取貨人
              </dt>
              <dd>{{ request.recipientName }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-neutral-500">
                手機
              </dt>
              <dd class="font-mono">
                {{ request.recipientPhone }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-neutral-500">
                門市
              </dt>
              <dd class="text-right">
                {{ request.storeName }}
                <span
                  v-if="request.storeCode"
                  class="text-neutral-500"
                >（{{ request.storeCode }}）</span>
              </dd>
            </div>
            <div
              v-if="request.note"
              class="flex justify-between gap-4"
            >
              <dt class="text-neutral-500">
                備註
              </dt>
              <dd class="text-right">
                {{ request.note }}
              </dd>
            </div>
          </dl>

          <dl class="space-y-1.5 text-sm">
            <div class="flex justify-between">
              <dt class="text-neutral-500">
                作品金額合計
              </dt>
              <dd>{{ money(request.itemTotal) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-neutral-500">
                已付訂金
              </dt>
              <dd>− {{ money(request.depositPaid) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-neutral-500">
                運費
              </dt>
              <dd>+ {{ money(request.shipping) }}</dd>
            </div>
            <div class="flex justify-between border-t border-neutral-200 pt-1.5 dark:border-neutral-800">
              <dt>貨到付款代收</dt>
              <dd class="text-primary-700 dark:text-primary-400">
                {{ money(request.cod) }}
              </dd>
            </div>
          </dl>
        </div>

        <ul class="mt-4 space-y-1 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-800">
          <li
            v-for="item in request.items"
            :key="item.orderId"
            class="flex justify-between gap-4"
          >
            <span class="truncate">
              {{ item.productName }}
              <span class="font-mono text-xs text-neutral-400">{{ item.orderId.slice(0, 8).toUpperCase() }}</span>
            </span>
            <span class="shrink-0 text-neutral-500">{{ money(item.amount) }}</span>
          </li>
        </ul>

        <div class="mt-4 flex flex-wrap gap-2">
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-copy"
            @click="copyShipping(request)"
          >
            複製收件資訊
          </UButton>
          <template v-if="request.status === 'pending'">
            <UButton
              size="sm"
              color="primary"
              :loading="pendingAction === request.id"
              @click="transition(request, 'mark_shipped')"
            >
              標記已寄出
            </UButton>
            <UButton
              size="sm"
              color="error"
              variant="ghost"
              :loading="pendingAction === request.id"
              @click="transition(request, 'cancel')"
            >
              取消
            </UButton>
          </template>
          <p
            v-else-if="request.shippedAt"
            class="self-center text-xs text-neutral-500"
          >
            已於 {{ formatTime(request.shippedAt) }} 寄出
          </p>
        </div>
      </article>
    </div>
  </div>
</template>
