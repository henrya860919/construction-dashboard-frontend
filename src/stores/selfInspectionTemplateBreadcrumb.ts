import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 自主檢查樣板詳情頁麵包屑：顯示樣板名稱 */
export const useSelfInspectionTemplateBreadcrumbStore = defineStore(
  'selfInspectionTemplateBreadcrumb',
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
