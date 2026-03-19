import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  BREADCRUMB_LABELS,
  BREADCRUMB_PROJECT_SUFFIX_LABELS,
  getBreadcrumbModuleForSuffix,
} from '@/constants/breadcrumb'
import { useDeviceBreadcrumbStore } from '@/stores/deviceBreadcrumb'
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
  const projectStore = useProjectStore()

  const tenantStore = useTenantStore()

  const items = computed<BreadcrumbItem[]>(() => {
    const path = route.path
    if (!path || path === '/') {
      return [{ label: BREADCRUMB_LABELS['/'] ?? '首頁' }]
    }

    const segments = path.split('/').filter(Boolean)

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
        let pageLabel =
          BREADCRUMB_PROJECT_SUFFIX_LABELS[suffix] ??
          rest[rest.length - 1]
        if (isDeviceDetail && deviceBreadcrumbStore.currentDeviceName) {
          pageLabel = deviceBreadcrumbStore.currentDeviceName
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
