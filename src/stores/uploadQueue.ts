import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { UploadQueueItem, UploadQueueStatus, UploadQueueItemResult } from '@/types/upload'

export const useUploadQueueStore = defineStore('uploadQueue', () => {
  const items = ref<UploadQueueItem[]>([])

  /** 用於 Header badge：有「尚未被使用者清除」的項目數（含上傳中、成功、失敗） */
  const badgeCount = computed(() => items.value.length)

  /** 是否有正在上傳中的項目 */
  const hasActiveUploads = computed(() =>
    items.value.some((i) => i.status === 'pending' || i.status === 'uploading')
  )

  /** 由新到舊排序，供清單顯示 */
  const itemsByNewest = computed(() => [...items.value].sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  ))

  function add(entry: {
    fileName: string
    fileSize: number
    projectId: string
    category?: string | null
    /** 可選來源標籤，例如 'contract' | 'monitoring'，供之後篩選或顯示 */
    source?: string
  }): string {
    const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const item: UploadQueueItem = {
      id,
      fileName: entry.fileName,
      fileSize: entry.fileSize,
      status: 'pending',
      progress: 0,
      errorMessage: null,
      projectId: entry.projectId,
      category: entry.category ?? null,
      result: null,
      addedAt: new Date().toISOString(),
      source: entry.source ?? null,
    }
    items.value.push(item)
    return id
  }

  function setStatus(id: string, status: UploadQueueStatus) {
    const item = items.value.find((i) => i.id === id)
    if (item) item.status = status
  }

  function setProgress(id: string, progress: number) {
    const item = items.value.find((i) => i.id === id)
    if (item) {
      item.status = 'uploading'
      item.progress = Math.min(100, Math.max(0, progress))
    }
  }

  function setSuccess(id: string, result: UploadQueueItemResult | null) {
    const item = items.value.find((i) => i.id === id)
    if (item) {
      item.status = 'success'
      item.progress = 100
      item.errorMessage = null
      item.result = result
    }
  }

  function setError(id: string, errorMessage: string) {
    const item = items.value.find((i) => i.id === id)
    if (item) {
      item.status = 'error'
      item.errorMessage = errorMessage
    }
  }

  function remove(id: string) {
    items.value = items.value.filter((i) => i.id !== id)
  }

  /** 清除所有已完成（成功或失敗）的項目 */
  function clearCompleted() {
    items.value = items.value.filter(
      (i) => i.status !== 'success' && i.status !== 'error'
    )
  }

  /** 清除全部（僅在無上傳中時建議使用，或由 UI 決定） */
  function clearAll() {
    items.value = []
  }

  return {
    items,
    badgeCount,
    hasActiveUploads,
    itemsByNewest,
    add,
    setStatus,
    setProgress,
    setSuccess,
    setError,
    remove,
    clearCompleted,
    clearAll,
  }
})
