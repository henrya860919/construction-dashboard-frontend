import { apiClient } from './client'
import { API_PATH } from '@/constants'
import type { ApiResponse } from '@/types'
import type { AlertItem } from '@/types/dashboard'

export interface AlertHistoryItem extends AlertItem {
  createdAt: string
}

export async function fetchCurrentAlerts(projectId?: string): Promise<AlertItem[]> {
  const params = projectId ? { projectId } : {}
  const { data } = await apiClient.get<ApiResponse<AlertItem[]>>(API_PATH.ALERTS_CURRENT, {
    params,
  })
  if (!data.data) return []
  return data.data
}

export async function fetchAlertHistory(params: {
  projectId?: string
  startDate: string
  endDate: string
  limit?: number
}): Promise<AlertHistoryItem[]> {
  const { data } = await apiClient.get<ApiResponse<AlertHistoryItem[]>>(API_PATH.ALERTS_HISTORY, {
    params: {
      projectId: params.projectId,
      startDate: params.startDate,
      endDate: params.endDate,
      limit: params.limit,
    },
  })
  if (!data.data) return []
  return data.data
}
