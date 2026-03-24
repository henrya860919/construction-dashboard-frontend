import { defineStore } from 'pinia'
import { ref } from 'vue'

/** 手機自主檢查：頂欄顯示目前樣板名稱（子頁設定） */
export const useMobileSelfInspectionNavStore = defineStore('mobileSelfInspectionNav', () => {
  const templateTitle = ref('')

  function setTemplateTitle(title: string | null) {
    templateTitle.value = title?.trim() ?? ''
  }

  return { templateTitle, setTemplateTitle }
})
