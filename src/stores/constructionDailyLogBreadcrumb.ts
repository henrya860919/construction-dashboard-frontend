import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 施工日誌編輯頁麵包屑：顯示填表日期（非 log id）
 */
export const useConstructionDailyLogBreadcrumbStore = defineStore(
  'constructionDailyLogBreadcrumb',
  () => {
    const currentTitle = ref<string | null>(null)

    function setCurrentTitle(title: string | null) {
      currentTitle.value = title
    }

    return {
      currentTitle,
      setCurrentTitle,
    }
  }
)
