<script setup lang="ts">
/**
 * 作品照片欄位：直接上傳到 Cloudinary，也保留手動貼網址。
 *
 * 保留貼網址是因為既有商品的圖片本來就是網址，而且偶爾會想沿用
 * Cloudinary 媒體庫裡已經存在的圖，不必重傳一次。
 */

interface ProductImageDraft {
  src: string
  alt: string
  kind: string
}

const props = defineProps<{ marketId: string }>()

const images = defineModel<ProductImageDraft[]>({ required: true })

/**
 * reka-ui 不接受空字串當選項值（空字串代表「清空選擇、顯示 placeholder」），
 * 所以「一般作品照」在畫面上用一個哨兵值，存回父層時再換回空字串。
 * 後端的 normalizeProductImages 認不得的 kind 一律當成 undefined，
 * 所以就算哨兵值漏出去也只是變回「一般作品照」。
 */
const GENERAL_KIND = 'general'

const IMAGE_KINDS = [
  { value: GENERAL_KIND, label: '一般作品照' },
  { value: 'front', label: '正面' },
  { value: 'side', label: '側面' },
  { value: 'back', label: '背面' },
  { value: 'bottom', label: '底部' },
  { value: 'detail', label: '陶土細節' },
  { value: 'process', label: '製作過程' }
]

const { uploading, error, done, total, upload } = useCloudinaryUpload(() => props.marketId)

const picked = ref<File[] | null>(null)

const progressLabel = computed(() => (total.value > 1 ? `上傳中 ${done.value}/${total.value}` : '上傳中'))

watch(picked, async (files) => {
  if (!files || files.length === 0) {
    return
  }

  // 先清空挑選狀態：UFileUpload 會把檔案留在自己的清單裡，不清掉的話
  // 畫面上會同時有「待上傳」和「已上傳」兩份，而且同一個檔案選不了第二次。
  picked.value = null

  images.value = [...images.value, ...await upload(files)]
})

/** 一律換成新陣列，不要就地改 model 裡的物件（父層的 form.images 是同一份參考）。 */
function updateAt(index: number, patch: Partial<ProductImageDraft>) {
  images.value = images.value.map((image, i) => (i === index ? { ...image, ...patch } : image))
}

function addByUrl() {
  images.value = [...images.value, { src: '', alt: '', kind: '' }]
}

function removeAt(index: number) {
  images.value = images.value.filter((_, i) => i !== index)
}
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <span class="text-sm">作品照片</span>
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-link"
        :disabled="uploading"
        @click="addByUrl"
      >
        貼網址
      </UButton>
    </div>

    <UFileUpload
      v-model="picked"
      multiple
      :accept="ACCEPTED_IMAGE_TYPES"
      :disabled="uploading"
      icon="i-lucide-image-plus"
      label="拖曳照片到這裡，或點擊選擇"
      :description="uploading ? progressLabel : '可一次選多張，單張上限 10MB'"
      class="mb-3 w-full"
    />

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-lucide-triangle-alert"
      title="部分照片沒有上傳成功"
      :description="error"
      class="mb-3 whitespace-pre-line"
    />

    <div class="space-y-2">
      <div
        v-for="(image, i) in images"
        :key="i"
        class="flex items-center gap-2"
      >
        <img
          v-if="image.src"
          :src="image.src"
          alt=""
          loading="lazy"
          class="size-10 shrink-0 rounded-md object-cover"
        >
        <UInput
          :model-value="image.src"
          placeholder="圖片網址"
          class="flex-1"
          @update:model-value="updateAt(i, { src: String($event) })"
        />
        <USelect
          :model-value="image.kind || GENERAL_KIND"
          :items="IMAGE_KINDS"
          value-key="value"
          class="w-36"
          @update:model-value="updateAt(i, { kind: $event === GENERAL_KIND ? '' : String($event) })"
        />
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="sm"
          @click="removeAt(i)"
        />
      </div>
      <p
        v-if="images.length === 0"
        class="text-xs text-neutral-500"
      >
        第一張會作為瀏覽器的主圖與清單縮圖。
      </p>
    </div>
  </div>
</template>
