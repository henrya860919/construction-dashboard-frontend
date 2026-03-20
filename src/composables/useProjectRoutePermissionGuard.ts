import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useProjectPermissionsStore } from '@/stores/projectPermissions'
import {
  permissionModuleForProjectPath,
  resolvePermissionPathSuffix,
} from '@/constants/permission-modules'
import { buildProjectPath } from '@/constants/routes'

/**
 * 專案內路由：若對當前頁對應模組無 read，導向儀表板或專案列表（platform_admin 略過）
 */
export function useProjectRoutePermissionGuard() {
  const route = useRoute()
  const router = useRouter()
  const authStore = useAuthStore()
  const permStore = useProjectPermissionsStore()

  watch(
    () =>
      [
        route.path,
        authStore.isAuthenticated,
        authStore.user?.systemRole,
      ] as const,
    async ([path, authed, role]) => {
      if (!authed) return
      const m = path.match(/^\/p\/([^/]+)/)
      if (!m) return
      const projectId = m[1]
      if (role === 'platform_admin') return

      await permStore.ensureLoaded(projectId)
      const suffix = resolvePermissionPathSuffix(path)
      const mod = permissionModuleForProjectPath(suffix)
      if (permStore.can(projectId, mod, 'read')) return

      if (permStore.can(projectId, 'project.overview', 'read')) {
        await router.replace(buildProjectPath(projectId, '/dashboard'))
      } else {
        await router.replace('/projects')
      }
    },
    { immediate: true }
  )
}
