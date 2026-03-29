import type { InjectionKey } from 'vue'
import type { OrgDeptTreeNode } from '@/api/organization'

export type OrgDeptDetailContext = {
  openDetail: (node: OrgDeptTreeNode) => void
}

export const orgDeptDetailKey: InjectionKey<OrgDeptDetailContext> = Symbol('orgDeptDetail')
