import { apiClient } from './client'
import { API_PATH } from '@/constants'
import type { ApiResponse } from '@/types'
import type { LoginPayload, LoginResponse, User } from '@/types'

export async function login(payload: LoginPayload) {
  const { data } = await apiClient.post<ApiResponse<LoginResponse>>(
    API_PATH.AUTH_LOGIN,
    payload
  )
  return data.data
}

/** 取得當前登入者（含 hasAvatar），用於重新整理使用者資料 */
export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<ApiResponse<User>>(API_PATH.AUTH_ME)
  return data.data
}

export async function logout() {
  await apiClient.post(API_PATH.AUTH_LOGOUT)
}

export async function callRefreshToken(currentRefreshToken: string) {
  const { data } = await apiClient.post<ApiResponse<{ accessToken: string; refreshToken: string }>>(
    API_PATH.AUTH_REFRESH,
    { refreshToken: currentRefreshToken }
  )
  return data.data
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

/** 上傳個人頭貼（multipart form: file） */
export async function uploadAvatar(file: File): Promise<void> {
  const form = new FormData()
  form.append('file', file)
  await apiClient.post(API_PATH.AUTH_ME_AVATAR, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

/** 取得個人頭貼 blob（用於預覽，需登入） */
export async function getAvatarBlob(): Promise<Blob> {
  const res = await apiClient.get<Blob>(API_PATH.AUTH_ME_AVATAR, {
    responseType: 'blob',
  })
  return res.data
}
