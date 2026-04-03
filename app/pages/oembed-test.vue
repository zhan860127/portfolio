<script setup lang="ts">
interface InstagramPost {
  url: string
  html: string
}

useHead({
  title: 'oEmbed 審查',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  script: [
    {
      src: 'https://www.instagram.com/embed.js',
      async: true
    }
  ]
})

const { data, pending, error, refresh } = await useAsyncData(
  'oembed-test-instagram',
  () => $fetch<{ posts: InstagramPost[] }>('/api/instagram')
)
</script>

<template>
  <div class="py-8 sm:py-10 space-y-8">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">
          Instagram oEmbed 審查
        </h1>
        <p class="mt-1 text-sm text-muted">
          與首頁相同資料來源：<code class="text-xs">GET /api/instagram</code>
        </p>
      </div>
      <UButton
        color="neutral"
        variant="soft"
        icon="i-lucide-refresh-cw"
        :loading="pending"
        @click="refresh"
      >
        重新載入
      </UButton>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="取得 oEmbed 失敗"
      :description="error.message || '請檢查伺服器紀錄與 INSTAGRAM_ACCESS_TOKEN'"
    />

    <div v-else-if="pending" class="text-sm text-muted">
      載入中…
    </div>

    <template v-else>
      <p v-if="!data?.posts?.length" class="text-sm text-muted">
        沒有任何貼文（API 回傳空陣列或全部請求失敗）。
      </p>

      <div v-else class="space-y-10">
        <section
          v-for="(post, index) in data.posts"
          :key="post.url"
          class="rounded-lg border border-default bg-elevated/30 p-4 sm:p-6 space-y-4"
        >
          <div class="flex flex-wrap items-baseline gap-2">
            <span class="text-xs font-mono text-muted">
              #{{ index + 1 }}
            </span>
            <ULink
              :to="post.url"
              target="_blank"
              class="text-sm font-medium break-all"
            >
              {{ post.url }}
            </ULink>
          </div>

          <div>
            <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">
              渲染預覽（v-html）
            </p>
            <div
              class="min-h-[120px] rounded-md border border-dashed border-default p-3 overflow-x-auto"
            >
              <div v-html="post.html" />
            </div>
          </div>

          <details class="group">
            <summary
              class="cursor-pointer text-sm font-medium text-muted hover:text-highlighted list-none flex items-center gap-2"
            >
              <UIcon
                name="i-lucide-chevron-right"
                class="size-4 transition-transform group-open:rotate-90"
              />
              原始 HTML
            </summary>
            <pre class="mt-3 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs leading-relaxed whitespace-pre-wrap break-words">{{ post.html }}</pre>
          </details>
        </section>
      </div>
    </template>
  </div>
</template>
