/**
 * 使用者端公告 API：取得當前有效公告、標記已讀
 */
import { apiClient } from './client'
import { API_PATH } from '@/constants'
import type { ApiResponse } from '@/types'

export interface ActiveAnnouncementItem {
  id: string
  title: string
  body: string
  publishedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
  /** 當前使用者已讀時間，null 表示未讀 */
  readAt: string | null
}

export async function fetchActiveAnnouncements(): Promise<ActiveAnnouncementItem[]> {
  const { data } = await apiClient.get<ApiResponse<ActiveAnnouncementItem[]>>(API_PATH.ANNOUNCEMENTS_ACTIVE)
  return data.data
}

export async function markAnnouncementRead(id: string): Promise<void> {
  await apiClient.post(`${API_PATH.ANNOUNCEMENTS_ACTIVE.replace('/active', '')}/${id}/read`)
}
