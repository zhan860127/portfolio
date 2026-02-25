<script setup lang="ts">
import { useOrderStore } from '~/stores/order'

const orderStore = useOrderStore()
const { loggedIn } = useUserSession()

useHead({
  title: 'My Orders',
  meta: [
    { name: 'description', content: 'View your past orders.' }
  ]
})

if (loggedIn.value) {
  await orderStore.fetchOrders()
}
</script>

<template>
  <div class="py-12">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-8">
        My Orders
      </h1>

      <div v-if="!loggedIn" class="text-center py-12">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Please log in to view your orders.
        </p>
        <div class="mt-6">
          <UButton to="/auth/google" external>
            Login with Google
          </UButton>
        </div>
      </div>

      <div v-else>
        <div v-if="orderStore.loading" class="text-center py-12">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Loading your orders...
          </p>
        </div>

        <div v-else-if="orderStore.orders.length === 0" class="text-center py-12">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            You don't have any orders yet.
          </p>
          <div class="mt-6">
            <UButton to="/products">
              Start Shopping
            </UButton>
          </div>
        </div>

        <div v-else class="space-y-4">
          <div
            v-for="(order, index) in orderStore.orders"
            :key="index"
            class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white/80 dark:bg-gray-900/80 shadow-sm"
          >
            <div class="flex items-center justify-between mb-2">
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Order time
                </p>
                <p class="text-sm font-medium text-gray-900 dark:text-white">
                  {{ order.time || 'N/A' }}
                </p>
              </div>
              <div class="text-right">
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Total amount
                </p>
                <p class="text-lg font-semibold text-gray-900 dark:text-white">
                  ${{ order.amount }}
                </p>
              </div>
            </div>

            <div class="mt-3">
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Items
              </p>
              <p class="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-line">
                {{ order.items }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

