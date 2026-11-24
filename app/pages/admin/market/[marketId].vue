<script setup lang="ts">
definePageMeta({ middleware: 'admin' })

interface AdminProduct {
  id: string
  code: string | null
  name: string
  description: string | null
  price: number
  deposit: number
  images: Array<{ src: string, alt?: string, kind?: string }>
  specifications: Record<string, string | undefined>
  story: string | null
  purchaseNotes: string | null
  status: 'available' | 'reserved' | 'sold'
  statusLabel: string
  sortOrder: number
  allowWaitlistWhenSold: number | null
  waitingCount: number
  activeOrderId: string | null
  activeOrderStatus: string | null
}

interface WaitlistRow {
  id: string
  userEmail: string
  userName: string | null
  status: string
  position: number | null
  notifiedAt: string | null
  windowExpiresAt: string | null
  windowActive: boolean
  createdAt: string
}

const route = useRoute()
const toast = useToast()
const marketId = computed(() => String(route.params.marketId))

const { data, refresh } = await useFetch<{
  market: { id: string, title: string, waitlistWindowHours: number }
  products: AdminProduct[]
}>(() => `/api/admin/market/markets/${marketId.value}/products`)

useSeoMeta({ title: () => `${data.value?.market.title ?? '活動'}｜商品管理`, robots: 'noindex' })

/* ------------------------------ 商品表單 ------------------------------ */

const SPEC_FIELDS = [
  { key: 'dimensions', label: '尺寸' },
  { key: 'weight', label: '重量' },
  { key: 'material', label: '材質' },
  { key: 'technique', label: '製作方式' },
  { key: 'firingTemperature', label: '燒成溫度' },
  { key: 'glaze', label: '釉色與表面特色' },
  { key: 'variation', label: '手工製作的自然差異' }
] as const

const editingId = ref<string | null>(null)
const creating = ref(false)
const saving = ref(false)
const formError = ref<string | null>(null)

function emptyProductForm() {
  return {
    code: '',
    name: '',
    description: '',
    price: 0,
    deposit: 0,
    images: [] as Array<{ src: string, alt: string, kind: string }>,
    specifications: {} as Record<string, string>,
    story: '',
    purchaseNotes: '',
    sortOrder: 0,
    status: 'available' as AdminProduct['status'],
    allowWaitlistWhenSold: null as boolean | null
  }
}

const form = reactive(emptyProductForm())

function openCreate() {
  Object.assign(form, emptyProductForm())
  form.sortOrder = (data.value?.products.length ?? 0) * 10
  editingId.value = null
  creating.value = true
  formError.value = null
}

function openEdit(product: AdminProduct) {
  Object.assign(form, {
    code: product.code ?? '',
    name: product.name,
    description: product.description ?? '',
    price: product.price,
    deposit: product.deposit,
    images: product.images.map(image => ({ src: image.src, alt: image.alt ?? '', kind: image.kind ?? '' })),
    specifications: { ...product.specifications } as Record<string, string>,
    story: product.story ?? '',
    purchaseNotes: product.purchaseNotes ?? '',
    sortOrder: product.sortOrder,
    status: product.status,
    allowWaitlistWhenSold: product.allowWaitlistWhenSold === null
      ? null
      : product.allowWaitlistWhenSold === 1
  })
  editingId.value = product.id
  creating.value = false
  formError.value = null
}

function close() {
  editingId.value = null
  creating.value = false
}

