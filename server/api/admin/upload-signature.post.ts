import { v2 as cloudinary } from 'cloudinary'

/**
 * 後台上傳作品照片用的 Cloudinary 直傳簽章。
 *
 * 照片刻意不經過我們自己的伺服器：站台跑在 Vercel 上，serverless function 的
 * request body 上限是 4.5MB，而手機或相機拍的作品照很容易就超過，
 * 走代理上傳會在正式站上直接失敗。這支端點只負責簽名，
 * 瀏覽器拿著簽章把檔案直接 POST 給 Cloudinary。
 *
 * api_secret 不會離開伺服器，對外只給出簽章本身。而簽章把 folder、
 * 可接受的副檔名與 timestamp 綁死了（Cloudinary 只認一小時內的 timestamp），
 * 所以就算簽章外流，也只能往同一個資料夾丟同樣格式的圖片。
 */

/** 每場活動一個資料夾，Cloudinary 媒體庫才不會變成一坨散檔。 */
const UPLOAD_ROOT = 'market'

/** 一併簽進簽章裡：拿到簽章也改不了能上傳的格式。 */
const ALLOWED_FORMATS = 'jpg,jpeg,png,webp,avif'

export default defineEventHandler(async (event) => {
  await requireAdminUser(event)

  const config = useRuntimeConfig().cloudinary

  if (!config.cloudName || !config.apiKey || !config.apiSecret) {
    // 環境變數沒設時早點講清楚，不要讓前端拿到一個簽不出來的空簽章
    throw createError({ statusCode: 500, statusMessage: 'Cloudinary 尚未設定' })
  }

  const body = await readBody<Record<string, unknown>>(event)
  // 只吃 UUID，不讓前端送的任意字串被簽進 folder（避免 ../ 之類的東西）
  const marketId = requireUuid(body?.marketId, 'market id')

  const folder = `${UPLOAD_ROOT}/${marketId}`
  const timestamp = Math.round(Date.now() / 1000)

  // 這裡簽的參數必須和瀏覽器實際送出的完全一致，多一個或少一個 Cloudinary 都會回 401
  const signature = cloudinary.utils.api_sign_request(
    { allowed_formats: ALLOWED_FORMATS, folder, timestamp },
    config.apiSecret
  )

  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    allowedFormats: ALLOWED_FORMATS,
    folder,
    timestamp,
    signature
  }
})
