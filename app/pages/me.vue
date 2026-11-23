<script setup lang="ts">
import type { MarketOrder } from '~/stores/market'

/**
 * 個人頁（需求 11）。
 *
 * 三個分頁刻意分開而不是混成一張清單：
 * 「我訂購的」「我只是追蹤的」「我正在排隊的」在使用者心裡是完全不同的承諾，
 * 混在一起最容易讓人以為追蹤就等於買到了。
 */
const marketStore = useMarketStore()
const { loggedIn } = useUserSession()
const loginLink = useLoginLink()
const toast = useToast()

useSeoMeta({ title: '我的市集', robots: 'noindex' })

const tab = ref<'orders' | 'follows' | 'waitlist'>('orders')

if (loggedIn.value) {
  await Promise.all([
    marketStore.fetchMyOrders(),
    marketStore.fetchMyFollows(),
    marketStore.fetchMyWaitlist()
  ])
}

/** 需求 11 要求的四個訂單區塊 */
const ORDER_GROUPS = [
  { key: 'pending_deposit', title: '待付訂金', hint: '請在期限前完成匯款並填寫末五碼' },
  { key: 'payment_submitted', title: '待人工核對', hint: '我們正在比對銀行入帳，核對完成會再通知你' },
  { key: 'deposit_confirmed', title: '已確認訂金', hint: '訂金已入帳，作品正在為你準備' },
  { key: 'completed', title: '已完成訂單', hint: '' }
] as const

const groupedOrders = computed(() =>
  ORDER_GROUPS.map(group => ({
    ...group,
    orders: marketStore.myOrders.filter(order => order.status === group.key)
  }))
)

const otherOrders = computed(() =>
  marketStore.myOrders.filter(order => order.status === 'expired' || order.status === 'cancelled')
)

/* ------------------------------------------------------------------ */
/*  匯款資料填寫                                                       */
/* ------------------------------------------------------------------ */

const paymentOrderId = ref<string | null>(null)
const submitting = ref(false)

