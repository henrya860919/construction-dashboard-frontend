import { apiClient } from './client'
import { API_PATH } from '@/constants/api'

export const PROGRESS_PLAN_EXCEL_TEMPLATE_FILENAME = 'progress_template.xlsx'
import type { ProgressDashboardDto, ProgressPlanSummaryDto } from '@/types/project-progress'

export async function getProgressDashboard(
  projectId: string,
  params?: { primaryPlanId?: string; comparePlanId?: string }
): Promise<ProgressDashboardDto> {
  const sp = new URLSearchParams()
  if (params?.primaryPlanId) sp.set('primaryPlanId', params.primaryPlanId)
  if (params?.comparePlanId) sp.set('comparePlanId', params.comparePlanId)
  const q = sp.toString()
  const url =
    API_PATH.PROJECT_PROGRESS_DASHBOARD(projectId) + (q ? `?${q}` : '')
  const res = await apiClient.get<{ data: ProgressDashboardDto }>(url)
  return res.data.data
}

export type CreateProgressPlanBody = {
  label: string
  reason?: string | null
  isBaseline?: boolean
  effectiveFromDate: string
  effectiveFromIdx: number
  extraWeeks?: number
  entries: Array<{
    periodDate: string
    periodIndex: number
    periodProgress?: number | null
    cumulativeProgress?: number | null
    isLocked?: boolean
    isExtended?: boolean
  }>
}

export async function createProgressPlan(
  projectId: string,
  body: CreateProgressPlanBody
): Promise<{ id: string; version: number; label: string; isBaseline: boolean }> {
  const res = await apiClient.post<{
    data: { id: string; version: number; label: string; isBaseline: boolean }
  }>(API_PATH.PROJECT_PROGRESS_PLANS(projectId), body)
  return res.data.data
}

/** 建立計畫並儲存上傳之 Excel（multipart：file + payload JSON 字串） */
export async function createProgressPlanWithUpload(
  projectId: string,
  body: CreateProgressPlanBody,
  file: File
): Promise<{ id: string; version: number; label: string; isBaseline: boolean }> {
  const fd = new FormData()
  fd.append('payload', JSON.stringify(body))
  fd.append('file', file)
  const res = await apiClient.post<{
    data: { id: string; version: number; label: string; isBaseline: boolean }
  }>(API_PATH.PROJECT_PROGRESS_PLAN_WITH_UPLOAD(projectId), fd)
  return res.data.data
}

export interface ProgressPlanUploadListItemDto {
  attachmentId: string
  fileName: string
  fileSize: number
  mimeType: string
  createdAt: string
  planId: string | null
  planVersion: number | null
  planLabel: string | null
  planIsBaseline: boolean | null
  /** 非原始計畫才有；對應圖表變更虛線對齊之週期 */
  effectiveFromDate: string | null
  effectiveFromIdx: number | null
  uploaderName: string | null
}

export async function listProgressPlanUploads(
  projectId: string
): Promise<ProgressPlanUploadListItemDto[]> {
  const res = await apiClient.get<{ data: ProgressPlanUploadListItemDto[] }>(
    API_PATH.PROJECT_PROGRESS_PLAN_UPLOADS(projectId)
  )
  return res.data.data
}

/** 下載內建進度表 Excel 樣板（須 construction.progress 讀取權） */
export async function downloadProgressPlanExcelTemplate(projectId: string): Promise<void> {
  const res = await apiClient.get<Blob>(
    API_PATH.PROJECT_PROGRESS_PLAN_UPLOADS_EXCEL_TEMPLATE(projectId),
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
  a.download = PROGRESS_PLAN_EXCEL_TEMPLATE_FILENAME
  a.click()
  URL.revokeObjectURL(url)
}

export async function duplicateProgressPlan(
  projectId: string,
  body: {
    sourcePlanId: string
    label: string
    reason?: string | null
    effectiveFromDate?: string
    effectiveFromIdx?: number
  }
): Promise<{ id: string; version: number; label: string; isBaseline: boolean }> {
  const res = await apiClient.post<{
    data: { id: string; version: number; label: string; isBaseline: boolean }
  }>(API_PATH.PROJECT_PROGRESS_PLAN_DUPLICATE(projectId), body)
  return res.data.data
}

export async function deleteProgressPlan(projectId: string, planId: string): Promise<void> {
  await apiClient.delete(API_PATH.PROJECT_PROGRESS_PLAN(projectId, planId))
}

export async function patchProgressPlanEffective(
  projectId: string,
  planId: string,
  body: { effectiveFromDate: string; effectiveFromIdx: number }
): Promise<{ effectiveFromDate: string; effectiveFromIdx: number }> {
  const res = await apiClient.patch<{
    data: { effectiveFromDate: string; effectiveFromIdx: number }
  }>(API_PATH.PROJECT_PROGRESS_PLAN_EFFECTIVE(projectId, planId), body)
  return res.data.data
}

export async function putProgressPlanEntries(
  projectId: string,
  planId: string,
  body: {
    entries: Array<{
      periodDate: string
      periodIndex: number
      periodProgress: number | null
      isLocked?: boolean
      isExtended?: boolean
    }>
  }
): Promise<void> {
  await apiClient.put(API_PATH.PROJECT_PROGRESS_PLAN_ENTRIES(projectId, planId), body)
}

export async function putProgressActuals(
  projectId: string,
  body: {
    rows: Array<{
      periodDate: string
      periodIndex: number
      periodProgressPercent: number | null
      cumulativeProgressPercent?: number | null
    }>
  }
): Promise<void> {
  await apiClient.put(API_PATH.PROJECT_PROGRESS_ACTUALS(projectId), body)
}

export async function listProgressPlans(projectId: string): Promise<ProgressPlanSummaryDto[]> {
  const res = await apiClient.get<{ data: ProgressPlanSummaryDto[] }>(
    API_PATH.PROJECT_PROGRESS_PLANS(projectId)
  )
  return res.data.data
}
