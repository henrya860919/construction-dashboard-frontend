import axios, { type AxiosInstance } from 'axios'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'

const baseURL = import.meta.env.VITE_API_URL ?? ''

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const auth = useAuthStore()
  const token = auth.accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const auth = useAuthStore()
      const adminStore = useAdminStore()
      auth.clearAuth()
      adminStore.clearSelectedTenantId()
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    // 維護模式：503 + code MAINTENANCE 時保留 API 回傳訊息供畫面顯示
    if (error.response?.status === 503 && error.response?.data?.error?.code === 'MAINTENANCE') {
      error.message = error.response?.data?.error?.message ?? '系統維護中，請稍後再試。'
    }
    return Promise.reject(error)
  }
)
