import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types/api'

/** 與後端 `resources/templates/construction_project_change_list.xlsx` 檔名一致 */
export const PCCES_CHANGE_LIST_EXCEL_TEMPLATE_FILENAME = 'construction_project_change_list.xlsx'

export interface PccesImportSummary {
  id: string
  projectId: string
  version: number
  /** 版本顯示名稱；第 1 版空值時前端顯示「原契約」 */
  versionLabel: string | null
  documentType: string | null
  fileName: string
  attachmentId: string | null
  itemCount: number
  generalCount: number
  /** ISO；null 表示尚未核定（施工日誌僅能引用已核定版之工項） */
  approvedAt: string | null
  approvedById: string | null
  /** ISO；施工日誌依填表日選版時之「生效」日曆日以此為準；null 則以核定操作時間之日為準 */
  approvalEffectiveAt: string | null
  createdAt: string
  createdById: string
}

export interface PccesItemDto {
  id: string
  itemKey: number
  parentItemKey: number | null
  itemNo: string
  itemKind: string
  refCode: string
  description: string
  unit: string
  quantity: string
  unitPrice: string
  amountImported: string | null
  remark: string
  percent: string | null
  path: string
  depth: number
}

/** 列表／明細用版本名稱（第 1 版無自訂時為「原契約」） */
export function displayPccesVersionLabel(row: {
  version: number
  versionLabel: string | null | undefined
}): string {
  const t = row.versionLabel?.trim()
  if (row.version === 1) {
    if (!t) return '原契約'
    return t
  }
  return t || `第 ${row.version} 版`
}

export async function listPccesImports(projectId: string): Promise<PccesImportSummary[]> {
  const { data } = await apiClient.get<ApiResponse<PccesImportSummary[]>>(
    API_PATH.PROJECT_PCCES_IMPORTS(projectId)
  )
  return data.data
}

/** 下載 PCCES Excel 變更用工程變更清單樣板（須 construction.pcces 讀取權） */
export async function downloadPccesChangeListExcelTemplate(projectId: string): Promise<void> {
  const res = await apiClient.get<Blob>(
    API_PATH.PROJECT_PCCES_IMPORTS_CONSTRUCTION_PROJECT_CHANGE_LIST_EXCEL_TEMPLATE(projectId),
    { responseType: 'blob' }
  )
  const blob = res.data
  if (blob.type === 'application/json' || blob.type === 'application/problem+json') {
    const text = await blob.text()
    let message = '下載失敗'
    try {
      const j = JSON.parse(text) as { error?: { message?: string } }
      if (j.error?.message) message = j.error.message
    } catch {
      /* ignore */
    }
    throw new Error(message)
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = PCCES_CHANGE_LIST_EXCEL_TEMPLATE_FILENAME
  a.click()
  URL.revokeObjectURL(url)
}

export async function uploadPccesImport(
  projectId: string,
  file: File,
  options?: { versionLabel?: string }
): Promise<PccesImportSummary> {
  const form = new FormData()
  form.append('file', file, file.name)
  if (options?.versionLabel != null && options.versionLabel !== '') {
    form.append('versionLabel', options.versionLabel)
  }
  const { data } = await apiClient.post<ApiResponse<PccesImportSummary>>(
    API_PATH.PROJECT_PCCES_IMPORTS(projectId),
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return data.data
}

export async function patchPccesImport(
  projectId: string,
  importId: string,
  body: { versionLabel?: string; approvalEffectiveAt?: string | null }
): Promise<PccesImportSummary> {
  const { data } = await apiClient.patch<ApiResponse<PccesImportSummary>>(
    API_PATH.PROJECT_PCCES_IMPORT(projectId, importId),
    body
  )
  return data.data
}

export async function patchPccesImportVersionLabel(
  projectId: string,
  importId: string,
  versionLabel: string
): Promise<PccesImportSummary> {
  return patchPccesImport(projectId, importId, { versionLabel })
}

export async function getPccesImport(
  projectId: string,
  importId: string
): Promise<PccesImportSummary> {
  const { data } = await apiClient.get<ApiResponse<PccesImportSummary>>(
    API_PATH.PROJECT_PCCES_IMPORT(projectId, importId)
  )
  return data.data
}

export interface PccesImportItemsResult {
  import: PccesImportSummary
  items: PccesItemDto[]
  meta: { page: number; limit: number; total: number }
}

export async function deletePccesImport(projectId: string, importId: string): Promise<void> {
  await apiClient.delete<ApiResponse<{ ok: boolean }>>(
    API_PATH.PROJECT_PCCES_IMPORT(projectId, importId)
  )
}

export async function approvePccesImport(
  projectId: string,
  importId: string
): Promise<PccesImportSummary> {
  const { data } = await apiClient.post<ApiResponse<PccesImportSummary>>(
    API_PATH.PROJECT_PCCES_IMPORT_APPROVE(projectId, importId)
  )
  return data.data
}

/** POST .../pcces-imports/:importId/excel-apply 請求體（與後端 Zod 對齊） */
export interface PccesExcelApplyExcelAudit {
  itemNo?: string
  description: string
  unit?: string
  qtyRaw?: string
  unitPriceRaw?: string
  remark?: string
}

export interface PccesExcelApplyAutoMatched {
  itemKey: number
  newQuantity?: string
  newUnitPrice?: string
  excel: PccesExcelApplyExcelAudit
}

export interface PccesExcelApplyManuallyPlaced {
  parentItemKey: number
  itemNo: string
  description: string
  unit: string
  quantity: string
  unitPrice: string
  remark?: string
  excel: PccesExcelApplyExcelAudit
}

export interface PccesExcelApplyBody {
  fileName?: string
  /** 產生之新版本顯示名稱（必填） */
  versionLabel: string
  autoMatched: PccesExcelApplyAutoMatched[]
  manuallyPlaced: PccesExcelApplyManuallyPlaced[]
}

export async function applyPccesImportExcelChanges(
  projectId: string,
  baseImportId: string,
  body: PccesExcelApplyBody
): Promise<PccesImportSummary> {
  const { data } = await apiClient.post<ApiResponse<PccesImportSummary>>(
    API_PATH.PROJECT_PCCES_IMPORT_EXCEL_APPLY(projectId, baseImportId),
    body
  )
  return data.data
}

export async function getPccesImportItems(
  projectId: string,
  importId: string,
  params: {
    page?: number
    limit?: number
    /** 後端依原字串篩選 XML itemKind；空字串表示不篩 */
    itemKind?: string
    /** 一次載入該匯入之全部工項（後端有筆數上限） */
    all?: boolean
  }
): Promise<PccesImportItemsResult> {
  const search = new URLSearchParams()
  if (params.all) {
    search.set('all', '1')
  } else {
    if (params.page != null) search.set('page', String(params.page))
    if (params.limit != null) search.set('limit', String(params.limit))
  }
  if (params.itemKind != null && String(params.itemKind).trim() !== '') {
    search.set('itemKind', String(params.itemKind).trim())
  }
  const q = search.toString()
  const url = `${API_PATH.PROJECT_PCCES_IMPORT_ITEMS(projectId, importId)}${q ? `?${q}` : ''}`
  const { data: body } = await apiClient.get<
    ApiResponse<{ import: PccesImportSummary; items: PccesItemDto[] }>
  >(url)
  const meta = body.meta
  if (meta?.page == null || meta?.limit == null || meta?.total == null) {
    throw new Error('Invalid paginated response')
  }
  return {
    import: body.data.import,
    items: body.data.items,
    meta: { page: meta.page, limit: meta.limit, total: meta.total },
  }
}
