<script setup lang="ts">
import type { IndexCollectionItem } from '@nuxt/content'
import { useCloudinaryStore } from '~/stores/cloudinary'

type InstagramSection = {
  instagram?: {
    title?: string
    description?: string
    url?: string
  }
}

interface InstagramPost {
  id: string
  url: string
  authorName: string
  providerName: string
  mediaType?: string
  mediaUrl?: string
  thumbnailUrl?: string
  caption?: string
  timestamp?: string
}

interface InstagramResponse {
  posts: InstagramPost[]
  configured?: boolean
  error?: string
  code?: number
}

const props = defineProps<{
  page: IndexCollectionItem & InstagramSection
}>()

const instagramUrl = computed(
  () => props.page.instagram?.url ?? 'https://www.instagram.com/tranquil._.island/'
)

const { data, pending, error } = await useAsyncData<InstagramResponse>(
  'instagram-home-posts',
  () => $fetch('/api/instagram'),
  {
    default: () => ({ posts: [] }),
    lazy: true,
    server: false
  }
)

const failedImageUrls = shallowRef(new Set<string>())
const selectedIndex = shallowRef<number | null>(null)
const pageTurnDirection = shallowRef<'next' | 'previous'>('next')
const cloudinaryStore = useCloudinaryStore()
const cloudinaryImages = cloudinaryStore.getFormattedImages(6)

const posts = computed(() => {
  return (data.value?.posts ?? [])
    .filter(post => Boolean(post.url))
    .slice(0, 6)
})

const selectedPost = computed(() => {
  if (selectedIndex.value === null) return null
  return posts.value[selectedIndex.value] ?? null
})

const hasPosts = computed(() => posts.value.length > 0)
const isModalOpen = computed(() => selectedPost.value !== null)
const apiErrorMessage = computed(() => data.value?.error?.trim() || '')

const gridItemClasses = computed(() => {
  return posts.value.map((_, index) => ({
    'instagram-collage-item--large': index === 0,
    'instagram-collage-item--wide': index === 3,
    'instagram-collage-item--tall': index === 4,
    'instagram-collage-item--tilt-left': index === 1 || index === 5,
    'instagram-collage-item--tilt-right': index === 2
  }))
})

function getPostImage(post: InstagramPost, index: number): string | null {
  const directMedia =
    post.mediaType === 'VIDEO'
      ? post.thumbnailUrl || post.mediaUrl
      : post.mediaUrl || post.thumbnailUrl

  if (directMedia && !failedImageUrls.value.has(directMedia)) {
    return directMedia
  }

  if (post.thumbnailUrl && !failedImageUrls.value.has(post.thumbnailUrl)) {
    return post.thumbnailUrl
  }

  const fallbackImage = cloudinaryImages.value[index % cloudinaryImages.value.length]
  if (fallbackImage?.src && !failedImageUrls.value.has(fallbackImage.src)) {
    return fallbackImage.src
  }

  return null
}

function getPostTitle(post: InstagramPost, index: number) {
  return post.caption?.trim() || `Instagram diary ${index + 1}`
}

function getPostCaption(post: InstagramPost) {
  if (post.caption?.trim()) return post.caption.trim()
  return '安靜收藏在 Instagram 裡的一頁。'
}

function markImageUnavailable(url: string | null) {
  if (!url) return
  failedImageUrls.value = new Set([...failedImageUrls.value, url])
}

function openPost(index: number) {
  if (!posts.value[index]) return
  selectedIndex.value = index
}

function closePost() {
  selectedIndex.value = null
}

function goToPost(direction: 'next' | 'previous') {
  if (selectedIndex.value === null || posts.value.length < 2) return

  pageTurnDirection.value = direction
  const offset = direction === 'next' ? 1 : -1
  selectedIndex.value = (selectedIndex.value + offset + posts.value.length) % posts.value.length
}

function handleKeydown(event: KeyboardEvent) {
  if (!isModalOpen.value) return

  if (event.key === 'Escape') {
    closePost()
    return
  }

  if (event.key === 'ArrowRight') {
    goToPost('next')
    return
  }

  if (event.key === 'ArrowLeft') {
    goToPost('previous')
  }
}

