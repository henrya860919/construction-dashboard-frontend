import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { PermissionAction, PermissionModuleId } from '@/constants/permission-modules'
import { permissionModuleForProjectPath } from '@/constants/permission-modules'
import { useProjectPermissionsStore } from '@/stores/projectPermissions'
import { useAuthStore } from '@/stores/auth'

/**
 * 專案內權限（對齊後端 my-permissions）。
 * platform_admin 前端視為全開（與後端略過一致）；其餘角色（含 tenant_admin）依 store，並受租戶模組開通與後端遮罩影響。
 */
export function useProjectPermission(projectId: MaybeRefOrGetter<string | undefined | null>) {
  const store = useProjectPermissionsStore()
  const auth = useAuthStore()

  const pid = computed(() => toValue(projectId) ?? null)

  function can(module: PermissionModuleId, action: PermissionAction): boolean {
    const id = pid.value
    if (!id) return false
    if (auth.isPlatformAdmin) return true
    return store.can(id, module, action)
  }

  function canReadPath(pathSuffix: string): boolean {
    const mod = permissionModuleForProjectPath(pathSuffix)
    return can(mod, 'read')
  }

  return { can, canReadPath, pid }
}
