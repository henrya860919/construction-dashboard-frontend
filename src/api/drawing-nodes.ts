import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types/api'
import type { DrawingNodeTree, DrawingRevisionItem } from '@/types/drawing-node'

export const DRAWING_REVISION_CATEGORY = 'drawing_revision'

export interface CreateDrawingNodePayload {
  parentId?: string | null
  name: string
  kind: 'folder' | 'leaf'
}

export interface MoveDrawingNodePayload {
  parentId?: string | null
  insertBeforeId?: string | null
}

export async function listDrawingNodes(projectId: string): Promise<DrawingNodeTree[]> {
  const { data } = await apiClient.get<ApiResponse<DrawingNodeTree[]>>(
    API_PATH.PROJECT_DRAWING_NODES(projectId)
  )
  return data.data
}

export async function createDrawingNode(
  projectId: string,
  payload: CreateDrawingNodePayload
): Promise<DrawingNodeTree[]> {
  const { data } = await apiClient.post<ApiResponse<DrawingNodeTree[]>>(
    API_PATH.PROJECT_DRAWING_NODES(projectId),
    payload
  )
  return data.data
}

export async function updateDrawingNode(
  projectId: string,
  nodeId: string,
  payload: { name: string }
): Promise<DrawingNodeTree[]> {
  const { data } = await apiClient.patch<ApiResponse<DrawingNodeTree[]>>(
    API_PATH.PROJECT_DRAWING_NODE(projectId, nodeId),
    payload
  )
  return data.data
}

export async function deleteDrawingNode(projectId: string, nodeId: string): Promise<void> {
  await apiClient.delete(API_PATH.PROJECT_DRAWING_NODE(projectId, nodeId))
}

export async function moveDrawingNode(
  projectId: string,
  nodeId: string,
  payload: MoveDrawingNodePayload
): Promise<DrawingNodeTree[]> {
  const { data } = await apiClient.patch<ApiResponse<DrawingNodeTree[]>>(
    API_PATH.PROJECT_DRAWING_NODE_MOVE(projectId, nodeId),
    payload
  )
  return data.data
}

export async function listDrawingRevisions(
  projectId: string,
  nodeId: string
): Promise<DrawingRevisionItem[]> {
  const { data } = await apiClient.get<ApiResponse<DrawingRevisionItem[]>>(
    API_PATH.PROJECT_DRAWING_NODE_REVISIONS(projectId, nodeId)
  )
  return data.data
}
