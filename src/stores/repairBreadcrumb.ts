import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 報修詳情頁麵包屑：客戶／類別等短標題 */
export const useRepairBreadcrumbStore = defineStore('repairBreadcrumb', () => {
  const currentTitle = ref<string | null>(null)

  function setCurrentTitle(title: string | null) {
    currentTitle.value = title
  }

  return {
    currentTitle,
    setCurrentTitle,
  }
})
