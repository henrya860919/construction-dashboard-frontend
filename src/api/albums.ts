import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types/api'

export interface AlbumItem {
  id: string
  projectId: string
  name: string
  createdAt: string
}

export interface AlbumPhotoItem {
  id: string
  projectId: string
  fileName: string
  fileSize: number
  mimeType: string
  category: string | null
  uploadedById: string
  uploaderName: string | null
  createdAt: string
  url: string
}

export async function listProjectAlbums(projectId: string): Promise<AlbumItem[]> {
  const { data } = await apiClient.get<ApiResponse<AlbumItem[]>>(
    API_PATH.PROJECT_ALBUMS(projectId)
  )
  return data.data ?? []
}

export async function createAlbum(projectId: string, name: string): Promise<AlbumItem> {
  const { data } = await apiClient.post<ApiResponse<AlbumItem>>(
    API_PATH.PROJECT_ALBUMS(projectId),
    { name }
  )
  return data.data
}

export async function deleteAlbum(projectId: string, albumId: string): Promise<void> {
  await apiClient.delete(`${API_PATH.PROJECT_ALBUMS(projectId)}/${albumId}`)
}

export async function listAlbumPhotos(
  projectId: string,
  albumId: string
): Promise<AlbumPhotoItem[]> {
  const { data } = await apiClient.get<ApiResponse<AlbumPhotoItem[]>>(
    API_PATH.PROJECT_ALBUM_PHOTOS(projectId, albumId)
  )
  return data.data ?? []
}

export async function addPhotoToAlbum(
  projectId: string,
  albumId: string,
  attachmentId: string
): Promise<void> {
  await apiClient.post(`${API_PATH.PROJECT_ALBUMS(projectId)}/${albumId}/photos`, {
    attachmentId,
  })
}

export async function removePhotoFromAlbum(
  projectId: string,
  albumId: string,
  attachmentId: string
): Promise<void> {
  await apiClient.delete(
    `${API_PATH.PROJECT_ALBUMS(projectId)}/${albumId}/photos/${attachmentId}`
  )
}
