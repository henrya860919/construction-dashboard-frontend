import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse, PaginatedResponse } from '@/types/api'
import type {
  HeaderConfig,
  SelfInspectionBlockWithItems,
} from '@/api/self-inspection-templates'

export interface ProjectSelfInspectionTemplateItem {
  id: string
  tenantId: string
  name: string
  description: string | null
  status: string
  recordCount: number
  /** 匯入本專案的時間（ISO） */
  linkedAt: string
  createdAt: string
  updatedAt: string
}

/** 可匯入之樣板（租戶啟用、尚未在本專案匯入） */
export interface AvailableSelfInspectionTemplateItem {
  id: string
  tenantId: string
  name: string
  description: string | null
  status: string
  createdAt: string
  updatedAt: string
}

/** 匯入 modal：租戶啟用樣板 + 是否已匯入（已匯入則 checkbox disabled） */
export interface SelfInspectionImportCatalogItem extends AvailableSelfInspectionTemplateItem {
  imported: boolean
}

export interface ProjectSelfInspectionTemplateHub {
  template: {
    id: string
    tenantId: string
    name: string
    description: string | null
    status: string
    headerConfig: HeaderConfig
    createdAt: string
    updatedAt: string
  }
  blocks: SelfInspectionBlockWithItems[]
  recordCount: number
}

export interface FilledPayload {
  header?: {
    inspectionName?: string
    projectName?: string
    subProjectName?: string
    subcontractor?: string
    inspectionLocation?: string
    inspectionDate?: string
    timingOptionId?: string
  }
  items?: Record<string, { actualText?: string; resultOptionId?: string }>
}

export interface SelfInspectionRecordItem {
  id: string
  projectId: string
  templateId: string
  filledPayload: FilledPayload
  /** 建立當下的樣板結構（詳情／建立回應才有）；列表通常不帶以減少 payload */
  structureSnapshot?: ProjectSelfInspectionTemplateHub | null
  filledById: string | null
  filledBy: { id: string; name: string | null; email: string } | null
  createdAt: string
  updatedAt: string
}

export async function listProjectSelfInspectionTemplates(
  projectId: string
): Promise<ProjectSelfInspectionTemplateItem[]> {
  const { data } = await apiClient.get<ApiResponse<ProjectSelfInspectionTemplateItem[]>>(
    `${API_PATH.PROJECT_SELF_INSPECTIONS(projectId)}/templates`
  )
  return data.data
}

export async function listAvailableProjectSelfInspectionTemplates(
  projectId: string
): Promise<AvailableSelfInspectionTemplateItem[]> {
  const { data } = await apiClient.get<ApiResponse<AvailableSelfInspectionTemplateItem[]>>(
    API_PATH.PROJECT_SELF_INSPECTION_TEMPLATES_AVAILABLE(projectId)
  )
  return data.data
}

export async function listProjectSelfInspectionImportCatalog(
  projectId: string
): Promise<SelfInspectionImportCatalogItem[]> {
  const { data } = await apiClient.get<ApiResponse<SelfInspectionImportCatalogItem[]>>(
    API_PATH.PROJECT_SELF_INSPECTION_TEMPLATES_IMPORT_CATALOG(projectId)
  )
  return data.data
}

export async function importProjectSelfInspectionTemplate(
  projectId: string,
  templateId: string
): Promise<ProjectSelfInspectionTemplateItem> {
  const { data } = await apiClient.post<ApiResponse<ProjectSelfInspectionTemplateItem>>(
    `${API_PATH.PROJECT_SELF_INSPECTIONS(projectId)}/templates`,
    { templateId }
  )
  return data.data
}

export async function removeProjectSelfInspectionTemplate(
  projectId: string,
  templateId: string
): Promise<void> {
  await apiClient.delete(API_PATH.PROJECT_SELF_INSPECTION_TEMPLATE(projectId, templateId))
}

export async function getProjectSelfInspectionTemplateHub(
  projectId: string,
  templateId: string
): Promise<ProjectSelfInspectionTemplateHub> {
  const { data } = await apiClient.get<ApiResponse<ProjectSelfInspectionTemplateHub>>(
    API_PATH.PROJECT_SELF_INSPECTION_TEMPLATE(projectId, templateId)
  )
  return data.data
}

export async function listProjectSelfInspectionRecords(
  projectId: string,
  templateId: string,
  params?: { page?: number; limit?: number }
): Promise<{ data: SelfInspectionRecordItem[]; meta: { page: number; limit: number; total: number } }> {
  const { data } = await apiClient.get<PaginatedResponse<SelfInspectionRecordItem>>(
    API_PATH.PROJECT_SELF_INSPECTION_RECORDS(projectId, templateId),
    { params }
  )
  return { data: data.data, meta: data.meta }
}

export async function createProjectSelfInspectionRecord(
  projectId: string,
  templateId: string,
  body: { filledPayload: FilledPayload }
): Promise<SelfInspectionRecordItem> {
  const { data } = await apiClient.post<ApiResponse<SelfInspectionRecordItem>>(
    API_PATH.PROJECT_SELF_INSPECTION_RECORDS(projectId, templateId),
    body
  )
  return data.data
}

export async function getProjectSelfInspectionRecord(
  projectId: string,
  templateId: string,
  recordId: string
): Promise<SelfInspectionRecordItem> {
  const { data } = await apiClient.get<ApiResponse<SelfInspectionRecordItem>>(
    API_PATH.PROJECT_SELF_INSPECTION_RECORD(projectId, templateId, recordId)
  )
  return data.data
}
