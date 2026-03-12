/**
 * 上傳佇列項目狀態
 */
export type UploadQueueStatus = 'pending' | 'uploading' | 'success' | 'error'

/**
 * 上傳佇列單一項目（用於 Header 進度清單）
 */
export interface UploadQueueItem {
  id: string
  fileName: string
  fileSize: number
  status: UploadQueueStatus
  /** 0–100，僅 status === 'uploading' 時有意義 */
  progress: number
  /** 錯誤訊息，僅 status === 'error' 時有值 */
  errorMessage: string | null
  projectId: string
  category: string | null
  /** 上傳成功後 API 回傳，僅 status === 'success' 時有值（非附件類上傳可為 null） */
  result: UploadQueueItemResult | null
  addedAt: string
  /** 可選來源，例如 'contract' | 'monitoring'，供篩選或顯示 */
  source: string | null
}

export interface UploadQueueItemResult {
  id: string
  projectId: string
  fileName: string
  fileSize: number
  mimeType: string
  category: string | null
  createdAt: string
  url: string
}
