<script setup lang="ts">
import type { MarketProduct } from '~/stores/market'

/**
 * 商品詳細資訊面板（需求 6）。
 *
 * 做成覆蓋在瀏覽器之上的面板而不是另一個路由：
 * 需求要求關閉後必須回到原本正在瀏覽的商品並保留瀏覽進度，
 * 換頁再回來就得想辦法還原狀態，覆蓋面板則天生不會丟失。
 */
const props = defineProps<{
  open: boolean
  product: MarketProduct | null
}>()

const emit = defineEmits<{ close: [] }>()

const SPEC_LABELS: Record<string, string> = {
  dimensions: '尺寸',
  weight: '重量',
  material: '材質',
  technique: '製作方式',
  firingTemperature: '燒成溫度',
  glaze: '釉色與表面特色',
  variation: '手工製作的自然差異'
}

const IMAGE_GROUP_LABELS: Record<string, string> = {
  front: '正面',
  side: '側面',
  back: '背面',
  bottom: '底部',
  detail: '陶土細節',
  process: '製作過程'
}

const specs = computed(() =>
  Object.entries(SPEC_LABELS)
    .map(([key, label]) => ({ key, label, value: props.product?.specifications?.[key] }))
    .filter(item => Boolean(item.value))
)

/** 有標 kind 的照片分組顯示；沒標的集中在「作品照片」 */
const groupedImages = computed(() => {
  const product = props.product

  if (!product) {
    return []
  }

  const groups = new Map<string, { label: string, images: MarketProduct['images'] }>()

  for (const image of product.images) {
    const key = image.kind ?? 'gallery'
    const label = image.kind ? (IMAGE_GROUP_LABELS[image.kind] ?? image.kind) : '作品照片'
    const bucket = groups.get(key) ?? { label, images: [] }
    bucket.images.push(image)
    groups.set(key, bucket)
  }

  return [...groups.values()]
})

// 面板開啟時鎖住背景捲動，避免 iOS 把捲動傳遞到底下的瀏覽器
watch(() => props.open, (open) => {
  if (!import.meta.client) {
    return
  }

  document.body.style.overflow = open ? 'hidden' : ''
})

onUnmounted(() => {
  if (import.meta.client) {
    document.body.style.overflow = ''
  }
})

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="market-animated transition-all duration-300 ease-out"
      leave-active-class="market-animated transition-all duration-200 ease-in"
      enter-from-class="opacity-0 translate-y-6"
      leave-to-class="opacity-0 translate-y-6"
    >
      <div
        v-if="props.open && props.product"
        class="fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-neutral-950"
        role="dialog"
        aria-label="商品詳細資訊"
        :style="{ paddingTop: 'var(--market-safe-top)', paddingBottom: 'var(--market-safe-bottom)' }"
      >
        <header
          class="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200/70 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90"
        >
          <div class="min-w-0">
            <p class="truncate text-base font-medium">
              {{ props.product.name }}
            </p>
            <p
              v-if="props.product.code"
              class="text-xs text-neutral-500"
            >
              作品編號 {{ props.product.code }}
            </p>
          </div>
          <UButton
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            aria-label="關閉詳細資訊"
            @click="emit('close')"
          />
        </header>

        <div class="mx-auto max-w-2xl px-4 py-6 space-y-8">
          <section
            v-for="group in groupedImages"
            :key="group.label"
            class="space-y-3"
          >
            <h2 class="text-sm tracking-wide text-neutral-500">
              {{ group.label }}
            </h2>
            <div class="grid grid-cols-2 gap-3">
              <img
                v-for="(image, index) in group.images"
                :key="image.src + index"
                :src="image.src"
                :alt="image.alt ?? props.product.name"
                loading="lazy"
                decoding="async"
                class="aspect-square w-full rounded-xl object-cover bg-neutral-100 dark:bg-neutral-900"
              >
            </div>
          </section>

          <section
            v-if="props.product.description"
            class="space-y-2"
          >
            <h2 class="text-sm tracking-wide text-neutral-500">
              作品介紹
            </h2>
            <p class="whitespace-pre-line leading-relaxed">
              {{ props.product.description }}
            </p>
          </section>

          <section
            v-if="specs.length > 0"
            class="space-y-3"
          >
            <h2 class="text-sm tracking-wide text-neutral-500">
              作品規格
            </h2>
            <dl class="divide-y divide-neutral-200 dark:divide-neutral-800">
              <div
                v-for="spec in specs"
                :key="spec.key"
                class="grid grid-cols-3 gap-3 py-2.5 text-sm"
              >
                <dt class="text-neutral-500">
                  {{ spec.label }}
                </dt>
                <dd class="col-span-2">
                  {{ spec.value }}
                </dd>
              </div>
            </dl>
          </section>

          <section
            v-if="props.product.story"
            class="space-y-2"
          >
            <h2 class="text-sm tracking-wide text-neutral-500">
              作品故事
            </h2>
            <p class="whitespace-pre-line leading-relaxed text-neutral-700 dark:text-neutral-300">
              {{ props.product.story }}
            </p>
          </section>

          <section
            v-if="props.product.purchaseNotes"
            class="space-y-2 rounded-xl bg-neutral-50 p-4 dark:bg-neutral-900"
          >
            <h2 class="text-sm tracking-wide text-neutral-500">
              購買須知
            </h2>
            <p class="whitespace-pre-line text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
              {{ props.product.purchaseNotes }}
            </p>
          </section>

          <div class="flex items-baseline justify-between border-t border-neutral-200 pt-5 dark:border-neutral-800">
            <span class="text-sm text-neutral-500">售價</span>
            <span class="text-2xl">NT$ {{ props.product.price.toLocaleString('zh-TW') }}</span>
          </div>
          <div class="flex items-baseline justify-between -mt-4">
            <span class="text-sm text-neutral-500">應付訂金</span>
            <span class="text-lg text-primary-600 dark:text-primary-400">
              NT$ {{ props.product.deposit.toLocaleString('zh-TW') }}
            </span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
