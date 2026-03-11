import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'
import { ROUTE_PATH } from '@/constants'

/**
 * 登入狀態與登出，供 views 使用
 */
export function useAuth() {
  const auth = useAuthStore()
  const router = useRouter()

  function logout() {
    auth.clearAuth()
    router.push(ROUTE_PATH.LOGIN)
  }

  return {
    isAuthenticated: auth.isAuthenticated,
    accessToken: auth.accessToken,
    setToken: auth.setToken,
    clearAuth: auth.clearAuth,
    logout,
  }
}