if (import.meta.client) {
  watch(isModalOpen, (open) => {
    document.documentElement.classList.toggle('instagram-modal-lock', open)
  })

  onMounted(() => {
    void cloudinaryStore.fetchImages()
    window.addEventListener('keydown', handleKeydown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
    document.documentElement.classList.remove('instagram-modal-lock')
  })
}

if (error.value) {
  console.warn('[instagram] Homepage Instagram diary failed to load.', error.value)
}
</script>

<template>
  <UPageSection
    :ui="{
      container: 'px-4 sm:px-12 lg:px-16 !pt-0'
    }"
  >
    <section
      class="instagram-collage mx-auto max-w-(--ui-container)"
      aria-label="Instagram diary posts"
    >
      <div
        v-if="pending && !hasPosts"
        class="instagram-collage-grid"
        aria-label="Loading Instagram posts"
      >
        <div
          v-for="item in 6"
          :key="item"
          class="instagram-collage-item instagram-collage-item--skeleton"
          :class="{
            'instagram-collage-item--large': item === 1,
            'instagram-collage-item--wide': item === 4,
            'instagram-collage-item--tall': item === 5
          }"
        >
          <div class="instagram-collage-skeleton" />
        </div>
      </div>

      <UAlert
        v-else-if="(error || apiErrorMessage) && !hasPosts"
        color="warning"
        variant="soft"
        title="Instagram 貼文暫時無法載入"
        :description="apiErrorMessage || '可以稍後再試，或直接前往 Instagram 查看最新日記。'"
      />

      <UAlert
        v-else-if="!hasPosts"
        color="neutral"
        variant="soft"
        title="尚未取得 Instagram 貼文"
        description="請確認 INSTAGRAM_ACCESS_TOKEN 是否有效，或稍後重新整理。"
      />

      <div
        v-else
        class="instagram-collage-grid"
      >
        <article
          v-for="(post, index) in posts"
          :key="post.id"
          class="instagram-collage-item"
          :class="gridItemClasses[index]"
        >
          <button
            type="button"
            class="instagram-collage-button"
            :aria-label="`Open ${getPostTitle(post, index)}`"
            @click="openPost(index)"
          >
            <img
              v-if="getPostImage(post, index)"
              :src="getPostImage(post, index) || ''"
              :alt="getPostTitle(post, index)"
              class="instagram-collage-image"
              loading="lazy"
              @error="markImageUnavailable(getPostImage(post, index))"
            >

            <span
              v-else
              class="instagram-collage-fallback"
            >
              <span class="instagram-collage-fallback-mark">
                {{ String(index + 1).padStart(2, '0') }}
              </span>
              <span class="instagram-collage-fallback-copy">
                View diary post
              </span>
            </span>

            <span class="instagram-collage-overlay">
              <UIcon
                name="i-simple-icons-instagram"
                class="instagram-collage-overlay-icon"
              />
              <span>Open diary</span>
            </span>
          </button>

          <ULink
            :to="post.url"
            target="_blank"
            rel="noopener noreferrer"
            class="instagram-collage-link"
            :aria-label="`View ${getPostTitle(post, index)} on Instagram`"
          >
            <UIcon
              name="i-lucide-arrow-up-right"
              class="size-4"
            />
          </ULink>
        </article>
      </div>
    </section>

    <Teleport to="body">
      <Transition name="instagram-modal">
        <div
          v-if="selectedPost"
          class="instagram-modal"
          role="dialog"
          aria-modal="true"
          :aria-label="getPostTitle(selectedPost, selectedIndex ?? 0)"
        >
          <button
            type="button"
            class="instagram-modal-backdrop"
            aria-label="Close Instagram diary"
            @click="closePost"
          />

          <div class="instagram-modal-panel">
            <button
              type="button"
              class="instagram-modal-close"
              aria-label="Close Instagram diary"
              @click="closePost"
            >
              <UIcon
                name="i-lucide-x"
                class="size-5"
              />
            </button>

            <button
              v-if="posts.length > 1"
              type="button"
              class="instagram-modal-nav instagram-modal-nav--previous"
              aria-label="Previous Instagram post"
              @click="goToPost('previous')"
            >
              <UIcon
                name="i-lucide-chevron-left"
                class="size-5"
              />
            </button>

            <button
              v-if="posts.length > 1"
              type="button"
              class="instagram-modal-nav instagram-modal-nav--next"
              aria-label="Next Instagram post"
              @click="goToPost('next')"
            >
              <UIcon
                name="i-lucide-chevron-right"
                class="size-5"
              />
            </button>

            <Transition
              :name="pageTurnDirection === 'next' ? 'diary-page-next' : 'diary-page-previous'"
              mode="out-in"
            >
              <article
                :key="selectedPost.url"
                class="instagram-modal-post"
              >
                <div class="instagram-modal-media">
                  <img
                    v-if="getPostImage(selectedPost, selectedIndex ?? 0)"
                    :src="getPostImage(selectedPost, selectedIndex ?? 0) || ''"
                    :alt="getPostTitle(selectedPost, selectedIndex ?? 0)"
                    class="instagram-modal-image"
                    @error="markImageUnavailable(getPostImage(selectedPost, selectedIndex ?? 0))"
                  >

                  <div
                    v-else
                    class="instagram-modal-fallback"
                  >
                    <UIcon
                      name="i-simple-icons-instagram"
                      class="instagram-modal-fallback-icon"
                    />
                    <p class="instagram-modal-fallback-title">
                      Preview unavailable
                    </p>
                    <p class="instagram-modal-fallback-copy">
                      這則貼文的圖片暫時無法顯示。
                    </p>
                  </div>
                </div>

                <aside class="instagram-modal-story">
                  <div class="instagram-modal-account">
                    <div class="instagram-modal-avatar">
                      <UIcon
                        name="i-simple-icons-instagram"
                        class="size-5"
                      />
                    </div>
                    <div>
                      <p class="instagram-modal-author">
                        @{{ selectedPost.authorName || 'tranquil._.island' }}
                      </p>
                      <p class="instagram-modal-provider">
                        {{ selectedPost.providerName || 'Instagram' }}
                      </p>
                    </div>
                  </div>

                  <p class="instagram-modal-caption">
                    {{ getPostCaption(selectedPost) }}
                  </p>

                  <div class="instagram-modal-actions">
                    <span class="instagram-modal-count">
                      {{ String((selectedIndex ?? 0) + 1).padStart(2, '0') }}
                      /
                      {{ String(posts.length).padStart(2, '0') }}
                    </span>

                    <UButton
                      :to="selectedPost.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      trailing-icon="i-lucide-arrow-up-right"
                      label="View on Instagram"
                    />
                  </div>
                </aside>
              </article>
            </Transition>
          </div>
        </div>
      </Transition>
    </Teleport>
  </UPageSection>
