<script setup lang="ts">
import type { MarketProduct, MarketSummary } from '~/stores/market'

/**
 * 全螢幕商品瀏覽器（需求 4、5）。
 *
 * 這個元件是整個市集唯一的手勢來源。所有 pointer 事件都在這裡收斂，
 * 再交給 resolveGestureIntent 依優先權裁決要縮放、拖曳照片、捲動快照列表
 * 還是切換商品 —— 子元件一律不自己監聽 pointer，避免同一個手勢被處理兩次。
 */
const props = defineProps<{
  market: MarketSummary
  products: MarketProduct[]
}>()

const emit = defineEmits<{
  back: []
  follow: [string]
  order: [string]
  waitlist: [string]
}>()

const marketStore = useMarketStore()

const index = ref(0)
const sheetOpen = ref(false)
const detailOpen = ref(false)
const zoomed = ref(false)
const viewed = ref(new Set<number>([0]))

const zoomRef = ref<{
  applyPinch: (scale: number, focal: Point) => void
  pan: (dx: number, dy: number) => void
  toggleZoom: (focal: Point) => void
  reset: () => void
  currentScale: () => number
} | null>(null)

const surface = ref<HTMLElement | null>(null)

const current = computed(() => props.products[index.value] ?? null)
const total = computed(() => props.products.length)

const currentSrc = computed(() => current.value?.images[0]?.src ?? '')

/** 前後各一件的主圖：放進 DOM 讓瀏覽器先下載，切換時就不會白一下（需求 14） */
const preloadSrcs = computed(() =>
  preloadWindow(index.value, total.value)
    .filter(position => position !== index.value)
    .map(position => props.products[position]?.images[0]?.src)
    .filter((src): src is string => Boolean(src))
)

/** 切換時先淡出再淡入。prefers-reduced-motion 由 .market-animated 統一關掉動畫 */
const switching = ref(false)
let switchTimer: ReturnType<typeof setTimeout> | undefined

function goTo(next: number) {
  const target = clampIndex(next, total.value)

  if (target === index.value) {
    return
  }

  switching.value = true
  index.value = target
  viewed.value = new Set(viewed.value).add(target)
  zoomRef.value?.reset()

  clearTimeout(switchTimer)
  switchTimer = setTimeout(() => (switching.value = false), 120)
}

function goPrev() {
  if (canGoPrev(index.value)) {
    goTo(index.value - 1)
  }
}

function goNext() {
  if (canGoNext(index.value, total.value)) {
    goTo(index.value + 1)
  }
}

/* ------------------------------------------------------------------ */
/*  手勢                                                               */
/* ------------------------------------------------------------------ */

interface TrackedPointer { x: number, y: number }

const pointers = new Map<number, TrackedPointer>()

let startX = 0
let startY = 0
let lastX = 0
let lastY = 0
let startDistance = 0
let startScale = 1
let pinching = false
let moved = false
let lastTapAt = 0

function centerOf(element: HTMLElement) {
  const rect = element.getBoundingClientRect()

  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function onPointerDown(event: PointerEvent) {
  // 詳細資訊面板開啟時，手勢完全交給面板自己捲動
  if (detailOpen.value) {
    return
  }

  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)

  if (pointers.size === 1) {
    startX = event.clientX
    startY = event.clientY
    lastX = event.clientX
    lastY = event.clientY
    moved = false

    return
  }

  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]

    if (a && b) {
      pinching = true
      startDistance = distanceBetween(a, b)
      startScale = zoomRef.value?.currentScale() ?? 1
    }
  }
}

function onPointerMove(event: PointerEvent) {
  const previous = pointers.get(event.pointerId)

  if (!previous) {
    return
  }

  const currentPoint = { x: event.clientX, y: event.clientY }
  pointers.set(event.pointerId, currentPoint)

  // 兩指：縮放。優先權最高，單指邏輯一律不介入
  if (pointers.size >= 2 && pinching && startDistance > 0) {
    const [a, b] = [...pointers.values()]

    if (!a || !b || !surface.value) {
      return
    }

    const nextScale = startScale * (distanceBetween(a, b) / startDistance)
    const center = centerOf(surface.value)
    const focus = midpoint(a, b)

    zoomRef.value?.applyPinch(nextScale, {
      x: focus.x - center.x,
      y: focus.y - center.y
    })
    moved = true

    return
  }

  if (pointers.size !== 1) {
    return
  }

  const dx = currentPoint.x - previous.x
  const dy = currentPoint.y - previous.y
  lastX = currentPoint.x
  lastY = currentPoint.y

  if (Math.abs(currentPoint.x - startX) > 6 || Math.abs(currentPoint.y - startY) > 6) {
    moved = true
  }

  // 照片已放大：單指拖曳一律用來移動照片（需求 5.4 第一順位）
  if (zoomed.value) {
    zoomRef.value?.pan(dx, dy)
  }
}

