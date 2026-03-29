import { apiClient } from './client'
import { API_PATH } from '@/constants/api'
import type { ApiResponse, PaginatedResponse } from '@/types/api'

export interface OrgTreeMember {
  userId: string
  name: string | null
  positionName: string
  /** 職位職等（對應 OrgPosition.level）；舊版 API 可能缺省 */
  positionLevel?: number
  isManager: boolean
}

export interface OrgDeptTreeNode {
  id: string
  name: string
  icon: string
  parentId: string | null
  sortOrder: number
  status: string
  memberCount: number
  members: OrgTreeMember[]
  children: OrgDeptTreeNode[]
}

export interface OrgTreeResponse {
  departmentCount: number
  memberCount: number
  departments: OrgDeptTreeNode[]
}

export interface OrgMemberRow {
  assignmentId: string
  userId: string
  name: string
  /** 單筆 GET 時帶入，列表可能缺省 */
  email?: string
  departmentPath: string
  departmentId: string
  positionId: string
  positionName: string
  level: number
  approvalLimit: string | null
  isManager: boolean
  isPrimary: boolean
  userStatus: string
}

export interface OrgDepartmentDto {
  id: string
  tenantId: string
  name: string
  icon: string
  parentId: string | null
  sortOrder: number
  status: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  deletedById: string | null
}

export interface OrgPositionDto {
  id: string
  tenantId: string
  name: string
  level: number
  approvalLimit: string | null
  departmentId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  deletedById: string | null
}

function tenantParams(tenantId?: string) {
  return tenantId ? { tenantId } : undefined
}

export async function fetchOrgTree(tenantId?: string): Promise<OrgTreeResponse> {
  const { data } = await apiClient.get<ApiResponse<OrgTreeResponse>>(API_PATH.ORG_TREE, {
    params: tenantParams(tenantId),
  })
  return data.data
}

export async function fetchOrgMembers(opts: {
  tenantId?: string
  departmentId?: string
  page?: number
  limit?: number
}): Promise<PaginatedResponse<OrgMemberRow>> {
  const { data } = await apiClient.get<PaginatedResponse<OrgMemberRow>>(API_PATH.ORG_MEMBERS, {
    params: {
      ...tenantParams(opts.tenantId),
      departmentId: opts.departmentId,
      page: opts.page,
      limit: opts.limit,
    },
  })
  return data
}

export async function fetchOrgFindApprover(
  amount: string,
  opts?: { tenantId?: string; userId?: string }
): Promise<{
  approverUserId: string | null
  approverName?: string | null
  departmentId?: string
  reason: string
}> {
  const { data } = await apiClient.get<
    ApiResponse<{
      approverUserId: string | null
      approverName?: string | null
      departmentId?: string
      reason: string
    }>
  >(API_PATH.ORG_FIND_APPROVER, {
    params: {
      amount,
      ...tenantParams(opts?.tenantId),
      ...(opts?.userId ? { userId: opts.userId } : {}),
    },
  })
  return data.data
}

