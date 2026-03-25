import { apiClient } from './client'
import { API_PATH } from '@/constants'
import type { ApiResponse, PaginatedResponse } from '@/types/api'
import type {
  RepairRequestItem,
  CreateRepairRequestPayload,
  UpdateRepairRequestPayload,
  RepairExecutionRecordItem,
  CreateRepairRecordPayload,
} from '@/types/repair-request'

const listPath = (projectId: string) => API_PATH.PROJECT_REPAIR_REQUESTS(projectId)
const detailPath = (projectId: string, repairId: string) =>
  API_PATH.PROJECT_REPAIR_REQUEST(projectId, repairId)
const recordsPath = (projectId: string, repairId: string) =>
  API_PATH.PROJECT_REPAIR_REQUEST_RECORDS(projectId, repairId)

export async function listRepairRequests(
  projectId: string,
  params?: {
    /** 多選狀態（OR）；空陣列或不傳表示不篩狀態 */
    statusIn?: Array<'in_progress' | 'completed'>
    /** 後端以客戶／電話／內容／類別／戶別／備註模糊搜尋 */
    q?: string
    page?: number
    limit?: number
  }
): Promise<{ data: RepairRequestItem[]; meta: { page: number; limit: number; total: number } }> {
  const { data } = await apiClient.get<PaginatedResponse<RepairRequestItem>>(listPath(projectId), {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 50,
      ...(params?.statusIn?.length && { status: params.statusIn.join(',') }),
      ...(params?.q?.trim() && { q: params.q.trim() }),
    },
  })
  const meta = data.meta ?? { page: 1, limit: 50, total: 0 }
  return { data: data.data ?? [], meta }
}

export async function getRepairRequest(
  projectId: string,
  repairId: string
): Promise<RepairRequestItem | null> {
  const { data } = await apiClient.get<ApiResponse<RepairRequestItem>>(
    detailPath(projectId, repairId)
  )
  return data.data ?? null
}

export async function createRepairRequest(
  projectId: string,
  payload: CreateRepairRequestPayload
): Promise<RepairRequestItem> {
  const { data } = await apiClient.post<ApiResponse<RepairRequestItem>>(listPath(projectId), payload)
  if (!data?.data) throw new Error('新增失敗')
  return data.data
}

export async function updateRepairRequest(
  projectId: string,
  repairId: string,
  payload: UpdateRepairRequestPayload
): Promise<RepairRequestItem> {
  const { data } = await apiClient.patch<ApiResponse<RepairRequestItem>>(
    detailPath(projectId, repairId),
    payload
  )
  if (!data?.data) throw new Error('更新失敗')
  return data.data
}

export async function deleteRepairRequest(projectId: string, repairId: string): Promise<void> {
  await apiClient.delete(detailPath(projectId, repairId))
}

export async function listRepairRecords(
  projectId: string,
  repairId: string
): Promise<RepairExecutionRecordItem[]> {
  const { data } = await apiClient.get<ApiResponse<RepairExecutionRecordItem[]>>(
    recordsPath(projectId, repairId)
  )
  return data.data ?? []
}

export async function getRepairRecord(
  projectId: string,
  repairId: string,
  recordId: string
): Promise<RepairExecutionRecordItem | null> {
  const { data } = await apiClient.get<ApiResponse<RepairExecutionRecordItem>>(
    API_PATH.PROJECT_REPAIR_REQUEST_RECORD(projectId, repairId, recordId)
  )
  return data.data ?? null
}

export async function createRepairRecord(
  projectId: string,
  repairId: string,
  payload: CreateRepairRecordPayload
): Promise<RepairExecutionRecordItem> {
  const { data } = await apiClient.post<ApiResponse<RepairExecutionRecordItem>>(
    recordsPath(projectId, repairId),
    payload
  )
  if (!data?.data) throw new Error('新增失敗')
  return data.data
}
