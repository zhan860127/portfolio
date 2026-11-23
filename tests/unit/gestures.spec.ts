import { describe, expect, it } from 'vitest'
import {
  AXIS_RATIO,
  SWIPE_THRESHOLD,
  canGoNext,
  canGoPrev,
  clampIndex,
  preloadWindow,
  resolveAxis,
  resolveGestureIntent,
  resolveTapZone
} from '../../app/utils/gestures'

/**
 * 對應需求 15 的測試項目 4、5、7、8、9、10、11。
 *
 * 手勢在單元測試裡無法用真實觸控重現，所以裁決規則被抽成純函式，
 * 這裡直接用位移量驗證每一條優先權。
 */

const base = { zoomed: false, sheetOpen: false, pointers: 1, dx: 0, dy: 0 }

describe('resolveAxis', () => {
  it('主軸必須明顯長於副軸才認定方向', () => {
    expect(resolveAxis(100, 10)).toBe('horizontal')
    expect(resolveAxis(10, 100)).toBe('vertical')
  })

  it('斜向滑動視為不明確，不觸發任何動作', () => {
    // 50 / 45 ≈ 1.11，小於 AXIS_RATIO
    expect(AXIS_RATIO).toBeGreaterThan(1.11)
    expect(resolveAxis(50, 45)).toBe('ambiguous')
    expect(resolveGestureIntent({ ...base, dx: 50, dy: 45 })).toBe('none')
  })
})

describe('測試項目 4：左右滑動切換商品', () => {
  it('向左滑超過門檻 → 下一件', () => {
    expect(resolveGestureIntent({ ...base, dx: -SWIPE_THRESHOLD, dy: 0 })).toBe('next-product')
  })

  it('向右滑超過門檻 → 上一件', () => {
    expect(resolveGestureIntent({ ...base, dx: SWIPE_THRESHOLD, dy: 0 })).toBe('prev-product')
  })

  it('位移未達門檻不切換，避免點擊抖動被誤判', () => {
    expect(resolveGestureIntent({ ...base, dx: -(SWIPE_THRESHOLD - 1), dy: 0 })).toBe('none')
    expect(resolveGestureIntent({ ...base, dx: SWIPE_THRESHOLD - 1, dy: 0 })).toBe('none')
  })
})

describe('測試項目 5：點擊左右區域切換商品', () => {
  const rect = { left: 0, width: 400 }

  it('左側 30% 是上一件，右側 30% 是下一件', () => {
    expect(resolveTapZone(10, rect)).toBe('prev')
    expect(resolveTapZone(390, rect)).toBe('next')
  })

  it('中間 40% 不作用，才不會蓋到追蹤與購買按鈕', () => {
    expect(resolveTapZone(200, rect)).toBe('none')
    expect(resolveTapZone(140, rect)).toBe('none')
    expect(resolveTapZone(260, rect)).toBe('none')
  })

  it('容器左緣不是 0 時也要正確換算', () => {
    expect(resolveTapZone(110, { left: 100, width: 400 })).toBe('prev')
    expect(resolveTapZone(490, { left: 100, width: 400 })).toBe('next')
  })

  it('落在容器外不作用', () => {
    expect(resolveTapZone(-10, rect)).toBe('none')
    expect(resolveTapZone(410, rect)).toBe('none')
  })
})

describe('測試項目 7：放大後拖曳不會誤切商品', () => {
  it('放大狀態下，任何方向的單指拖曳都是移動照片', () => {
    for (const [dx, dy] of [[-200, 0], [200, 0], [0, -200], [0, 200], [150, 150]]) {
      expect(resolveGestureIntent({ ...base, zoomed: true, dx: dx!, dy: dy! })).toBe('pan-image')
    }
  })

  it('放大狀態優先於快照列表狀態', () => {
    expect(resolveGestureIntent({ ...base, zoomed: true, sheetOpen: true, dx: -200, dy: 0 }))
      .toBe('pan-image')
  })

  it('兩指以上一律交給縮放處理，不做任何裁決', () => {
    expect(resolveGestureIntent({ ...base, pointers: 2, dx: -200, dy: 0 })).toBe('none')
    expect(resolveGestureIntent({ ...base, pointers: 3, dx: 0, dy: -200 })).toBe('none')
  })
})

describe('測試項目 8：上滑開啟快照列表', () => {
  it('列表關閉時向上滑 → 開啟', () => {
    expect(resolveGestureIntent({ ...base, dx: 0, dy: -SWIPE_THRESHOLD })).toBe('open-sheet')
  })

  it('列表關閉時向下滑不做事', () => {
    expect(resolveGestureIntent({ ...base, dx: 0, dy: SWIPE_THRESHOLD })).toBe('none')
  })
})

describe('測試項目 9：快照列表開啟時的左右滑動', () => {
  const opened = { ...base, sheetOpen: true }

  it('左右滑只處理列表的水平捲動，不切換商品', () => {
    expect(resolveGestureIntent({ ...opened, dx: -200, dy: 0 })).toBe('scroll-sheet')
    expect(resolveGestureIntent({ ...opened, dx: 200, dy: 0 })).toBe('scroll-sheet')
  })

  it('向下滑關閉列表', () => {
    expect(resolveGestureIntent({ ...opened, dx: 0, dy: SWIPE_THRESHOLD + 1 })).toBe('close-sheet')
  })

  it('列表已開啟時再向上滑不會重複開啟', () => {
    expect(resolveGestureIntent({ ...opened, dx: 0, dy: -200 })).toBe('none')
  })
})

describe('測試項目 11：邊界不可超出', () => {
  it('第一件不能再往前，最後一件不能再往後', () => {
    expect(canGoPrev(0)).toBe(false)
    expect(canGoPrev(1)).toBe(true)
    expect(canGoNext(4, 5)).toBe(false)
    expect(canGoNext(3, 5)).toBe(true)
  })

  it('索引一律夾在有效範圍內', () => {
    expect(clampIndex(-3, 5)).toBe(0)
    expect(clampIndex(99, 5)).toBe(4)
    expect(clampIndex(2, 5)).toBe(2)
  })

  it('空清單不會算出負索引', () => {
    expect(clampIndex(3, 0)).toBe(0)
  })
})

describe('需求 14：預載目前與前後各一件', () => {
  it('中間位置預載三件', () => {
    expect(preloadWindow(2, 5)).toEqual([1, 2, 3])
  })

  it('頭尾不會越界', () => {
    expect(preloadWindow(0, 5)).toEqual([0, 1])
    expect(preloadWindow(4, 5)).toEqual([3, 4])
  })

  it('只有一件時只預載自己', () => {
    expect(preloadWindow(0, 1)).toEqual([0])
  })
})
