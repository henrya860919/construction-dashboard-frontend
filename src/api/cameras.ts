import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types/api'

/** 攝影機連線狀態：依實際推流與歷史判斷 */
export type CameraConnectionStatus = 'online' | 'offline' | 'not_configured'

export interface CameraItem {
  id: string
  projectId: string
  name: string
  streamToken: string
  connectionMode: string
  status: string
  /** 實際連線狀態：線上／離線／尚未設定 */
  connectionStatus: CameraConnectionStatus
  /** 最後一次偵測到推流成功的時間；null 表示從未連線過 */
  lastStreamAt: string | null
  createdAt: string
  updatedAt: string
  /** 設定用：設備 IP 或主機名（解析自 RTSP） */
  sourceHost?: string
  sourcePort?: number
  sourcePath?: string
  hasCredentials?: boolean
  usernameMasked?: string
  /** 手動標示為離線時為 'offline'；不影響實際串流 */
  connectionStatusOverride?: string | null
  /** 手動標示為離線時，回傳實際連線狀態（供提示用） */
  actualConnectionStatus?: CameraConnectionStatus
}

export interface CameraInstallConfig {
  streamToken: string
  mediamtxHost: string
  mediamtxWebRtcUrl: string
  rtmpPublishUrl: string
  go2rtcYamlSnippet: string
}

export interface PlayUrlResult {
  url: string
  expiresAt: string
  expiresIn: number
}

export interface CreateCameraPayload {
  name: string
  sourceUrl?: string
}

export interface UpdateCameraPayload {
  name?: string
  status?: 'active' | 'disabled'
  sourceUrl?: string | null
  sourceHost?: string
  sourcePort?: number
  sourcePath?: string
  hasCredentials?: boolean
  username?: string
  password?: string
}

export async function listProjectCameras(projectId: string): Promise<CameraItem[]> {
  const { data } = await apiClient.get<ApiResponse<CameraItem[]>>(API_PATH.PROJECT_CAMERAS(projectId))
  return data.data
}

export async function createCamera(projectId: string, payload: CreateCameraPayload): Promise<CameraItem> {
  const { data } = await apiClient.post<ApiResponse<CameraItem>>(API_PATH.PROJECT_CAMERAS(projectId), payload)
  return data.data
}

export async function getCamera(projectId: string, cameraId: string): Promise<CameraItem> {
  const { data } = await apiClient.get<ApiResponse<CameraItem>>(API_PATH.PROJECT_CAMERA(projectId, cameraId))
  return data.data
}

export async function updateCamera(
  projectId: string,
  cameraId: string,
  payload: UpdateCameraPayload
): Promise<CameraItem> {
  const { data } = await apiClient.patch<ApiResponse<CameraItem>>(
    API_PATH.PROJECT_CAMERA(projectId, cameraId),
    payload
  )
  return data.data
}

export async function deleteCamera(projectId: string, cameraId: string): Promise<void> {
  await apiClient.delete(API_PATH.PROJECT_CAMERA(projectId, cameraId))
}

/** 手動標示為離線或清除標示；不影響實際串流，僅影響顯示狀態 */
export async function setCameraConnectionStatusOverride(
  projectId: string,
  cameraId: string,
  override: 'offline' | null
): Promise<{ connectionStatus: CameraConnectionStatus; connectionStatusOverride: string | null; actualConnectionStatus: CameraConnectionStatus | null }> {
  const { data } = await apiClient.patch<ApiResponse<{ connectionStatus: CameraConnectionStatus; connectionStatusOverride: string | null; actualConnectionStatus: CameraConnectionStatus | null }>>(
    API_PATH.PROJECT_CAMERA_CONNECTION_STATUS_OVERRIDE(projectId, cameraId),
    { override }
  )
  return data.data
}

export async function getCameraPlayUrl(
  projectId: string,
  cameraId: string
): Promise<PlayUrlResult> {
  const { data } = await apiClient.get<ApiResponse<PlayUrlResult>>(
    API_PATH.PROJECT_CAMERA_PLAY_URL(projectId, cameraId)
  )
  return data.data
}

export async function getCameraInstallConfig(
  projectId: string,
  cameraId: string
): Promise<CameraInstallConfig> {
  const { data } = await apiClient.get<ApiResponse<CameraInstallConfig>>(
    API_PATH.PROJECT_CAMERA_INSTALL_CONFIG(projectId, cameraId)
  )
  return data.data
}

/** 下載 go2rtc 設定檔（YAML）；需帶認證，取得 blob 後觸發下載 */
export async function downloadCameraInstallYaml(projectId: string, cameraId: string): Promise<void> {
  const res = await apiClient.get(API_PATH.PROJECT_CAMERA_INSTALL_CONFIG_DOWNLOAD(projectId, cameraId), {
    responseType: 'blob',
  })
  const blob = res.data as Blob
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `go2rtc-${cameraId.slice(0, 8)}.yaml`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 下載專案層級一鍵安裝包（zip：本專案所有攝影機的 go2rtc.yaml + run 腳本；Mac 含 run.command 可雙擊） */
export async function downloadProjectInstallPackage(
  projectId: string,
  os: 'win' | 'mac'
): Promise<void> {
  const res = await apiClient.get(API_PATH.PROJECT_CAMERAS_INSTALL_PACKAGE(projectId, os), {
    responseType: 'blob',
  })
  const blob = res.data as Blob
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = os === 'win' ? 'go2rtc-setup-windows.zip' : 'go2rtc-setup-mac.zip'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** 下載單一攝影機一鍵安裝包（zip：含 go2rtc.yaml 與 run.bat / run.sh），解壓後執行即可 */
export async function downloadCameraInstallPackage(
  projectId: string,
  cameraId: string,
  os: 'win' | 'mac'
): Promise<void> {
  const res = await apiClient.get(
    API_PATH.PROJECT_CAMERA_INSTALL_PACKAGE(projectId, cameraId, os),
    { responseType: 'blob' }
  )
  const blob = res.data as Blob
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = os === 'win' ? 'go2rtc-setup-windows.zip' : 'go2rtc-setup-mac.zip'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
