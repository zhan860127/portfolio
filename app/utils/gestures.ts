/**
 * 市集全螢幕瀏覽器的手勢裁決邏輯。
 *
 * 刻意寫成「不碰 DOM 的純函式」：手勢衝突（需求 5.4）是這個功能最容易出錯的地方，
 * 而觸控行為在單元測試裡幾乎無法重現。把裁決規則抽出來之後，
 * 每一條優先權規則都可以直接用數字驗證，元件只負責把事件換算成這裡的輸入。
 */

export type GestureIntent
  = | 'pan-image'
    | 'scroll-sheet'
    | 'close-sheet'
    | 'open-sheet'
    | 'prev-product'
    | 'next-product'
    | 'none'

export interface GestureInput {
  /** 照片目前是否處於放大狀態 */
  zoomed: boolean
  /** 商品快照列表（bottom sheet）是否開啟 */
  sheetOpen: boolean
  /** 目前在畫面上的觸控點數量 */
  pointers: number
  /** 位移量，向右／向下為正 */
  dx: number
  dy: number
}

/** 位移超過這個距離才算一次滑動，低於此值視為點擊抖動 */
export const SWIPE_THRESHOLD = 48

/**
 * 判定主軸所需的比例。
 * 斜向滑動（例如 dx=50, dy=45）不該同時觸發切換商品與開啟列表，
 * 因此要求主軸至少比副軸長 1.2 倍，否則一律不處理。
 */
export const AXIS_RATIO = 1.2

export type GestureAxis = 'horizontal' | 'vertical' | 'ambiguous'

export function resolveAxis(dx: number, dy: number, ratio: number = AXIS_RATIO): GestureAxis {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)

  if (absX > absY * ratio) {
    return 'horizontal'
  }

  if (absY > absX * ratio) {
    return 'vertical'
  }

  return 'ambiguous'
}

/**
 * 手勢優先權（需求 5.4，由高到低）：
 *   1. 兩指以上 → 交給縮放處理，這裡不介入
 *   2. 照片已放大 → 單指拖曳一律是移動照片，絕不切換商品
 *   3. 快照列表開啟 → 左右只捲動列表、向下關閉列表
 *   4. 其餘情況 → 左右切換商品、向上開啟列表
 */
export function resolveGestureIntent(input: GestureInput): GestureIntent {
  const { zoomed, sheetOpen, pointers, dx, dy } = input

  // 1. 多指手勢屬於縮放，不在這裡裁決
  if (pointers >= 2) {
    return 'none'
  }

  // 2. 放大狀態下，單指拖曳永遠優先用於移動照片
  if (zoomed) {
    return 'pan-image'
  }

  const axis = resolveAxis(dx, dy)

  if (axis === 'ambiguous') {
    return 'none'
  }

  // 3. 快照列表開啟時，左右滑只處理列表的水平捲動
  if (sheetOpen) {
    if (axis === 'horizontal') {
      return 'scroll-sheet'
    }

    return dy > SWIPE_THRESHOLD ? 'close-sheet' : 'none'
  }

  // 4. 列表關閉且未放大：左右切換商品、上滑開啟列表
  if (axis === 'horizontal') {
    if (dx <= -SWIPE_THRESHOLD) {
      return 'next-product'
    }

    if (dx >= SWIPE_THRESHOLD) {
      return 'prev-product'
    }

    return 'none'
  }

  return dy <= -SWIPE_THRESHOLD ? 'open-sheet' : 'none'
}

export type TapZone = 'prev' | 'next' | 'none'

/**
 * 點擊畫面左右區域切換商品。
 *
 * 中間保留一段無作用區（預設 40%），避免使用者要按底部的追蹤／購買按鈕時
 * 不小心被判定成切換商品 —— 需求 5.4 明確要求點擊區不能影響那些按鈕。
 */
export function resolveTapZone(
  clientX: number,
  rect: { left: number, width: number },
  edgeRatio: number = 0.3
): TapZone {
  if (rect.width <= 0) {
    return 'none'
  }

  const ratio = (clientX - rect.left) / rect.width

  if (ratio < 0 || ratio > 1) {
    return 'none'
  }

  if (ratio <= edgeRatio) {
    return 'prev'
  }

  if (ratio >= 1 - edgeRatio) {
    return 'next'
  }

  return 'none'
}

/** 第一件不能再往前、最後一件不能再往後（需求 5.1） */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0
  }

  return Math.min(Math.max(index, 0), length - 1)
}

export function canGoPrev(index: number): boolean {
  return index > 0
}

export function canGoNext(index: number, length: number): boolean {
  return index < length - 1
}

/**
 * 預載範圍：目前這件 + 前後各一件（需求 14）。
 * 其餘圖片走 lazy loading，不會一次把整場高解析度照片拉下來。
 */
export function preloadWindow(index: number, length: number): number[] {
  const result: number[] = []

  for (let offset = -1; offset <= 1; offset += 1) {
    const target = index + offset

    if (target >= 0 && target < length) {
      result.push(target)
    }
  }

  return result
}
