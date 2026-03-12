import { useUploadQueueStore } from '@/stores/uploadQueue'
import { uploadFileWithProgress } from '@/api/files'
import type { UploadFileParams } from '@/api/files'
import type { UploadQueueItemResult } from '@/types/upload'

/**
 * 統一上傳佇列：全站所有檔案上傳皆應經由此 composable，
 * 進度與結果會顯示在 Header「檔案上傳進度」清單（不自動展開，使用者可點擊查看）。
 *
 * - 專案附件（契約等）：使用 enqueueAndUpload
 * - 其他上傳（監測 Excel、未來功能）：使用 enqueueAndRun，傳入自訂的 API 呼叫
 */
export function useUploadQueue() {
  const store = useUploadQueueStore()

  /**
   * 專案附件上傳（POST /api/v1/files/upload）。進度會顯示在 Header 上傳清單。
   * @returns 成功時回傳 API 結果；失敗時拋出 Error，同時佇列中該項會標為 error
   */
  async function enqueueAndUpload(params: {
    file: File
    projectId: string
    category?: string | null
    businessId?: string
    /** 來源標籤，例如 'contract' | 'monitoring'，供清單顯示或篩選 */
    source?: string
  }): Promise<UploadQueueItemResult> {
    const id = store.add({
      fileName: params.file.name,
      fileSize: params.file.size,
      projectId: params.projectId,
      category: params.category,
      source: params.source,
    })
    store.setStatus(id, 'uploading')

    try {
      const result = await uploadFileWithProgress(
        {
          file: params.file,
          projectId: params.projectId,
          category: params.category ?? undefined,
          businessId: params.businessId,
        } as UploadFileParams,
        {
          onProgress: (percent) => store.setProgress(id, percent),
        }
      )
      const itemResult: UploadQueueItemResult = {
        id: result.id,
        projectId: result.projectId,
        fileName: result.fileName,
        fileSize: result.fileSize,
        mimeType: result.mimeType,
        category: result.category,
        createdAt: result.createdAt,
        url: result.url,
      }
      store.setSuccess(id, itemResult)
      return itemResult
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string } } }; message?: string }
      const message =
        err.response?.data?.error?.message ?? err.message ?? '上傳失敗，請稍後再試'
      store.setError(id, message)
      throw new Error(message)
    }
  }

  /**
   * 通用上傳：將項目加入佇列並執行自訂上傳邏輯（例如監測 Excel、其他 API）。
   * 任何「檔案上傳」都應經由 enqueueAndUpload 或 enqueueAndRun，以統一顯示在 Header 清單。
   * @param meta 檔名、大小、專案 ID 等，用於清單顯示
   * @param run 實際執行上傳的函式，需呼叫 onProgress(0-100) 回報進度，成功 resolve、失敗 reject
   */
  async function enqueueAndRun(
    meta: {
      fileName: string
      fileSize: number
      projectId: string
      category?: string | null
      source?: string
    },
    run: (onProgress: (percent: number) => void) => Promise<void>
  ): Promise<void> {
    const id = store.add({
      fileName: meta.fileName,
      fileSize: meta.fileSize,
      projectId: meta.projectId,
      category: meta.category ?? null,
      source: meta.source ?? null,
    })
    store.setStatus(id, 'uploading')
    try {
      await run((percent) => store.setProgress(id, percent))
      store.setSuccess(id, null)
    } catch (e: unknown) {
      const message =
        e instanceof Error ? e.message : '上傳失敗，請稍後再試'
      store.setError(id, message)
      throw new Error(message)
    }
  }

  return {
    store,
    enqueueAndUpload,
    enqueueAndRun,
  }
}
