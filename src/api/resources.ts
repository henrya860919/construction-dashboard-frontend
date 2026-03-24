import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types/api'
import type {
  ProjectResourceItem,
  ProjectResourceType,
  CreateProjectResourcePayload,
  UpdateProjectResourcePayload,
} from '@/types/resource'

/** 取得專案所有類型資源（供 WBS 資源多選等使用） */
export async function getAllProjectResources(projectId: string): Promise<ProjectResourceItem[]> {
  const types: ProjectResourceType[] = ['labor', 'equipment', 'material']
  const results = await Promise.all(types.map((type) => getProjectResources(projectId, type)))
  return results.flat()
}

export async function getProjectResources(
  projectId: string,
  type: ProjectResourceType
): Promise<ProjectResourceItem[]> {
  const { data } = await apiClient.get<ApiResponse<ProjectResourceItem[]>>(
    `${API_PATH.PROJECT_RESOURCES(projectId)}?type=${encodeURIComponent(type)}`
  )
  return data.data
}

export async function createProjectResource(
  projectId: string,
  payload: CreateProjectResourcePayload
): Promise<ProjectResourceItem> {
  const { data } = await apiClient.post<ApiResponse<ProjectResourceItem>>(
    API_PATH.PROJECT_RESOURCES(projectId),
    payload
  )
  return data.data
}

export async function updateProjectResource(
  projectId: string,
  resourceId: string,
  payload: UpdateProjectResourcePayload
): Promise<ProjectResourceItem> {
  const { data } = await apiClient.patch<ApiResponse<ProjectResourceItem>>(
    API_PATH.PROJECT_RESOURCE(projectId, resourceId),
    payload
  )
  return data.data
}

export async function deleteProjectResource(
  projectId: string,
  resourceId: string
): Promise<void> {
  await apiClient.delete(API_PATH.PROJECT_RESOURCE(projectId, resourceId))
}
