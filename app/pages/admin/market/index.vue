<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: '市集後台', robots: 'noindex' })

interface AdminMarket {
  id: string
  title: string
  description: string | null
  coverImage: string | null
  startsAt: string
  endsAt: string
  status: string
  statusLabel: string
  storedStatus: string
  sortOrder: number
  allowWaitlistWhenSold: boolean
  productCount: number
  depositDueHours: number
  waitlistWindowHours: number
  stats: { available: number, reserved: number, sold: number }
}

const toast = useToast()
const { data: markets, refresh } = await useFetch<AdminMarket[]>('/api/admin/market/markets')

const editing = ref<AdminMarket | null>(null)
const creating = ref(false)
const saving = ref(false)

function emptyForm() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  const local = (date: Date) => new Date(date.getTime() - offset).toISOString().slice(0, 16)

  return {
    title: '',
    description: '',
    coverImage: '',
    startsAt: local(now),
    endsAt: local(new Date(now.getTime() + 7 * 86400000)),
    status: 'draft',
    depositDueHours: 48,
    waitlistWindowHours: 24,
    allowWaitlistWhenSold: false,
    sortOrder: 0
  }
}

const form = reactive(emptyForm())
const formError = ref<string | null>(null)

function toLocalInput(iso: string) {
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60000

  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function openCreate() {
  Object.assign(form, emptyForm())
  editing.value = null
  creating.value = true
  formError.value = null
}

function openEdit(market: AdminMarket) {
  Object.assign(form, {
    title: market.title,
    description: market.description ?? '',
    coverImage: market.coverImage ?? '',
    startsAt: toLocalInput(market.startsAt),
    endsAt: toLocalInput(market.endsAt),
    status: market.storedStatus,
    depositDueHours: market.depositDueHours,
    waitlistWindowHours: market.waitlistWindowHours,
    allowWaitlistWhenSold: market.allowWaitlistWhenSold,
    sortOrder: market.sortOrder
  })
  editing.value = market
  creating.value = false
  formError.value = null
}

function close() {
  editing.value = null
  creating.value = false
}

async function save() {
  saving.value = true
  formError.value = null

  const payload = {
    ...form,
    startsAt: new Date(form.startsAt).toISOString(),
    endsAt: new Date(form.endsAt).toISOString()
  }

  try {
    if (editing.value) {
      await $fetch(`/api/admin/market/markets/${editing.value.id}`, { method: 'PATCH', body: payload })
    } else {
      await $fetch('/api/admin/market/markets', { method: 'POST', body: payload })
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

/** 上架 / 下架 */
async function togglePublish(market: AdminMarket) {
  const next = market.storedStatus === 'draft' ? 'upcoming' : 'draft'

  try {
    await $fetch(`/api/admin/market/markets/${market.id}`, { method: 'PATCH', body: { status: next } })
    await refresh()
    toast.add({ title: next === 'draft' ? '已下架' : '已上架', color: 'success' })
  } catch (error) {
    toast.add({
      title: (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? '操作失敗',
      color: 'error'
    })
  }
}
</script>

<template>
  <div class="py-20 sm:py-24">
    <header class="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl">
          市集後台
        </h1>
        <p class="mt-1 text-sm text-neutral-500">
          活動、商品、訂單、候補與寄貨單管理
        </p>
      </div>
      <div class="flex gap-2">
        <UButton
          to="/admin/market/categories"
          color="neutral"
          variant="outline"
          icon="i-lucide-tags"
        >
          作品分類
        </UButton>
        <UButton
          to="/admin/market/orders"
          color="neutral"
          variant="outline"
          icon="i-lucide-receipt"
        >
          訂單管理
        </UButton>
        <UButton
          to="/admin/market/shipping"
          color="neutral"
          variant="outline"
          icon="i-lucide-package"
        >
          寄貨單
        </UButton>
        <UButton
          icon="i-lucide-plus"
          @click="openCreate"
        >
          新增活動
        </UButton>
      </div>
    </header>

    <p
      v-if="!markets || markets.length === 0"
      class="py-20 text-center text-sm text-neutral-500"
    >
      還沒有任何活動。
    </p>

    <ul
      v-else
      class="space-y-3"
    >
      <li
        v-for="market in markets"
        :key="market.id"
        class="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
      >
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h2 class="truncate">
                {{ market.title }}
              </h2>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-xs"
                :class="market.storedStatus === 'draft'
                  ? 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                  : 'bg-primary-100 text-primary-800 dark:bg-primary-500/15 dark:text-primary-300'"
              >
                {{ market.storedStatus === 'draft' ? '未上架' : market.statusLabel }}
              </span>
            </div>
            <p class="mt-1 text-xs text-neutral-500">
              {{ new Date(market.startsAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) }}
              –
              {{ new Date(market.endsAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) }}
            </p>
            <p class="mt-1 text-xs text-neutral-500">
              共 {{ market.productCount }} 件．
              開放 {{ market.stats.available }}．
              保留 {{ market.stats.reserved }}．
              售出 {{ market.stats.sold }}
            </p>
            <p class="mt-1 text-xs text-neutral-400">
              訂金期限 {{ market.depositDueHours }} 小時．候補優先購買 {{ market.waitlistWindowHours }} 小時
            </p>
          </div>

          <div class="flex shrink-0 gap-2">
            <UButton
              :to="`/admin/market/${market.id}`"
              size="sm"
              color="neutral"
              variant="outline"
            >
              商品
            </UButton>
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              @click="openEdit(market)"
            >
              編輯
            </UButton>
            <UButton
              size="sm"
              :color="market.storedStatus === 'draft' ? 'primary' : 'neutral'"
              :variant="market.storedStatus === 'draft' ? 'solid' : 'outline'"
              @click="togglePublish(market)"
            >
              {{ market.storedStatus === 'draft' ? '上架' : '下架' }}
            </UButton>
          </div>
        </div>
      </li>
    </ul>

    <UModal
      :open="creating || Boolean(editing)"
      :title="editing ? '編輯活動' : '新增活動'"
      @update:open="value => { if (!value) close() }"
    >
      <template #body>
        <div class="space-y-4">
          <UFormField
            label="活動名稱"
            required
          >
            <UInput v-model="form.title" />
          </UFormField>
          <UFormField label="活動介紹">
            <UTextarea
              v-model="form.description"
              :rows="3"
            />
          </UFormField>
          <UFormField label="主視覺圖片網址">
            <UInput
              v-model="form.coverImage"
              placeholder="https://"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="開始時間"
              required
            >
              <UInput
                v-model="form.startsAt"
                type="datetime-local"
              />
            </UFormField>
            <UFormField
              label="結束時間"
              required
            >
              <UInput
                v-model="form.endsAt"
                type="datetime-local"
              />
            </UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField
              label="訂金繳款期限（小時）"
              help="逾期只會標記，不會自動釋放商品"
            >
              <UInput
                v-model.number="form.depositDueHours"
                type="number"
                min="1"
              />
            </UFormField>
            <UFormField
              label="候補優先購買窗口（小時）"
              help="通知後只開放被通知者下單的時間"
            >
              <UInput
                v-model.number="form.waitlistWindowHours"
                type="number"
                min="1"
              />
            </UFormField>
          </div>
          <UFormField label="排序">
            <UInput
              v-model.number="form.sortOrder"
              type="number"
            />
          </UFormField>
          <UCheckbox
            v-model="form.allowWaitlistWhenSold"
            label="已售完的作品仍允許加入候補"
          />

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
  </div>
</template>
