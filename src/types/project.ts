/**
 * 專案相關型別（列表、建立/編輯、平台總覽）
 * 與後端 GET/POST /projects、GET /platform-admin/projects 對齊
 */

/** 專案列表單筆（租戶後台專案管理、專案列表頁） */
export interface ProjectItem {
  id: string
  name: string
  description: string | null
  code: string | null
  status: string
  tenantId: string | null
  createdAt: string
  updatedAt: string
}

/** 平台專案總覽單筆（含所屬租戶名稱） */
export interface PlatformProjectItem {
  id: string
  name: string
  description: string | null
  code: string | null
  status: string
  tenantId: string | null
  tenantName: string | null
  createdAt: string
  updatedAt: string
}

/** 專案詳情（專案資訊頁 GET /projects/:id，含契約／工程欄位） */
export interface ProjectDetail extends ProjectItem {
  designUnit: string | null
  supervisionUnit: string | null
  contractor: string | null
  summary: string | null
  benefits: string | null
  startDate: string | null
  plannedDurationDays: number | null  // 工期（天）；預定完工 = 開工 + 工期
  plannedEndDate: string | null       // 由開工+工期算出（API 回傳）
  revisedEndDate: string | null       // 預定竣工 = 開工+工期+調整工期（API 回傳）
  siteManager: string | null
  contactPhone: string | null
  projectStaff: string | null
}

/** 專案資訊更新 payload（PATCH /projects/:id） */
export interface UpdateProjectInfoPayload {
  name?: string
  description?: string | null
  code?: string | null
  status?: string
  designUnit?: string | null
  supervisionUnit?: string | null
  contractor?: string | null
  summary?: string | null
  benefits?: string | null
  startDate?: string | null
  plannedDurationDays?: number | null
  plannedEndDate?: string | null
  revisedEndDate?: string | null
  siteManager?: string | null
  contactPhone?: string | null
  projectStaff?: string | null
}
