<script setup lang="ts">
import type { MarketProduct } from '~/stores/market'

/**
 * 商品快照列表（需求 5.3）。
 *
 * 高度刻意只佔畫面下半部，而且上方留一塊半透明遮罩：
 * 需求要求「不能遮蔽所有操作，也不能讓使用者失去目前瀏覽位置」，
 * 所以目前這件商品的照片在列表開啟時仍然看得見。
 */
const props = defineProps<{
  open: boolean
  products: MarketProduct[]
  currentIndex: number
  viewed: Set<number>
}>()

const emit = defineEmits<{ select: [number], close: [] }>()

const scroller = ref<HTMLElement | null>(null)
const itemRefs = ref<HTMLElement[]>([])

/** 開啟時把目前商品捲到可視範圍，使用者才不會迷失位置 */
watch(() => [props.open, props.currentIndex] as const, async ([open]) => {
  if (!open) {
    return
  }

  await nextTick()
  itemRefs.value[props.currentIndex]?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    inline: 'center',
    block: 'nearest'
  })
}, { immediate: true })

function onSelect(index: number) {
  // 點目前這件就是關閉列表（需求 5.3）
  if (index === props.currentIndex) {
    emit('close')

    return
  }

  emit('select', index)
}

const statusTone: Record<MarketProduct['status'], string> = {
  available: 'bg-primary-500/90 text-white',
  reserved: 'bg-amber-500/90 text-white',
  sold: 'bg-neutral-700/90 text-white'
}

/* 拖曳把手：向下拖超過 60px 就關閉 */
const dragStartY = ref<number | null>(null)
const dragOffset = ref(0)

function onHandleDown(event: PointerEvent) {
  dragStartY.value = event.clientY
  dragOffset.value = 0;
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function onHandleMove(event: PointerEvent) {
  if (dragStartY.value === null) {
    return
  }

  dragOffset.value = Math.max(0, event.clientY - dragStartY.value)
}

function onHandleUp() {
  if (dragStartY.value === null) {
    return
  }

  if (dragOffset.value > 60) {
    emit('close')
  }

  dragStartY.value = null
  dragOffset.value = 0
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="market-animated transition-opacity duration-200"
      leave-active-class="market-animated transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="props.open"
        class="fixed inset-0 z-40"
        @click.self="emit('close')"
      >
        <!-- 上半部維持可見：使用者仍然看得到自己停在哪一件 -->
        <div class="absolute inset-x-0 top-0 h-[45%] bg-neutral-900/15" />

        <Transition
          enter-active-class="market-animated transition-transform duration-300 ease-out"
          leave-active-class="market-animated transition-transform duration-200 ease-in"
          enter-from-class="translate-y-full"
          leave-to-class="translate-y-full"
          appear
        >
          <section
            v-if="props.open"
            class="absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-neutral-200 bg-white/95 backdrop-blur-md text-neutral-900 shadow-2xl shadow-neutral-900/20"
            :style="{
              transform: dragOffset ? `translateY(${dragOffset}px)` : undefined,
              paddingBottom: 'calc(1rem + var(--market-safe-bottom))'
            }"
            role="dialog"
            aria-label="本次活動商品快照"
          >
            <div
              class="flex justify-center py-3 cursor-grab active:cursor-grabbing"
              style="touch-action: none"
              @pointerdown="onHandleDown"
              @pointermove="onHandleMove"
              @pointerup="onHandleUp"
              @pointercancel="onHandleUp"
            >
              <span class="h-1.5 w-12 rounded-full bg-neutral-300" />
            </div>

            <header class="flex items-center justify-between px-5 pb-3">
              <h2 class="text-sm tracking-wide text-neutral-500">
                本次作品 {{ props.products.length }} 件
              </h2>
              <UButton
                icon="i-lucide-x"
                color="neutral"
                variant="ghost"
                size="xs"
                aria-label="關閉商品列表"
                @click="emit('close')"
              />
            </header>

            <!-- touch-action: pan-x 讓這一列走瀏覽器原生水平捲動，
                 事件不會冒泡到 viewer 的手勢層，自然不會誤切商品 -->
            <div
              ref="scroller"
              class="flex gap-3 overflow-x-auto px-5 pb-4 snap-x snap-mandatory"
              style="touch-action: pan-x; scrollbar-width: none"
            >
              <button
                v-for="(product, index) in props.products"
                :key="product.id"
                :ref="el => { if (el) itemRefs[index] = el as HTMLElement }"
                type="button"
                class="shrink-0 w-28 snap-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded-xl"
                :aria-current="index === props.currentIndex ? 'true' : undefined"
                @click="onSelect(index)"
              >
                <div
                  class="relative aspect-square overflow-hidden rounded-xl bg-neutral-100 ring-2 transition-all"
                  :class="index === props.currentIndex ? 'ring-primary-500' : 'ring-transparent'"
                >
                  <img
                    v-if="product.images[0]?.src"
                    :src="product.images[0].src"
                    :alt="product.name"
                    loading="lazy"
                    decoding="async"
                    class="size-full object-cover"
                    :class="props.viewed.has(index) || index === props.currentIndex ? '' : 'opacity-60'"
                  >
                  <!-- 這幾個標記都疊在照片上，照片深淺不一，所以維持實色底 + 白字 -->
                  <span
                    class="absolute left-1 top-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none"
                    :class="statusTone[product.status]"
                  >
                    {{ product.statusLabel }}
                  </span>
                  <!-- 追蹤標記。放右下角，不跟左上的狀態打架 -->
                  <span
                    v-if="product.isFollowing"
                    class="absolute bottom-1 right-1 rounded-full bg-white/85 p-1"
                    aria-label="已追蹤"
                    title="已追蹤"
                  >
                    <!-- lucide 沒有實心愛心，用 svg 模式把描邊圖形填滿 -->
                    <UIcon
                      name="i-lucide-heart"
                      mode="svg"
                      class="size-3 fill-current text-primary-600"
                    />
                  </span>
                </div>
                <p class="mt-2 truncate text-xs text-neutral-800">
                  {{ product.name }}
                </p>
                <p class="text-xs text-neutral-500">
                  NT$ {{ product.price.toLocaleString('zh-TW') }}
                </p>
              </button>
            </div>
          </section>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
