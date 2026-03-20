import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { PermissionAction, PermissionModuleId } from '@/constants/permission-modules'
import { PERMISSION_MODULES } from '@/constants/permission-modules'
import { fetchMyProjectPermissions } from '@/api/project-permissions'
import type { ModulePermissionFlags } from '@/types/permissions'

function emptyFlags(): ModulePermissionFlags {
  return { canCreate: false, canRead: false, canUpdate: false, canDelete: false }
}

function actionAllowed(flags: ModulePermissionFlags | undefined, action: PermissionAction): boolean {
  if (!flags) return false
  switch (action) {
    case 'create':
      return flags.canCreate
    case 'read':
      return flags.canRead
    case 'update':
      return flags.canUpdate
    case 'delete':
      return flags.canDelete
    default:
      return false
  }
}

export const useProjectPermissionsStore = defineStore('projectPermissions', () => {
  /** projectId → 各模組權限 */
  const modulesByProjectId = shallowRef<Record<string, Partial<Record<PermissionModuleId, ModulePermissionFlags>>>>(
    {}
  )
  const inFlight = ref<Record<string, Promise<void> | undefined>>({})

  function can(projectId: string, module: PermissionModuleId, action: PermissionAction): boolean {
    const row = modulesByProjectId.value[projectId]?.[module]
    return actionAllowed(row, action)
  }

  async function ensureLoaded(projectId: string): Promise<void> {
    if (!projectId) return
    if (modulesByProjectId.value[projectId]) return
    const existing = inFlight.value[projectId]
    if (existing) return existing

    const p = (async () => {
      try {
        const raw = await fetchMyProjectPermissions(projectId)
        const normalized: Partial<Record<PermissionModuleId, ModulePermissionFlags>> = {}
        for (const m of PERMISSION_MODULES) {
          const r = raw[m]
          normalized[m] = r ?? emptyFlags()
        }
        modulesByProjectId.value = { ...modulesByProjectId.value, [projectId]: normalized }
      } catch {
        const denied: Partial<Record<PermissionModuleId, ModulePermissionFlags>> = {}
        for (const m of PERMISSION_MODULES) {
          denied[m] = emptyFlags()
        }
        modulesByProjectId.value = { ...modulesByProjectId.value, [projectId]: denied }
      } finally {
        const next = { ...inFlight.value }
        delete next[projectId]
        inFlight.value = next
      }
    })()

    inFlight.value = { ...inFlight.value, [projectId]: p }
    return p
  }

  function invalidateProject(projectId: string) {
    const next = { ...modulesByProjectId.value }
    delete next[projectId]
    modulesByProjectId.value = next
  }

  function clearAll() {
    modulesByProjectId.value = {}
    inFlight.value = {}
  }

  return {
    modulesByProjectId,
    can,
    ensureLoaded,
    invalidateProject,
    clearAll,
  }
})
