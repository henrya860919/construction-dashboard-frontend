import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types/api'

export interface HeaderConfigTimingOption {
  id: string
  label: string
}

export interface HeaderConfig {
  /** 表頭「檢查名稱」欄位標題 */
  inspectionNameLabel: string
  projectNameLabel: string
  subProjectLabel: string
  subcontractorLabel: string
  inspectionLocationLabel: string
  inspectionDateLabel: string
  timingSectionLabel: string
  timingOptions: HeaderConfigTimingOption[]
  resultSectionLabel: string
  /** 檢查結果圖例／列填寫選項（代碼＋顯示文字；現場為 radio 單選） */
  resultLegendOptions: HeaderConfigTimingOption[]
}

export interface SelfInspectionTemplateItem {
  id: string
  tenantId: string
  name: string
  description: string | null
  status: string
  blockCount: number
  createdAt: string
  updatedAt: string
}

export interface SelfInspectionBlockItem {
  id: string
  blockId: string
  categoryLabel: string
  itemName: string
  standardText: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface SelfInspectionBlockWithItems {
  id: string
  templateId: string
  title: string
  description: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  items: SelfInspectionBlockItem[]
}

export interface SelfInspectionTemplateDetailMeta extends SelfInspectionTemplateItem {
  headerConfig: HeaderConfig
}

export interface SelfInspectionTemplateDetail {
  template: SelfInspectionTemplateDetailMeta
  blocks: SelfInspectionBlockWithItems[]
}

function tenantQuery(tenantId: string | null | undefined): Record<string, string> {
  return tenantId ? { tenantId } : {}
}

export async function listSelfInspectionTemplates(
  tenantId: string | null | undefined,
  params?: { status?: string }
): Promise<SelfInspectionTemplateItem[]> {
  const { data } = await apiClient.get<ApiResponse<SelfInspectionTemplateItem[]>>(
    API_PATH.ADMIN_SELF_INSPECTION_TEMPLATES,
    { params: { ...tenantQuery(tenantId), ...params } }
  )
  return data.data
}

export async function getSelfInspectionTemplate(
  id: string,
  tenantId: string | null | undefined
): Promise<SelfInspectionTemplateDetail> {
  const { data } = await apiClient.get<ApiResponse<SelfInspectionTemplateDetail>>(
    API_PATH.ADMIN_SELF_INSPECTION_TEMPLATE(id),
    { params: tenantQuery(tenantId) }
  )
  return data.data
}

export async function createSelfInspectionTemplate(
  body: {
    name: string
    description?: string | null
    status?: string
    headerConfig?: HeaderConfig
  },
  tenantId: string | null | undefined
): Promise<SelfInspectionTemplateItem & { headerConfig?: HeaderConfig }> {
  const payload = {
    ...body,
    ...(tenantId ? { tenantId } : {}),
  }
  const { data } = await apiClient.post<
    ApiResponse<SelfInspectionTemplateItem & { headerConfig?: HeaderConfig }>
  >(API_PATH.ADMIN_SELF_INSPECTION_TEMPLATES, payload)
  return data.data
}

export async function updateSelfInspectionTemplate(
  id: string,
  body: {
    name?: string
    description?: string | null
    status?: string
    headerConfig?: HeaderConfig
  },
  tenantId: string | null | undefined
): Promise<SelfInspectionTemplateItem & { headerConfig?: HeaderConfig }> {
  const { data } = await apiClient.patch<
    ApiResponse<SelfInspectionTemplateItem & { headerConfig?: HeaderConfig }>
  >(API_PATH.ADMIN_SELF_INSPECTION_TEMPLATE(id), body, { params: tenantQuery(tenantId) })
  return data.data
}

export async function deleteSelfInspectionTemplate(
  id: string,
  tenantId: string | null | undefined
): Promise<void> {
  await apiClient.delete(API_PATH.ADMIN_SELF_INSPECTION_TEMPLATE(id), {
    params: tenantQuery(tenantId),
  })
}

export async function createSelfInspectionBlock(
  templateId: string,
  body: { title: string; description?: string | null },
  tenantId: string | null | undefined
): Promise<SelfInspectionBlockWithItems> {
  const { data } = await apiClient.post<ApiResponse<SelfInspectionBlockWithItems>>(
    API_PATH.ADMIN_SELF_INSPECTION_TEMPLATE_BLOCKS(templateId),
    body,
    { params: tenantQuery(tenantId) }
  )
  return data.data
}

export async function updateSelfInspectionBlock(
  templateId: string,
  blockId: string,
  body: { title?: string; description?: string | null; sortOrder?: number },
  tenantId: string | null | undefined
): Promise<SelfInspectionBlockWithItems> {
  const { data } = await apiClient.patch<ApiResponse<SelfInspectionBlockWithItems>>(
    API_PATH.ADMIN_SELF_INSPECTION_TEMPLATE_BLOCK(templateId, blockId),
    body,
    { params: tenantQuery(tenantId) }
  )
  return data.data
}

export async function deleteSelfInspectionBlock(
  templateId: string,
  blockId: string,
  tenantId: string | null | undefined
): Promise<void> {
  await apiClient.delete(API_PATH.ADMIN_SELF_INSPECTION_TEMPLATE_BLOCK(templateId, blockId), {
    params: tenantQuery(tenantId),
  })
}

export async function createSelfInspectionBlockItem(
  templateId: string,
  blockId: string,
  body: { categoryLabel: string; itemName: string; standardText: string },
  tenantId: string | null | undefined
): Promise<SelfInspectionBlockItem> {
  const { data } = await apiClient.post<ApiResponse<SelfInspectionBlockItem>>(
    API_PATH.ADMIN_SELF_INSPECTION_TEMPLATE_BLOCK_ITEMS(templateId, blockId),
    body,
    { params: tenantQuery(tenantId) }
  )
  return data.data
}

export async function updateSelfInspectionBlockItem(
  templateId: string,
  blockId: string,
  itemId: string,
  body: {
    categoryLabel?: string
    itemName?: string
    standardText?: string
    sortOrder?: number
  },
  tenantId: string | null | undefined
): Promise<SelfInspectionBlockItem> {
  const { data } = await apiClient.patch<ApiResponse<SelfInspectionBlockItem>>(
    API_PATH.ADMIN_SELF_INSPECTION_TEMPLATE_BLOCK_ITEM(templateId, blockId, itemId),
    body,
    { params: tenantQuery(tenantId) }
  )
  return data.data
}

export async function deleteSelfInspectionBlockItem(
  templateId: string,
  blockId: string,
  itemId: string,
  tenantId: string | null | undefined
): Promise<void> {
  await apiClient.delete(
    API_PATH.ADMIN_SELF_INSPECTION_TEMPLATE_BLOCK_ITEM(templateId, blockId, itemId),
    { params: tenantQuery(tenantId) }
  )
}
