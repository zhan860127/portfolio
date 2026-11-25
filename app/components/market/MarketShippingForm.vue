<script setup lang="ts">
import type { ShippableOrder } from '~/stores/market'

/**
 * 寄貨單（7-ELEVEN 貨到付款）。
 *
 * 客人把自己已確認訂金的訂單勾成一張單、填好收件資訊後直接送進後台。
 * 刻意不經過聊天室或 email —— 訊息會被漏接，而寄貨資訊漏接的代價是包裹寄錯人。
 */
const marketStore = useMarketStore()
const toast = useToast()

const overview = computed(() => marketStore.shipping)
const current = computed(() => overview.value?.current ?? null)
const eligibleOrders = computed<ShippableOrder[]>(() => overview.value?.eligibleOrders ?? [])
const shippingFee = computed(() => overview.value?.shippingFee ?? 0)

const selected = ref<string[]>([])
const editing = ref(false)
const submitting = ref(false)
const formError = ref<string | null>(null)

const form = reactive({
  recipientName: '',
  recipientPhone: '',
  storeName: '',
  storeCode: '',
  note: ''
})

/** 還沒有送出過的時候表單直接攤開 —— 不要讓客人先點一次「我要填」。 */
const formOpen = computed(() => editing.value || !current.value)

function resetForm() {
  const existing = current.value

  form.recipientName = existing?.recipientName ?? ''
  form.recipientPhone = existing?.recipientPhone ?? ''
  form.storeName = existing?.storeName ?? ''
  form.storeCode = existing?.storeCode ?? ''
  form.note = existing?.note ?? ''

  selected.value = existing
    ? eligibleOrders.value.filter(order => order.includedInCurrent).map(order => order.id)
    : eligibleOrders.value.map(order => order.id)

  formError.value = null
}

// 資料抓回來（或送出後重抓）之後，把表單同步成伺服器的版本
watch(overview, () => {
  if (!editing.value) {
    resetForm()
  }
}, { immediate: true })

const selectedOrders = computed(() =>
  eligibleOrders.value.filter(order => selected.value.includes(order.id))
)

/**
 * 畫面上的金額預覽。
 *
 * 公式與伺服器的 summarizeShipment 一致，但**伺服器才是權威** ——
 * 送出後會整包重抓，畫面上的數字會被伺服器算出來的結果覆蓋。
 */
const preview = computed(() => {
  const itemTotal = selectedOrders.value.reduce((sum, order) => sum + order.amount, 0)
  const depositPaid = selectedOrders.value.reduce((sum, order) => sum + order.deposit, 0)

  return {
    itemTotal,
    depositPaid,
    shipping: shippingFee.value,
    cod: Math.max(0, itemTotal - depositPaid) + shippingFee.value
  }
})

function money(value: number) {
  return 'NT$ ' + value.toLocaleString('zh-TW')
}

function toggle(orderId: string) {
  selected.value = selected.value.includes(orderId)
    ? selected.value.filter(id => id !== orderId)
    : [...selected.value, orderId]
}

/** 只做最低限度的前置檢查，避免白跑一趟；真正的驗證在伺服器端。 */
function validate(): string | null {
  if (selected.value.length === 0) {
    return '請至少勾選一筆要寄送的作品'
  }

  if (form.recipientName.trim().length < 2) {
    return '請填寫取貨人姓名'
  }

  const digits = form.recipientPhone.replace(/[\s()-]/g, '').replace(/^\+?886/, '0')

  if (!/^09\d{8}$/.test(digits)) {
    return '請填寫正確的手機號碼（例如 0912345678）'
  }

  if (form.storeName.trim().length < 2) {
    return '請填寫取貨的 7-ELEVEN 門市名稱'
  }

  return null
}

async function submit() {
  formError.value = validate()

  if (formError.value) {
    return
  }

  submitting.value = true

  try {
    await marketStore.submitShipping({
      orderIds: selected.value,
      recipientName: form.recipientName.trim(),
      recipientPhone: form.recipientPhone.trim(),
      storeName: form.storeName.trim(),
      storeCode: form.storeCode.trim(),
      note: form.note.trim()
    })

    editing.value = false
    toast.add({
      title: '寄貨單已送出',
      description: '我們會依這張單安排出貨，取貨時以貨到付款支付尾款',
      color: 'success'
    })
  } catch {
    formError.value = marketStore.error ?? '送出失敗，請稍後再試'
  } finally {
    submitting.value = false
  }
}

