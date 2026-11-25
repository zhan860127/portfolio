<script setup lang="ts">
import { useProductStore } from '~/stores/product';


const productStore = useProductStore()

// 包進 useAsyncData，讓這次抓取跟著路由的生命週期走：進 SSR payload、
// 重複呼叫會去重、離開頁面時取消，而不是在 setup 裡裸奔一個 await。
//
// 注意這樣「不會」讓換頁完全不發請求 —— Nuxt 預設仍會在每次導航時重跑 handler。
// 真正把那 300～360ms 拿掉的是 /api/getSheet 的伺服器端快取。
// 想連請求都省掉的話要自己給 getCachedData，代價是整個 SPA 連線期間都不會更新。
await useAsyncData('products-product', () => productStore.fetchProducts('product'))

useHead({
  title: 'Products',
  meta: [
    { name: 'description', content: 'Browse our collection of premium products.' }
  ]
})
</script>

<template>
  <div class="py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center mb-12">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl">
          Our Products
        </h1>
        <p class="mt-4 text-lg text-gray-500 dark:text-gray-400">
          Carefully curated items for your lifestyle.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-y-10 gap-x-6 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">
        <NuxtLink
          v-for="product in productStore.products"
          :key="product.id"
          :to="`/products/${product.id}`"
          class="group relative"
        >
          <div class="aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800 xl:aspect-w-7 xl:aspect-h-8">
            <img
              :src="product.image?.[0]?.src"
              :alt="product.title"
              class="h-full w-full object-cover object-center group-hover:opacity-75 transition-opacity duration-300 block"
              onerror="this.style.opacity='0'"

            >
          </div>
          <h3 class="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            {{ product.title }}
          </h3>
          <p class="mt-1 text-lg font-medium text-gray-900 dark:text-white">
            ${{ product.price }}
          </p>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
