<script setup lang="ts">
import { useCartStore } from '~/stores/cart'

const cartStore = useCartStore()
const { loggedIn, user, clear } = useUserSession()
const route = useRoute()

const isExpanded = ref(true)
const contentRef = ref<HTMLElement>()
const navRef = ref<HTMLElement>()

function createSpring(stiffness = 300, damping = 26) {
  const current = ref(0)
  let tgt = 0
  let vel = 0
  let raf: number | null = null

  function tick() {
    const dx = current.value - tgt
    vel += (-stiffness * dx - damping * vel) / 60
    current.value += vel / 60
    if (Math.abs(vel) < 0.1 && Math.abs(dx) < 0.5) {
      current.value = tgt
      vel = 0
      raf = null
      return
    }
    raf = requestAnimationFrame(tick)
  }

  return {
    current,
    animateTo(v: number) { tgt = v; if (!raf) raf = requestAnimationFrame(tick) },
    snapTo(v: number) { tgt = v; current.value = v; vel = 0; if (raf) { cancelAnimationFrame(raf); raf = null } },
    cleanup() { if (raf) cancelAnimationFrame(raf) }
  }
}

const widthSpring = createSpring(300, 26)
const offsetSpring = createSpring(200, 24)

function measure() {
  const el = contentRef.value
  if (!el) return 0
  const prev = el.style.width
  el.style.width = 'auto'
  const w = el.scrollWidth
  el.style.width = prev
  return w
}

function isMobile() { return window.innerWidth < 640 }

function btnWidth() {
  return navRef.value?.querySelector('button')?.offsetWidth ?? 32
}

function capWidth(raw: number) {
  const pad = isMobile() ? 12 : 16
  return Math.min(raw, window.innerWidth - pad * 2 - btnWidth())
}

function centerOffset(contentW: number) {
  if (isMobile()) return 0
  const pad = 16
  return Math.max(0, (window.innerWidth - btnWidth() - contentW) / 2 - pad)
}

function apply(open: boolean, snap = false) {
  const w = open ? capWidth(measure()) : 0
  const x = open ? centerOffset(w) : 0
  if (snap) { widthSpring.snapTo(w); offsetSpring.snapTo(x) }
  else { widthSpring.animateTo(w); offsetSpring.animateTo(x) }
}

watch(isExpanded, (open) => apply(open))
watch(loggedIn, () => { if (isExpanded.value) nextTick(() => apply(true)) })

onMounted(() => {
  nextTick(() => {
    if (isMobile()) { isExpanded.value = false; apply(false, true) }
    else { apply(true, true) }
  })
})

watch(() => route.fullPath, () => {
  if (import.meta.client && isMobile()) isExpanded.value = false
})

onUnmounted(() => { widthSpring.cleanup(); offsetSpring.cleanup() })

const { t, locale, locales, setLocale } = useI18n()

const availableLocales = computed(() =>
  (locales.value as Array<{ code: string; name: string }>).filter(l => l.code !== locale.value)
)

async function switchLocale() {
  const next = availableLocales.value[0]
  if (next) {
    await setLocale(next.code as 'zh-TW' | 'en')
    await nextTick()
    requestAnimationFrame(() => {
      if (isExpanded.value) apply(true)
    })
  }
}

const localeName = computed(() => locale.value === 'zh-TW' ? '中' : 'EN')

const navItems = computed(() => [
  { label: t('nav.home'), to: '/' },
  { label: t('nav.products'), to: '/products' },
  { label: t('nav.orders'), to: '/orders' }
])
</script>

<template>
  <div class="fixed top-2 sm:top-4 inset-x-0 z-10 flex justify-start px-3 sm:px-4 pointer-events-none">
    <nav
      ref="navRef"
      class="pointer-events-auto flex items-center bg-muted/80 backdrop-blur-sm rounded-full border border-muted/50 shadow-lg shadow-neutral-950/5"
      :style="{ transform: `translateX(${offsetSpring.current.value}px)` }"
    >
      <button
        class="relative flex-shrink-0 inline-flex items-center justify-center size-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
        aria-label="Toggle navigation"
        @click="isExpanded = !isExpanded"
      >
        <UIcon name="i-heroicons-bars-3" class="w-5 h-5" />
        <span
          v-if="!isExpanded && loggedIn && cartStore.itemCount > 0"
          class="absolute -top-1 -right-1 bg-primary-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center"
        >
          {{ cartStore.itemCount }}
        </span>
      </button>

      <div
        ref="contentRef"
        class="overflow-hidden scrollbar-hide"
        :style="{ width: widthSpring.current.value + 'px' }"
      >
        <div class="flex items-center gap-1 sm:gap-2 pr-2">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 whitespace-nowrap"
            active-class="bg-gray-100 dark:bg-gray-800"
          >
            {{ item.label }}
          </NuxtLink>

          <NuxtLink
            v-if="loggedIn"
            to="/cart"
            class="relative flex-shrink-0 inline-flex items-center justify-center size-8 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
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

          <button
            class="flex-shrink-0 inline-flex items-center justify-center size-8 rounded-full text-xs font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            @click="switchLocale"
          >
            {{ localeName }}
          </button>

          <div v-if="loggedIn" class="flex items-center gap-2 flex-shrink-0 ml-1">
            <UAvatar :src="user?.avatar" :alt="user?.name" size="xs" />
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
            to="/auth/google"
            external
            icon="i-simple-icons-google"
            color="neutral"
            variant="ghost"
            size="xs"
            class="ml-1 flex-shrink-0"
          >
            {{ $t('nav.login') }}
          </UButton>
        </div>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