</template>

<style scoped>
.instagram-collage {
  position: relative;
  padding-block: clamp(0.5rem, 1.2vw, 1rem);
}

.instagram-collage-grid {
  display: grid;
  position: relative;
  grid-auto-flow: dense;
  grid-auto-rows: minmax(7rem, auto);
  gap: clamp(0.8rem, 2.1vw, 1.35rem);
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.instagram-collage-item {
  position: relative;
  min-width: 0;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 0.22rem;
  background: transparent;
  box-shadow: none;
  grid-column: span 3;
  transition:
    transform 180ms ease;
}

.instagram-collage-item::before {
  content: none;
}

.instagram-collage-item:hover {
  transform: translateY(-1px);
}

.instagram-collage-item--large {
  grid-column: span 6;
  grid-row: span 2;
}

.instagram-collage-item--wide {
  grid-column: span 6;
}

.instagram-collage-item--tall {
  grid-row: span 2;
}

.instagram-collage-item--tilt-left {
  transform: none;
}

.instagram-collage-item--tilt-right {
  transform: none;
}

.instagram-collage-item--tilt-left:hover,
.instagram-collage-item--tilt-right:hover {
  transform: translateY(-2px) rotate(0deg);
}

.instagram-collage-button {
  display: block;
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 12rem;
  padding: 0;
  border: 0;
  background: transparent;
  border-radius: 0.22rem;
  color: inherit;
  cursor: pointer;
  text-align: inherit;
}

.instagram-collage-image {
  display: block;
  width: 100%;
  height: 100%;
  min-height: inherit;
  aspect-ratio: 1 / 1;
  object-fit: cover;
  filter: saturate(0.94) contrast(0.98);
  transition:
    filter 220ms ease,
    transform 220ms ease;
}

.instagram-collage-item--large .instagram-collage-image,
.instagram-collage-item--wide .instagram-collage-image {
  aspect-ratio: 4 / 3;
}

.instagram-collage-button:hover .instagram-collage-image,
.instagram-collage-button:focus-visible .instagram-collage-image {
  filter: saturate(1) contrast(1.01);
  transform: scale(1.035);
}

.instagram-collage-button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--ui-primary) 78%, white);
  outline-offset: -4px;
}

