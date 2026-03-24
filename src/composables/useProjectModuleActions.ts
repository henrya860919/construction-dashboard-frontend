import { computed, type MaybeRefOrGetter } from 'vue'
import type { PermissionModuleId } from '@/constants/permission-modules'
import { useProjectPermission } from '@/composables/useProjectPermission'

/** 專案內單一模組的 create/read/update/delete（與後端 assertProjectModuleAction 對齊） */
export function useProjectModuleActions(
  projectId: MaybeRefOrGetter<string | undefined | null>,
  module: PermissionModuleId
) {
  const { can } = useProjectPermission(projectId)
  return {
    canRead: computed(() => can(module, 'read')),
    canCreate: computed(() => can(module, 'create')),
    canUpdate: computed(() => can(module, 'update')),
    canDelete: computed(() => can(module, 'delete')),
  }
}
