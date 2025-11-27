
<script setup lang="ts">

const svgRef = ref<InstanceType<typeof LandingMap> | null>(null)
const scheduleStore = useScheduleStore()

onMounted(async () => {   
   
   await scheduleStore.fetchSchedule() 
  
  if (svgRef.value) {
    // 拿到原生 svg DOM
    const svgEl = (svgRef.value as any).$el as SVGSVGElement
  for(let s of scheduleStore.getSchedule().value){
    const north = svgEl.querySelectorAll(`#${s.id}`) 
    
    for(let k of north){
        k.classList.add("lable")
        k.classList.add("show")

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

    <slot></slot>
    <LandingMap class="" ref = "svgRef">

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
