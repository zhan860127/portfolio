<script setup lang="ts">
import { useProductStore } from '~/stores/product'
import { useCartStore } from '~/stores/cart'
import { storeToRefs } from 'pinia'

const { t } = useI18n()
const route = useRoute()
const cartStore = useCartStore()
const productStore = useProductStore()
const toast = useToast()
const { products } = storeToRefs(productStore)

// Ensure products are fetched if navigating directly
if (products.value.length === 0) {
    await productStore.fetchProducts('product')
}

const product = computed(() => {
  const id = route.params.id as string
  return products.value.find((p) => p.id === id)
})

useHead({
  title: product.value?.title || t('products.notFound'),
  meta: [
    { name: 'description', content: product.value?.description || t('products.description') }
  ]
})
const { loggedIn } = useUserSession()
function addToCart() {

  if (!loggedIn.value) {
    navigateTo('/auth/google', { external: true })
    return;
  }
  if (product.value) {
    cartStore.addToCart(product.value)
    toast.add({
      title: t('products.addedToCart'),
      description: t('products.addedToCartDesc', { title: product.value.title }),
      icon: 'i-heroicons-check-circle',
      color: 'success'
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
          

              <UCarousel 
              v-slot="{ item }"  
              loop
              arrows
              dots
              :autoplay="{ delay: 3000 }"

              :items="product.image" class="w-full max-w-xs mx-auto" >
            <img
              :src="item.src"
              :alt="product.title"
              class="w-full h-full object-center object-cover rounded-lg"
              
            >
          </UCarousel>
          
        </div>

        <!-- Product info -->
        <div class="mt-10 px-4 sm:px-0 sm:mt-16 lg:mt-0">
          <h1 class="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {{ product.title }}
          </h1>

          <div class="mt-3">
            <h2 class="sr-only">
              {{ $t('products.productInfo') }}
            </h2>
            <p class="text-3xl text-gray-900 dark:text-white">
              ${{ product.price }}
            </p>
          </div>

          <div class="mt-6">
            <h3 class="sr-only">
              {{ $t('products.description') }}
            </h3>
            <div class="text-base text-gray-700 dark:text-gray-300 space-y-6">
              <p>{{ product.description }}</p>
            </div>
          </div>

          <div class="mt-10 flex">
            <UButton
              size="xl"
              @click="addToCart()"
            >
              {{ $t('products.addToCart') }}
            </UButton>
          </div>
        </div>
      </div>

      <div v-else class="text-center py-12">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-white">
          {{ $t('products.notFound') }}
        </h2>
        <div class="mt-6">
          <UButton to="/products">
            {{ $t('products.backToProducts') }}
          </UButton>
        </div>
      </div>
    </div>
  </div>
</template>
