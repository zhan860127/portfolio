<script setup lang="ts">
import { products } from '~/utils/products'
import { useCartStore } from '~/stores/cart'

const route = useRoute()
const cartStore = useCartStore()
const toast = useToast()

const product = computed(() => {
  const id = Number(route.params.id)
  return products.find((p) => p.id === id)
})

useHead({
  title: product.value?.title || 'Product Not Found',
  meta: [
    { name: 'description', content: product.value?.description || 'Product details' }
  ]
})

function addToCart() {
  if (product.value) {
    cartStore.addToCart(product.value)
    toast.add({
      title: 'Added to cart',
      description: `${product.value.title} has been added to your cart.`,
      icon: 'i-heroicons-check-circle',
      color: 'green'
    })
  }
}
</script>

<template>
  <div class="py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div v-if="product" class="lg:grid lg:grid-cols-2 lg:gap-x-8 lg:items-start">
        <!-- Image gallery -->
        <div class="flex flex-col-reverse">
          <div class="w-full aspect-w-1 aspect-h-1 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
            <img
              :src="product.image"
              :alt="product.title"
              class="w-full h-full object-center object-cover"
            >
          </div>
        </div>

        <!-- Product info -->
        <div class="mt-10 px-4 sm:px-0 sm:mt-16 lg:mt-0">
          <h1 class="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {{ product.title }}
          </h1>

          <div class="mt-3">
            <h2 class="sr-only">
              Product information
            </h2>
            <p class="text-3xl text-gray-900 dark:text-white">
              ${{ product.price }}
            </p>
          </div>

          <div class="mt-6">
            <h3 class="sr-only">
              Description
            </h3>
            <div class="text-base text-gray-700 dark:text-gray-300 space-y-6">
              <p>{{ product.description }}</p>
            </div>
          </div>

          <div class="mt-10 flex sm:flex-col1">
            <UButton
              size="xl"
              block
              @click="addToCart"
            >
              Add to cart
            </UButton>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-12">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
          Product not found
        </h2>
        <div class="mt-6">
          <UButton to="/products">
            Back to Products
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
