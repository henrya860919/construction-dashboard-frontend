import { apiClient } from './client'
import { API_PATH } from '@/constants'
import type { ApiResponse, PaginatedResponse } from '@/types/api'
import type {
  DefectItem,
  DefectExecutionRecordItem,
  CreateDefectPayload,
  UpdateDefectPayload,
  CreateDefectRecordPayload,
} from '@/types/defect-improvement'

const listPath = (projectId: string) => API_PATH.PROJECT_DEFECT_IMPROVEMENTS(projectId)
const detailPath = (projectId: string, defectId: string) =>
  API_PATH.PROJECT_DEFECT_IMPROVEMENT(projectId, defectId)
const recordsPath = (projectId: string, defectId: string) =>
  API_PATH.PROJECT_DEFECT_IMPROVEMENT_RECORDS(projectId, defectId)

/** 缺失改善列表（可依狀態篩選） */
export async function listDefectImprovements(
  projectId: string,
  params?: { status?: 'in_progress' | 'completed'; page?: number; limit?: number }
): Promise<{ data: DefectItem[]; meta: { page: number; limit: number; total: number } }> {
  const { data } = await apiClient.get<PaginatedResponse<DefectItem>>(listPath(projectId), {
    params: { page: params?.page ?? 1, limit: params?.limit ?? 50, ...(params?.status && { status: params.status }) },
  })
  const meta = data.meta ?? { page: 1, limit: 50, total: 0 }
  return { data: data.data ?? [], meta }
}

/** 分頁拉齊該專案全部缺失（供前端搜尋／篩選／分頁） */
export async function listAllDefectImprovements(
  projectId: string,
  options?: { maxPages?: number }
): Promise<DefectItem[]> {
  const maxPages = options?.maxPages ?? 200
  const out: DefectItem[] = []
  let page = 1
  const limit = 100
  for (let i = 0; i < maxPages; i++) {
    const res = await listDefectImprovements(projectId, { page, limit })
    out.push(...res.data)
    if (res.data.length === 0 || res.data.length < limit || out.length >= res.meta.total) break
    page++
  }
  return out
}

/** 單一缺失（含照片） */
export async function getDefectImprovement(
  projectId: string,
  defectId: string
): Promise<DefectItem | null> {
  const { data } = await apiClient.get<ApiResponse<DefectItem>>(detailPath(projectId, defectId))
  return data.data ?? null
}

/** 新增缺失改善 */
export async function createDefectImprovement(
  projectId: string,
  payload: CreateDefectPayload
): Promise<DefectItem> {
  const { data } = await apiClient.post<ApiResponse<DefectItem>>(listPath(projectId), payload)
  if (!data?.data) throw new Error('新增失敗')
  return data.data
}

/** 更新缺失改善 */
export async function updateDefectImprovement(
  projectId: string,
  defectId: string,
  payload: UpdateDefectPayload
): Promise<DefectItem> {
  const { data } = await apiClient.patch<ApiResponse<DefectItem>>(
    detailPath(projectId, defectId),
    payload
  )
  if (!data?.data) throw new Error('更新失敗')
  return data.data
}

/** 刪除缺失改善 */
export async function deleteDefectImprovement(
  projectId: string,
  defectId: string
): Promise<void> {
  await apiClient.delete(detailPath(projectId, defectId))
}

/** 執行紀錄列表（含照片） */
export async function listDefectRecords(
  projectId: string,
  defectId: string
): Promise<DefectExecutionRecordItem[]> {
  const { data } = await apiClient.get<ApiResponse<DefectExecutionRecordItem[]>>(
    recordsPath(projectId, defectId)
  )
  return data.data ?? []
}

/** 單一執行紀錄（含照片） */
export async function getDefectRecord(
  projectId: string,
  defectId: string,
  recordId: string
): Promise<DefectExecutionRecordItem | null> {
  const { data } = await apiClient.get<ApiResponse<DefectExecutionRecordItem>>(
    API_PATH.PROJECT_DEFECT_IMPROVEMENT_RECORD(projectId, defectId, recordId)
  )
  return data.data ?? null
}

/** 新增執行紀錄 */
export async function createDefectRecord(
  projectId: string,
  defectId: string,
  payload: CreateDefectRecordPayload
): Promise<DefectExecutionRecordItem> {
  const { data } = await apiClient.post<ApiResponse<DefectExecutionRecordItem>>(
    recordsPath(projectId, defectId),
    payload
  )
  if (!data?.data) throw new Error('新增失敗')
  return data.data
}
