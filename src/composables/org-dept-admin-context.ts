import type { InjectionKey, ComputedRef } from 'vue'
import type { OrgDeptTreeNode } from '@/api/organization'

export type OrgDeptAdminContext = {
  disabled: ComputedRef<boolean>
  edit: (node: OrgDeptTreeNode) => void
  delete: (node: OrgDeptTreeNode) => void
}

export const orgDeptAdminKey: InjectionKey<OrgDeptAdminContext> = Symbol('orgDeptAdmin')
