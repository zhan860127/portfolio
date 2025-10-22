
<script setup lang="ts">

const svgRef = ref<InstanceType<typeof LandingMap> | null>(null)

onMounted(() => {


  if (svgRef.value) {
    // 拿到原生 svg DOM
    const svgEl = (svgRef.value as any).$el as SVGSVGElement
    const north = svgEl.querySelectorAll('#TWHSQ')
    console.log(north)
    for(let k of north){
        k.setAttribute('fill', 'blue')
    }
    console.log(TWKIN)
  
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

