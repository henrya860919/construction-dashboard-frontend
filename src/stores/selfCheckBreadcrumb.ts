import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 專案內「自主檢查」子頁麵包屑：樣板名稱 */
export const useSelfCheckBreadcrumbStore = defineStore('selfCheckBreadcrumb', () => {
  const templateTitle = ref<string | null>(null)

  function setTemplateTitle(title: string | null) {
    templateTitle.value = title
  }

  return { templateTitle, setTemplateTitle }
})
