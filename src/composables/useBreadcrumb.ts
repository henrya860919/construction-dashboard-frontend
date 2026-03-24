import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  BREADCRUMB_LABELS,
  BREADCRUMB_PROJECT_SUFFIX_LABELS,
  getBreadcrumbModuleForSuffix,
} from '@/constants/breadcrumb'
import { useDeviceBreadcrumbStore } from '@/stores/deviceBreadcrumb'
import { useConstructionDailyLogBreadcrumbStore } from '@/stores/constructionDailyLogBreadcrumb'
import {
  formatLogDateForBreadcrumb,
  parseConstructionDailyLogDetailFromPath,
  readDailyLogBreadcrumbDateFromHistory,
  readDailyLogBreadcrumbDateFromSession,
} from '@/lib/construction-daily-log-breadcrumb'
import { useRepairBreadcrumbStore } from '@/stores/repairBreadcrumb'
import { useSelfInspectionTemplateBreadcrumbStore } from '@/stores/selfInspectionTemplateBreadcrumb'
import { useSelfCheckBreadcrumbStore } from '@/stores/selfCheckBreadcrumb'
import { useProjectStore } from '@/stores/project'
import { useTenantStore } from '@/stores/tenant'

import type { BreadcrumbItem } from '@/types'

export type { BreadcrumbItem }

/**
 * 依當前路由 path 組出麵包屑
 * - 首頁 /：首頁
 * - /projects：首頁 > 專案列表
 * - /p/:projectId/...：首頁 > 專案列表 > [專案名稱] > [頁面名稱]
 * - 設備詳情最後一層使用 store 的設備名稱
 */
