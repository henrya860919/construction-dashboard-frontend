import { apiClient } from './client'
import { API_PATH } from '@/constants'
import type { ApiResponse } from '@/types'
import type { LoginPayload, LoginResponse } from '@/types'

export async function login(payload: LoginPayload) {
  const { data } = await apiClient.post<ApiResponse<LoginResponse>>(
    API_PATH.AUTH_LOGIN,
    payload
  )
  return data.data
}

export async function logout() {
  await apiClient.post(API_PATH.AUTH_LOGOUT)
}

export async function refreshToken() {
  const { data } = await apiClient.post<ApiResponse<{ accessToken: string }>>(
    API_PATH.AUTH_REFRESH
  )
  return data.data.accessToken
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
}

export async function changePassword(payload: ChangePasswordPayload) {
  await apiClient.patch<ApiResponse<{ ok: true }>>(
    API_PATH.AUTH_CHANGE_PASSWORD,
    payload
  )
}