.instagram-collage-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  background:
    linear-gradient(180deg, rgb(44 36 28 / 10%), rgb(44 36 28 / 44%));
  color: #fffaf0;
  font-size: 0.78rem;
  letter-spacing: 0.02em;
  opacity: 0;
  transition: opacity 180ms ease;
}

.instagram-collage-button:hover .instagram-collage-overlay,
.instagram-collage-button:focus-visible .instagram-collage-overlay {
  opacity: 1;
}

.instagram-collage-overlay-icon {
  width: 1.05rem;
  height: 1.05rem;
}

.instagram-collage-link {
  position: absolute;
  z-index: 3;
  bottom: 0.7rem;
  left: 0.7rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid rgb(255 250 242 / 70%);
  border-radius: 999px;
  background: rgb(45 36 28 / 34%);
  color: #fffaf2;
  opacity: 1;
  transition:
    background 160ms ease,
    opacity 160ms ease,
    transform 160ms ease;
}

.instagram-collage-link:hover {
  background: rgb(31 26 22 / 58%);
  transform: translateY(-1px);
}

.instagram-collage-fallback,
.instagram-collage-skeleton {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: inherit;
  align-items: center;
  justify-content: center;
}

.instagram-collage-fallback {
  flex-direction: column;
  gap: 0.35rem;
  padding: 1rem;
  background:
    repeating-linear-gradient(
      178deg,
      rgb(112 92 70 / 8%) 0,
      rgb(112 92 70 / 8%) 1px,
      transparent 1px,
      transparent 1.9rem
    ),
    #f8f1e8;
  color: color-mix(in srgb, var(--ui-text-muted) 82%, #604a38);
}

.instagram-collage-fallback-mark {
  color: var(--ui-text-highlighted);
  font-size: clamp(1.6rem, 5vw, 3rem);
  line-height: 1;
}

.instagram-collage-fallback-copy {
  font-size: 0.75rem;
}

.instagram-collage-item--skeleton {
  min-height: 12rem;
}

.instagram-collage-skeleton {
  background: linear-gradient(
    90deg,
    rgb(202 188 170 / 22%),
    rgb(255 255 255 / 72%),
    rgb(202 188 170 / 22%)
  );
  background-size: 200% 100%;
  animation: instagram-skeleton 1.25s ease-in-out infinite;
}

@keyframes instagram-skeleton {
  0% {
    background-position: 100% 0;
  }

  100% {
    background-position: -100% 0;
  }
}

.instagram-modal {
  position: fixed;
  z-index: 80;
  inset: 0;
  display: grid;
  place-items: center;
  padding: clamp(1rem, 3vw, 2rem);
}

.instagram-modal-backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background:
    radial-gradient(circle at 50% 8%, rgb(255 250 242 / 18%), transparent 34rem),
    rgb(20 17 15 / 78%);
  cursor: zoom-out;
}

.instagram-modal-panel {
  position: relative;
  width: min(100%, 66rem);
  max-height: min(88vh, 48rem);
  border: 1px solid rgb(255 250 242 / 18%);
  border-radius: 0.75rem;
  background:
    linear-gradient(180deg, rgb(255 252 246 / 98%), rgb(246 236 221 / 98%)),
    #f8efe2;
  box-shadow: 0 34px 86px rgb(0 0 0 / 32%);
}

.instagram-modal-post {
  display: grid;
  min-height: min(78vh, 42rem);
  overflow: hidden;
  border-radius: inherit;
  grid-template-columns: minmax(0, 1.2fr) minmax(18rem, 0.8fr);
}

