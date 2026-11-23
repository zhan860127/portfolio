<script setup lang="ts">
// 明確匯入而不靠 auto-import：unimport 的掃描結果會漏掉 isZoomed，
// 同一個檔案的其他匯出卻都在，這種不一致不該讓元件去承擔。
import type { Point, ZoomState } from '~/utils/zoom'
import { IDENTITY_ZOOM, isZoomed, panBy, toTransform, zoomAroundPoint } from '~/utils/zoom'

/**
 * 可縮放的商品照片。
 *
 * 刻意不自己監聽 pointer 事件：整個瀏覽器只有一個手勢來源（MarketStoryViewer），
 * 由它依照需求 5.4 的優先權決定這次要縮放、拖曳還是切換商品，再呼叫這裡的方法。
 * 兩個元件各自搶 pointer 事件，正是手勢打架最常見的成因。
 */

const props = withDefaults(defineProps<{
  src: string
  alt?: string
  /** 目前正在瀏覽的那一張用 eager，前後各一張預載，其餘 lazy（需求 14） */
  priority?: 'eager' | 'lazy'
}>(), {
  alt: '',
  priority: 'lazy'
})

const emit = defineEmits<{ zoomChange: [boolean] }>()

const container = ref<HTMLElement | null>(null)
const { width, height } = useElementSize(container)

const zoom = ref<ZoomState>({ ...IDENTITY_ZOOM })
const animating = ref(false)

const zoomed = computed(() => isZoomed(zoom.value))

watch(zoomed, value => emit('zoomChange', value))

// 換商品時一定要歸位，否則下一張會沿用上一張的縮放狀態
watch(() => props.src, () => reset())

function reset() {
  if (zoom.value.scale === 1 && zoom.value.offsetX === 0 && zoom.value.offsetY === 0) {
    return
  }

  animating.value = true
  zoom.value = { ...IDENTITY_ZOOM }
  window.setTimeout(() => (animating.value = false), 200)
}

/** 由 viewer 在偵測到雙指時呼叫。focal 是相對容器中心的座標。 */
function applyPinch(nextScale: number, focal: Point) {
  animating.value = false
  zoom.value = zoomAroundPoint(zoom.value, nextScale, focal, width.value, height.value)
}

/** 放大狀態下的單指拖曳 */
function pan(dx: number, dy: number) {
  if (!zoomed.value) {
    return
  }

  animating.value = false
  zoom.value = panBy(zoom.value, dx, dy, width.value, height.value)
}

/** 雙擊：在原始比例與 2.5 倍之間切換 */
function toggleZoom(focal: Point) {
  animating.value = true

  zoom.value = zoomed.value
    ? { ...IDENTITY_ZOOM }
    : zoomAroundPoint(zoom.value, 2.5, focal, width.value, height.value)

  window.setTimeout(() => (animating.value = false), 220)
}

function currentScale() {
  return zoom.value.scale
}

defineExpose({ applyPinch, pan, toggleZoom, reset, zoomed, currentScale })
</script>

<template>
  <div
    ref="container"
    class="relative size-full overflow-hidden flex items-center justify-center bg-neutral-50"
  >
    <img
      :src="props.src"
      :alt="props.alt"
      :loading="props.priority === 'eager' ? 'eager' : 'lazy'"
      :fetchpriority="props.priority === 'eager' ? 'high' : 'low'"
      decoding="async"
      draggable="false"
      class="max-h-full max-w-full object-contain will-change-transform select-none"
      :class="animating ? 'market-animated transition-transform duration-200 ease-out' : ''"
      :style="{ transform: toTransform(zoom) }"
    >
  </div>
</template>
