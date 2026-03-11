import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 設備詳情頁麵包屑：當前設備名稱，供 useBreadcrumb 顯示「監測 > 設備 > [設備名稱]」
 */
export const useDeviceBreadcrumbStore = defineStore('deviceBreadcrumb', () => {
  const currentDeviceName = ref<string | null>(null)

  function setCurrentDeviceName(name: string | null) {
    currentDeviceName.value = name
  }

  return {
    currentDeviceName,
    setCurrentDeviceName,
  }
})
