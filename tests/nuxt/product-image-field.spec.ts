// @vitest-environment nuxt
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import AdminProductImageField from '../../app/components/admin/AdminProductImageField.vue'

/**
 * 作品照片欄位。
 *
 * 這支測的是「欄位和父層表單之間的契約」：上傳完要把網址接到既有清單後面，
 * 刪除與貼網址都必須換成新陣列丟回父層 —— 就地改父層的物件雖然畫面會動，
 * 但 defineModel 不會發事件，存檔時很容易漏掉。
 */

const MARKET_ID = '55555555-5555-4555-8555-555555555555'

const signature = {
  cloudName: 'test-cloud',
  apiKey: 'test-key',
  allowedFormats: 'jpg,jpeg,png,webp,avif',
  folder: `market/${MARKET_ID}`,
  timestamp: 1700000000,
  signature: 'test-signature'
}

function makeFile(name: string): File {
  const file = new File(['x'], name)

  Object.defineProperty(file, 'size', { value: 1024 })

  return file
}

function stubFetch() {
  vi.stubGlobal('$fetch', vi.fn(async (url: string, options?: { body?: FormData }) => {
    if (url === '/api/admin/upload-signature') {
      return signature
    }

    const file = options!.body!.get('file') as File

    return { secure_url: `https://res.cloudinary.com/test-cloud/${file.name}` }
  }))
}

function mountField(images: Array<{ src: string, alt: string, kind: string }>) {
  return mountSuspended(AdminProductImageField, {
    props: { marketId: MARKET_ID, modelValue: images }
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AdminProductImageField', () => {
  it('把既有的圖片網址渲染成可編輯的列', async () => {
    const wrapper = await mountField([
      { src: 'https://res.cloudinary.com/test-cloud/bowl.jpg', alt: '', kind: 'front' }
    ])

    const preview = wrapper.find('img')

    expect(preview.exists()).toBe(true)
    expect(preview.attributes('src')).toBe('https://res.cloudinary.com/test-cloud/bowl.jpg')
  })

  it('上傳完的網址接在既有清單後面，不是蓋掉', async () => {
    stubFetch()

    const existing = { src: 'https://res.cloudinary.com/test-cloud/old.jpg', alt: '', kind: '' }
    const wrapper = await mountField([existing])

    const upload = wrapper.findComponent({ name: 'UFileUpload' })

    expect(upload.exists()).toBe(true)

    upload.vm.$emit('update:modelValue', [makeFile('new.jpg')])
    await new Promise(resolve => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    const emitted = wrapper.emitted('update:modelValue')

    expect(emitted).toBeTruthy()
    expect(emitted!.at(-1)![0]).toEqual([
      existing,
      { src: 'https://res.cloudinary.com/test-cloud/new.jpg', alt: '', kind: '' }
    ])
  })

  it('貼網址會多一列空的，而且丟回去的是新陣列', async () => {
    const images = [{ src: 'https://example.com/a.jpg', alt: '', kind: '' }]
    const wrapper = await mountField(images)

    await wrapper.findAll('button').find(button => button.text().includes('貼網址'))!.trigger('click')

    const emitted = wrapper.emitted('update:modelValue')!.at(-1)![0] as unknown[]

    expect(emitted).toHaveLength(2)
    // 父層原本那份不能被就地改掉
    expect(images).toHaveLength(1)
    expect(emitted).not.toBe(images)
  })
})
