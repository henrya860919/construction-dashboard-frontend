import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 電子表單 Builder 麵包屑最後一層標題 */
export const useElectronicFormBuilderBreadcrumbStore = defineStore(
  'electronicFormBuilderBreadcrumb',
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
