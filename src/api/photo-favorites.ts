import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types/api'
import type { AttachmentItem } from './files'

export async function listProjectPhotoFavorites(projectId: string): Promise<AttachmentItem[]> {
  const { data } = await apiClient.get<ApiResponse<AttachmentItem[]>>(
    API_PATH.PROJECT_PHOTO_FAVORITES(projectId)
  )
  return data.data ?? []
}

export async function addPhotoFavorite(projectId: string, attachmentId: string): Promise<void> {
  await apiClient.post(API_PATH.PROJECT_PHOTO_FAVORITES(projectId), { attachmentId })
}

export async function removePhotoFavorite(
  projectId: string,
  attachmentId: string
): Promise<void> {
  await apiClient.delete(
    `${API_PATH.PROJECT_PHOTO_FAVORITES(projectId)}/${attachmentId}`
  )
}
