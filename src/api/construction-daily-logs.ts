import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse } from '@/types/api'

export interface ConstructionDailyLogWorkItemDto {
  id?: string
  pccesItemId?: string | null
  /** PCCES 項次；手填列為 null */
  itemNo?: string | null
  /** 綁定 PCCES 時之 XML itemKind；手填列為 null */
  pccesItemKind?: string | null
  /** 綁定 PCCES 時是否為結構末層（目錄列為 false）；手填列為 null */
  pccesStructuralLeaf?: boolean | null
  workItemName: string
  unit: string
  contractQty: string
  /** 綁定 PCCES 時之單價快照；未存過為 null */
  unitPrice?: string | null
  dailyQty: string
  accumulatedQty: string
  remark: string
}

export interface ConstructionDailyLogMaterialDto {
  id?: string
  materialName: string
  unit: string
  contractQty: string
  dailyUsedQty: string
  accumulatedQty: string
  remark: string
}

export interface ConstructionDailyLogPersonnelEquipmentDto {
  id?: string
  workType: string
  dailyWorkers: number
  accumulatedWorkers: number
  equipmentName: string
  dailyEquipmentQty: string
  accumulatedEquipmentQty: string
}

/** 進度管理主計畫：時間區間與累計預定 %（供日誌預定進度內插，與後端一致） */
export interface ConstructionDailyLogProgressPlanKnot {
  periodDate: string
  cumulativePlanned: string
}

export interface ConstructionDailyLogDto {
  id: string
  projectId: string
  reportNo: string | null
  weatherAm: string | null
  weatherPm: string | null
  logDate: string
  projectName: string
  contractorName: string
  approvedDurationDays: number | null
  accumulatedDays: number | null
  remainingDays: number | null
  extendedDays: number | null
  startDate: string | null
  completionDate: string | null
  plannedProgress: number | null
  /** 與預定進度內插相同之節點（供前端即時預覽） */
  progressPlanKnots?: ConstructionDailyLogProgressPlanKnot[]
  actualProgress: string | null
  specialItemA: string
  specialItemB: string
  hasTechnician: boolean
  preWorkEducation: string
  newWorkerInsurance: string
  ppeCheck: string
  otherSafetyNotes: string
  sampleTestRecord: string
  subcontractorNotice: string
  importantNotes: string
  siteManagerSigned: boolean
  createdById: string
  createdAt: string
  updatedAt: string
  workItems: ConstructionDailyLogWorkItemDto[]
  materials: ConstructionDailyLogMaterialDto[]
  personnelEquipmentRows: ConstructionDailyLogPersonnelEquipmentDto[]
}

export interface ConstructionDailyLogListItemDto {
  id: string
  logDate: string
  reportNo: string | null
  weatherAm: string | null
  weatherPm: string | null
  projectName: string
  plannedProgress: number | null
  actualProgress: string | null
  createdAt: string
}

export interface ConstructionDailyLogFormDefaults {
  projectName: string
  contractorName: string
  startDate: string | null
  approvedDurationDays: number | null
  progressPlanKnots: ConstructionDailyLogProgressPlanKnot[]
}

export type ConstructionDailyLogUpsertPayload = Omit<
  ConstructionDailyLogDto,
  | 'id'
  | 'projectId'
  | 'plannedProgress'
  | 'createdById'
  | 'createdAt'
  | 'updatedAt'
  | 'workItems'
  | 'materials'
  | 'personnelEquipmentRows'
  | 'actualProgress'
> & {
  actualProgress: number | null
  workItems: Omit<ConstructionDailyLogWorkItemDto, 'id'>[]
  materials: Omit<ConstructionDailyLogMaterialDto, 'id'>[]
  personnelEquipmentRows: Omit<ConstructionDailyLogPersonnelEquipmentDto, 'id'>[]
}

export async function listConstructionDailyLogs(
  projectId: string,
  params: { page?: number; limit?: number }
): Promise<{ list: ConstructionDailyLogListItemDto[]; meta: { page: number; limit: number; total: number } }> {
  const search = new URLSearchParams()
  if (params.page != null) search.set('page', String(params.page))
  if (params.limit != null) search.set('limit', String(params.limit))
  const q = search.toString()
  const url = `${API_PATH.PROJECT_CONSTRUCTION_DAILY_LOGS(projectId)}${q ? `?${q}` : ''}`
  const { data: body } = await apiClient.get<
    ApiResponse<ConstructionDailyLogListItemDto[]>
  >(url)
  const meta = body.meta
  if (!meta?.page || !meta.limit || meta.total === undefined) {
    throw new Error('Invalid list response')
  }
  return { list: body.data, meta: { page: meta.page, limit: meta.limit, total: meta.total } }
}

/** 專案日誌全量（後端單頁上限 100，此處自動翻頁彙總，供前端篩選／分頁） */
export async function listAllConstructionDailyLogs(
  projectId: string,
  options?: { maxPages?: number }
): Promise<ConstructionDailyLogListItemDto[]> {
  const maxPages = options?.maxPages ?? 200
  const out: ConstructionDailyLogListItemDto[] = []
  let page = 1
  const limit = 100
  for (let i = 0; i < maxPages; i++) {
    const res = await listConstructionDailyLogs(projectId, { page, limit })
    out.push(...res.list)
    if (res.list.length === 0 || res.list.length < limit || out.length >= res.meta.total) break
    page++
  }
  return out
}

