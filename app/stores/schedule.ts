import { defineStore } from 'pinia'

interface ScheduleResource {
  id: string
  city: string
  time: string
  marketName: string
  marketUrl: string
}

export const useScheduleStore = defineStore('schedule', () => {
  const schedule = ref<ScheduleResource[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const fetchSchedule = async () => {
    if (schedule.value.length > 0) return

    loading.value = true
    error.value = null

    try {
      const data = await $fetch<string[][]>('/api/getSheet', {
        query: { range: 'schedule' }
      })

      schedule.value = data.map((element) => ({
        id: element[0] ?? '',
        city: element[1] ?? '',
        time: element[3] ?? '',
        marketName: element[4] ?? '',
        marketUrl: element[6] ?? ''
      }))
    } catch (err) {
      error.value = 'Failed to fetch schedule from Google Sheet'
      console.error('Google Sheet fetch error:', err)
    } finally {
      loading.value = false
    }
  }

  return {
    schedule,
    loading,
    error,
    fetchSchedule
  }
})
