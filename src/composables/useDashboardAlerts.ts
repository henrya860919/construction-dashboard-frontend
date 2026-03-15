import { ref, onMounted, onUnmounted } from 'vue'
import { fetchCurrentAlerts } from '@/api/alerts'
import type { AlertItem } from '@/types/dashboard'

const POLL_INTERVAL_MS = 60_000 // 每 1 分鐘重新查詢政府資訊，逾 30 分鐘的警報會由後端過濾消失

export function useDashboardAlerts(projectId?: string) {
  const alerts = ref<AlertItem[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      alerts.value = await fetchCurrentAlerts(projectId)
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? (e instanceof Error ? e.message : '無法載入警報')
      error.value = msg
      alerts.value = []
    } finally {
      loading.value = false
    }
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    load()
    pollTimer = setInterval(load, POLL_INTERVAL_MS)
  })

  onUnmounted(() => {
    if (pollTimer) clearInterval(pollTimer)
  })

  return {
    alerts,
    loading,
    error,
    reload: load,
  }
}
