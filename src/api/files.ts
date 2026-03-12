import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types/api'

export interface AttachmentItem {
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

export interface ListProjectFilesParams {
  projectId: string
  page?: number
  limit?: number
  category?: string
}

export interface UploadFileParams {
  file: File
  projectId: string
  category?: string
  businessId?: string
}

export interface UploadFileResult {
  id: string
  projectId: string
  fileName: string
  fileSize: number
  mimeType: string
  category: string | null
  createdAt: string
  url: string
}

export async function listProjectFiles(
  params: ListProjectFilesParams
): Promise<{ data: AttachmentItem[]; meta: { page: number; limit: number; total: number } }> {
  const { data } = await apiClient.get<ApiResponse<AttachmentItem[]>>(
    API_PATH.PROJECT_FILES(params.projectId),
    {
      params: {
        page: params.page ?? 1,
        limit: params.limit ?? 50,
        ...(params.category ? { category: params.category } : {}),
      },
    }
  )
  const meta = (data as { meta?: { page: number; limit: number; total: number } }).meta ?? {
    page: 1,
    limit: 50,
    total: 0,
  }
  return { data: (data as ApiResponse<AttachmentItem[]>).data, meta }
}

export async function uploadFile(params: UploadFileParams): Promise<UploadFileResult> {
  const form = new FormData()
  form.append('file', params.file)
  form.append('projectId', params.projectId)
  // 明確傳送 UTF-8 檔名，避免 multipart 編碼導致後端收到亂碼
  form.append('fileName', params.file.name)
  if (params.category) form.append('category', params.category)
  if (params.businessId) form.append('businessId', params.businessId)

  const { data } = await apiClient.post<ApiResponse<UploadFileResult>>(API_PATH.FILES_UPLOAD, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.data
}

export interface UploadFileWithProgressParams extends UploadFileParams {}

export interface UploadFileWithProgressOptions {
  onProgress?: (percent: number) => void
}

/**
 * 上傳檔案並支援進度回呼（用於佇列進度 UI）
 */
export async function uploadFileWithProgress(
  params: UploadFileWithProgressParams,
  options?: UploadFileWithProgressOptions
): Promise<UploadFileResult> {
  const form = new FormData()
  form.append('file', params.file)
  form.append('projectId', params.projectId)
  form.append('fileName', params.file.name)
  if (params.category) form.append('category', params.category)
  if (params.businessId) form.append('businessId', params.businessId)

  const { data } = await apiClient.post<ApiResponse<UploadFileResult>>(API_PATH.FILES_UPLOAD, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total != null && e.total > 0 && options?.onProgress) {
        const percent = Math.round((e.loaded / e.total) * 100)
        options.onProgress(percent)
      }
    },
  })
  return data.data
}

export async function deleteFile(id: string): Promise<void> {
  await apiClient.delete(API_PATH.FILES_DELETE(id))
}

/** 取得檔案 Blob 用於下載（可帶 ?download=true）；若傳入 fileName 則優先作為下載檔名（避免 header 解析問題） */
export async function getFileBlob(
  id: string,
  options?: { download?: boolean; fileName?: string }
): Promise<{ blob: Blob; fileName: string }> {
  const res = await apiClient.get(API_PATH.FILES_GET(id), {
    responseType: 'blob',
    params: options?.download ? { download: 'true' } : undefined,
  })
  const blob = res.data as Blob
  if (options?.fileName?.trim()) {
    return { blob, fileName: options.fileName.trim() }
  }
  const disposition = res.headers['content-disposition'] as string | undefined
  let fileName = 'download'
  if (disposition) {
    // 優先解析 RFC 5987: filename*=UTF-8''%encoded
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;\s]+)/i)
    if (utf8Match) {
      try {
        fileName = decodeURIComponent(utf8Match[1].trim())
      } catch {
        fileName = 'download'
      }
    } else {
      const legacyMatch = disposition.match(/filename="?([^";\n]+)"?/i)
      if (legacyMatch) fileName = decodeURIComponent(legacyMatch[1].trim().replace(/^["']|["']$/g, ''))
    }
  }
  return { blob, fileName }
}
