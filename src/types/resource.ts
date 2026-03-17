/** 資源類型：人力、機具、材料 */
export type ProjectResourceType = 'labor' | 'equipment' | 'material'

export interface ProjectResourceItem {
  id: string
  projectId: string
  type: ProjectResourceType
  name: string
  unit: string
  unitCost: number
  capacityType: string | null
  dailyCapacity: number | null
  description: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateProjectResourcePayload {
  type: ProjectResourceType
  name: string
  unit: string
  unitCost: number
  capacityType?: string | null
  dailyCapacity?: number | null
  description?: string | null
}

export interface UpdateProjectResourcePayload {
  name?: string
  unit?: string
  unitCost?: number
  capacityType?: string | null
  dailyCapacity?: number | null
  description?: string | null
}