export async function getConstructionDailyLogDefaults(
  projectId: string,
  params?: { logDate?: string }
): Promise<ConstructionDailyLogFormDefaults> {
  const search = new URLSearchParams()
  if (params?.logDate) search.set('logDate', params.logDate)
  const q = search.toString()
  const url = `${API_PATH.PROJECT_CONSTRUCTION_DAILY_LOG_DEFAULTS(projectId)}${q ? `?${q}` : ''}`
  const { data } = await apiClient.get<ApiResponse<ConstructionDailyLogFormDefaults>>(url)
  return data.data
}

export async function getConstructionDailyLogProgressPlanKnots(
  projectId: string,
  logDate: string
): Promise<{ progressPlanKnots: ConstructionDailyLogProgressPlanKnot[] }> {
  const search = new URLSearchParams({ logDate })
  const url = `${API_PATH.PROJECT_CONSTRUCTION_DAILY_LOG_PROGRESS_PLAN_KNOTS(projectId)}?${search}`
  const { data } = await apiClient.get<
    ApiResponse<{ progressPlanKnots: ConstructionDailyLogProgressPlanKnot[] }>
  >(url)
  return data.data
}

export interface ConstructionDailyLogPccesPickerImport {
  id: string
  version: number
  approvedAt: string | null
  approvedById: string | null
  /** 與匯入紀錄「核定生效時間」一致；null 表示以核定操作日為生效日曆日 */
  approvalEffectiveAt: string | null
}

/** 與「PCCES 明細／全部類型」同序（itemKey 升序）；父列與末層欄位一致 */
export interface ConstructionDailyLogPccesPickerRow {
  pccesItemId: string
  itemKey: number
  parentItemKey: number | null
  itemNo: string
  workItemName: string
  unit: string
  itemKind: string
  contractQty: string
  unitPrice: string
  isStructuralLeaf: boolean
  /** 非末層為 null */
  priorAccumulatedQty: string | null
}

/** @deprecated 後端回傳空陣列；請改用 `rows` */
export interface ConstructionDailyLogPccesPickerGroup {
  parent: { itemNo: string; workItemName: string; unit: string } | null
  children: ConstructionDailyLogPccesPickerRow[]
}

export interface ConstructionDailyLogPccesPickerResponse {
  pccesImport: ConstructionDailyLogPccesPickerImport | null
  /** 全部工項列，itemKey 升序（同匯入明細列表） */
  rows: ConstructionDailyLogPccesPickerRow[]
  /** @deprecated 請改用 `rows` */
  groups: ConstructionDailyLogPccesPickerGroup[]
  /** 僅結構末層（等同 `rows.filter(r => r.isStructuralLeaf)`） */
  items: ConstructionDailyLogPccesPickerRow[]
}

export async function getConstructionDailyLogPccesWorkItems(
  projectId: string,
  params: { logDate: string; excludeLogId?: string }
): Promise<ConstructionDailyLogPccesPickerResponse> {
  const search = new URLSearchParams()
  search.set('logDate', params.logDate)
  if (params.excludeLogId) search.set('excludeLogId', params.excludeLogId)
  const url = `${API_PATH.PROJECT_CONSTRUCTION_DAILY_LOG_PCCES_WORK_ITEMS(projectId)}?${search}`
  const { data } = await apiClient.get<ApiResponse<ConstructionDailyLogPccesPickerResponse>>(url)
  return data.data
}

export interface PreviewPccesActualProgressBody {
  logDate: string
  excludeLogId?: string
  overlayWorkItems: { pccesItemId: string; dailyQty: string }[]
}

export interface PreviewPccesActualProgressResult {
  actualProgress: string
  contractTotalAmount: string
  weightedDoneAmount: string
  generalLeafCount: number
}

export async function previewConstructionDailyLogPccesActualProgress(
  projectId: string,
  body: PreviewPccesActualProgressBody
): Promise<PreviewPccesActualProgressResult> {
  const { data } = await apiClient.post<ApiResponse<PreviewPccesActualProgressResult>>(
    API_PATH.PROJECT_CONSTRUCTION_DAILY_LOG_PREVIEW_PCCES_ACTUAL(projectId),
    body
  )
  return data.data
}

export async function getConstructionDailyLog(
  projectId: string,
  logId: string
): Promise<ConstructionDailyLogDto> {
  const { data } = await apiClient.get<ApiResponse<ConstructionDailyLogDto>>(
    API_PATH.PROJECT_CONSTRUCTION_DAILY_LOG(projectId, logId)
  )
  return data.data
}

export async function createConstructionDailyLog(
  projectId: string,
  payload: ConstructionDailyLogUpsertPayload
): Promise<ConstructionDailyLogDto> {
  const { data } = await apiClient.post<ApiResponse<ConstructionDailyLogDto>>(
    API_PATH.PROJECT_CONSTRUCTION_DAILY_LOGS(projectId),
    payload
  )
  return data.data
}

export async function updateConstructionDailyLog(
  projectId: string,
  logId: string,
  payload: ConstructionDailyLogUpsertPayload
): Promise<ConstructionDailyLogDto> {
  const { data } = await apiClient.patch<ApiResponse<ConstructionDailyLogDto>>(
    API_PATH.PROJECT_CONSTRUCTION_DAILY_LOG(projectId, logId),
    payload
  )
  return data.data
}

export async function deleteConstructionDailyLog(projectId: string, logId: string): Promise<void> {
  await apiClient.delete<ApiResponse<{ ok: boolean }>>(
    API_PATH.PROJECT_CONSTRUCTION_DAILY_LOG(projectId, logId)
  )
}
