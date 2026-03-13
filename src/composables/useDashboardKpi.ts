import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getProject } from '@/api/project'
import type { ProjectInfoKpi, ProgressKpi, BudgetKpi } from '@/types/dashboard'

const DEFAULT_PROJECT_INFO: ProjectInfoKpi = {
  cumulativeDays: 0,
  startDate: '—',
  plannedCompletionDate: '—',
}

function formatDateDisplay(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/** 從開工日到今天的累積天數（含今天）；若未開工或無 startDate 則為 0 */
function computeCumulativeDays(startDateIso: string | null): number {
  if (!startDateIso) return 0
  const start = new Date(startDateIso)
  if (Number.isNaN(start.getTime())) return 0
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const diffMs = today.getTime() - start.getTime()
  if (diffMs < 0) return 0
  return Math.floor(diffMs / (24 * 60 * 60 * 1000))
}

export function useDashboardKpi() {
  const route = useRoute()
  const projectInfo = ref<ProjectInfoKpi>({ ...DEFAULT_PROJECT_INFO })
  const progress: ProgressKpi = {
    overallPercent: 0,
    plannedProgressPercent: 0,
    actualProgressPercent: 0,
  }
  const budget: BudgetKpi = {
    executedAmount: 0,
    approvedBudget: 0,
    executionRatePercent: 0,
  }

  const projectId = computed(() => route.params.projectId as string | undefined)

  async function loadProjectInfo(id: string) {
    try {
      const project = await getProject(id)
      if (!project) {
        projectInfo.value = { ...DEFAULT_PROJECT_INFO }
        return
      }
      // 預定竣工：以工期調整後（revisedEndDate）為準，無則用原訂（plannedEndDate）
      const effectivePlannedEnd = project.revisedEndDate ?? project.plannedEndDate
      projectInfo.value = {
        cumulativeDays: computeCumulativeDays(project.startDate),
        startDate: formatDateDisplay(project.startDate),
        plannedCompletionDate: formatDateDisplay(effectivePlannedEnd),
      }
    } catch {
      projectInfo.value = { ...DEFAULT_PROJECT_INFO }
    }
  }

  watch(projectId, (id) => {
    if (id) loadProjectInfo(id)
    else projectInfo.value = { ...DEFAULT_PROJECT_INFO }
  }, { immediate: true })

  onMounted(() => {
    if (projectId.value) loadProjectInfo(projectId.value)
  })

  return {
    projectInfo,
    progress,
    budget,
  }
}
