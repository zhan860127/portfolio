<script setup lang="ts">
import type { IndexCollectionItem } from '@nuxt/content'

const props = defineProps<{
  page: IndexCollectionItem
}>()

const quote = computed(() => props.page.about?.quote ?? `每一件器物\n都是一次\n與土的對話。`)

const materials = computed(() => ({
  title: props.page.about?.materials?.title ?? 'Materials',
  tags: props.page.about?.materials?.tags ?? ['陶土', '手捏',]
}))
</script>

<template>
  <div class="about-quote px-6 py-10 rounded-lg">
    <!-- Top quote -->
    <div class="quote-block">
      <div class="quote-line" />
      <p class="quote-text" v-html="quote.replace(/\n/g, '<br />')" />
    </div>

    <!-- Bottom: material tags -->
    <div class="materials-block">
      <p class="materials-title">{{ materials.title }}</p>
      <div class="materials-tags">
        <span
          v-for="tag in materials.tags"
          :key="tag"
          class="material-tag"
        >
          {{ tag }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.about-quote {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: #f0ece6;
  min-height: 100%;
}

.quote-block {
  flex: 1;
}

.quote-line {
  width: 24px;
  height: 2px;
  background: #b0957a;
  margin-bottom: 20px;
}

.quote-text {
  font-size: 14px;  /* 手機版 */
  font-weight: 200;
  color: #4a3e32;
  line-height: 1.9;
  letter-spacing: 2px;
  margin: 0;
}
@media (min-width: 640px) {
  .quote-text {
    font-size: 18px;
  }
}
@media (min-width: 1024px) {
  .quote-text {
    font-size: 20px;
  }
}

.materials-block {
  margin-top: auto;
}

.materials-title {
  font-size: 11px;
  letter-spacing: 3px;
  color: #b0a090;
  margin-bottom: 16px;
  text-transform: uppercase;
}

.materials-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.material-tag {
  font-size: 12px;
  color: #7a6a58;
  border: 1px solid #c9bfb2;
  padding: 5px 12px;
  letter-spacing: 1px;
  background: transparent;
}
</style>
