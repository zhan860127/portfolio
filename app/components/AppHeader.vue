<script setup lang="ts">
import { useCartStore } from '~/stores/cart'

const cartStore = useCartStore()
const { loggedIn, user, clear } = useUserSession()
const loginLink = useLoginLink()

const navItems = [
  { label: 'Home', to: '/' },
  // { label: 'About', to: '/about' },
  // { label: 'Projects', to: '/projects' },
  // { label: 'Speaking', to: '/speaking' },
  // { label: 'Blog', to: '/blog' },
  { label: '市集', to: '/market' },
  { label: 'Products', to: '/products' },
  { label: 'My Orders', to: '/orders' }
]

// 後台入口只是顯示與否，真正的授權在伺服器端的 requireAdminUser
const isAdmin = computed(() => user.value?.role === 'admin')
</script>

<template>
  <!-- max-w 讓導覽列在窄螢幕不會超出畫面；放不下時整列可以水平捲動，而不是被切掉 -->
  <div class="fixed top-2 sm:top-4 mx-auto left-1/2 transform -translate-x-1/2 z-10 max-w-[calc(100vw-1rem)]">
    <nav
      class="bg-muted/80 backdrop-blur-sm rounded-full px-2 sm:px-4 border border-muted/50 shadow-lg shadow-neutral-950/5 overflow-x-auto"
      style="scrollbar-width: none"
    >
      <div class="flex items-center gap-1 sm:gap-2 w-max">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="whitespace-nowrap px-2 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          active-class="bg-gray-100 dark:bg-gray-800"
        >
          {{ item.label }}
        </NuxtLink>

        <NuxtLink
          v-if="loggedIn"
          to="/cart"
          class="relative px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
          active-class="bg-gray-100 dark:bg-gray-800"
        >
          <UIcon
            name="i-heroicons-shopping-cart"
            class="w-5 h-5"
          />
          <!-- 數量改由 localStorage 還原，SSR 階段取不到；不包 ClientOnly 會 hydration mismatch -->
          <ClientOnly>
            <span
              v-if="cartStore.itemCount > 0"
              class="absolute -top-1 -right-1 bg-primary-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center"
            >
              {{ cartStore.itemCount }}
            </span>
          </ClientOnly>
        </NuxtLink>

        <ColorModeButton />

        <div
          v-if="loggedIn"
          class="flex items-center gap-2 ml-2"
        >
          <NuxtLink
            v-if="isAdmin"
            to="/admin/market"
            class="px-2 py-2 rounded-md text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="後台管理"
          >
            <UIcon
              name="i-lucide-settings"
              class="w-4 h-4"
            />
          </NuxtLink>
          <NuxtLink
            to="/me"
            aria-label="我的市集"
          >
            <UAvatar
              :src="user?.avatar ?? undefined"
              :alt="user?.name ?? undefined"
              size="xs"
            />
          </NuxtLink>
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-heroicons-arrow-right-on-rectangle"
            @click="clear"
          />
        </div>
        <UButton
          v-else
          :to="loginLink"
          external
          icon="i-simple-icons-google"
          color="neutral"
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