async function save() {
  saving.value = true
  formError.value = null

  const payload: Record<string, unknown> = {
    marketId: marketId.value,
    code: form.code,
    name: form.name,
    description: form.description,
    price: Number(form.price),
    deposit: Number(form.deposit),
    images: form.images.filter(image => image.src.trim()),
    specifications: form.specifications,
    story: form.story,
    purchaseNotes: form.purchaseNotes,
    sortOrder: Number(form.sortOrder),
    allowWaitlistWhenSold: form.allowWaitlistWhenSold
  }

  try {
    if (editingId.value) {
      // 狀態只在沒有有效訂單時送出，避免後端直接回 409
      const target = data.value?.products.find(product => product.id === editingId.value)

      if (target && !target.activeOrderId) {
        payload.status = form.status
      }

      await $fetch(`/api/admin/market/products/${editingId.value}`, { method: 'PATCH', body: payload })
    } else {
      await $fetch('/api/admin/market/products', { method: 'POST', body: payload })
    }

    close()
    await refresh()
    toast.add({ title: '已儲存', color: 'success' })
  } catch (error) {
    formError.value = (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? '儲存失敗'
  } finally {
    saving.value = false
  }
}

async function removeProduct(product: AdminProduct) {
  if (!window.confirm(`確定要刪除「${product.name}」嗎？此操作無法復原。`)) {
    return
  }

  try {
    await $fetch(`/api/admin/market/products/${product.id}`, { method: 'DELETE' })
    await refresh()
    toast.add({ title: '已刪除', color: 'success' })
  } catch (error) {
    toast.add({
      title: (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? '刪除失敗',
      color: 'error'
    })
  }
}

/* ------------------------------ 候補管理 ------------------------------ */

const waitlistProduct = ref<AdminProduct | null>(null)
const waitlistRows = ref<WaitlistRow[]>([])
const waitlistLoading = ref(false)
const notifyCount = ref(1)
const notifyHours = ref<number | null>(null)

async function openWaitlist(product: AdminProduct) {
  waitlistProduct.value = product
  waitlistLoading.value = true
  notifyCount.value = 1
  notifyHours.value = data.value?.market.waitlistWindowHours ?? 24

  try {
    const result = await $fetch<{ entries: WaitlistRow[] }>('/api/admin/market/waitlist', {
      query: { productId: product.id }
    })
    waitlistRows.value = result.entries
  } finally {
    waitlistLoading.value = false
  }
}

async function notifyWaitlist() {
  if (!waitlistProduct.value) {
    return
  }

  try {
    const result = await $fetch<{ notified: number, windowExpiresAt: string | null }>(
      '/api/admin/market/waitlist/notify',
      {
        method: 'POST',
        body: {
          productId: waitlistProduct.value.id,
          count: notifyCount.value,
          windowHours: notifyHours.value
        }
      }
    )

    toast.add({
      title: `已通知 ${result.notified} 位候補者`,
      description: result.windowExpiresAt
        ? `優先購買至 ${new Date(result.windowExpiresAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`
        : undefined,
      color: 'success'
    })

    await openWaitlist(waitlistProduct.value)
    await refresh()
  } catch (error) {
    toast.add({
      title: (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? '通知失敗',
      color: 'error'
    })
  }
}

async function cancelEntry(entryId: string) {
  try {
    await $fetch(`/api/admin/market/waitlist/${entryId}`, { method: 'DELETE' })

    if (waitlistProduct.value) {
      await openWaitlist(waitlistProduct.value)
    }

    await refresh()
  } catch {
    toast.add({ title: '取消失敗', color: 'error' })
  }
}

const statusTone: Record<string, string> = {
  available: 'bg-primary-100 text-primary-800 dark:bg-primary-500/15 dark:text-primary-300',
  reserved: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  sold: 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
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
          {{ data?.market.title }}
        </h1>
      </div>
      <UButton
        icon="i-lucide-plus"
        @click="openCreate"
      >
        新增作品
      </UButton>
    </header>

    <p
      v-if="!data || data.products.length === 0"
      class="py-20 text-center text-sm text-neutral-500"
    >
      這場活動還沒有作品。
    </p>

    <ul
      v-else
      class="space-y-3"
    >
      <li
        v-for="product in data.products"
        :key="product.id"
        class="flex flex-wrap items-center gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
      >
        <img
          v-if="product.images[0]?.src"
          :src="product.images[0].src"
          :alt="product.name"
          loading="lazy"
          class="size-16 shrink-0 rounded-lg object-cover"
        >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <p class="truncate">
              {{ product.name }}
            </p>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-xs"
              :class="statusTone[product.status]"
            >
              {{ product.statusLabel }}
            </span>
          </div>
          <p class="mt-0.5 text-xs text-neutral-500">
            <span v-if="product.code">{{ product.code }}．</span>
            NT$ {{ product.price.toLocaleString('zh-TW') }}．訂金 NT$ {{ product.deposit.toLocaleString('zh-TW') }}．
            排序 {{ product.sortOrder }}
          </p>
          <p
            v-if="product.waitingCount > 0"
            class="mt-0.5 text-xs text-amber-600"
          >
            候補 {{ product.waitingCount }} 人
          </p>
        </div>

        <div class="flex shrink-0 flex-wrap gap-2">
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            @click="openWaitlist(product)"
          >
            候補 ({{ product.waitingCount }})
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            variant="outline"
            @click="openEdit(product)"
          >
            編輯
          </UButton>
          <UButton
            size="sm"
            color="error"
            variant="ghost"
            :disabled="Boolean(product.activeOrderId)"
            :title="product.activeOrderId ? '已有訂單，無法刪除' : undefined"
            @click="removeProduct(product)"
          >
            刪除
          </UButton>
        </div>
      </li>
    </ul>

    <!-- 商品表單 -->
    <UModal
      :open="creating || Boolean(editingId)"
      :title="editingId ? '編輯作品' : '新增作品'"
      :ui="{ content: 'sm:max-w-2xl' }"
      @update:open="value => { if (!value) close() }"
    >
      <template #body>
        <div class="space-y-4">
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="作品名稱"
              required
            >
              <UInput v-model="form.name" />
            </UFormField>
            <UFormField label="作品編號">
              <UInput
                v-model="form.code"
                placeholder="TI-2026-01"
              />
            </UFormField>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <UFormField
              label="售價"
              required
            >
              <UInput
                v-model.number="form.price"
                type="number"
                min="0"
              />
            </UFormField>
            <UFormField
              label="訂金"
              required
              help="每件作品個別設定"
            >
              <UInput
                v-model.number="form.deposit"
                type="number"
                min="0"
              />
            </UFormField>
            <UFormField label="排序">
              <UInput
                v-model.number="form.sortOrder"
                type="number"
              />
            </UFormField>
          </div>

          <UFormField label="作品介紹">
            <UTextarea
              v-model="form.description"
              :rows="3"
            />
          </UFormField>

          <AdminProductImageField
            v-model="form.images"
            :market-id="marketId"
          />

          <div class="grid grid-cols-2 gap-3">
            <UFormField
              v-for="field in SPEC_FIELDS"
              :key="field.key"
              :label="field.label"
            >
              <UInput v-model="form.specifications[field.key]" />
            </UFormField>
          </div>

          <UFormField label="作品故事">
            <UTextarea
              v-model="form.story"
              :rows="3"
            />
          </UFormField>
          <UFormField label="購買須知">
            <UTextarea
              v-model="form.purchaseNotes"
              :rows="2"
            />
          </UFormField>

          <UFormField
            v-if="editingId && !data?.products.find(p => p.id === editingId)?.activeOrderId"
            label="商品狀態"
            help="有有效訂單時請改用訂單管理釋放商品"
          >
            <USelect
              v-model="form.status"
              :items="[
                { value: 'available', label: '開放選購' },
                { value: 'sold', label: '已售完' }
              ]"
              value-key="value"
            />
          </UFormField>

          <p
            v-if="formError"
            class="text-sm text-red-600"
          >
            {{ formError }}
          </p>
        </div>
      </template>

      <template #footer>
        <div class="flex w-full gap-2">
          <UButton
            color="neutral"
            variant="outline"
            class="flex-1 justify-center"
            @click="close"
          >
            取消
          </UButton>
          <UButton
            class="flex-1 justify-center"
            :loading="saving"
            @click="save"
          >
            儲存
          </UButton>
        </div>
      </template>
    </UModal>

    <!-- 候補名單 -->
    <UModal
      :open="Boolean(waitlistProduct)"
      :title="`候補名單｜${waitlistProduct?.name ?? ''}`"
      :ui="{ content: 'sm:max-w-2xl' }"
      @update:open="value => { if (!value) waitlistProduct = null }"
    >
      <template #body>
        <div class="space-y-4">
          <div class="rounded-lg bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400">
            通知不會自動把作品保留給任何人。被通知者會獲得一段「優先購買窗口」，
            窗口期間這件作品只接受他們下單，到期後自動回到所有人都能購買的狀態。
            商品必須先回到「開放選購」才能發送通知。
          </div>

          <div
            v-if="waitlistProduct?.status === 'available'"
            class="flex flex-wrap items-end gap-3"
          >
            <UFormField
              label="通知人數"
              class="w-28"
            >
              <UInput
                v-model.number="notifyCount"
                type="number"
                min="1"
                max="20"
              />
            </UFormField>
            <UFormField
              label="窗口長度（小時）"
              class="w-40"
            >
              <UInput
                v-model.number="notifyHours"
                type="number"
                min="1"
              />
            </UFormField>
            <UButton
              icon="i-lucide-send"
              @click="notifyWaitlist"
            >
              通知候補者
            </UButton>
          </div>
          <p
            v-else
            class="text-sm text-amber-600"
          >
            這件作品目前是「{{ waitlistProduct?.statusLabel }}」，需先釋放商品才能通知候補。
          </p>

          <div
            v-if="waitlistLoading"
            class="py-8 text-center text-sm text-neutral-500"
          >
            載入中…
          </div>
          <table
            v-else-if="waitlistRows.length > 0"
            class="w-full text-sm"
          >
            <thead class="text-left text-xs text-neutral-500">
              <tr class="border-b border-neutral-200 dark:border-neutral-800">
                <th class="py-2">
                  順位
                </th>
                <th>使用者</th>
                <th>狀態</th>
                <th>加入時間</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in waitlistRows"
                :key="row.id"
                class="border-b border-neutral-100 dark:border-neutral-900"
              >
                <td class="py-2 tabular-nums">
                  {{ row.position ?? '—' }}
                </td>
                <td class="max-w-[12rem] truncate">
                  {{ row.userName || row.userEmail }}
                </td>
                <td>
                  <span
                    v-if="row.windowActive"
                    class="text-primary-600"
                  >優先購買中</span>
                  <span v-else-if="row.status === 'waiting'">等待中</span>
                  <span
                    v-else
                    class="text-neutral-500"
                  >{{ row.status }}</span>
                </td>
                <td class="text-xs text-neutral-500">
                  {{ new Date(row.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) }}
                </td>
                <td class="text-right">
                  <UButton
                    v-if="row.status === 'waiting' || row.status === 'notified'"
                    size="xs"
                    color="error"
                    variant="ghost"
                    @click="cancelEntry(row.id)"
                  >
                    取消
                  </UButton>
                </td>
              </tr>
            </tbody>
          </table>
          <p
            v-else
            class="py-8 text-center text-sm text-neutral-500"
          >
            目前沒有人候補這件作品。
          </p>
        </div>
      </template>
    </UModal>
  </div>
</template>
