<script setup lang="ts">
/**
 * 全螢幕沉浸式版面，給線上市集的商品瀏覽器用。
 *
 * 預設版面把所有內容包在 UContainer 裡並固定一個置頂導覽列，
 * 那會讓全螢幕瀏覽器被限寬、又被導覽列擋住頂部進度條，
 * 所以這裡不套用任何容器與導覽，由頁面自己填滿視窗。
 */
</script>

<template>
  <div class="min-h-dvh bg-white">
    <slot />
  </div>
</template>
