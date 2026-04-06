<script setup lang="ts">
import type { IndexCollectionItem } from '@nuxt/content'

interface InstagramPost {
  url: string
  html: string
}

type InstagramSection = {
  instagram?: {
    title?: string
    description?: string
    url?: string
  }
}

const props = defineProps<{
  page: IndexCollectionItem & InstagramSection
}>()

const { t } = useI18n()

const instagramUrl = computed(
  () => props.page.instagram?.url ?? 'https://www.instagram.com/tranquil._.island/'
)

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
    v-if="pending"
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
        :to="instagramUrl"
        target="_blank"
        color="neutral"
        variant="solid"
        icon="i-simple-icons-instagram"
        :label="t('landing.goToInstagram')"
      />
    </div>

    <div v-if="pending">
      <p class="text-sm text-muted">{{ $t('landing.loadingInstagram') }}</p>
    </div>

    <div v-else-if="groups.length === 0">
      <div class="text-sm text-muted">
        <ULink
          :to="instagramUrl"
          target="_blank"
          class="inline-flex items-center gap-2 hover:text-(--ui-primary)"
        >
          <UIcon name="i-simple-icons-instagram" class="h-4 w-4" />
          <span class="underline underline-offset-4">
            {{ instagramUrl }}
          </span>
        </ULink>
      </div>
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