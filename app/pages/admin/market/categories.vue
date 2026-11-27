<script setup lang="ts">
definePageMeta({ middleware: 'admin' })
useSeoMeta({ title: '作品分類管理', robots: 'noindex' })

/**
 * 作品分類（品項）管理。
 *
 * 例如「森野」底下有森野 01、森野 02 —— 同一個系列、各自獨立的作品。
 * 分類是跨活動共用的，所以這一頁不綁任何一場市集。
 */

interface AdminCategory {
  id: string
  name: string
  slug: string
  description: string | null
  sortOrder: number
  productCount: number
}

const toast = useToast()

const { data, refresh, status } = await useFetch<{
  categories: AdminCategory[]
  uncategorizedCount: number
}>('/api/admin/market/categories')

const categories = computed(() => data.value?.categories ?? [])

const form = reactive({
  id: null as string | null,
  name: '',
  slug: '',
  description: '',
  sortOrder: 0
})

const saving = ref(false)
const formError = ref<string | null>(null)

const editing = computed(() => Boolean(form.id))

function resetForm() {
  form.id = null
  form.name = ''
  form.slug = ''
  form.description = ''
  form.sortOrder = categories.value.length * 10
  formError.value = null
}

resetForm()

function startEdit(category: AdminCategory) {
  form.id = category.id
  form.name = category.name
  form.slug = category.slug
  form.description = category.description ?? ''
  form.sortOrder = category.sortOrder
  formError.value = null
}

async function save() {
  if (!form.name.trim()) {
    formError.value = '請填寫分類名稱'

    return
  }

  saving.value = true
  formError.value = null

  const body = {
    name: form.name.trim(),
    slug: form.slug.trim(),
    description: form.description.trim(),
    sortOrder: Number(form.sortOrder) || 0
  }

  try {
    if (form.id) {
      await $fetch(`/api/admin/market/categories/${form.id}`, { method: 'PATCH', body })
      toast.add({ title: '分類已更新', color: 'success' })
    } else {
      await $fetch('/api/admin/market/categories', { method: 'POST', body })
      toast.add({ title: `已新增分類「${body.name}」`, color: 'success' })
    }

    await refresh()
    resetForm()
  } catch (error) {
    formError.value = (error as { data?: { statusMessage?: string } })?.data?.statusMessage
      ?? '儲存失敗，請稍後再試'
  } finally {
    saving.value = false
  }
}

async function remove(category: AdminCategory) {
  const warning = category.productCount > 0
    ? `刪除「${category.name}」？底下 ${category.productCount} 件作品不會被刪除，但會變成未分類。`
    : `刪除「${category.name}」？`

  if (!confirm(warning)) {
    return
  }

  try {
    const result = await $fetch<{ uncategorizedNow: number }>(
      `/api/admin/market/categories/${category.id}`,
      { method: 'DELETE' }
    )

    await refresh()

    if (form.id === category.id) {
      resetForm()
    }

    toast.add({
      title: '分類已刪除',
      description: result.uncategorizedNow > 0
        ? `${result.uncategorizedNow} 件作品回到未分類`
        : undefined,
      color: 'neutral'
    })
  } catch (error) {
    toast.add({
      title: (error as { data?: { statusMessage?: string } })?.data?.statusMessage ?? '刪除失敗',
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
          作品分類
        </h1>
        <p class="mt-1 text-sm text-neutral-500">
          例如「森野」底下有森野 01、森野 02。分類跨活動共用，不必每一場重建
        </p>
      </div>
      <UButton
        to="/admin/market"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
      >
        回後台
      </UButton>
    </header>

    <div class="grid gap-8 lg:grid-cols-5">
      <!-- 清單 -->
      <section class="space-y-3 lg:col-span-3">
        <p
          v-if="categories.length === 0"
          class="rounded-xl border border-dashed border-neutral-300 py-16 text-center text-sm text-neutral-500 dark:border-neutral-700"
        >
          還沒有任何分類。右邊新增第一個，例如「森野」。
        </p>

        <article
          v-for="category in categories"
          :key="category.id"
          class="flex items-center gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
          :class="form.id === category.id ? 'border-primary-300 bg-primary-50/40 dark:border-primary-500/30 dark:bg-primary-500/5' : ''"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate">
              {{ category.name }}
              <span class="ml-1 font-mono text-xs text-neutral-400">{{ category.slug }}</span>
            </p>
            <p
              v-if="category.description"
              class="truncate text-xs text-neutral-500"
            >
              {{ category.description }}
            </p>
          </div>

          <span
            class="shrink-0 rounded-full px-2.5 py-1 text-xs"
            :class="category.productCount > 0
              ? 'bg-primary-100 text-primary-800 dark:bg-primary-500/15 dark:text-primary-300'
              : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'"
          >
            {{ category.productCount }} 件
          </span>

          <div class="flex shrink-0 gap-1">
            <UButton
              size="xs"
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              aria-label="編輯"
              @click="startEdit(category)"
            />
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              aria-label="刪除"
              @click="remove(category)"
            />
          </div>
        </article>

        <p
          v-if="(data?.uncategorizedCount ?? 0) > 0"
          class="rounded-xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600 dark:bg-neutral-900 dark:text-neutral-400"
        >
          還有 <span class="text-neutral-900 dark:text-neutral-100">{{ data?.uncategorizedCount }}</span> 件作品沒有分類，
          前台會歸進「其他」。到各場市集的商品列表用批次指定就能一次分完。
        </p>
      </section>

      <!-- 新增 / 編輯 -->
      <section class="lg:col-span-2">
        <form
          class="space-y-4 rounded-xl border border-neutral-200 p-5 dark:border-neutral-800"
          @submit.prevent="save"
        >
          <h2 class="text-sm">
            {{ editing ? '編輯分類' : '新增分類' }}
          </h2>

          <UFormField
            label="分類名稱"
            required
          >
            <UInput
              v-model="form.name"
              placeholder="森野"
            />
          </UFormField>

          <UFormField
            label="網址代稱"
            help="客人分享「只看這個分類」時用的。留白就自動產生"
          >
            <UInput
              v-model="form.slug"
              placeholder="senya"
            />
          </UFormField>

          <UFormField label="說明">
            <UInput
              v-model="form.description"
              placeholder="選填，例如：以森林為題的手捏系列"
            />
          </UFormField>

          <UFormField
            label="排序"
            help="數字小的排前面"
          >
            <UInput
              v-model.number="form.sortOrder"
              type="number"
            />
          </UFormField>

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
              :loading="saving"
            >
              {{ editing ? '儲存' : '新增' }}
            </UButton>
            <UButton
              v-if="editing"
              color="neutral"
              variant="outline"
              @click="resetForm"
            >
              取消
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              :loading="status === 'pending'"
              aria-label="重新整理"
              @click="refresh()"
            />
          </div>
        </form>
      </section>
    </div>
  </div>
</template>