.instagram-modal-media {
  display: grid;
  position: relative;
  min-width: 0;
  min-height: 20rem;
  overflow: hidden;
  place-items: center;
  background:
    repeating-linear-gradient(
      178deg,
      rgb(112 92 70 / 8%) 0,
      rgb(112 92 70 / 8%) 1px,
      transparent 1px,
      transparent 2.15rem
    ),
    linear-gradient(135deg, rgb(255 255 255 / 48%), transparent 42%),
    #f1eadf;
}

.instagram-modal-media::before {
  position: absolute;
  inset: 1.1rem;
  border: 1px solid rgb(105 85 64 / 12%);
  border-radius: 0.45rem;
  background:
    linear-gradient(112deg, transparent 10%, rgb(84 69 54 / 10%) 10.4%, transparent 11.2%),
    linear-gradient(19deg, transparent 34%, rgb(84 69 54 / 8%) 34.3%, transparent 35.2%),
    linear-gradient(164deg, transparent 68%, rgb(84 69 54 / 9%) 68.4%, transparent 69.3%);
  content: "";
  pointer-events: none;
}

.instagram-modal-media::after {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(92deg, rgb(109 88 64 / 7%), transparent 16%, transparent 84%, rgb(109 88 64 / 7%)),
    linear-gradient(176deg, rgb(255 255 255 / 26%), transparent 38%, rgb(105 85 64 / 5%));
  content: "";
  pointer-events: none;
}

.instagram-modal-image {
  display: block;
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  max-height: min(78vh, 42rem);
  object-fit: contain;
}

.instagram-modal-fallback {
  display: grid;
  position: relative;
  z-index: 1;
  max-width: 20rem;
  place-items: center;
  gap: 0.55rem;
  padding: 2rem;
  text-align: center;
}

