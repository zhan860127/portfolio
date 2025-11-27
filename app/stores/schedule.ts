import { defineStore } from 'pinia'

interface ScheduleResource {
    id: string,
    city: string,
    time: string,
}



export const useScheduleStore = defineStore('schedule', () => {
    const schedule = ref<ScheduleResource[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    // 取得圖片列表
    const fetchSchedule = async () => {

        if (schedule.value.length > 0) {
            return // 如果已經有圖片就不重複獲取
        }

        loading.value = true
        error.value = null

        try {
            const data = await $fetch<string[][]>('/api/getSheet', {
                query: { range: "schedule" }
            })

            const scheduledata = data.map(element => {
                return {
                    id: element[0] ?? '',
                    city: element[1] ?? '',
                    time: element[2] ?? '',
                }
            });

            if (scheduledata) {
                schedule.value = scheduledata
            }
        } catch (err) {
            error.value = 'Failed to fetch schedule from Google Sheet'
            console.error('Google Sheet fetch error:', err)
        } finally {
            loading.value = false
        }
    }


    const getSchedule = () => {
        return computed(() => {
            // 如果 folder 有指定，就只回傳那個資料夾的圖片
            return schedule.value
        })
    }



    return {
        schedule,
        loading,
        error,
        fetchSchedule,
        getSchedule,
    }
})