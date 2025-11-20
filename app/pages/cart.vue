<script setup lang="ts">
import { useCartStore } from '~/stores/cart'

const cartStore = useCartStore()

useHead({
  title: 'Shopping Cart',
  meta: [
    { name: 'description', content: 'Review your shopping cart.' }
  ]
})

function increment(id: number, currentQuantity: number) {
  cartStore.updateQuantity(id, currentQuantity + 1)
}

function decrement(id: number, currentQuantity: number) {
  cartStore.updateQuantity(id, currentQuantity - 1)
}

function remove(id: number) {
  cartStore.removeFromCart(id)
}
</script>

<template>
  <div class="py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-12">
        Shopping Cart
      </h1>

      <div v-if="cartStore.items.length > 0" class="mt-12 lg:grid lg:grid-cols-12 lg:gap-x-12 lg:items-start xl:gap-x-16">
        <section aria-labelledby="cart-heading" class="lg:col-span-7">
          <h2 id="cart-heading" class="sr-only">
            Items in your shopping cart
          </h2>

          <ul role="list" class="border-t border-b border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            <li v-for="item in cartStore.items" :key="item.id" class="flex py-6 sm:py-10">
              <div class="flex-shrink-0">
                <img
                  :src="item.image"
                  :alt="item.title"
                  class="w-24 h-24 rounded-md object-center object-cover sm:w-48 sm:h-48"
                >
              </div>

              <div class="ml-4 flex-1 flex flex-col justify-between sm:ml-6">
                <div class="relative pr-9 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:pr-0">
                  <div>
                    <div class="flex justify-between">
                      <h3 class="text-sm">
                        <NuxtLink :to="`/products/${item.id}`" class="font-medium text-gray-700 dark:text-gray-200 hover:text-gray-800 dark:hover:text-white">
                          {{ item.title }}
                        </NuxtLink>
                      </h3>
                    </div>
                    <p class="mt-1 text-sm font-medium text-gray-900 dark:text-white">
                      ${{ item.price }}
                    </p>
                  </div>

                  <div class="mt-4 sm:mt-0 sm:pr-9">
                    <div class="flex items-center space-x-3">
                      <UButton
                        icon="i-heroicons-minus"
                        size="xs"
                        color="gray"
                        variant="ghost"
                        @click="decrement(item.id, item.quantity)"
                      />
                      <span class="text-gray-900 dark:text-white font-medium">{{ item.quantity }}</span>
                      <UButton
                        icon="i-heroicons-plus"
                        size="xs"
                        color="gray"
                        variant="ghost"
                        @click="increment(item.id, item.quantity)"
                      />
                    </div>

                    <div class="absolute top-0 right-0">
                      <UButton
                        icon="i-heroicons-trash"
                        size="sm"
                        color="red"
                        variant="ghost"
                        @click="remove(item.id)"
                      >
                        <span class="sr-only">Remove</span>
                      </UButton>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          </ul>
        </section>

        <!-- Order summary -->
        <section
          aria-labelledby="summary-heading"
          class="mt-16 bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-6 sm:p-6 lg:p-8 lg:mt-0 lg:col-span-5"
        >
          <h2 id="summary-heading" class="text-lg font-medium text-gray-900 dark:text-white">
            Order summary
          </h2>

          <dl class="mt-6 space-y-4">
            <div class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
              <dt class="text-base font-medium text-gray-900 dark:text-white">
                Order total
              </dt>
              <dd class="text-base font-medium text-gray-900 dark:text-white">
                ${{ cartStore.cartTotal }}
              </dd>
            </div>
          </dl>

          <div class="mt-6">
            <UButton block size="lg">
              Checkout
            </UButton>
          </div>
        </section>
      </div>

      <div v-else class="text-center py-12">
        <div class="text-center">
          <UIcon name="i-heroicons-shopping-cart" class="mx-auto h-12 w-12 text-gray-400" />
          <h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            Cart is empty
          </h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Start shopping to add items to your cart.
          </p>
          <div class="mt-6">
            <UButton to="/products">
              Continue Shopping
            </UButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
