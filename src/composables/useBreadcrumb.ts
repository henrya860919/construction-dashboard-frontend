import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { BREADCRUMB_LABELS } from '@/constants/breadcrumb'
import { useDeviceBreadcrumbStore } from '@/stores/deviceBreadcrumb'

export interface BreadcrumbItem {
  label: string
  to?: string
}

/**
 * 依當前路由 path 組出麵包屑項目（首項為首頁，最後一項為當前頁、不帶連結）
 * 設備詳情頁（/monitoring/devices/:deviceId）最後一層使用 store 的設備名稱
 */
export function useBreadcrumb() {
  const route = useRoute()
  const deviceBreadcrumbStore = useDeviceBreadcrumbStore()

  const items = computed<BreadcrumbItem[]>(() => {
    const path = route.path
    if (!path || path === '/') {
      return [{ label: BREADCRUMB_LABELS['/'] ?? '首頁' }]
    }

    const segments = path.split('/').filter(Boolean)
    const result: BreadcrumbItem[] = []
    const isDeviceDetail =
      segments[0] === 'monitoring' && segments[1] === 'devices' && segments.length === 3

    let acc = ''
    for (let i = 0; i < segments.length; i++) {
      acc += `/${segments[i]}`
      let label = BREADCRUMB_LABELS[acc] ?? segments[i]
      if (isDeviceDetail && i === segments.length - 1 && deviceBreadcrumbStore.currentDeviceName) {
        label = deviceBreadcrumbStore.currentDeviceName
      }
      result.push(
        i === segments.length - 1
          ? { label }
          : { label, to: acc },
      )
    }

    if (result.length === 0) {
      return [{ label: BREADCRUMB_LABELS['/'] ?? '首頁' }]
    }

    const homeLabel = BREADCRUMB_LABELS['/'] ?? '首頁'
    return [{ label: homeLabel, to: '/' }, ...result]
  })

  return { items }
}
