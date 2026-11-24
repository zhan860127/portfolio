import { v2 as cloudinary } from 'cloudinary'
import type { ResourceApiResponse } from 'cloudinary'

/** Cloudinary 把 resources 標成「至少一個元素」的 tuple，取元素型別才能宣告空陣列。 */
type CloudinaryResource = ResourceApiResponse['resources'][number]

/** Cloudinary 單次請求最多 500 筆，再多要靠 next_cursor 翻頁。 */
const PAGE_SIZE = 500

/** 翻頁的硬上限，避免帳號圖片爆量時把 serverless function 的執行時間吃光。 */
const MAX_PAGES = 10

/**
 * 列出 Cloudinary 上的圖片，給首頁 Hero、Instagram 區塊與商品配圖共用。
 *
 * 原本寫死只抓最新的 30 張。Cloudinary 預設由新到舊排序，所以後台每上傳
 * 一張作品照，首頁 Hero 的圖就會被擠掉一張 —— 必須整個抓完再交給前端篩。
 *
 * 加上快取是因為這支會打 Cloudinary 的 Admin API，而 Admin API 在免費方案
 * 有每小時 500 次的上限。翻頁後一次請求可能打好幾次，不快取很容易撞到上限。
 * 失敗的結果也會被快取住，但最多就是多撐這段 TTL，之後會自己恢復。
 */
export default defineCachedEventHandler(async () => {
  const config = useRuntimeConfig().cloudinary

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true
  })

  try {
    const resources: CloudinaryResource[] = []
    let nextCursor: string | undefined

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await cloudinary.api.resources({
        type: 'upload',
        max_results: PAGE_SIZE,
        next_cursor: nextCursor
      })

      resources.push(...result.resources)
      nextCursor = result.next_cursor

      if (!nextCursor) {
        break
      }
    }

    return { resources }
  } catch (error) {
    console.error('[cloudinary] failed to list resources', error)

    return { error: 'Failed to fetch resources from Cloudinary' }
  }
}, {
  maxAge: 300,
  name: 'cloudinary-resources',
  getKey: () => 'all'
})