.instagram-modal-fallback-icon {
  width: 2rem;
  height: 2rem;
  color: color-mix(in srgb, var(--ui-text-highlighted) 80%, #9c7353);
}

.instagram-modal-fallback-title {
  color: var(--ui-text-highlighted);
  font-size: 1rem;
}

.instagram-modal-fallback-copy {
  color: var(--ui-text-muted);
  font-size: 0.86rem;
  line-height: 1.7;
}

.instagram-modal-story {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: clamp(1.25rem, 3vw, 2rem);
  justify-content: space-between;
  padding: clamp(1.25rem, 3vw, 2rem);
  border-left: 1px solid rgb(145 116 83 / 20%);
  background: rgb(255 249 240 / 68%);
}

.instagram-modal-account {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}

.instagram-modal-avatar {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 2.55rem;
  height: 2.55rem;
  border: 1px solid color-mix(in srgb, var(--ui-border) 70%, transparent);
  border-radius: 999px;
  color: color-mix(in srgb, var(--ui-text-highlighted) 85%, #9c7353);
}

.instagram-modal-author {
  color: var(--ui-text-highlighted);
  font-size: 0.92rem;
  line-height: 1.35;
}

.instagram-modal-provider {
  color: var(--ui-text-muted);
  font-size: 0.76rem;
  line-height: 1.4;
}

.instagram-modal-caption {
  overflow: auto;
  max-height: 20rem;
  color: color-mix(in srgb, var(--ui-text) 88%, #604a38);
  font-size: 0.96rem;
  line-height: 1.9;
  white-space: pre-wrap;
}

.instagram-modal-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.instagram-modal-count {
  color: var(--ui-text-muted);
  font-size: 0.78rem;
}

.instagram-modal-close,
.instagram-modal-nav {
  position: absolute;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.35rem;
  height: 2.35rem;
  border: 1px solid rgb(152 120 88 / 26%);
  border-radius: 999px;
  background: rgb(255 250 243 / 92%);
  color: rgb(84 65 44 / 90%);
  box-shadow: 0 12px 26px rgb(0 0 0 / 14%);
  cursor: pointer;
  transition:
    background 160ms ease,
    transform 160ms ease;
}

.instagram-modal-close:hover,
.instagram-modal-nav:hover {
  background: rgb(247 235 219 / 96%);
  transform: translateY(-1px);
}

.instagram-modal-close {
  top: 0.8rem;
  right: 0.8rem;
}

.instagram-modal-nav {
  top: 50%;
  transform: translateY(-50%);
}

.instagram-modal-nav:hover {
  transform: translateY(calc(-50% - 1px));
}

.instagram-modal-nav--previous {
  left: -1.2rem;
}

.instagram-modal-nav--next {
  right: -1.2rem;
}

.instagram-modal-enter-active,
.instagram-modal-leave-active {
  transition: opacity 180ms ease;
}

.instagram-modal-enter-from,
.instagram-modal-leave-to {
  opacity: 0;
}

.instagram-modal-enter-active .instagram-modal-panel,
.instagram-modal-leave-active .instagram-modal-panel {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.instagram-modal-enter-from .instagram-modal-panel,
.instagram-modal-leave-to .instagram-modal-panel {
  opacity: 0;
  transform: translateY(0.8rem) scale(0.985);
}

.diary-page-next-enter-active,
.diary-page-next-leave-active,
.diary-page-previous-enter-active,
.diary-page-previous-leave-active {
  transition:
    opacity 190ms ease,
    transform 190ms ease;
}

.diary-page-next-enter-from {
  opacity: 0;
  transform: translateX(1.25rem) rotateY(-3deg);
}

.diary-page-next-leave-to {
  opacity: 0;
  transform: translateX(-1.25rem) rotateY(3deg);
}

.diary-page-previous-enter-from {
  opacity: 0;
  transform: translateX(-1.25rem) rotateY(3deg);
}

.diary-page-previous-leave-to {
  opacity: 0;
  transform: translateX(1.25rem) rotateY(-3deg);
}

@media (min-width: 768px) {
  .instagram-collage-grid {
    grid-auto-rows: minmax(8rem, auto);
    grid-template-columns: repeat(12, minmax(0, 1fr));
  }

  .instagram-collage-item {
    grid-column: span 3;
  }

  .instagram-collage-item--large {
    grid-column: span 5;
  }

  .instagram-collage-item--wide {
    grid-column: span 4;
  }

  .instagram-collage-item--tall {
    grid-column: span 3;
  }
}

@media (max-width: 767px) {
  .instagram-collage-grid {
    grid-auto-rows: auto;
  }

  .instagram-collage-item,
  .instagram-collage-item--tall {
    grid-column: span 3;
    grid-row: auto;
  }

  .instagram-collage-item--large,
  .instagram-collage-item--wide {
    grid-column: span 6;
    grid-row: auto;
  }

  .instagram-collage-item--tilt-left,
  .instagram-collage-item--tilt-right {
    transform: none;
  }

  .instagram-collage-item:hover {
    transform: none;
  }

  .instagram-collage-button,
  .instagram-collage-image,
  .instagram-collage-fallback {
    min-height: 10.5rem;
  }

  .instagram-collage-link {
    opacity: 1;
  }

  .instagram-modal {
    align-items: end;
    padding: 0.75rem;
  }

  .instagram-modal-panel {
    width: 100%;
    max-height: 92vh;
    overflow: auto;
    border-radius: 0.75rem;
  }

  .instagram-modal-post {
    min-height: auto;
    grid-template-columns: 1fr;
  }

  .instagram-modal-media {
    min-height: 18rem;
  }

  .instagram-modal-image {
    max-height: 52vh;
  }

  .instagram-modal-story {
    border-top: 1px solid rgb(145 116 83 / 20%);
    border-left: 0;
  }

  .instagram-modal-caption {
    max-height: none;
  }

  .instagram-modal-nav {
    top: 32%;
  }

  .instagram-modal-nav--previous {
    left: 0.65rem;
  }

  .instagram-modal-nav--next {
    right: 0.65rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .instagram-collage-item,
  .instagram-collage-image,
  .instagram-collage-link,
  .instagram-modal-close,
  .instagram-modal-nav,
  .instagram-modal-enter-active,
  .instagram-modal-leave-active,
  .instagram-modal-enter-active .instagram-modal-panel,
  .instagram-modal-leave-active .instagram-modal-panel,
  .diary-page-next-enter-active,
  .diary-page-next-leave-active,
  .diary-page-previous-enter-active,
  .diary-page-previous-leave-active {
    transition: none;
  }
}
</style>

<style>
.instagram-modal-lock {
  overflow: hidden;
}
</style>
