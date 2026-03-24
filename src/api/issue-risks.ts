import { apiClient } from './client'
import { API_PATH } from '@/constants'
import type { ApiResponse } from '@/types'
import type {
  IssueRiskItem,
  CreateIssueRiskPayload,
  UpdateIssueRiskPayload,
} from '@/types/issue-risk'

const issueRisksPath = (projectId: string) => API_PATH.PROJECT_ISSUE_RISKS(projectId)
const issueRiskPath = (projectId: string, id: string) =>
  API_PATH.PROJECT_ISSUE_RISK(projectId, id)

/** 取得專案議題風險列表 */
export async function getIssueRisks(projectId: string): Promise<IssueRiskItem[]> {
  const { data } = await apiClient.get<ApiResponse<IssueRiskItem[]>>(issueRisksPath(projectId))
  return data.data ?? []
}

/** 取得單一議題風險 */
export async function getIssueRisk(
  projectId: string,
  id: string
): Promise<IssueRiskItem | null> {
  const { data } = await apiClient.get<ApiResponse<IssueRiskItem>>(issueRiskPath(projectId, id))
  return data.data ?? null
}

/** 新增議題風險 */
export async function createIssueRisk(
  projectId: string,
  payload: CreateIssueRiskPayload
): Promise<IssueRiskItem> {
  const { data } = await apiClient.post<ApiResponse<IssueRiskItem>>(
    issueRisksPath(projectId),
    payload
  )
  if (!data?.data) throw new Error('新增失敗')
  return data.data
}

/** 更新議題風險 */
export async function updateIssueRisk(
  projectId: string,
  id: string,
  payload: UpdateIssueRiskPayload
): Promise<IssueRiskItem> {
  const { data } = await apiClient.patch<ApiResponse<IssueRiskItem>>(
    issueRiskPath(projectId, id),
    payload
  )
  if (!data.data) throw new Error('更新失敗')
  return data.data
}

/** 刪除議題風險 */
export async function deleteIssueRisk(projectId: string, id: string): Promise<void> {
  await apiClient.delete(issueRiskPath(projectId, id))
}
