<script setup lang="ts">
// LandingMap 是自動匯入的元件，script 區段拿不到它的值，無法用 typeof 取型別；
// 這裡只需要存取底層的 <svg> 元素，所以直接描述用得到的形狀就夠了。
const svgRef = ref<{ $el: SVGSVGElement } | null>(null)
const scheduleStore = useScheduleStore()

onMounted(async () => {
  await scheduleStore.fetchSchedule()

  if (svgRef.value) {
    // 拿到原生 svg DOM
    const svgEl = svgRef.value.$el
    for (const s of scheduleStore.getSchedule().value) {
      const north = svgEl.querySelectorAll(`#${s.id}`)

      for (const k of north) {
        k.classList.add('lable')
        k.classList.add('show')
      }
    }
  }
})
</script>

<template>
  <UPageSection
    :ui="{
      container: '!pt-0 lg:grid lg:gap-8  lg:grid-cols-2 center'
    }"
  >
    <slot />
    <LandingMap
      ref="svgRef"
      class=""
    />
  </UPageSection>
</template>

<style>
.lable{
    fill:#a7be8c !important;
   opacity: 0;
  transition: all 0.6s ease-out;
}
.lable.show {
  opacity: 1;

}
</style>
