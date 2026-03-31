import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'

const baseURL = import.meta.env.VITE_API_URL ?? ''

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// 專門用於 refresh 的裸實例，不經過 apiClient 攔截器，避免 401 循環觸發
const refreshClient = axios.create({ baseURL })

type QueueEntry = { resolve: (token: string) => void; reject: (err: unknown) => void }
let isRefreshing = false
let pendingQueue: QueueEntry[] = []

function drainQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => (error ? reject(error) : resolve(token!)))
  pendingQueue = []
}

function clearAuthAndRedirect() {
  const auth = useAuthStore()
  const adminStore = useAdminStore()
  auth.clearAuth()
  adminStore.clearSelectedTenantId()
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login'
  }
}

apiClient.interceptors.request.use((config) => {
  const auth = useAuthStore()
  const token = auth.accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  // 預設 Content-Type: application/json 不可蓋掉 multipart boundary；FormData 務必讓瀏覽器自帶 boundary
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    const h = config.headers
    if (h && typeof (h as { delete?: (k: string) => void }).delete === 'function') {
      ;(h as { delete: (k: string) => void }).delete('Content-Type')
    } else if (h && typeof h === 'object' && 'Content-Type' in h) {
      delete (h as Record<string, unknown>)['Content-Type']
    }
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 維護模式：503 + code MAINTENANCE 時保留 API 回傳訊息供畫面顯示
    if (error.response?.status === 503 && error.response?.data?.error?.code === 'MAINTENANCE') {
      error.message = error.response?.data?.error?.message ?? '系統維護中，請稍後再試。'
      return Promise.reject(error)
    }

    const originalRequest = error.config as InternalAxiosRequestConfig & { _isRetry?: boolean }

    if (error.response?.status !== 401 || originalRequest._isRetry) {
      return Promise.reject(error)
    }

    const auth = useAuthStore()

    // 沒有 refresh token，直接登出
    if (!auth.refreshToken) {
      clearAuthAndRedirect()
      return Promise.reject(error)
    }

    // 若已有其他請求正在刷新，排隊等待新 token
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        pendingQueue.push({ resolve, reject })
      }).then((newToken) => {
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      })
    }

    originalRequest._isRetry = true
    isRefreshing = true

    try {
      const { data } = await refreshClient.post<{
        data: { accessToken: string; refreshToken: string }
      }>('/api/v1/auth/refresh', { refreshToken: auth.refreshToken })

      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = data.data
      auth.setToken(newAccessToken)
      auth.setRefreshToken(newRefreshToken)
      drainQueue(null, newAccessToken)
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return apiClient(originalRequest)
    } catch (refreshError) {
      drainQueue(refreshError, null)
      clearAuthAndRedirect()
      return Promise.reject(refreshError)
    } finally {
      isRefreshing = false
    }
  }
)
