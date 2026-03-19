export type RepairRequestStatus = 'in_progress' | 'completed'

export interface RepairAttachmentMeta {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  createdAt: string
  url: string
}

export interface RepairRequestItem {
  id: string
  projectId: string
  customerName: string
  contactPhone: string
  repairContent: string
  unitLabel: string | null
  remarks: string | null
  problemCategory: string
  isSecondRepair: boolean
  deliveryDate: string | null
  repairDate: string | null
  status: RepairRequestStatus
  createdAt: string
  updatedAt: string
  photos?: RepairAttachmentMeta[]
  attachments?: RepairAttachmentMeta[]
}

export interface CreateRepairRequestPayload {
  customerName: string
  contactPhone: string
  repairContent: string
  unitLabel?: string | null
  remarks?: string | null
  problemCategory: string
  isSecondRepair?: boolean
  deliveryDate?: string
  repairDate?: string
  status?: RepairRequestStatus
  photoAttachmentIds?: string[]
  fileAttachmentIds?: string[]
}

export interface UpdateRepairRequestPayload {
  customerName?: string
  contactPhone?: string
  repairContent?: string
  unitLabel?: string | null
  remarks?: string | null
  problemCategory?: string
  isSecondRepair?: boolean
  deliveryDate?: string | null
  repairDate?: string | null
  status?: RepairRequestStatus
}

export interface RepairExecutionRecordItem {
  id: string
  repairId: string
  content: string
  recordedById: string | null
  recordedBy: { id: string; name: string | null; email: string } | null
  createdAt: string
  photos?: RepairAttachmentMeta[]
}

export interface CreateRepairRecordPayload {
  content: string
  attachmentIds?: string[]
}
