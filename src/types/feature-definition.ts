/** 與後端 GET feature-definitions 回傳列一致（camelCase） */
export interface FeatureDefinition {
  id: string
  tenantId: string | null
  name: string
  slug: string | null
  icon: string | null
  description: string | null
  systemModule: string
  subModule: string | null
  isSystem: boolean
  routePath: string | null
  formId: string | null
  closeFormId: string | null
  listConfig: unknown
  filterConfig: unknown
  systemSortOrder: number
  tenantSortOrder: number
  status: string
  permissionKey: string | null
  createdAt: string
  updatedAt: string
}
