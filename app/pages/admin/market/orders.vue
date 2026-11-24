<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: '市集訂單管理', robots: 'noindex' })

interface AdminOrder {
  id: string
  marketId: string
  marketTitle: string | null
  productId: string
  productName: string
  productImage: string | null
  productCode: string | null
  productStatus: 'available' | 'reserved' | 'sold'
  amount: number
  deposit: number
  status: 'pending_deposit' | 'payment_submitted' | 'deposit_confirmed' | 'completed' | 'expired' | 'cancelled'
  statusLabel: string
  expiresAt: string | null
  createdAt: string
  overdue: boolean
  buyerEmail: string
  buyerName: string | null
  payment: {
    bankLast5: string
    paidAmount: number
    paidAt: string
    note: string | null
    submittedAt: string
  } | null
}

const toast = useToast()
const statusFilter = ref('')

const { data: orders, refresh, status } = await useFetch<AdminOrder[]>('/api/admin/market/orders', {
  query: { status: statusFilter }
})

const STATUS_OPTIONS = [
  { value: '', label: '全部狀態' },
  { value: 'pending_deposit', label: '待付訂金' },
  { value: 'payment_submitted', label: '待人工核對' },
  { value: 'deposit_confirmed', label: '已確認訂金' },
  { value: 'completed', label: '已完成' },
  { value: 'expired', label: '已逾期' },
  { value: 'cancelled', label: '已取消' }
]

/**
 * 每個狀態下可用的動作。
 * 「確認訂金」與「確認售出」刻意分成兩步，對應兩個不同的人工確認時點。
 */
const ACTIONS: Record<string, Array<{ action: string, label: string, color: 'primary' | 'neutral' | 'error', confirm?: string }>> = {
  pending_deposit: [
    { action: 'confirm_deposit', label: '確認訂金入帳', color: 'primary' },
    { action: 'mark_expired', label: '標記逾期', color: 'neutral' },
    { action: 'cancel', label: '取消並釋放商品', color: 'error', confirm: '取消訂單並釋放作品？有人候補的話會直接保留給第一順位。' }
  ],
  payment_submitted: [
    { action: 'confirm_deposit', label: '確認訂金入帳', color: 'primary' },
    { action: 'revert_payment', label: '退回重填', color: 'neutral' },
    { action: 'cancel', label: '取消並釋放商品', color: 'error', confirm: '取消訂單並釋放作品？有人候補的話會直接保留給第一順位。' }
  ],
  deposit_confirmed: [
    { action: 'confirm_sold', label: '確認售出', color: 'primary', confirm: '確認售出後作品會變成已售完，候補名單也會結束。' },
    { action: 'cancel', label: '取消並釋放商品', color: 'error', confirm: '取消訂單並釋放作品？有人候補的話會直接保留給第一順位。' }
  ],
  expired: [
    { action: 'confirm_deposit', label: '確認訂金入帳', color: 'primary' },
    { action: 'cancel', label: '取消並釋放商品', color: 'error', confirm: '取消訂單並釋放作品？有人候補的話會直接保留給第一順位。' }
  ]
}

const busy = ref<string | null>(null)

interface TransitionResult {
  statusLabel: string
  waitingCount: number
  /** 取消並釋放時，作品若直接保留給候補第一順位，這裡會帶回新訂單 */
  promoted: { orderId: string, userEmail: string } | null
}

/** 釋放之後作品可能已經有新主人，別再叫管理員去發通知。 */
function describeTransition(result: TransitionResult): string | undefined {
  if (result.promoted) {
    const base = `已直接保留給候補第一順位（${result.promoted.userEmail}）`

    return result.waitingCount > 0 ? `${base}，後面還有 ${result.waitingCount} 人候補` : base
  }

  return result.waitingCount > 0
    ? `這件作品有 ${result.waitingCount} 人候補，可到商品管理發送通知`
    : undefined
}

