import { apiClient } from './client'
import { API_PATH } from '@/constants'
import type { ApiResponse } from '@/types'
import type { ProjectDetail, UpdateProjectInfoPayload, ProjectMemberItem, ProjectMemberAvailableItem } from '@/types'
import type { ScheduleAdjustmentRow } from '@/types'

const scheduleAdjustmentsPath = (projectId: string) =>
  `${API_PATH.PROJECTS}/${encodeURIComponent(projectId)}/schedule-adjustments`

/** 取得單一專案（含專案資訊欄位） */
export async function getProject(projectId: string): Promise<ProjectDetail | null> {
  const { data } = await apiClient.get<ApiResponse<ProjectDetail>>(
    `${API_PATH.PROJECTS}/${encodeURIComponent(projectId)}`
  )
  return data.data ?? null
}

/** 更新專案（含專案資訊） */
export async function updateProject(
  projectId: string,
  payload: UpdateProjectInfoPayload
): Promise<ProjectDetail> {
  const { data } = await apiClient.patch<ApiResponse<ProjectDetail>>(
    `${API_PATH.PROJECTS}/${encodeURIComponent(projectId)}`,
    payload
  )
  if (!data.data) throw new Error('更新失敗')
  return data.data
}

/** 取得專案工期調整列表 */
export async function getScheduleAdjustments(projectId: string): Promise<ScheduleAdjustmentRow[]> {
  const { data } = await apiClient.get<ApiResponse<ScheduleAdjustmentRow[]>>(scheduleAdjustmentsPath(projectId))
  return data.data ?? []
}

/** 新增工期調整 */
export async function createScheduleAdjustment(
  projectId: string,
  payload: { applyDate: string; type: string; applyDays: number; approvedDays: number; status?: string }
): Promise<ScheduleAdjustmentRow> {
  const { data } = await apiClient.post<ApiResponse<ScheduleAdjustmentRow>>(
    scheduleAdjustmentsPath(projectId),
    payload
  )
  if (!data.data) throw new Error('新增失敗')
  return data.data
}

/** 更新工期調整 */
export async function updateScheduleAdjustment(
  projectId: string,
  id: string,
  payload: Partial<{ applyDate: string; type: string; applyDays: number; approvedDays: number; status: string }>
): Promise<ScheduleAdjustmentRow> {
  const { data } = await apiClient.patch<ApiResponse<ScheduleAdjustmentRow>>(
    `${scheduleAdjustmentsPath(projectId)}/${encodeURIComponent(id)}`,
    payload
  )
  if (!data.data) throw new Error('更新失敗')
  return data.data
}

/** 刪除工期調整 */
export async function deleteScheduleAdjustment(projectId: string, id: string): Promise<void> {
  await apiClient.delete(`${scheduleAdjustmentsPath(projectId)}/${encodeURIComponent(id)}`)
}

// ---------- 專案成員（從租戶成員引入） ----------

/** 取得專案成員列表 */
export async function getProjectMembers(projectId: string): Promise<ProjectMemberItem[]> {
  const { data } = await apiClient.get<ApiResponse<ProjectMemberItem[]>>(
    `${API_PATH.PROJECT_MEMBERS(projectId)}`
  )
  return data.data ?? []
}

/** 取得可加入專案的租戶成員（尚未在專案中） */
export async function getProjectMembersAvailable(
  projectId: string,
  limit?: number
): Promise<ProjectMemberAvailableItem[]> {
  const params = limit != null ? { limit } : {}
  const { data } = await apiClient.get<ApiResponse<ProjectMemberAvailableItem[]>>(
    `${API_PATH.PROJECT_MEMBERS_AVAILABLE(projectId)}`,
    { params }
  )
  return data.data ?? []
}

/** 新增專案成員（須為同租戶成員） */
export async function addProjectMember(
  projectId: string,
  payload: { userId: string }
): Promise<ProjectMemberItem> {
  const { data } = await apiClient.post<ApiResponse<ProjectMemberItem>>(
    `${API_PATH.PROJECT_MEMBERS(projectId)}`,
    payload
  )
  if (!data.data) throw new Error('新增失敗')
  return data.data
}

/** 設定專案成員狀態（停用／啟用） */
export async function setProjectMemberStatus(
  projectId: string,
  userId: string,
  status: 'active' | 'suspended'
): Promise<ProjectMemberItem> {
  const { data } = await apiClient.patch<ApiResponse<ProjectMemberItem>>(
    `${API_PATH.PROJECT_MEMBERS(projectId)}/${encodeURIComponent(userId)}`,
    { status }
  )
  if (!data.data) throw new Error('更新失敗')
  return data.data
}

/** 移除專案成員 */
export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  await apiClient.delete(`${API_PATH.PROJECT_MEMBERS(projectId)}/${encodeURIComponent(userId)}`)
}
