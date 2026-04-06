<script setup lang="ts">
import type { IndexCollectionItem } from '@nuxt/content'
import { useCloudinaryStore } from '~/stores/cloudinary';

const { hero, global } = useAppConfig()

const props = defineProps<{
  page: IndexCollectionItem
}>()

const cloudinaryStore = useCloudinaryStore()

// 在組件掛載時獲取圖片
onMounted(() => {
  cloudinaryStore.fetchImages()
})

// 取得格式化的圖片（前 9 張）
const heroImages = cloudinaryStore.getFormattedImages(9)

// 如果 Cloudinary 有圖片就用 Cloudinary，否則用原本的圖片
const displayImages = computed(() => {
  return heroImages.value.length > 0 
    ? heroImages.value 
    : props.page.hero.images
})

// 僅在 Cloudinary 成功取得圖片時才顯示圖片，否則顯示空白
const showCloudinaryImages = computed(() => heroImages.value.length > 0)

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
          width="200"
          height="200"
          sizes="sm:80vw md:300px"
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
        <!-- {{ page.title }} -->
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
        <!-- {{ page.description }} -->
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
      class="py-2 -mx-8 sm:-mx-12 lg:-mx-16 [--duration:40s]"
    >
      <!-- Cloudinary 成功回傳後才顯示圖片 -->
      <Motion
        v-for="(img, index) in heroImages"
        v-if="showCloudinaryImages"
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
          class="rounded-lg aspect-square object-cover"
          :class="index % 2 === 0 ? '-rotate-2' : 'rotate-2'"
          v-bind="img"
          placeholder
          preload
        />
      </Motion>
      <!-- 尚未成功呼叫前顯示空白佔位 -->
      <Motion
        v-for="index in 9"
        v-if="!showCloudinaryImages"
        :key="'placeholder-' + index"
        :initial="{ opacity: 0 }"
        :animate="{ opacity: 1 }"
        :transition="{ duration: 0.3 }"
        class="rounded-lg aspect-square bg-muted/30 shrink-0"
        style="width: 234px; height: 234px"
      />
    </UMarquee>
  </UPageHero>
</template>
