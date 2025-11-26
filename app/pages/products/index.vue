<script setup lang="ts">
import { useProductStore } from '~/stores/product';


const productStore = useProductStore()

await productStore.fetchProducts('1iBbMtTjMyZfOpHtZti2wdfqbi49V46FWsu6qIKCO0Ug', 'product')

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
              :src="product.image"
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
