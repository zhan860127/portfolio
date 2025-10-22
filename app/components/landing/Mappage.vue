
<script setup lang="ts">

const svgRef = ref<InstanceType<typeof LandingMap> | null>(null)

onMounted(() => {   
  if (svgRef.value) {
    // 拿到原生 svg DOM
    const svgEl = (svgRef.value as any).$el as SVGSVGElement
    const north = svgEl.querySelectorAll('#TWHSQ') 
    for(let k of north){
        k.classList.add("lable")
        k.classList.add("show")

    }
  }
})
</script>

<template>
    <UPageSection
      :ui="{
        container: '!pt-0 lg:grid lg:gap-8 w-full'
      }"
    >
    <LandingMap class="w-full" ref = "svgRef">

    </LandingMap>
</UPageSection>
</template>
<style >
.lable{
    fill:#a7be8c !important;
   opacity: 0;
  transition: all 0.6s ease-out;
}
.lable.show {
  opacity: 1;

}
</style>
