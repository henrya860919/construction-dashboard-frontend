import type { PermissionModuleId } from '@/constants/permission-modules'

export type ModulePermissionFlags = {
  canCreate: boolean
  canRead: boolean
  canUpdate: boolean
  canDelete: boolean
}

export type ProjectPermissionsPayload = {
  modules: Record<PermissionModuleId, ModulePermissionFlags> & Record<string, ModulePermissionFlags>
}