export function useBreadcrumb() {
  const route = useRoute()
  const deviceBreadcrumbStore = useDeviceBreadcrumbStore()
  const constructionDailyLogBreadcrumbStore = useConstructionDailyLogBreadcrumbStore()
  const repairBreadcrumbStore = useRepairBreadcrumbStore()
  const selfInspectionTemplateBreadcrumbStore = useSelfInspectionTemplateBreadcrumbStore()
  const selfCheckBreadcrumbStore = useSelfCheckBreadcrumbStore()
  const projectStore = useProjectStore()

  const tenantStore = useTenantStore()

  watch(
    () => route.path,
    () => {
      const ctx = parseConstructionDailyLogDetailFromPath(route.path)
      if (!ctx) {
        constructionDailyLogBreadcrumbStore.setCurrentTitle(null)
        return
      }
      const ymd =
        readDailyLogBreadcrumbDateFromHistory() ??
        readDailyLogBreadcrumbDateFromSession(ctx.projectId, ctx.logId)
      if (ymd) {
        constructionDailyLogBreadcrumbStore.setCurrentTitle(formatLogDateForBreadcrumb(ymd))
      } else {
        constructionDailyLogBreadcrumbStore.setCurrentTitle(null)
      }
    },
    { immediate: true }
  )

  const items = computed<BreadcrumbItem[]>(() => {
    const path = route.path
    if (!path || path === '/') {
      return [{ label: BREADCRUMB_LABELS['/'] ?? '首頁' }]
    }

    const segments = path.split('/').filter(Boolean)

    // 租戶後台：自主檢查樣板詳情 /admin/self-inspection-templates/:templateId
    if (
      segments[0] === 'admin' &&
      segments[1] === 'self-inspection-templates' &&
      segments.length === 3
    ) {
      const templateName =
        selfInspectionTemplateBreadcrumbStore.currentTitle ?? '樣板詳情'
      return [
        { label: BREADCRUMB_LABELS['/'] ?? '首頁', to: '/' },
        { label: BREADCRUMB_LABELS['/admin'] ?? '後台', to: '/admin/projects' },
        {
          label: BREADCRUMB_LABELS['/admin/self-inspection-templates'] ?? '自主檢查樣板',
          to: '/admin/self-inspection-templates',
        },
        { label: templateName },
      ]
    }

    // 平台方租戶管理詳情：/platform-admin/tenants/:tenantId
    if (segments[0] === 'platform-admin' && segments[1] === 'tenants' && segments.length === 3) {
      const tenantName = tenantStore.currentTenantName ?? segments[2]
      return [
        { label: BREADCRUMB_LABELS['/'] ?? '首頁', to: '/' },
        { label: BREADCRUMB_LABELS['/platform-admin/tenants'] ?? '租戶管理', to: '/platform-admin/tenants' },
        { label: tenantName },
      ]
    }

    // 專案內路徑：/p/:projectId/...
    if (segments[0] === 'p' && segments.length >= 2) {
      const projectId = segments[1]
      const rest = segments.slice(2)
      const suffix = rest.length ? `/${rest.join('/')}` : ''
      const projectName = projectStore.currentProjectName ?? projectId
      const toProject = `/p/${projectId}`

      const result: BreadcrumbItem[] = [
        { label: BREADCRUMB_LABELS['/'] ?? '首頁', to: '/' },
        { label: BREADCRUMB_LABELS['/projects'] ?? '專案列表', to: '/projects' },
        { label: projectName, to: toProject },
      ]

      if (rest.length > 0) {
        const isDeviceDetail =
          rest[0] === 'monitoring' && rest[1] === 'devices' && rest.length === 3
        const isDefectDetail =
          rest[0] === 'construction' && rest[1] === 'defects' && rest.length === 3
        const isRepairRecordDetail =
          rest[0] === 'repair' && rest[1] === 'records' && rest.length === 3
        const isSelfCheckSub =
          rest[0] === 'construction' && rest[1] === 'self-check' && rest.length >= 3
        let pageLabel =
          BREADCRUMB_PROJECT_SUFFIX_LABELS[suffix] ??
          rest[rest.length - 1]
        if (isDeviceDetail && deviceBreadcrumbStore.currentDeviceName) {
          pageLabel = deviceBreadcrumbStore.currentDeviceName
        }
        if (isDefectDetail) {
          pageLabel = '缺失詳情'
        }
        if (isRepairRecordDetail) {
          pageLabel = repairBreadcrumbStore.currentTitle ?? '報修詳情'
        }
        if (isSelfCheckSub) {
          if (rest.length === 3) {
            pageLabel = selfCheckBreadcrumbStore.templateTitle ?? rest[2]
          } else if (rest.length === 4 && rest[3] === 'new') {
            pageLabel = '新增查驗紀錄'
          } else if (rest.length === 5 && rest[3] === 'records') {
            pageLabel = '查驗紀錄詳情'
          }
        }
        const isPccesDetail =
          rest[0] === 'construction' &&
          rest[1] === 'diary' &&
          rest[2] === 'pcces' &&
          rest[3] === 'versions' &&
          rest.length === 5
        if (isPccesDetail) {
          pageLabel = '工項明細'
        }
        const isValuationDetail =
          rest[0] === 'construction' &&
          rest[1] === 'diary' &&
          rest[2] === 'valuations' &&
          rest.length === 4 &&
          rest[3] !== 'new'
        if (isValuationDetail) {
          pageLabel = '估驗明細'
        }
        const dailyLogReserved = new Set(['new', 'valuations', 'pcces'])
        const isDailyLogDetail =
          rest[0] === 'construction' &&
          rest[1] === 'diary' &&
          rest.length === 3 &&
          !dailyLogReserved.has(rest[2])
        if (isDailyLogDetail) {
          pageLabel = constructionDailyLogBreadcrumbStore.currentTitle ?? '…'
        }
        const moduleName = getBreadcrumbModuleForSuffix(suffix)
        if (moduleName) {
          result.push({ label: moduleName })
        }
        result.push({ label: pageLabel })
      }

      return result
    }

    // 非專案內：依 path 一層一層對 BREADCRUMB_LABELS
    const result: BreadcrumbItem[] = []
    let acc = ''
    for (let i = 0; i < segments.length; i++) {
      acc += `/${segments[i]}`
      const label = BREADCRUMB_LABELS[acc] ?? segments[i]
      result.push(
        i === segments.length - 1 ? { label } : { label, to: acc },
      )
    }

    const homeLabel = BREADCRUMB_LABELS['/'] ?? '首頁'
    return [{ label: homeLabel, to: '/' }, ...result]
  })

  return { items }
}
