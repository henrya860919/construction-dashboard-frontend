import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types/api'
import type {
  ProjectResourceItem,
  ProjectResourceType,
  CreateProjectResourcePayload,
  UpdateProjectResourcePayload,
} from '@/types/resource'

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