function localDateTimeValue(date: Date) {
  // datetime-local 需要本地時間字串，直接用 toISOString 會變成 UTC
  const offset = date.getTimezoneOffset() * 60000

  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const form = reactive({
  bankLast5: '',
  paidAmount: 0,
  paidAt: localDateTimeValue(new Date()),
  note: ''
})

const formError = ref<string | null>(null)

function openPaymentForm(order: MarketOrder) {
  paymentOrderId.value = order.id
  form.bankLast5 = order.payment?.bankLast5 ?? ''
  form.paidAmount = order.payment?.paidAmount ?? order.deposit
  form.paidAt = localDateTimeValue(order.payment ? new Date(order.payment.paidAt) : new Date())
  form.note = order.payment?.note ?? ''
  formError.value = null
}

async function submitPayment() {
  if (!paymentOrderId.value) {
    return
  }

  if (!/^\d{5}$/.test(form.bankLast5.trim())) {
    formError.value = '請輸入匯款帳號末五碼（5 位數字）'

    return
  }

  if (!(form.paidAmount > 0)) {
    formError.value = '請輸入匯款金額'

    return
  }

  submitting.value = true
  formError.value = null

  try {
    await marketStore.submitPayment(paymentOrderId.value, {
      bankLast5: form.bankLast5.trim(),
      paidAmount: Number(form.paidAmount),
      paidAt: new Date(form.paidAt).toISOString(),
      note: form.note.trim()
    })

    paymentOrderId.value = null
    toast.add({
      title: '已收到你的匯款資料',
      description: '我們核對銀行入帳後會更新訂單狀態',
      color: 'success'
    })
  } catch (error) {
    formError.value = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
      ?? '送出失敗，請稍後再試'
  } finally {
    submitting.value = false
  }
}

async function cancelWaitlist(entryId: string) {
  try {
    await marketStore.cancelWaitlist(entryId)
    toast.add({ title: '已取消候補', color: 'neutral' })
  } catch {
    toast.add({ title: marketStore.error ?? '取消失敗', color: 'error' })
  }
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
}

const productStatusTone: Record<string, string> = {
  available: 'text-primary-700 bg-primary-100 dark:bg-primary-500/15 dark:text-primary-300',
  reserved: 'text-amber-700 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300',
  sold: 'text-neutral-600 bg-neutral-100 dark:bg-neutral-800 dark:text-neutral-400'
}
</script>

<template>
  <div class="py-20 sm:py-24">
    <h1 class="mb-2 text-3xl">
      我的市集
    </h1>
    <p class="mb-8 text-sm text-neutral-500">
      訂購、追蹤與候補分開管理，一眼就能分辨哪些作品真的屬於你。
    </p>

    <div
      v-if="!loggedIn"
      class="rounded-2xl border border-dashed border-neutral-300 py-20 text-center dark:border-neutral-700"
    >
      <p class="text-sm text-neutral-500">
        請先登入才能查看你的訂單、追蹤與候補。
      </p>
      <UButton
        :to="loginLink"
        external
        class="mt-6"
        icon="i-simple-icons-google"
      >
        使用 Google 登入
      </UButton>
    </div>

    <template v-else>
      <div class="mb-8 flex gap-2 border-b border-neutral-200 dark:border-neutral-800">
        <button
          v-for="item in [
            { key: 'orders', label: `我的訂單 (${marketStore.myOrders.length})` },
            { key: 'follows', label: `我的追蹤 (${marketStore.myFollows.length})` },
            { key: 'waitlist', label: `我的候補 (${marketStore.myWaitlist.length})` }
          ]"
          :key="item.key"
          type="button"
          class="-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors"
          :class="tab === item.key
            ? 'border-primary-500 text-primary-700 dark:text-primary-400'
            : 'border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'"
          @click="tab = item.key as typeof tab"
        >
          {{ item.label }}
        </button>
      </div>

      <!-- 我的訂單 -->
      <div
        v-if="tab === 'orders'"
        class="space-y-10"
      >
        <p
          v-if="marketStore.myOrders.length === 0"
          class="py-16 text-center text-sm text-neutral-500"
        >
          還沒有市集訂單。
        </p>

        <section
          v-for="group in groupedOrders"
          v-show="group.orders.length > 0"
          :key="group.key"
          class="space-y-3"
        >
          <div>
            <h2 class="text-lg">
              {{ group.title }}
            </h2>
            <p
              v-if="group.hint"
              class="text-xs text-neutral-500"
            >
              {{ group.hint }}
            </p>
          </div>

          <article
            v-for="order in group.orders"
            :key="order.id"
            class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
          >
            <div class="flex gap-4">
              <img
                v-if="order.productImage"
                :src="order.productImage"
                :alt="order.productName"
                loading="lazy"
                class="size-20 shrink-0 rounded-lg object-cover"
              >
              <div class="min-w-0 flex-1 space-y-1">
                <p class="truncate">
                  {{ order.productName }}
                </p>
                <p class="text-xs text-neutral-500">
                  {{ order.marketTitle }}．訂單 {{ order.id.slice(0, 8).toUpperCase() }}
                </p>
                <p class="text-sm">
                  NT$ {{ order.amount.toLocaleString('zh-TW') }}
                  <span class="text-primary-600 dark:text-primary-400">
                    ．訂金 NT$ {{ order.deposit.toLocaleString('zh-TW') }}
                  </span>
                </p>
                <p
                  v-if="order.expiresAt && order.status === 'pending_deposit'"
                  class="text-xs text-amber-600"
                >
                  付款期限 {{ formatTime(order.expiresAt) }}
                </p>
                <p
                  v-if="order.payment"
                  class="text-xs text-neutral-500"
                >
                  已填末五碼 {{ order.payment.bankLast5 }}．
                  匯款 NT$ {{ order.payment.paidAmount.toLocaleString('zh-TW') }}．
                  {{ formatTime(order.payment.paidAt) }}
                </p>
              </div>
            </div>

            <div
              v-if="order.status === 'pending_deposit' || order.status === 'expired'"
              class="mt-4"
            >
              <UButton
                size="sm"
                color="primary"
                @click="openPaymentForm(order)"
              >
                {{ order.payment ? '重新填寫匯款資料' : '填寫匯款資料' }}
              </UButton>
            </div>
          </article>
        </section>

        <section
          v-if="otherOrders.length > 0"
          class="space-y-3"
        >
          <h2 class="text-lg text-neutral-500">
            已逾期 / 已取消
          </h2>
          <article
            v-for="order in otherOrders"
            :key="order.id"
            class="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800"
          >
            <span class="truncate text-neutral-500">{{ order.productName }}</span>
            <span class="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              {{ order.statusLabel }}
            </span>
          </article>
        </section>

        <div v-if="groupedOrders.some(g => g.key === 'pending_deposit' && g.orders.length > 0)">
          <MarketBankInfo />
        </div>
      </div>

      <!-- 我的追蹤 -->
      <div
        v-else-if="tab === 'follows'"
        class="space-y-3"
      >
        <p class="rounded-lg bg-neutral-50 px-4 py-3 text-xs text-neutral-500 dark:bg-neutral-900">
          追蹤只是收藏，不會保留庫存，也不會取得購買優先權。作品重新開放時我們會通知你。
        </p>

        <p
          v-if="marketStore.myFollows.length === 0"
          class="py-16 text-center text-sm text-neutral-500"
        >
          還沒有追蹤任何作品。
        </p>

        <NuxtLink
          v-for="follow in marketStore.myFollows"
          :key="follow.id"
          :to="`/market/${follow.marketId}`"
          class="flex items-center gap-4 rounded-xl border border-neutral-200 p-4 transition-colors hover:border-primary-300 dark:border-neutral-800"
        >
          <img
            v-if="follow.productImage"
            :src="follow.productImage"
            :alt="follow.productName"
            loading="lazy"
            class="size-16 shrink-0 rounded-lg object-cover"
          >
          <div class="min-w-0 flex-1">
            <p class="truncate">
              {{ follow.productName }}
            </p>
            <p class="text-xs text-neutral-500">
              {{ follow.marketTitle }}．NT$ {{ follow.price.toLocaleString('zh-TW') }}
            </p>
          </div>
          <span
            class="shrink-0 rounded-full px-2.5 py-1 text-xs"
            :class="productStatusTone[follow.status]"
          >
            {{ follow.statusLabel }}
          </span>
        </NuxtLink>
      </div>

      <!-- 我的候補排隊 -->
      <div
        v-else
        class="space-y-3"
      >
        <p class="rounded-lg bg-neutral-50 px-4 py-3 text-xs text-neutral-500 dark:bg-neutral-900">
          候補不是訂單，也不會保留商品。作品釋出時我們會依順位通知，
          被通知後會有一段只開放給你下單的優先購買時間。
        </p>

        <p
          v-if="marketStore.myWaitlist.length === 0"
          class="py-16 text-center text-sm text-neutral-500"
        >
          目前沒有候補中的作品。
        </p>

        <article
          v-for="entry in marketStore.myWaitlist"
          :key="entry.id"
          class="flex items-center gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <img
            v-if="entry.productImage"
            :src="entry.productImage"
            :alt="entry.productName"
            loading="lazy"
            class="size-16 shrink-0 rounded-lg object-cover"
          >
          <div class="min-w-0 flex-1">
            <NuxtLink
              :to="`/market/${entry.marketId}`"
              class="truncate hover:underline"
            >
              {{ entry.productName }}
            </NuxtLink>
            <p class="text-xs text-neutral-500">
              <template v-if="entry.status === 'waiting'">
                目前第 {{ entry.position ?? '—' }} 順位
              </template>
              <template v-else-if="entry.status === 'notified'">
                已通知，優先購買至 {{ entry.windowExpiresAt ? formatTime(entry.windowExpiresAt) : '—' }}
              </template>
              <template v-else-if="entry.status === 'converted'">
                已轉為訂單
              </template>
              <template v-else>
                候補已結束
              </template>
            </p>
          </div>

          <UButton
            v-if="entry.status === 'notified'"
            size="sm"
            color="primary"
            :to="`/market/${entry.marketId}`"
          >
            前往選購
          </UButton>
          <UButton
            v-else-if="entry.status === 'waiting'"
            size="sm"
            color="neutral"
            variant="outline"
            @click="cancelWaitlist(entry.id)"
          >
            取消候補
          </UButton>
        </article>
      </div>
    </template>

    <!-- 匯款資料表單 -->
    <UModal
      :open="Boolean(paymentOrderId)"
      title="填寫匯款資料"
      @update:open="value => { if (!value) paymentOrderId = null }"
    >
      <template #body>
        <div class="space-y-4">
          <MarketBankInfo />

          <UFormField
            label="匯款帳號末五碼"
            required
          >
            <UInput
              v-model="form.bankLast5"
              placeholder="12345"
              inputmode="numeric"
              maxlength="5"
            />
          </UFormField>

          <UFormField
            label="匯款金額"
            required
          >
            <UInput
              v-model.number="form.paidAmount"
              type="number"
              min="1"
            />
          </UFormField>

          <UFormField
            label="匯款日期與時間"
            required
          >
            <UInput
              v-model="form.paidAt"
              type="datetime-local"
            />
          </UFormField>

          <UFormField label="付款備註">
            <UTextarea
              v-model="form.note"
              :rows="2"
              placeholder="例如：使用家人的帳戶匯款"
            />
          </UFormField>

          <p
            v-if="formError"
            class="text-sm text-red-600"
          >
            {{ formError }}
          </p>

          <p class="text-xs leading-relaxed text-neutral-500">
            送出後訂單會變成「待人工核對」。填寫末五碼不代表付款完成，
            我們確認銀行實際入帳後才會更新為「已確認訂金」。
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full gap-2">
          <UButton
            color="neutral"
            variant="outline"
            class="flex-1 justify-center"
            @click="paymentOrderId = null"
          >
            取消
          </UButton>
          <UButton
            color="primary"
            class="flex-1 justify-center"
            :loading="submitting"
            @click="submitPayment"
          >
            送出
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
