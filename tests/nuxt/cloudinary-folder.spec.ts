// @vitest-environment nuxt
import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { createPinia, setActivePinia } from 'pinia'
import { useCloudinaryStore } from '../../app/stores/cloudinary'

/**
 * Cloudinary 資料夾比對。
 *
 * 這組測試擋的是「首頁精選圖被後台上傳的作品照擠掉」那個問題的根因：
 * 資料夾比對必須夠精準，hero 不能連 hero-old 或 market/... 一起撈進來。
 */

function makeResource(publicId: string, assetFolder?: string) {
  return {
    public_id: publicId,
    secure_url: `https://res.cloudinary.com/test/${publicId}.jpg`,
    url: `http://res.cloudinary.com/test/${publicId}.jpg`,
    format: 'jpg',
    width: 1000,
    height: 1000,
    bytes: 2048,
    asset_folder: assetFolder
  }
}

let resources: ReturnType<typeof makeResource>[] = []

registerEndpoint('/api/cloudinary', () => ({ resources }))

beforeEach(() => {
  setActivePinia(createPinia())
})

async function loadStore() {
  const store = useCloudinaryStore()

  await store.fetchImages()

  return store
}

describe('useCloudinaryStore.getFolderImages', () => {
  it('只回傳指定資料夾的圖片', async () => {
    resources = [
      makeResource('one', 'hero'),
      makeResource('two', 'hero'),
      makeResource('three', 'TQ001')
    ]

    const store = await loadStore()

    expect(store.getFolderImages('hero').value).toEqual([
      { src: 'https://res.cloudinary.com/test/one.jpg', alt: 'one' },
      { src: 'https://res.cloudinary.com/test/two.jpg', alt: 'two' }
    ])
  })

  it('不會把名字裡剛好有 hero 的資料夾也算進去', async () => {
    resources = [
      makeResource('keep', 'hero'),
      makeResource('old', 'hero-old'),
      makeResource('nested', 'market/hero-ish')
    ]

    const store = await loadStore()
    const images = store.getFolderImages('hero').value

    expect(images.map(image => image.alt)).toEqual(['keep'])
  })

  it('後台上傳的市集照片不會跑進 hero', async () => {
    resources = [
      makeResource('bowl', 'market/55555555-5555-4555-8555-555555555555'),
      makeResource('cup', 'market/55555555-5555-4555-8555-555555555555')
    ]

    const store = await loadStore()

    expect(store.getFolderImages('hero').value).toEqual([])
  })

  it('巢狀資料夾用路徑片段也認得', async () => {
    resources = [makeResource('bowl', 'products/TQ001')]

    const store = await loadStore()

    expect(store.getFolderImages('TQ001').value).toHaveLength(1)
  })

  it('沒有 asset_folder 的圖片不會讓比對爆掉', async () => {
    resources = [makeResource('rootlevel'), makeResource('inside', 'hero')]

    const store = await loadStore()

    expect(() => store.getFolderImages('hero').value).not.toThrow()
    expect(store.getFolderImages('hero').value).toHaveLength(1)
  })

  it('沒指定資料夾時回空陣列，而不是整包圖片', async () => {
    resources = [makeResource('one', 'hero'), makeResource('two', 'TQ001')]

    const store = await loadStore()

    expect(store.getFolderImages('').value).toEqual([])
  })
})