export async function adminListOrgDepartments(tenantId?: string): Promise<OrgDepartmentDto[]> {
  const { data } = await apiClient.get<ApiResponse<OrgDepartmentDto[]>>(
    API_PATH.ADMIN_ORG_DEPARTMENTS,
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export async function adminCreateOrgDepartment(
  body: { name: string; icon?: string; parentId?: string | null; sortOrder?: number },
  tenantId?: string
): Promise<OrgDepartmentDto> {
  const { data } = await apiClient.post<ApiResponse<OrgDepartmentDto>>(
    API_PATH.ADMIN_ORG_DEPARTMENTS,
    body,
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export async function adminUpdateOrgDepartment(
  id: string,
  body: Partial<{
    name: string
    icon: string
    parentId: string | null
    sortOrder: number
    status: 'active' | 'archived'
  }>,
  tenantId?: string
): Promise<OrgDepartmentDto> {
  const { data } = await apiClient.patch<ApiResponse<OrgDepartmentDto>>(
    API_PATH.ADMIN_ORG_DEPARTMENT(id),
    body,
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export async function adminDeleteOrgDepartment(id: string, tenantId?: string): Promise<void> {
  await apiClient.delete(API_PATH.ADMIN_ORG_DEPARTMENT(id), { params: tenantParams(tenantId) })
}

export async function adminReorderOrgDepartments(
  items: { id: string; sortOrder: number }[],
  tenantId?: string
): Promise<void> {
  await apiClient.patch(API_PATH.ADMIN_ORG_DEPARTMENTS_REORDER, { items }, { params: tenantParams(tenantId) })
}

export async function adminListOrgPositions(
  tenantId?: string,
  departmentId?: string | null
): Promise<OrgPositionDto[]> {
  const { data } = await apiClient.get<ApiResponse<OrgPositionDto[]>>(API_PATH.ADMIN_ORG_POSITIONS, {
    params: {
      ...tenantParams(tenantId),
      ...(departmentId !== undefined
        ? { departmentId: departmentId === null ? 'null' : departmentId }
        : {}),
    },
  })
  return data.data
}

export async function adminCreateOrgPosition(
  body: {
    name: string
    level?: number
    approvalLimit?: number | null
    departmentId?: string | null
    sortOrder?: number
  },
  tenantId?: string
): Promise<OrgPositionDto> {
  const { data } = await apiClient.post<ApiResponse<OrgPositionDto>>(
    API_PATH.ADMIN_ORG_POSITIONS,
    body,
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export async function adminUpdateOrgPosition(
  id: string,
  body: Partial<{
    name: string
    level: number
    approvalLimit: number | null
    departmentId: string | null
    sortOrder: number
  }>,
  tenantId?: string
): Promise<OrgPositionDto> {
  const { data } = await apiClient.patch<ApiResponse<OrgPositionDto>>(
    API_PATH.ADMIN_ORG_POSITION(id),
    body,
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export async function adminDeleteOrgPosition(id: string, tenantId?: string): Promise<void> {
  await apiClient.delete(API_PATH.ADMIN_ORG_POSITION(id), { params: tenantParams(tenantId) })
}

/** 後台：組織指派列表（分頁），與 GET /org/members 資料形狀相同 */
export async function adminListOrgAssignments(opts: {
  tenantId?: string
  departmentId?: string
  page?: number
  limit?: number
}): Promise<PaginatedResponse<OrgMemberRow>> {
  const { data } = await apiClient.get<PaginatedResponse<OrgMemberRow>>(
    API_PATH.ADMIN_ORG_ASSIGNMENTS,
    {
      params: {
        ...tenantParams(opts.tenantId),
        departmentId: opts.departmentId,
        page: opts.page,
        limit: opts.limit,
      },
    }
  )
  return data
}

/** 人員組織指派（建立後回傳列） */
export async function adminCreateOrgAssignment(
  body: {
    userId: string
    departmentId: string
    positionId: string
    isPrimary?: boolean
    isManager?: boolean
    startedAt?: string
  },
  tenantId?: string
): Promise<Record<string, unknown>> {
  const { data } = await apiClient.post<ApiResponse<Record<string, unknown>>>(
    API_PATH.ADMIN_ORG_ASSIGNMENTS,
    body,
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export async function adminGetOrgAssignment(
  assignmentId: string,
  tenantId?: string
): Promise<OrgMemberRow> {
  const { data } = await apiClient.get<ApiResponse<OrgMemberRow>>(
    API_PATH.ADMIN_ORG_ASSIGNMENT(assignmentId),
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export async function adminUpdateOrgAssignment(
  assignmentId: string,
  body: Partial<{
    departmentId: string
    positionId: string
    isPrimary: boolean
    isManager: boolean
    startedAt: string
  }>,
  tenantId?: string
): Promise<Record<string, unknown>> {
  const { data } = await apiClient.patch<ApiResponse<Record<string, unknown>>>(
    API_PATH.ADMIN_ORG_ASSIGNMENT(assignmentId),
    body,
    { params: tenantParams(tenantId) }
  )
  return data.data
}

export async function adminRemoveOrgAssignment(
  assignmentId: string,
  tenantId?: string
): Promise<void> {
  await apiClient.delete(API_PATH.ADMIN_ORG_ASSIGNMENT(assignmentId), {
    params: tenantParams(tenantId),
  })
}