async function runAction(order: AdminOrder, action: { action: string, label: string, confirm?: string }) {
  if (action.confirm && !window.confirm(action.confirm)) {
    return
  }

  busy.value = order.id

  try {
    const result = await $fetch<TransitionResult>(
      `/api/admin/market/orders/${order.id}/transition`,
      { method: 'POST', body: { action: action.action } }
    )

    await refresh()

    toast.add({
      title: `已更新為「${result.statusLabel}」`,
      description: describeTransition(result),
      color: 'success'
    })
  } catch (error) {
    toast.add({
      title: (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? '操作失敗',
      color: 'error'
    })
  } finally {
    busy.value = null
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
}

const statusTone: Record<string, string> = {
  pending_deposit: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  payment_submitted: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300',
  deposit_confirmed: 'bg-primary-100 text-primary-800 dark:bg-primary-500/15 dark:text-primary-300',
  completed: 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
  expired: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
  cancelled: 'bg-neutral-200 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-500'
}
</script>

<template>
  <div class="py-20 sm:py-24">
    <header class="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <UButton
          to="/admin/market"
          variant="link"
          color="neutral"
          icon="i-lucide-chevron-left"
          class="-ml-3"
        >
          回到活動列表
        </UButton>
        <h1 class="mt-1 text-2xl">
          訂單管理
        </h1>
      </div>
      <USelect
        v-model="statusFilter"
        :items="STATUS_OPTIONS"
        value-key="value"
        class="w-44"
      />
    </header>

    <div class="mb-6 rounded-lg bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
      使用者填寫的末五碼只是待核對資訊，不代表已付款。
      請先在銀行確認實際入帳，再按「確認訂金入帳」；作品要等「確認售出」才會變成已售完。
    </div>

    <p
      v-if="status === 'pending'"
      class="py-20 text-center text-sm text-neutral-500"
    >
      載入中…
    </p>

    <p
      v-else-if="!orders || orders.length === 0"
      class="py-20 text-center text-sm text-neutral-500"
    >
      沒有符合條件的訂單。
    </p>

    <ul
      v-else
      class="space-y-3"
    >
      <li
        v-for="order in orders"
        :key="order.id"
        class="rounded-xl border p-4"
        :class="order.overdue
          ? 'border-red-300 dark:border-red-500/40'
          : 'border-neutral-200 dark:border-neutral-800'"
      >
        <div class="flex flex-wrap gap-4">
          <img
            v-if="order.productImage"
            :src="order.productImage"
            :alt="order.productName"
            loading="lazy"
            class="size-20 shrink-0 rounded-lg object-cover"
          >

          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="truncate">
                {{ order.productName }}
              </p>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-xs"
                :class="statusTone[order.status]"
              >
                {{ order.statusLabel }}
              </span>
              <span
                v-if="order.overdue"
                class="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-500/15 dark:text-red-300"
              >
                已過期限
              </span>
            </div>

            <p class="text-xs text-neutral-500">
              {{ order.marketTitle }}．訂單 {{ order.id.slice(0, 8).toUpperCase() }}．
              建立於 {{ formatTime(order.createdAt) }}
            </p>
            <p class="text-xs text-neutral-500">
              買家 {{ order.buyerName || '—' }}（{{ order.buyerEmail }}）
            </p>
            <p class="text-sm">
              NT$ {{ order.amount.toLocaleString('zh-TW') }}．
              應付訂金 NT$ {{ order.deposit.toLocaleString('zh-TW') }}
            </p>

            <div
              v-if="order.payment"
              class="mt-2 rounded-lg bg-neutral-50 p-3 text-xs dark:bg-neutral-900"
            >
              <p>
                末五碼
                <span class="font-mono text-sm">{{ order.payment.bankLast5 }}</span>
                ．匯款 NT$ {{ order.payment.paidAmount.toLocaleString('zh-TW') }}
                <span
                  v-if="order.payment.paidAmount !== order.deposit"
                  class="ml-1 text-amber-600"
                >（與應付訂金不符）</span>
              </p>
              <p class="mt-0.5 text-neutral-500">
                匯款時間 {{ formatTime(order.payment.paidAt) }}．
                填寫於 {{ formatTime(order.payment.submittedAt) }}
              </p>
              <p
                v-if="order.payment.note"
                class="mt-0.5 text-neutral-500"
              >
                備註：{{ order.payment.note }}
              </p>
            </div>
            <p
              v-else-if="order.status === 'pending_deposit'"
              class="text-xs text-neutral-400"
            >
              買家尚未填寫匯款資料
              <span v-if="order.expiresAt">．期限 {{ formatTime(order.expiresAt) }}</span>
            </p>
          </div>
        </div>

        <div
          v-if="ACTIONS[order.status]"
          class="mt-4 flex flex-wrap gap-2"
        >
          <UButton
            v-for="action in ACTIONS[order.status]"
            :key="action.action"
            size="sm"
            :color="action.color"
            :variant="action.color === 'primary' ? 'solid' : 'outline'"
            :loading="busy === order.id"
            @click="runAction(order, action)"
          >
            {{ action.label }}
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="ghost"
            :to="`/admin/market/${order.marketId}`"
          >
            查看商品
          </UButton>
        </div>
      </li>
    </ul>
  </div>
</template>