function onPointerUp(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) {
    return
  }

  pointers.delete(event.pointerId)

  if (pointers.size < 2) {
    pinching = false
  }

  // 還有手指在畫面上就先不做判斷
  if (pointers.size > 0) {
    return
  }

  const totalDx = lastX - startX
  const totalDy = lastY - startY

  if (!moved) {
    handleTap(event)

    return
  }

  const intent = resolveGestureIntent({
    zoomed: zoomed.value,
    sheetOpen: sheetOpen.value,
    pointers: 1,
    dx: totalDx,
    dy: totalDy
  })

  switch (intent) {
    case 'next-product':
      goNext()
      break
    case 'prev-product':
      goPrev()
      break
    case 'open-sheet':
      sheetOpen.value = true
      break
    case 'close-sheet':
      sheetOpen.value = false
      break
    // pan-image 在 pointermove 當下就處理完了；scroll-sheet 交給列表的原生捲動
    default:
      break
  }
}

function handleTap(event: PointerEvent) {
  if (sheetOpen.value || !surface.value) {
    return
  }

  // 已放大時左右區不切換商品（需求 5.4），所以一律當成中央區處理
  const zone = zoomed.value
    ? 'none'
    : resolveTapZone(event.clientX, surface.value.getBoundingClientRect())

  /*
   * 左右區直接換商品，而且刻意「不參與雙擊判定」。
   * 否則連續點兩下右側會被當成雙擊縮放，使用者就無法像翻限時動態那樣
   * 快速連點翻閱 —— 這是實際點過才會發現的問題。
   */
  if (zone === 'prev') {
    lastTapAt = 0
    goPrev()

    return
  }

  if (zone === 'next') {
    lastTapAt = 0
    goNext()

    return
  }

  // 中央區（以及已放大時的任何位置）：雙擊切換縮放
  const now = Date.now()

  if (now - lastTapAt < 300) {
    lastTapAt = 0

    const center = centerOf(surface.value)
    zoomRef.value?.toggleZoom({ x: event.clientX - center.x, y: event.clientY - center.y })

    return
  }

  lastTapAt = now
}

/* ------------------------------------------------------------------ */
/*  鍵盤與輪詢                                                         */
/* ------------------------------------------------------------------ */

function onKeydown(event: KeyboardEvent) {
  if (detailOpen.value) {
    return
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    goPrev()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    goNext()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    sheetOpen.value = true
  } else if (event.key === 'ArrowDown' || event.key === 'Escape') {
    event.preventDefault()
    sheetOpen.value = false
  }
}

const visibility = useDocumentVisibility()

// 狀態輪詢：只在分頁可見時跑，切到背景就停，避免無意義的請求
const { pause, resume } = useIntervalFn(() => {
  marketStore.refreshStatuses(props.market.id)
}, 20000, { immediate: false })

watch(visibility, (state) => {
  if (state === 'visible') {
    marketStore.refreshStatuses(props.market.id)
    resume()
  } else {
    pause()
  }
}, { immediate: true })

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(switchTimer)
  pause()
})

/* ------------------------------------------------------------------ */
/*  底部操作                                                           */
/* ------------------------------------------------------------------ */

// 白底版本：用淺色底 + 深色字，而不是整塊實色，才不會在素雅的版面上過度搶眼
const statusTone: Record<MarketProduct['status'], string> = {
  available: 'bg-primary-100 text-primary-800',
  reserved: 'bg-amber-100 text-amber-800',
  sold: 'bg-neutral-200 text-neutral-600'
}

