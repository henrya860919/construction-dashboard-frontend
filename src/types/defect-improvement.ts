/**
 * 缺失改善：問題說明、發現人、優先度、樓層、位置、狀態、照片
 */

export type DefectStatus = 'in_progress' | 'completed'
export type DefectPriority = 'low' | 'medium' | 'high'

export interface DefectPhoto {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  createdAt: string
  url: string
}

export interface DefectItem {
  id: string
  projectId: string
  description: string
  discoveredBy: string
  priority: DefectPriority
  floor: string | null
  location: string | null
  status: DefectStatus
  createdAt: string
  updatedAt: string
  photos?: DefectPhoto[]
}

export interface DefectExecutionRecordItem {
  id: string
  defectId: string
  content: string
  recordedById: string | null
  recordedBy: { id: string; name: string | null; email: string } | null
  createdAt: string
  photos?: DefectPhoto[]
}

export interface CreateDefectPayload {
  description: string
  discoveredBy: string
  priority?: DefectPriority
  floor?: string | null
  location?: string | null
  status?: DefectStatus
  attachmentIds?: string[]
}

export interface UpdateDefectPayload {
  description?: string
  discoveredBy?: string
  priority?: DefectPriority
  floor?: string | null
  location?: string | null
  status?: DefectStatus
}

export interface CreateDefectRecordPayload {
  content: string
  attachmentIds?: string[]
}
