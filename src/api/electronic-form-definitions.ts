import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse, PaginatedResponse } from '@/types/api'

export interface ElectronicFormDefinitionListItem {
  id: string
  tenantId: string
  name: string
  description: string | null
  code: string | null
  featureKey: string | null
  /** 同一業務表單之多版定義共用；列表／送單可依此彙總 */
  formSeriesId: string
  status: string
  version: number
  createdById: string | null
  createdAt: string
  updatedAt: string
}

export interface ElectronicFormFieldItem {
  id: string
  formDefinitionId: string
  fieldKey: string
  fieldType: string
  label: string | null
  placeholder: string | null
  required: boolean
  readonly: boolean
  sortOrder: number
  parentFieldId?: string | null
  slotIndex?: number | null
  config: Record<string, unknown>
  createdAt: string
}

export type ElectronicFormFieldLayoutAssignment = {
  id: string
  parentFieldId: string | null
  slotIndex: number | null
  sortOrder: number
}

export type ElectronicFormDefinitionDetail = ElectronicFormDefinitionListItem & {
  fields: ElectronicFormFieldItem[]
}

function tenantParams(tenantId: string | undefined): Record<string, string> {
  return tenantId ? { tenantId } : {}
}

export async function listElectronicFormDefinitions(
  tenantId: string | undefined,
  params: { page?: number; limit?: number; status?: string }
): Promise<{ items: ElectronicFormDefinitionListItem[]; meta: { page: number; limit: number; total: number } }> {
  const { data } = await apiClient.get<PaginatedResponse<ElectronicFormDefinitionListItem>>(
    API_PATH.ADMIN_ELECTRONIC_FORM_DEFINITIONS,
    { params: { ...tenantParams(tenantId), ...params } }
  )
  return { items: data.data, meta: data.meta }
}

export async function getElectronicFormDefinition(
  id: string,
  tenantId: string | undefined
): Promise<ElectronicFormDefinitionDetail> {
  const { data } = await apiClient.get<ApiResponse<ElectronicFormDefinitionDetail>>(
    API_PATH.ADMIN_ELECTRONIC_FORM_DEFINITION(id),
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export async function createElectronicFormDefinition(
  tenantId: string | undefined,
  body: { name: string; description?: string | null; code?: string | null; featureKey?: string | null }
): Promise<ElectronicFormDefinitionListItem> {
  const { data } = await apiClient.post<ApiResponse<ElectronicFormDefinitionListItem>>(
    API_PATH.ADMIN_ELECTRONIC_FORM_DEFINITIONS,
    body,
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export async function updateElectronicFormDefinition(
  id: string,
  tenantId: string | undefined,
  body: { name?: string; description?: string | null; code?: string | null; featureKey?: string | null }
): Promise<ElectronicFormDefinitionListItem> {
  const { data } = await apiClient.patch<ApiResponse<ElectronicFormDefinitionListItem>>(
    API_PATH.ADMIN_ELECTRONIC_FORM_DEFINITION(id),
    body,
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export async function addElectronicFormField(
  formId: string,
  tenantId: string | undefined,
  body: {
    fieldKey: string
    fieldType: string
    label?: string | null
    placeholder?: string | null
    required?: boolean
    readonly?: boolean
    sortOrder?: number
    parentFieldId?: string | null
    slotIndex?: number | null
    config?: Record<string, unknown>
  }
): Promise<ElectronicFormFieldItem> {
  const { data } = await apiClient.post<ApiResponse<ElectronicFormFieldItem>>(
    API_PATH.ADMIN_ELECTRONIC_FORM_DEFINITION_FIELDS(formId),
    body,
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export async function updateElectronicFormField(
  formId: string,
  fieldId: string,
  tenantId: string | undefined,
  body: {
    fieldKey?: string
    fieldType?: string
    label?: string | null
    placeholder?: string | null
    required?: boolean
    readonly?: boolean
    sortOrder?: number
    config?: Record<string, unknown>
  }
): Promise<ElectronicFormFieldItem> {
  const { data } = await apiClient.patch<ApiResponse<ElectronicFormFieldItem>>(
    API_PATH.ADMIN_ELECTRONIC_FORM_DEFINITION_FIELD(formId, fieldId),
    body,
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export async function deleteElectronicFormField(
  formId: string,
  fieldId: string,
  tenantId: string | undefined
): Promise<void> {
  await apiClient.delete(API_PATH.ADMIN_ELECTRONIC_FORM_DEFINITION_FIELD(formId, fieldId), {
    params: tenantParams(tenantId),
  })
}

export async function reorderElectronicFormFields(
  formId: string,
  tenantId: string | undefined,
  assignments: ElectronicFormFieldLayoutAssignment[]
): Promise<void> {
  await apiClient.put(
    API_PATH.ADMIN_ELECTRONIC_FORM_DEFINITION_FIELDS_REORDER(formId),
    { assignments },
    { params: tenantParams(tenantId) }
  )
}

export async function publishElectronicFormDefinition(
  id: string,
  tenantId: string | undefined
): Promise<ElectronicFormDefinitionListItem> {
  const { data } = await apiClient.post<ApiResponse<ElectronicFormDefinitionListItem>>(
    API_PATH.ADMIN_ELECTRONIC_FORM_DEFINITION_PUBLISH(id),
    {},
    { params: tenantParams(tenantId) }
  )
  return data.data
}

/** 複製為新草稿（沿用 formSeriesId）；發布新版前可加欄，不可刪／改既有 fieldKey 與類型 */
export async function duplicateElectronicFormDefinitionAsDraft(
  id: string,
  tenantId: string | undefined,
  body?: { name?: string }
): Promise<ElectronicFormDefinitionDetail> {
  const { data } = await apiClient.post<ApiResponse<ElectronicFormDefinitionDetail>>(
    API_PATH.ADMIN_ELECTRONIC_FORM_DEFINITION_DUPLICATE_AS_DRAFT(id),
    body ?? {},
    { params: tenantParams(tenantId) }
  )
  return data.data
}
