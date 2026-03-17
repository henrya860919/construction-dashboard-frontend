import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types/api'
import type { WbsNode } from '@/types/wbs'

/** 後端回傳的樹節點（與 WbsNode 結構一致） */
export type WbsNodeTree = WbsNode

export interface CreateWbsPayload {
  parentId?: string | null
  name: string
}

export interface UpdateWbsPayload {
  name?: string
}

export interface MoveWbsPayload {
  parentId?: string | null
  insertBeforeId?: string | null
}

export async function listProjectWbs(projectId: string): Promise<WbsNodeTree[]> {
  const { data } = await apiClient.get<ApiResponse<WbsNodeTree[]>>(API_PATH.PROJECT_WBS(projectId))
  return data.data
}

export async function createWbsNode(projectId: string, payload: CreateWbsPayload): Promise<WbsNode> {
  const { data } = await apiClient.post<ApiResponse<WbsNode>>(API_PATH.PROJECT_WBS(projectId), payload)
  return data.data
}

export async function updateWbsNode(
  projectId: string,
  nodeId: string,
  payload: UpdateWbsPayload
): Promise<WbsNode> {
  const { data } = await apiClient.patch<ApiResponse<WbsNode>>(
    API_PATH.PROJECT_WBS_NODE(projectId, nodeId),
    payload
  )
  return data.data
}

export async function deleteWbsNode(projectId: string, nodeId: string): Promise<void> {
  await apiClient.delete(API_PATH.PROJECT_WBS_NODE(projectId, nodeId))
}

export async function moveWbsNode(
  projectId: string,
  nodeId: string,
  payload: MoveWbsPayload
): Promise<WbsNodeTree[]> {
  const { data } = await apiClient.patch<ApiResponse<WbsNodeTree[]>>(
    API_PATH.PROJECT_WBS_NODE_MOVE(projectId, nodeId),
    payload
  )
  return data.data
}
