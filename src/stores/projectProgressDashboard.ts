import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ProgressDashboardDto } from '@/types/project-progress'

/**
 * 進度管理儀表板快取（依 projectId）。
 * 編輯本期／實際後只打 PUT、合併此暫存，避免每次儲存都 GET；
 * 下次 load（進入頁、切版本、上傳計畫等）再整包刷新。
 */
export const useProjectProgressDashboardStore = defineStore('projectProgressDashboard', () => {
  const dashboards = ref<Record<string, ProgressDashboardDto>>({})

  function setDashboard(projectId: string, data: ProgressDashboardDto) {
    dashboards.value = {
      ...dashboards.value,
      [projectId]: { ...data, planCurves: data.planCurves ?? [] },
    }
  }

  function clearDashboard(projectId: string) {
    if (!(projectId in dashboards.value)) return
    const { [projectId]: _removed, ...rest } = dashboards.value
    dashboards.value = rest
  }

  /** PUT 本期預定成功後，將草稿寫回 periods（不 GET） */
  function applySavedPlanned(projectId: string, plannedDraft: Record<string, string>) {
    const d = dashboards.value[projectId]
    if (!d) return
    const periods = d.periods.map((p) => {
      const raw = (plannedDraft[p.periodDate] ?? '').trim()
      return { ...p, periodPlanned: raw === '' ? null : raw }
    })
    dashboards.value = { ...dashboards.value, [projectId]: { ...d, periods } }
  }

  /** PUT 實際進度成功後，將草稿寫回 periods（不 GET） */
  function applySavedActuals(
    projectId: string,
    actualDraft: Record<string, string>,
    cumulativeActualDraft: Record<string, string>
  ) {
    const d = dashboards.value[projectId]
    if (!d) return
    const periods = d.periods.map((p) => {
      const aRaw = (actualDraft[p.periodDate] ?? '').trim()
      const cum = cumulativeActualDraft[p.periodDate] ?? ''
      return {
        ...p,
        periodActual: aRaw === '' ? null : aRaw,
        cumulativeActual: cum,
      }
    })
    dashboards.value = { ...dashboards.value, [projectId]: { ...d, periods } }
  }

  return {
    dashboards,
    setDashboard,
    clearDashboard,
    applySavedPlanned,
    applySavedActuals,
  }
})
