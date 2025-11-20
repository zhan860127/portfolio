<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

import { useCartStore } from '~/stores/cart'

const cartStore = useCartStore()
const { loggedIn, user, clear } = useUserSession()

const navItems = [
  { label: 'Home', to: '/' },
  { label: 'About', to: '/about' },
  { label: 'Projects', to: '/projects' },
  { label: 'Speaking', to: '/speaking' },
  { label: 'Blog', to: '/blog' }
]
</script>

<template>
  <div class="fixed top-2 sm:top-4 mx-auto left-1/2 transform -translate-x-1/2 z-10">
    <nav
      class="bg-muted/80 backdrop-blur-sm rounded-full px-2 sm:px-4 border border-muted/50 shadow-lg shadow-neutral-950/5"
    >
      <div class="flex items-center gap-2">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          active-class="bg-gray-100 dark:bg-gray-800"
        >
          {{ item.label }}
        </NuxtLink>

        <NuxtLink
          to="/products"
          class="px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          active-class="bg-gray-100 dark:bg-gray-800"
        >
          Products
        </NuxtLink>

        <NuxtLink
          to="/cart"
          class="relative px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          active-class="bg-gray-100 dark:bg-gray-800"
        >
          <UIcon name="i-heroicons-shopping-cart" class="w-5 h-5" />
          <span
            v-if="cartStore.itemCount > 0"
            class="absolute -top-1 -right-1 bg-primary-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center"
          >
            {{ cartStore.itemCount }}
          </span>
        </NuxtLink>

        <ColorModeButton />
        
        <div v-if="loggedIn" class="flex items-center gap-2 ml-2">
          <UAvatar :src="user?.avatar" :alt="user?.name" size="xs" />
          <UButton
            color="gray"
            variant="ghost"
            size="xs"
            icon="i-heroicons-arrow-right-on-rectangle"
            @click="clear"
          />
        </div>
        <UButton
          v-else
          to="/auth/google"
          external
          icon="i-simple-icons-google"
          color="gray"
          variant="ghost"
          size="xs"
          class="ml-2"
        >
          Login
        </UButton>
      </div>
    </nav>
  </div>
</template>