const primaryAction = computed(() => {
  const product = current.value

  if (!product) {
    return null
  }

  if (product.myOrderId) {
    return { kind: 'my-order' as const, label: '查看我的訂單（待付訂金）', icon: 'i-lucide-receipt' }
  }

  if (product.canPurchase) {
    return { kind: 'order' as const, label: '送出訂單', icon: 'i-lucide-shopping-bag' }
  }

  if (product.myWaitlistId) {
    return {
      kind: 'queued' as const,
      label: product.waitlistPosition ? `候補中．第 ${product.waitlistPosition} 順位` : '候補中',
      icon: 'i-lucide-clock'
    }
  }

  if (product.canWaitlist) {
    return { kind: 'waitlist' as const, label: '排隊候補', icon: 'i-lucide-user-plus' }
  }

  if (product.status === 'sold') {
    return { kind: 'sold' as const, label: '已售完', icon: 'i-lucide-check-circle' }
  }

  if (product.priorityWindowActive) {
    return { kind: 'locked' as const, label: '候補優先購買時段', icon: 'i-lucide-lock' }
  }

  return { kind: 'locked' as const, label: '保留中', icon: 'i-lucide-lock' }
})

function onPrimaryAction() {
  const product = current.value
  const action = primaryAction.value

  if (!product || !action) {
    return
  }

  if (action.kind === 'order') {
    emit('order', product.id)
  } else if (action.kind === 'waitlist') {
    emit('waitlist', product.id)
  } else if (action.kind === 'my-order') {
    navigateTo('/me')
  }
}
</script>

