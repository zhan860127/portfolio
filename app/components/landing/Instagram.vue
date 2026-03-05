<script setup lang="ts">
import type { IndexCollectionItem } from '@nuxt/content'

interface InstagramPost {
  url: string
  html: string
}

const props = defineProps<{
  page: IndexCollectionItem
}>()

// 從後端 /api/instagram 取得 oEmbed
const { data, pending } = await useAsyncData('instagram-posts', () =>
  $fetch<{ posts: InstagramPost[] }>('/api/instagram')
)

// 取得貼文陣列
const posts = computed<InstagramPost[]>(() => data.value?.posts || [])

// 分組，每 3 個貼文一組，給 Carousel 用
const groups = computed<InstagramPost[][]>(() => {
  const items = posts.value.slice(0, 9)
  const chunks: InstagramPost[][] = []

  for (let i = 0; i < items.length; i += 3) {
    chunks.push(items.slice(i, i + 3))
  }

  return chunks
})
</script>
<template>
  <UPageSection
    :title="page.instagram?.title || 'Instagram'"
    :description="page.instagram?.description"
    :ui="{
      container: 'px-0 !pt-0 sm:gap-6 lg:gap-8',
      title: 'text-left text-xl sm:text-xl lg:text-2xl font-medium',
      description: 'text-left mt-2 text-sm sm:text-md lg:text-sm text-muted'
    }"
  >
    <div class="flex items-center justify-between mb-4">
      <UButton
        v-if="page.instagram?.url"
        :to="page.instagram.url"
        target="_blank"
        color="neutral"
        variant="solid"
        icon="i-simple-icons-instagram"
        label="前往 Instagram"
      />
    </div>

    <div v-if="pending">
      <p class="text-sm text-muted">載入 Instagram 貼文中...</p>
    </div>

    <div v-else-if="groups.length === 0">
      <p class="text-sm text-muted">
        暫時無法載入 Instagram 貼文，您可以直接前往 IG 查看更多內容。
      </p>
    </div>

    <div v-else>
      <UCarousel
        v-slot="{ item }"
        :items="groups"
        arrows
        :ui="{
          viewport: '-mx-4 sm:-mx-12 lg:-mx-16 max-w-(--ui-container)'
        }"
      >
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 px-4 sm:px-12 lg:px-16">
          <!-- 渲染 oEmbed HTML -->
          <div
            v-for="post in item"
            :key="post.url"
            class="group block"
            v-html="post.html"
          ></div>
        </div>
      </UCarousel>
    </div>
  </UPageSection>
</template>