<script setup lang="ts">
import type { IndexCollectionItem } from '@nuxt/content'
import { useCloudinaryStore } from '~/stores/cloudinary'

const { hero, global } = useAppConfig()

const props = defineProps<{
  page: IndexCollectionItem
}>()

const cloudinaryStore = useCloudinaryStore()

// 在組件掛載時獲取圖片
onMounted(() => {
  cloudinaryStore.fetchImages()
})

/**
 * 只抓 app.config.ts 指定的那個 Cloudinary 資料夾。
 *
 * 原本抓的是「最新的 9 張」，所以後台一上傳作品照就會把首頁精選圖擠掉。
 */
const cloudinaryImages = cloudinaryStore.getFolderImages(hero.cloudinaryFolder)

/**
 * Cloudinary 還沒回來、資料夾不存在或還沒放圖，就用 content/index.yml 的靜態圖。
 *
 * 原本這裡會顯示九塊灰色方塊 —— displayImages 算了卻沒被用到，等於沒有退路。
 */
const heroImages = computed(() => (
  cloudinaryImages.value.length > 0
    ? cloudinaryImages.value
    : props.page.hero.images
))
</script>

<template>
  <UPageHero
    :ui="{
      headline: 'flex items-center justify-center',
      title: 'text-shadow-md max-w-lg mx-auto',
      links: 'flex-col justify-center items-center'
    }"
  >
    <template #headline>
      <Motion
        :initial="{
          scale: 1.1,
          opacity: 0,
          filter: 'blur(20px)'
        }"
        :animate="{
          scale: 1,
          opacity: 1,
          filter: 'blur(0px)'
        }"
        :transition="{
          duration: 0.6,
          delay: 0.1
        }"
      >
        <NuxtImg
          fit="cover"
          sizes="(max-width: 640px) 128px, (max-width: 1024px) 144px, 152px"
          class="mx-auto w-32 sm:w-36 md:w-38"
          :src="global.picture?.light!"
          :alt="global.picture?.alt!"
          placeholder
          preload
        />
      </Motion>
    </template>

    <template #title>
      <Motion
        :initial="{
          scale: 1.1,
          opacity: 0,
          filter: 'blur(20px)'
        }"
        :animate="{
          scale: 1,
          opacity: 1,
          filter: 'blur(0px)'
        }"
        :transition="{
          duration: 0.6,
          delay: 0.1
        }"
      >
        {{ page.title }}
      </Motion>
    </template>

    <template #description>
      <Motion
        :initial="{
          scale: 1.1,
          opacity: 0,
          filter: 'blur(20px)'
        }"
        :animate="{
          scale: 1,
          opacity: 1,
          filter: 'blur(0px)'
        }"
        :transition="{
          duration: 0.6,
          delay: 0.3
        }"
      >
        {{ page.description }}
      </Motion>
    </template>

    <template #links>
      <!-- <Motion
        :initial="{
          scale: 1.1,
          opacity: 0,
          filter: 'blur(20px)'
        }"
        :animate="{
          scale: 1,
          opacity: 1,
          filter: 'blur(0px)'
        }"
        :transition="{
          duration: 0.6,
          delay: 0.5
        }"
      >
        <div
          v-if="page.hero.links"
          class="flex items-center gap-2"
        >
          <UButton v-bind="page.hero.links[0]" />
          <UButton
            :color="global.available ? 'success' : 'error'"
            variant="ghost"
            class="gap-2"
            :to="global.available ? global.meetingLink : ''"
            :label="global.available ? 'Available for new projects' : 'Not available at the moment'"
          >
            <template #leading>
              <span class="relative flex size-2">
                <span
                  class="absolute inline-flex size-full rounded-full opacity-75"
                  :class="global.available ? 'bg-success animate-ping' : 'bg-error'"
                />
                <span
                  class="relative inline-flex size-2 scale-90 rounded-full"
                  :class="global.available ? 'bg-success' : 'bg-error'"
                />
              </span>
            </template>
          </UButton>
        </div>
      </Motion> -->

      <div class="gap-x-4 inline-flex mt-4">
        <Motion
          v-if="hero?.instagram"
          :initial="{
            scale: 1.1,
            opacity: 0,
            filter: 'blur(20px)'
          }"
          :animate="{
            scale: 1,
            opacity: 1,
            filter: 'blur(0px)'
          }"
          :transition="{
            duration: 0.6,
            delay: 0.5
          }"
        >
          <UButton
            v-bind="{ size: 'md', color: 'neutral', variant: 'ghost', ...hero.instagram }"
          />
        </Motion>
      </div>
    </template>

    <UMarquee
      pause-on-hover
      class="py-2 -mx-8 sm:-mx-12 lg:-mx-16 [--duration:40s] [--gap:0.5rem]"
    >
      <Motion
        v-for="(img, index) in heroImages"
        :key="'img-' + index"
        :initial="{
          scale: 1.1,
          opacity: 0,
          filter: 'blur(20px)'
        }"
        :animate="{
          scale: 1,
          opacity: 1,
          filter: 'blur(0px)'
        }"
        :transition="{
          duration: 0.6,
          delay: index * 0.1
        }"
      >
        <NuxtImg
          width="234"
          height="234"
          class=" aspect-square object-cover"
          v-bind="img"
          placeholder
          preload
        />
      </Motion>
    </UMarquee>
  </UPageHero>
</template>