<template>
  <div
    class="relative flex h-dvh w-full flex-col bg-white text-neutral-900"
    :style="{ paddingTop: 'var(--market-safe-top)', paddingBottom: 'var(--market-safe-bottom)' }"
  >
    <!-- 頂部：進度條 + 活動名稱 -->
    <header class="relative z-20 shrink-0 px-4 pt-3">
      <div
        class="flex gap-1"
        role="progressbar"
        :aria-valuenow="index + 1"
        :aria-valuemax="total"
      >
        <span
          v-for="(product, i) in props.products"
          :key="product.id"
          class="h-0.5 flex-1 overflow-hidden rounded-full bg-neutral-200"
        >
          <span
            class="block h-full rounded-full bg-primary-500 market-animated transition-all duration-300"
            :style="{ width: i < index ? '100%' : i === index ? '100%' : '0%' }"
          />
        </span>
      </div>

      <!-- 開啟列表的按鈕移到圖片右下角，所以這一列只剩返回與標題 -->
      <div class="mt-3 flex items-center justify-between gap-2">
        <UButton
          icon="i-lucide-chevron-left"
          color="neutral"
          variant="ghost"
          size="sm"
          class="-ml-2 shrink-0"
          aria-label="返回活動頁"
          @click="emit('back')"
        />
        <div class="min-w-0 text-center">
          <p class="truncate text-sm text-neutral-700">
            {{ props.market.title }}
          </p>
          <p class="text-xs tabular-nums text-neutral-400">
            {{ String(index + 1).padStart(2, '0') }} / {{ String(total).padStart(2, '0') }}
          </p>
        </div>
        <!-- 佔位，讓標題維持置中 -->
        <span class="size-8 shrink-0" />
      </div>
    </header>

    <!--
      手勢層。Desktop 用 max-w 限制中央內容寬度，不是把手機畫面直接放大（需求 4.1）。
      market-gesture-surface 負責關掉瀏覽器的預設觸控行為與 Safari 邊緣返回。
    -->
    <div
      ref="surface"
      class="market-gesture-surface relative z-10 mx-auto flex w-full max-w-md flex-1 items-center justify-center overflow-hidden sm:max-w-lg lg:max-w-xl"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @contextmenu.prevent
    >
      <!--
        只掛一個 MarketZoomImage 並換 src，不隨 v-for 重建：
        ref 放進 v-for 會變成陣列，而且每切一次就重建元件，縮放狀態與動畫都會跳掉。
      -->
      <div
        class="absolute inset-0 market-animated transition-opacity duration-150"
        :class="switching ? 'opacity-0' : 'opacity-100'"
      >
        <MarketZoomImage
          ref="zoomRef"
          :src="currentSrc"
          :alt="current?.name ?? ''"
          priority="eager"
          @zoom-change="zoomed = $event"
        />
      </div>

      <!-- 前後各一件先下載，但不佔版面也不接手勢 -->
      <img
        v-for="src in preloadSrcs"
        :key="src"
        :src="src"
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        class="pointer-events-none absolute size-px opacity-0"
      >

      <!-- 左右點擊區。中間 40% 留空，不會蓋到底部按鈕（需求 5.4 第 5 點） -->
      <div class="pointer-events-none absolute inset-0 flex justify-between">
        <span
          class="h-full w-[30%]"
          :class="canGoPrev(index) && !zoomed ? 'opacity-100' : 'opacity-0'"
        />
        <span
          class="h-full w-[30%]"
          :class="canGoNext(index, total) && !zoomed ? 'opacity-100' : 'opacity-0'"
        />
      </div>

      <!--
        開啟商品列表。疊在照片右下角，半透明加陰影讓它在深淺照片上都看得見。
        pointerdown / pointerup 必須 .stop：它落在右側的切換商品點擊區內，
        不擋住事件的話按一下會同時跳到下一件。
      -->
      <button
        type="button"
        aria-label="開啟商品列表"
        class="market-animated absolute bottom-3 right-3 z-20 rounded-full bg-white/65 p-2.5 text-neutral-700 shadow-lg shadow-neutral-900/15 ring-1 ring-neutral-900/5 backdrop-blur-sm transition hover:bg-white/85 active:scale-95"
        @pointerdown.stop
        @pointerup.stop
        @click.stop="sheetOpen = true"
      >
        <UIcon
          name="i-lucide-layout-grid"
          class="size-4"
        />
      </button>
    </div>

    <!-- 中央資訊 + 底部操作 -->
    <footer
      v-if="current"
      class="relative z-20 shrink-0 border-t border-neutral-100 bg-white px-4 pb-3 pt-4"
    >
      <div class="mx-auto w-full max-w-md sm:max-w-lg lg:max-w-xl">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h1 class="truncate text-lg">
              {{ current.name }}
            </h1>
            <p class="mt-0.5 text-sm text-neutral-600">
              NT$ {{ current.price.toLocaleString('zh-TW') }}
              <span class="text-neutral-400">．訂金 NT$ {{ current.deposit.toLocaleString('zh-TW') }}</span>
            </p>
            <p
              v-if="current.code"
              class="text-xs text-neutral-400"
            >
              作品編號 {{ current.code }}
            </p>
          </div>
          <span
            class="shrink-0 rounded-full px-2.5 py-1 text-xs"
            :class="statusTone[current.status]"
          >
            {{ current.statusLabel }}
          </span>
        </div>

        <div class="mt-4 flex items-center gap-2">
          <UButton
            icon="i-lucide-heart"
            :variant="current.isFollowing ? 'solid' : 'outline'"
            :color="current.isFollowing ? 'primary' : 'neutral'"
            size="md"
            :aria-label="current.isFollowing ? '取消追蹤' : '追蹤這件作品'"
            @click="emit('follow', current.id)"
          />
          <UButton
            icon="i-lucide-info"
            variant="outline"
            color="neutral"
            size="md"
            aria-label="查看商品詳細資訊"
            @click="detailOpen = true"
          >
            詳細資訊
          </UButton>
          <UButton
            :icon="primaryAction?.icon"
            :disabled="primaryAction?.kind === 'sold' || primaryAction?.kind === 'locked' || primaryAction?.kind === 'queued'"
            color="primary"
            size="md"
            class="flex-1 justify-center"
            @click="onPrimaryAction"
          >
            {{ primaryAction?.label }}
          </UButton>
        </div>

        <button
          type="button"
          class="mx-auto mt-3 flex w-full flex-col items-center gap-0.5 text-neutral-400 transition-colors hover:text-neutral-600"
          aria-label="開啟商品列表"
          @click="sheetOpen = true"
        >
          <UIcon
            name="i-lucide-chevron-up"
            class="size-4"
          />
          <span class="text-[11px]">上滑查看本次全部作品</span>
        </button>
      </div>
    </footer>

    <MarketSnapshotSheet
      :open="sheetOpen"
      :products="props.products"
      :current-index="index"
      :viewed="viewed"
      @select="goTo($event); sheetOpen = false"
      @close="sheetOpen = false"
    />

    <MarketProductDetail
      :open="detailOpen"
      :product="current"
      @close="detailOpen = false"
    />
  </div>
</template>
