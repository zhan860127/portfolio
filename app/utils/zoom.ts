/**
 * 雙指縮放的數學部分，同樣抽成純函式方便測試。
 * 元件只負責把 pointer 事件換算成這裡的輸入，再把結果寫進 transform。
 */

export interface Point {
  x: number
  y: number
}

export interface ZoomState {
  scale: number
  /** 相對容器中心的位移，單位 px */
  offsetX: number
  offsetY: number
}

export const MIN_SCALE = 1
export const MAX_SCALE = 4
/** 超過這個倍率就視為「已放大」，單指拖曳要讓給移動照片 */
export const ZOOMED_THRESHOLD = 1.02

export const IDENTITY_ZOOM: ZoomState = { scale: 1, offsetX: 0, offsetY: 0 }

export function isZoomed(state: Pick<ZoomState, 'scale'>): boolean {
  return state.scale > ZOOMED_THRESHOLD
}

export function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function clampScale(scale: number, min: number = MIN_SCALE, max: number = MAX_SCALE): number {
  if (!Number.isFinite(scale)) {
    return min
  }

  return Math.min(Math.max(scale, min), max)
}

/**
 * 放大後可以拖曳的範圍。
 * 縮放是以容器中心為原點，所以單邊最多只能移動「放大後多出來的一半」，
 * 再多就會把空白邊拉進畫面。
 */
export function maxOffset(scale: number, size: number): number {
  return Math.max(0, ((scale - 1) * size) / 2)
}

export function clampOffset(state: ZoomState, width: number, height: number): ZoomState {
  const limitX = maxOffset(state.scale, width)
  const limitY = maxOffset(state.scale, height)

  return {
    scale: state.scale,
    offsetX: Math.min(Math.max(state.offsetX, -limitX), limitX),
    offsetY: Math.min(Math.max(state.offsetY, -limitY), limitY)
  }
}

/**
 * 以某個焦點縮放，並保持該焦點下的內容不動（需求 5.2：保留照片中心位置及縮放位置）。
 *
 * focal 是相對「容器中心」的座標。推導：縮放前後焦點對應到同一個內容點，
 * 因此 newOffset = focal - (focal - oldOffset) * (newScale / oldScale)。
 */
export function zoomAroundPoint(
  state: ZoomState,
  nextScale: number,
  focal: Point,
  width: number,
  height: number
): ZoomState {
  const scale = clampScale(nextScale)
  const ratio = scale / state.scale

  const zoomed: ZoomState = {
    scale,
    offsetX: focal.x - (focal.x - state.offsetX) * ratio,
    offsetY: focal.y - (focal.y - state.offsetY) * ratio
  }

  // 縮回原尺寸時一律歸零，避免累積出看不見的偏移
  if (!isZoomed(zoomed)) {
    return { ...IDENTITY_ZOOM }
  }

  return clampOffset(zoomed, width, height)
}

export function panBy(state: ZoomState, dx: number, dy: number, width: number, height: number): ZoomState {
  return clampOffset(
    { scale: state.scale, offsetX: state.offsetX + dx, offsetY: state.offsetY + dy },
    width,
    height
  )
}

export function toTransform(state: ZoomState): string {
  return `translate3d(${state.offsetX}px, ${state.offsetY}px, 0) scale(${state.scale})`
}
