<script setup lang="ts">
import type { IndexCollectionItem } from '@nuxt/content'

const props = defineProps<{
  page: IndexCollectionItem
}>()

const groupedExperience = computed(() => {
  const groups: Record<string, any[]> = {}
  const items = props.page.experience.items || []

  for (const item of items) {
    if (!groups[item.position]) groups[item.position] = []
    groups[item.position].push(item)
  }

  return groups
})
</script>

<template>
  <UPageSection
    :title="props.page.experience.title"
    :ui="{
      container: '!p-0 gap-4 sm:gap-4',
      title: 'text-left text-xl sm:text-xl lg:text-2xl font-medium',
      description: 'mt-2'
    }"
  >
    <template #description>
      <div>
        <div
          v-for="(items, position) in groupedExperience"
          :key="position"
          class="mb-6"
        >
          <!-- 分類標題 -->
          <h4 class="text-lg font-semibold mb-2 text-left">{{ position }}</h4>

          <!-- 該地點下的市集列表 -->
          <div v-for="(experience, index) in items" :key="index">
            <Motion
              :initial="{ opacity: 0, transform: 'translateY(20px)' }"
              :while-in-view="{ opacity: 1, transform: 'translateY(0)' }"
              :transition="{ delay: 0.4 + 0.2 * index }"
              :in-view-options="{ once: true }"
              class="text-muted flex items-center flex-wrap gap-2"
            >
              <ULink
                class="flex items-center gap-1"
                :to="experience.company.url"
                target="_blank"
              >
                <div
                  class="inline-flex items-center gap-1"
                  :style="{ color: experience.company.color }"
                >
                  <span class="font-medium text-sm">{{
                    experience.company.name
                  }}</span>
                  <UIcon :name="experience.company.logo" />
                </div>
              </ULink>

              <USeparator orientation="vertical" />
              <p class="text-xs">{{ experience.date }}</p>
            </Motion>
          </div>
        </div>
      </div>
    </template>
  </UPageSection>
</template>