async function cancelRequest() {
  const existing = current.value

  if (!existing) {
    return
  }

  try {
    await marketStore.cancelShipping(existing.id)
    editing.value = false
    toast.add({ title: '已取消寄貨單', description: '這些作品可以重新併進新的一張', color: 'neutral' })
  } catch {
    toast.add({ title: marketStore.error ?? '取消失敗', color: 'error' })
  }
}

function startEdit() {
  resetForm()
  editing.value = true
}

function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
}
</script>

<template>
  <div class="space-y-6">
    <p class="rounded-lg bg-neutral-50 px-4 py-3 text-xs leading-relaxed text-neutral-500 dark:bg-neutral-900">
      訂金確認之後就可以填寄貨單。同一張單可以合併多件作品，
      <span class="text-neutral-700 dark:text-neutral-300">運費固定 {{ money(shippingFee) }}</span>，
      取貨時以 7-ELEVEN 貨到付款支付尾款（作品金額扣掉已付訂金，再加運費）。
    </p>

    <!-- 已送出的寄貨單 -->
    <article
      v-if="current"
      class="space-y-4 rounded-2xl border border-primary-200/70 bg-primary-50/40 p-4 dark:border-primary-500/20 dark:bg-primary-500/5"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm">
            寄貨單 {{ current.id.slice(0, 8).toUpperCase() }}
          </p>
          <p class="text-xs text-neutral-500">
            送出於 {{ formatTime(current.createdAt) }}
            <template v-if="current.shippedAt">
              ．已寄出 {{ formatTime(current.shippedAt) }}
            </template>
          </p>
        </div>
        <span class="shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-xs text-primary-800 dark:bg-primary-500/15 dark:text-primary-300">
          {{ current.statusLabel }}
        </span>
      </div>

      <dl class="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        <div class="flex justify-between gap-4">
          <dt class="text-neutral-500">
            取貨人
          </dt>
          <dd>{{ current.recipientName }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-neutral-500">
            手機
          </dt>
          <dd>{{ current.recipientPhone }}</dd>
        </div>
        <div class="flex justify-between gap-4 sm:col-span-2">
          <dt class="text-neutral-500">
            取貨門市
          </dt>
          <dd class="text-right">
            {{ current.storeName }}
            <span
              v-if="current.storeCode"
              class="text-neutral-500"
            >（{{ current.storeCode }}）</span>
          </dd>
        </div>
        <div
          v-if="current.note"
          class="flex justify-between gap-4 sm:col-span-2"
        >
          <dt class="text-neutral-500">
            備註
          </dt>
          <dd class="text-right">
            {{ current.note }}
          </dd>
        </div>
      </dl>

      <ul class="space-y-1 border-t border-primary-200/60 pt-3 text-sm dark:border-primary-500/20">
        <li
          v-for="item in current.items"
          :key="item.orderId"
          class="flex justify-between gap-4"
        >
          <span class="truncate">{{ item.productName }}</span>
          <span class="shrink-0 text-neutral-500">{{ money(item.amount) }}</span>
        </li>
      </ul>

      <dl class="space-y-1.5 border-t border-primary-200/60 pt-3 text-sm dark:border-primary-500/20">
        <div class="flex justify-between">
          <dt class="text-neutral-500">
            作品金額合計
          </dt>
          <dd>{{ money(current.itemTotal) }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-neutral-500">
            已付訂金
          </dt>
          <dd>− {{ money(current.depositPaid) }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-neutral-500">
            運費
          </dt>
          <dd>+ {{ money(current.shipping) }}</dd>
        </div>
        <div class="flex justify-between border-t border-primary-200/60 pt-1.5 dark:border-primary-500/20">
          <dt>貨到付款應付</dt>
          <dd class="text-primary-700 dark:text-primary-400">
            {{ money(current.cod) }}
          </dd>
        </div>
      </dl>

      <div
        v-if="current.canEdit && !editing"
        class="flex gap-2"
      >
        <UButton
          size="sm"
          color="neutral"
          variant="outline"
          @click="startEdit"
        >
          修改
        </UButton>
        <UButton
          size="sm"
          color="error"
          variant="ghost"
          @click="cancelRequest"
        >
          取消寄貨單
        </UButton>
      </div>
      <p
        v-else-if="!current.canEdit"
        class="text-xs text-neutral-500"
      >
        已經寄出的單子不能再修改。地址有誤請直接與我們聯繫。
      </p>
    </article>

    <!-- 沒有可以寄送的訂單 -->
    <p
      v-if="eligibleOrders.length === 0 && !current"
      class="py-16 text-center text-sm text-neutral-500"
    >
      還沒有可以安排寄送的作品。訂金確認之後就會出現在這裡。
    </p>

    <!-- 表單 -->
    <form
      v-else-if="formOpen"
      class="space-y-5"
      @submit.prevent="submit"
    >
      <fieldset class="space-y-2">
        <legend class="mb-2 text-sm">
          要一起寄的作品
        </legend>

        <label
          v-for="order in eligibleOrders"
          :key="order.id"
          class="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors"
          :class="selected.includes(order.id)
            ? 'border-primary-300 bg-primary-50/50 dark:border-primary-500/30 dark:bg-primary-500/5'
            : 'border-neutral-200 dark:border-neutral-800'"
        >
          <input
            type="checkbox"
            class="size-4 accent-primary-500"
            :checked="selected.includes(order.id)"
            @change="toggle(order.id)"
          >
          <img
            v-if="order.productImage"
            :src="order.productImage"
            :alt="order.productName"
            loading="lazy"
            class="size-12 shrink-0 rounded-lg object-cover"
          >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm">{{ order.productName }}</span>
            <span class="block text-xs text-neutral-500">
              {{ money(order.amount) }}．已付訂金 {{ money(order.deposit) }}
            </span>
          </span>
        </label>
      </fieldset>

      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          label="取貨人姓名"
          required
          help="請與取貨時出示的證件相符"
        >
          <UInput
            v-model="form.recipientName"
            placeholder="王小明"
            autocomplete="name"
          />
        </UFormField>

        <UFormField
          label="手機號碼"
          required
          help="超商取貨通知會傳到這支號碼"
        >
          <UInput
            v-model="form.recipientPhone"
            placeholder="0912345678"
            inputmode="tel"
            autocomplete="tel"
          />
        </UFormField>

        <UFormField
          label="7-ELEVEN 門市名稱"
          required
          class="sm:col-span-2"
        >
          <UInput
            v-model="form.storeName"
            placeholder="台北市信義區 ○○門市"
          />
        </UFormField>

        <UFormField
          label="門市店號"
          help="查得到再填，沒有也沒關係"
        >
          <UInput
            v-model="form.storeCode"
            placeholder="123456"
            inputmode="numeric"
          />
        </UFormField>

        <UFormField label="備註">
          <UInput
            v-model="form.note"
            placeholder="例如：平日下午比較方便取貨"
          />
        </UFormField>
      </div>

      <dl class="space-y-1.5 rounded-xl bg-neutral-50 p-4 text-sm dark:bg-neutral-900">
        <div class="flex justify-between">
          <dt class="text-neutral-500">
            已選 {{ selectedOrders.length }} 件作品
          </dt>
          <dd>{{ money(preview.itemTotal) }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-neutral-500">
            已付訂金
          </dt>
          <dd>− {{ money(preview.depositPaid) }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-neutral-500">
            運費
          </dt>
          <dd>+ {{ money(preview.shipping) }}</dd>
        </div>
        <div class="flex justify-between border-t border-neutral-200 pt-1.5 dark:border-neutral-800">
          <dt>取貨時要付</dt>
          <dd class="text-primary-700 dark:text-primary-400">
            {{ money(preview.cod) }}
          </dd>
        </div>
      </dl>

      <p
        v-if="formError"
        class="text-sm text-red-600"
      >
        {{ formError }}
      </p>

      <div class="flex gap-2">
        <UButton
          type="submit"
          color="primary"
          :loading="submitting"
          :disabled="selectedOrders.length === 0"
        >
          {{ current ? '儲存修改' : '送出寄貨單' }}
        </UButton>
        <UButton
          v-if="editing"
          color="neutral"
          variant="outline"
          @click="editing = false"
        >
          不改了
        </UButton>
      </div>
    </form>

    <!-- 歷史 -->
    <section
      v-if="overview?.history.length"
      class="space-y-2 border-t border-neutral-200 pt-6 dark:border-neutral-800"
    >
      <h3 class="text-sm text-neutral-500">
        過去的寄貨單
      </h3>
      <article
        v-for="request in overview.history"
        :key="request.id"
        class="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 p-3 text-sm dark:border-neutral-800"
      >
        <span class="min-w-0">
          <span class="block truncate">
            {{ request.items.map(item => item.productName).join('、') || '（無品項）' }}
          </span>
          <span class="block text-xs text-neutral-500">
            {{ formatTime(request.createdAt) }}．{{ money(request.cod) }}
          </span>
        </span>
        <span class="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
          {{ request.statusLabel }}
        </span>
      </article>
    </section>
  </div>
</template>
