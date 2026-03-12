import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

/**
 * 當前專案脈絡（URL 方案 A：projectId 來自 route.params.projectId）
 * 用於側欄顯示專案名稱、麵包屑、API 帶 projectId 等
 */
export const useProjectStore = defineStore('project', () => {
  /** 專案 id → 名稱（目前 mock；之後可改為 API 或從專案列表 response 快取） */
  const projectNameMap = ref<Record<string, string>>({
    proj1: '示範工程 A',
    proj2: '示範工程 B',
  })

  /** 當前專案 id（由 layout/route 同步，或從專案列表選完寫入） */
  const currentProjectId = ref<string | null>(null)

  /** 當前專案名稱（供側欄、麵包屑顯示） */
  const currentProjectName = computed(() => {
    const id = currentProjectId.value
    if (!id) return null
    return projectNameMap.value[id] ?? id
  })

  function setCurrentProjectId(id: string | null) {
    currentProjectId.value = id
  }

  /** 註冊或更新專案名稱（例如從專案列表 API 取得後寫入） */
  function setProjectName(projectId: string, name: string) {
    projectNameMap.value = { ...projectNameMap.value, [projectId]: name }
  }

  return {
    currentProjectId,
    currentProjectName,
    projectNameMap,
    setCurrentProjectId,
    setProjectName,
  }
})
