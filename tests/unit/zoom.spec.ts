import { describe, expect, it } from 'vitest'
import {
  IDENTITY_ZOOM,
  MAX_SCALE,
  MIN_SCALE,
  clampOffset,
  clampScale,
  distanceBetween,
  isZoomed,
  maxOffset,
  midpoint,
  panBy,
  toTransform,
  zoomAroundPoint
} from '../../app/utils/zoom'

/** 對應需求 15 的測試項目 6（雙指縮放）與 7（放大後拖曳）。 */

const SIZE = 400

describe('測試項目 6：雙指縮放', () => {
  it('兩指距離變大就放大、變小就縮小', () => {
    const a = { x: 0, y: 0 }
    const b = { x: 100, y: 0 }

    expect(distanceBetween(a, b)).toBe(100)
    expect(distanceBetween(a, { x: 0, y: 50 })).toBe(50)
  })

  it('焦點取兩指中點', () => {
    expect(midpoint({ x: 0, y: 0 }, { x: 100, y: 50 })).toEqual({ x: 50, y: 25 })
  })

  it('縮放倍率夾在允許範圍內', () => {
    expect(clampScale(0.1)).toBe(MIN_SCALE)
    expect(clampScale(99)).toBe(MAX_SCALE)
    expect(clampScale(2.5)).toBe(2.5)
    expect(clampScale(Number.NaN)).toBe(MIN_SCALE)
  })

  it('可以回到原始比例，且位移一併歸零', () => {
    const zoomedIn = zoomAroundPoint(IDENTITY_ZOOM, 3, { x: 80, y: 40 }, SIZE, SIZE)
    expect(isZoomed(zoomedIn)).toBe(true)

    const back = zoomAroundPoint(zoomedIn, 1, { x: 80, y: 40 }, SIZE, SIZE)
    expect(back).toEqual(IDENTITY_ZOOM)
  })

  it('以容器中心縮放時不產生位移', () => {
    const result = zoomAroundPoint(IDENTITY_ZOOM, 2, { x: 0, y: 0 }, SIZE, SIZE)

    expect(result.scale).toBe(2)
    expect(result.offsetX).toBe(0)
    expect(result.offsetY).toBe(0)
  })

  it('保留焦點位置：焦點下的內容在縮放前後維持不動', () => {
    const focal = { x: 100, y: 0 }
    const result = zoomAroundPoint(IDENTITY_ZOOM, 2, focal, SIZE, SIZE)

    // newOffset = focal - (focal - oldOffset) * ratio = 100 - 100 * 2 = -100
    // 夾限：scale 2 時單邊上限為 (2-1)*400/2 = 200，-100 仍在範圍內
    expect(result.offsetX).toBe(-100)
  })

  it('略大於 1 的倍率不算放大，避免誤判吃掉切換手勢', () => {
    expect(isZoomed({ scale: 1 })).toBe(false)
    expect(isZoomed({ scale: 1.01 })).toBe(false)
    expect(isZoomed({ scale: 1.5 })).toBe(true)
  })
})

describe('測試項目 7：放大後可以拖曳照片', () => {
  it('未放大時可拖曳範圍為 0', () => {
    expect(maxOffset(1, SIZE)).toBe(0)
  })

  it('放大後只能移動多出來的一半，不會把空白邊拉進畫面', () => {
    expect(maxOffset(2, SIZE)).toBe(200)
    expect(maxOffset(3, SIZE)).toBe(400)
  })

  it('拖曳會被夾在邊界內', () => {
    const state = { scale: 2, offsetX: 0, offsetY: 0 }
    const dragged = panBy(state, 9999, -9999, SIZE, SIZE)

    expect(dragged.offsetX).toBe(200)
    expect(dragged.offsetY).toBe(-200)
  })

  it('正常範圍內的拖曳如實累加', () => {
    const state = { scale: 2, offsetX: 0, offsetY: 0 }
    const dragged = panBy(state, 50, -30, SIZE, SIZE)

    expect(dragged.offsetX).toBe(50)
    expect(dragged.offsetY).toBe(-30)
  })

  it('clampOffset 不會改動倍率', () => {
    const result = clampOffset({ scale: 2.5, offsetX: 9999, offsetY: 0 }, SIZE, SIZE)

    expect(result.scale).toBe(2.5)
  })
})

describe('transform 輸出', () => {
  it('使用 translate3d 觸發合成層，避免放大拖曳時掉幀', () => {
    expect(toTransform({ scale: 2, offsetX: 10, offsetY: -5 }))
      .toBe('translate3d(10px, -5px, 0) scale(2)')
  })
})
