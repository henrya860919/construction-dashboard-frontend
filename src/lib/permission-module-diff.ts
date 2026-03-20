import { PERMISSION_MODULES, type PermissionModuleId } from '@/constants/permission-modules'
import type { ModulePermissionFlags } from '@/types/permissions'

const empty: ModulePermissionFlags = {
  canCreate: false,
  canRead: false,
  canUpdate: false,
  canDelete: false,
}

/** 與租戶範本／角色預設（baseline）相比，目前矩陣中有差異的模組 id */
export function permissionModulesDifferingFromBaseline(
  current: Partial<Record<PermissionModuleId, ModulePermissionFlags>>,
  baseline: Partial<Record<PermissionModuleId, ModulePermissionFlags>>
): PermissionModuleId[] {
  const out: PermissionModuleId[] = []
  for (const m of PERMISSION_MODULES) {
    const c = current[m] ?? empty
    const b = baseline[m] ?? empty
    if (
      c.canCreate !== b.canCreate ||
      c.canRead !== b.canRead ||
      c.canUpdate !== b.canUpdate ||
      c.canDelete !== b.canDelete
    ) {
      out.push(m)
    }
  }
  return out
}
