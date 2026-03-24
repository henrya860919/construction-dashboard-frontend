<script setup lang="ts">
import type { ColumnDef, FilterFn } from '@tanstack/vue-table'
import { ref, computed, watch, h } from 'vue'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getProject,
  getProjectMembers,
  getProjectMembersAvailable,
  addProjectMember,
  setProjectMemberStatus,
  removeProjectMember,
} from '@/api/project'
import { getAdminTenantModuleEntitlements } from '@/api/admin'
import {
  effectivePlatformDisabledModuleIds,
  type PermissionModuleId,
} from '@/constants/permission-modules'
import type { ProjectMemberItem, ProjectMemberAvailableItem } from '@/types'
import type { TableListFeatures } from '@/types/data-table'
import { Plus, Loader2 } from 'lucide-vue-next'
import DataTableColumnHeader from '@/components/common/data-table/DataTableColumnHeader.vue'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import DataTableFeatureToolbar from '@/components/common/data-table/DataTableFeatureToolbar.vue'
import ProjectMembersRowActions from '@/views/contract/ProjectMembersRowActions.vue'
import { useClientDataTable } from '@/composables/useClientDataTable'
import PermissionMatrixForm from '@/components/common/PermissionMatrixForm.vue'
import {
  fetchProjectMemberPermissionOverrides,
  replaceProjectMemberPermissionOverrides,
  resetProjectMemberPermissionOverrides,
  toFullModulesPayload,
  type ModulesMap,
} from '@/api/project-permissions'
import { permissionModulesDifferingFromBaseline } from '@/lib/permission-module-diff'
import { useAuthStore } from '@/stores/auth'
import { useProjectPermissionsStore } from '@/stores/projectPermissions'
import { useProjectPermission } from '@/composables/useProjectPermission'

const route = useRoute()
const authStore = useAuthStore()
const projectPermissionsStore = useProjectPermissionsStore()

const projectId = computed(() => (route.params.projectId as string) ?? '')
const { can } = useProjectPermission(projectId)

/** 與後端 project.members 模組對齊：read 看列表、create 新增／可加入名單、update 狀態與覆寫矩陣、delete 移出 */
const canReadMembers = computed(() => can('project.members', 'read'))
const canCreateMembers = computed(() => can('project.members', 'create'))
const canUpdateMembers = computed(() => can('project.members', 'update'))
const canDeleteMembers = computed(() => can('project.members', 'delete'))

const canShowMemberToolbar = computed(
  () => canCreateMembers.value || canUpdateMembers.value || canDeleteMembers.value
)

/** 專案內「成員模組權限覆寫」僅租戶／平台管理員（與後端 assertProjectMemberPermissionOverridesManage 一致） */
const canManageMemberPermissionMatrix = computed(() => authStore.canAccessAdmin)

function getProjectId(): string {
  return (route.params.projectId as string) ?? ''
}

const loading = ref(true)
const list = ref<ProjectMemberItem[]>([])
const errorMessage = ref('')
const addDialogOpen = ref(false)
const availableUsers = ref<ProjectMemberAvailableItem[]>([])
const availableLoading = ref(false)
const selectedUserId = ref<string>('')
const adding = ref(false)
const addError = ref('')

const removeDialogOpen = ref(false)
const removingMember = ref<ProjectMemberItem | null>(null)
const removing = ref(false)

const togglingStatusId = ref<string | null>(null)

const TABLE_FEATURES: TableListFeatures = {
  search: true,
  filtersAndSort: true,
  columnVisibility: true,
}

const COLUMN_LABELS: Record<string, string> = {
  name: '姓名',
  email: 'Email',
  systemRole: '系統角色',
  memberType: '成員類型',
  accountStatus: '帳號狀態',
  projectStatus: '專案狀態',
}

const SYSTEM_ROLE_FACET_OPTIONS = [
  { value: 'platform_admin', label: '平台管理員' },
  { value: 'tenant_admin', label: '租戶管理員' },
  { value: 'project_user', label: '專案使用者' },
] as const

const MEMBER_TYPE_FACET_OPTIONS = [
  { value: 'internal', label: '內部成員' },
  { value: 'external', label: '外部成員' },
] as const

const ACCOUNT_STATUS_FACET_OPTIONS = [
  { value: 'active', label: '使用中' },
  { value: 'suspended', label: '已停用' },
] as const

const PROJECT_STATUS_FACET_OPTIONS = [
  { value: 'active', label: '使用中' },
  { value: 'suspended', label: '已停用' },
] as const

const membersGlobalFilterFn: FilterFn<ProjectMemberItem> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? '')
    .trim()
    .toLowerCase()
  if (!q) return true
  const m = row.original
  const name = (m.user.name ?? '').toLowerCase()
  const email = m.user.email.toLowerCase()
  return name.includes(q) || email.includes(q)
}

function systemRoleLabel(role: string): string {
  const map: Record<string, string> = {
    project_user: '專案使用者',
    tenant_admin: '租戶管理員',
    platform_admin: '平台管理員',
  }
  return map[role] ?? role
}

function memberTypeLabel(type: string): string {
  return type === 'external' ? '外部成員' : '內部成員'
}

function statusLabel(status: string): string {
  return status === 'suspended' ? '已停用' : '使用中'
}

function projectStatusLabel(status: string): string {
  return status === 'suspended' ? '已停用' : '使用中'
}

async function toggleMemberStatus(member: ProjectMemberItem) {
  const nextStatus = member.status === 'active' ? 'suspended' : 'active'
  togglingStatusId.value = member.id
  errorMessage.value = ''
  try {
    await setProjectMemberStatus(getProjectId(), member.userId, nextStatus)
    await loadMembers()
  } catch {
    errorMessage.value = nextStatus === 'suspended' ? '停用失敗' : '啟用失敗'
  } finally {
    togglingStatusId.value = null
  }
}

async function loadMembers() {
  const id = getProjectId()
  if (!id) return
  loading.value = true
  errorMessage.value = ''
  try {
    list.value = await getProjectMembers(id)
  } catch {
    errorMessage.value = '無法載入專案成員'
  } finally {
    loading.value = false
  }
}

async function openAddDialog() {
  addError.value = ''
  selectedUserId.value = ''
  addDialogOpen.value = true
  availableLoading.value = true
  try {
    availableUsers.value = await getProjectMembersAvailable(getProjectId(), 200)
  } catch {
    addError.value = '無法載入可加入的成員名單'
  } finally {
    availableLoading.value = false
  }
}

function closeAddDialog() {
  addDialogOpen.value = false
  selectedUserId.value = ''
  addError.value = ''
}

async function submitAdd() {
  if (!selectedUserId.value) {
    addError.value = '請選擇成員'
    return
  }
  adding.value = true
  addError.value = ''
  try {
    await addProjectMember(getProjectId(), { userId: selectedUserId.value })
    closeAddDialog()
    await loadMembers()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: { message?: string } } } }
    addError.value = err.response?.data?.error?.message ?? '新增失敗'
  } finally {
    adding.value = false
  }
}

function openRemoveDialog(member: ProjectMemberItem) {
  removingMember.value = member
  removeDialogOpen.value = true
}

function closeRemoveDialog() {
  removeDialogOpen.value = false
  removingMember.value = null
}

const selectColumn: ColumnDef<ProjectMemberItem, unknown> = {
  id: 'select',
  header: ({ table }) =>
    h(Checkbox, {
      checked: table.getIsAllPageRowsSelected()
        ? true
        : table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : false,
      'onUpdate:checked': (v: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!v),
      'aria-label': '全選',
    }),
  cell: ({ row }) =>
    h(Checkbox, {
      checked: row.getIsSelected(),
      'onUpdate:checked': (v: boolean | 'indeterminate') => row.toggleSelected(!!v),
      'aria-label': '選取此列',
    }),
  enableSorting: false,
  enableHiding: false,
}

const columns = computed<ColumnDef<ProjectMemberItem, unknown>[]>(() => {
  const dataCols: ColumnDef<ProjectMemberItem, unknown>[] = [
    {
      accessorKey: 'user.name',
      id: 'name',
      header: ({ column }) =>
        h(DataTableColumnHeader, { column, title: '姓名', class: 'text-foreground' }),
      meta: { label: '姓名', searchable: true },
      cell: ({ row }) =>
        h('div', { class: 'font-medium text-foreground' }, row.original.user.name || '—'),
    },
    {
      accessorKey: 'user.email',
      id: 'email',
      header: ({ column }) =>
        h(DataTableColumnHeader, { column, title: 'Email', class: 'text-foreground' }),
      meta: { label: 'Email', searchable: true },
      cell: ({ row }) => h('div', { class: 'text-muted-foreground' }, row.original.user.email),
    },
    {
      accessorKey: 'user.systemRole',
      id: 'systemRole',
      filterFn: 'arrIncludesSome',
      header: ({ column }) =>
        h(DataTableColumnHeader, { column, title: '系統角色', class: 'text-foreground' }),
      meta: {
        label: '系統角色',
        filter: {
          type: 'faceted',
          title: '系統角色',
          options: [...SYSTEM_ROLE_FACET_OPTIONS],
        },
      },
      cell: ({ row }) =>
        h('div', { class: 'text-foreground' }, systemRoleLabel(row.original.user.systemRole)),
    },
    {
      accessorKey: 'user.memberType',
      id: 'memberType',
      filterFn: 'arrIncludesSome',
      header: ({ column }) =>
        h(DataTableColumnHeader, { column, title: '成員類型', class: 'text-foreground' }),
      meta: {
        label: '成員類型',
        filter: {
          type: 'faceted',
          title: '成員類型',
          options: [...MEMBER_TYPE_FACET_OPTIONS],
        },
      },
      cell: ({ row }) =>
        h('div', { class: 'text-foreground' }, memberTypeLabel(row.original.user.memberType)),
    },
    {
      accessorKey: 'user.status',
      id: 'accountStatus',
      filterFn: 'arrIncludesSome',
      header: ({ column }) =>
        h(DataTableColumnHeader, { column, title: '帳號狀態', class: 'text-foreground' }),
      meta: {
        label: '帳號狀態',
        filter: {
          type: 'faceted',
          title: '帳號狀態',
          options: [...ACCOUNT_STATUS_FACET_OPTIONS],
        },
      },
      cell: ({ row }) =>
        h('div', { class: 'text-foreground' }, statusLabel(row.original.user.status)),
    },
    {
      accessorKey: 'status',
      id: 'projectStatus',
      filterFn: 'arrIncludesSome',
      header: ({ column }) =>
        h(DataTableColumnHeader, { column, title: '專案狀態', class: 'text-foreground' }),
      meta: {
        label: '專案狀態',
        filter: {
          type: 'faceted',
          title: '專案狀態',
          options: [...PROJECT_STATUS_FACET_OPTIONS],
        },
      },
      cell: ({ row }) =>
        h('div', { class: 'text-foreground' }, projectStatusLabel(row.original.status)),
    },
    {
      id: 'actions',
      header: () => h('div', { class: 'w-[4rem]' }),
      cell: ({ row }) => {
        const showPermMatrix =
          canManageMemberPermissionMatrix.value && row.original.user.systemRole !== 'platform_admin'
        const anyRowAction = canUpdateMembers.value || canDeleteMembers.value || showPermMatrix
        if (!anyRowAction) {
          return h('span', { class: 'text-xs text-muted-foreground' }, '—')
        }
        return h(ProjectMembersRowActions, {
          row: row.original,
          togglingStatusId: togglingStatusId.value,
          canUpdateMembership: canUpdateMembers.value,
          canRemoveMember: canDeleteMembers.value,
          canEditPermissions: showPermMatrix,
          onToggleStatus: (r: ProjectMemberItem) => toggleMemberStatus(r),
          onRemove: (r: ProjectMemberItem) => openRemoveDialog(r),
          onEditPermissions: (r: ProjectMemberItem) => openProjectPermDialog(r),
        })
      },
      enableSorting: false,
      enableHiding: false,
    },
  ]
  const withSelect =
    canUpdateMembers.value || canDeleteMembers.value ? [selectColumn, ...dataCols] : dataCols
  return withSelect
})

const hasSelectColumn = computed(() => canUpdateMembers.value || canDeleteMembers.value)

const { table, globalFilter, hasActiveFilters, resetTableState } = useClientDataTable({
  data: list,
  columns,
  features: TABLE_FEATURES,
  getRowId: (row) => row.id,
  globalFilterFn: membersGlobalFilterFn,
  enableRowSelection: hasSelectColumn,
})

const projectMembersEmptyText = computed(() => {
  if (list.value.length === 0) {
    const q = globalFilter.value.trim()
    if (q) return '沒有符合條件的資料'
    return '尚無專案成員，請從「新增成員」加入同租戶的成員。'
  }
  return '沒有符合條件的資料'
})

const selectedRows = computed(() => table.getSelectedRowModel().rows)
const hasSelection = computed(() => selectedRows.value.length > 0)

function clearSelection() {
  table.setRowSelection({})
}

async function confirmRemove() {
  const member = removingMember.value
  if (!member) return
  removing.value = true
  errorMessage.value = ''
  try {
    await removeProjectMember(getProjectId(), member.userId)
    closeRemoveDialog()
    table.setRowSelection({})
    await loadMembers()
  } catch {
    errorMessage.value = '移除失敗'
  } finally {
    removing.value = false
  }
}

const projectPermDialogOpen = ref(false)
const projectPermMember = ref<ProjectMemberItem | null>(null)
const projectPermModules = ref<ModulesMap>({})
/** 與「重設為租戶範本」一致的基準矩陣，用於標示專案客製列 */
const projectPermBaseline = ref<ModulesMap>({})
const projectPermLoading = ref(false)
const projectPermSaving = ref(false)
const projectPermResetting = ref(false)
const projectPermError = ref('')

const projectPermHighlightModuleIds = computed(() =>
  permissionModulesDifferingFromBaseline(projectPermModules.value, projectPermBaseline.value)
)

async function openProjectPermDialog(member: ProjectMemberItem) {
  const pid = getProjectId()
  if (!pid) return
  projectPermMember.value = member
  projectPermError.value = ''
  projectPermDialogOpen.value = true
  projectPermLoading.value = true
  try {
    const res = await fetchProjectMemberPermissionOverrides(pid, member.userId)
    projectPermModules.value = res.modules
    projectPermBaseline.value = res.baselineModules
  } catch {
    projectPermError.value = '無法載入專案權限'
    projectPermModules.value = {}
    projectPermBaseline.value = {}
  } finally {
    projectPermLoading.value = false
  }
}

function closeProjectPermDialog() {
  projectPermDialogOpen.value = false
  projectPermMember.value = null
  projectPermError.value = ''
  projectPermModules.value = {}
  projectPermBaseline.value = {}
}

async function saveProjectPermOverrides() {
  const member = projectPermMember.value
  const pid = getProjectId()
  if (!member || !pid) return
  projectPermSaving.value = true
  projectPermError.value = ''
  try {
    const payload = toFullModulesPayload(projectPermModules.value)
    const res = await replaceProjectMemberPermissionOverrides(pid, member.userId, payload)
    projectPermModules.value = res.modules
    projectPermBaseline.value = res.baselineModules
    if (authStore.user?.id === member.userId) {
      projectPermissionsStore.invalidateProject(pid)
    }
    closeProjectPermDialog()
  } catch (e: unknown) {
    const res =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        : null
    projectPermError.value = res?.message ?? '儲存失敗'
  } finally {
    projectPermSaving.value = false
  }
}

async function resetProjectPermOverrides() {
  const member = projectPermMember.value
  const pid = getProjectId()
  if (!member || !pid) return
  projectPermResetting.value = true
  projectPermError.value = ''
  try {
    const res = await resetProjectMemberPermissionOverrides(pid, member.userId)
    projectPermModules.value = res.modules
    projectPermBaseline.value = res.baselineModules
    if (authStore.user?.id === member.userId) {
      projectPermissionsStore.invalidateProject(pid)
    }
  } catch (e: unknown) {
    const res =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        : null
    projectPermError.value = res?.message ?? '重設失敗'
  } finally {
    projectPermResetting.value = false
  }
}

const batchSuspendOpen = ref(false)
const batchSuspendLoading = ref(false)

function openBatchSuspend() {
  batchSuspendOpen.value = true
}

function closeBatchSuspend() {
  batchSuspendOpen.value = false
}

async function confirmBatchSuspend() {
  const toSuspend = selectedRows.value.filter((r) => r.original.status === 'active')
  if (!toSuspend.length) {
    closeBatchSuspend()
    return
  }
  batchSuspendLoading.value = true
  errorMessage.value = ''
  try {
    for (const r of toSuspend) {
      await setProjectMemberStatus(getProjectId(), r.original.userId, 'suspended')
    }
    closeBatchSuspend()
    table.setRowSelection({})
    await loadMembers()
  } catch {
    errorMessage.value = '批次停用失敗'
  } finally {
    batchSuspendLoading.value = false
  }
}

const batchRemoveOpen = ref(false)
const batchRemoveLoading = ref(false)

function openBatchRemove() {
  batchRemoveOpen.value = true
}

function closeBatchRemove() {
  batchRemoveOpen.value = false
}

/** 平台關閉之模組（與租戶資訊／後台權限範本一致） */
const platformDisabledModuleIds = ref<PermissionModuleId[]>([])

async function loadPlatformModuleEntitlements() {
  const pid = getProjectId()
  if (!pid) {
    platformDisabledModuleIds.value = []
    return
  }
  let tenantId: string | undefined = authStore.user?.tenantId ?? undefined
  if (authStore.isPlatformAdmin) {
    try {
      const p = await getProject(pid)
      tenantId = p?.tenantId ?? undefined
    } catch {
      platformDisabledModuleIds.value = []
      return
    }
  }
  if (!tenantId) {
    platformDisabledModuleIds.value = []
    return
  }
  try {
    const mod = await getAdminTenantModuleEntitlements(
      authStore.isPlatformAdmin ? tenantId : undefined
    )
    platformDisabledModuleIds.value = effectivePlatformDisabledModuleIds(
      mod.moduleEntitlementsGranted,
      mod.disabledModuleIds
    )
  } catch {
    platformDisabledModuleIds.value = []
  }
}

async function confirmBatchRemove() {
  const ids = selectedRows.value.map((r) => r.original)
  if (!ids.length) return
  batchRemoveLoading.value = true
  errorMessage.value = ''
  try {
    for (const m of ids) {
      await removeProjectMember(getProjectId(), m.userId)
    }
    closeBatchRemove()
    table.setRowSelection({})
    await loadMembers()
  } catch {
    errorMessage.value = '批次移除失敗'
  } finally {
    batchRemoveLoading.value = false
  }
}

watch(
  projectId,
  (id) => {
    if (id) {
      void loadMembers()
      void loadPlatformModuleEntitlements()
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">專案成員</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        專案成員來自租戶成員，可將同租戶的成員加入此專案；一成員可參與多個專案。
        <template v-if="canShowMemberToolbar">
          成員名單與新增／停用／移除依「專案成員」模組權限；租戶／平台管理員不受細粒度限制。
          「專案權限」矩陣覆寫僅租戶管理員或平台管理員可編輯。
        </template>
        <template v-else-if="canReadMembers">您目前僅能檢視名單。</template>
      </p>
    </div>

    <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
    <template v-else>
      <DataTableFeatureToolbar
        v-if="!loading"
        :table="table"
        :features="TABLE_FEATURES"
        :column-labels="COLUMN_LABELS"
        :has-active-filters="hasActiveFilters"
        :global-filter="globalFilter"
        search-placeholder="搜尋姓名或 Email…"
        @reset="resetTableState"
      >
        <template #actions>
          <div v-if="canShowMemberToolbar" class="flex flex-wrap items-center gap-3">
            <template v-if="hasSelection && (canUpdateMembers || canDeleteMembers)">
              <span class="text-sm text-muted-foreground">已選 {{ selectedRows.length }} 項</span>
              <ButtonGroup>
                <Button variant="outline" size="sm" @click="clearSelection">取消選取</Button>
                <Button
                  v-if="canUpdateMembers"
                  variant="outline"
                  size="sm"
                  :disabled="!selectedRows.some((r) => r.original.status === 'active')"
                  @click="openBatchSuspend"
                >
                  批次停用
                </Button>
                <Button
                  v-if="canDeleteMembers"
                  variant="outline"
                  size="sm"
                  class="text-destructive hover:text-destructive"
                  @click="openBatchRemove"
                >
                  批次移除
                </Button>
              </ButtonGroup>
            </template>
            <Button
              v-if="canCreateMembers && !hasSelection"
              size="sm"
              variant="default"
              @click="openAddDialog"
            >
              <Plus class="mr-2 size-4" />
              新增成員
            </Button>
          </div>
        </template>
      </DataTableFeatureToolbar>

      <div class="rounded-lg border border-border bg-card">
        <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 class="size-8 animate-spin" />
        </div>
        <DataTableFeatureSection
          v-else
          :table="table"
          :empty-text="projectMembersEmptyText"
        />
      </div>
      <div v-if="!loading && list.length > 0" class="mt-4">
        <DataTablePagination
          :table="table"
          :hide-selection-info="!hasSelectColumn"
        />
      </div>
    </template>

    <!-- 新增成員 Dialog -->
    <Dialog v-model:open="addDialogOpen" @update:open="(v: boolean) => !v && closeAddDialog()">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新增專案成員</DialogTitle>
          <DialogDescription>
            從同租戶成員中選擇要加入此專案的人員（僅顯示尚未在專案中的成員）。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <p v-if="addError" class="text-sm text-destructive">
            {{ addError }}
          </p>
          <div v-if="availableLoading" class="flex items-center justify-center py-8">
            <Loader2 class="size-6 animate-spin text-muted-foreground" />
          </div>
          <div v-else class="space-y-2">
            <label class="text-sm font-medium text-foreground">選擇成員</label>
            <Select v-model="selectedUserId" :disabled="availableUsers.length === 0">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="請選擇成員" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="u in availableUsers" :key="u.id" :value="u.id">
                  {{ u.name || u.email }} ({{ u.email }})
                </SelectItem>
              </SelectContent>
            </Select>
            <p
              v-if="availableUsers.length === 0 && !availableLoading"
              class="text-xs text-muted-foreground"
            >
              無可加入的成員（同租戶成員已全在專案中，或專案未綁定租戶）
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="closeAddDialog"> 取消 </Button>
          <Button :disabled="!selectedUserId || adding" @click="submitAdd">
            <Loader2 v-if="adding" class="mr-2 size-4 animate-spin" />
            新增
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 移除確認 Dialog -->
    <Dialog
      v-model:open="removeDialogOpen"
      @update:open="(v: boolean) => !v && closeRemoveDialog()"
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>移除專案成員</DialogTitle>
          <DialogDescription>
            確定要將「{{
              removingMember?.user.name || removingMember?.user.email
            }}」移出此專案嗎？移出後該成員將無法再存取此專案。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="closeRemoveDialog"> 取消 </Button>
          <Button variant="destructive" :disabled="removing" @click="confirmRemove">
            <Loader2 v-if="removing" class="mr-2 size-4 animate-spin" />
            移除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 批次停用確認 -->
    <Dialog
      v-model:open="batchSuspendOpen"
      @update:open="(v: boolean) => !v && closeBatchSuspend()"
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批次停用</DialogTitle>
          <DialogDescription>
            確定要停用所選的
            {{ selectedRows.filter((r) => r.original.status === 'active').length }}
            位成員嗎？停用後將無法存取此專案。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="closeBatchSuspend">取消</Button>
          <Button :disabled="batchSuspendLoading" @click="confirmBatchSuspend">
            <Loader2 v-if="batchSuspendLoading" class="mr-2 size-4 animate-spin" />
            停用
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 批次移除確認 -->
    <Dialog v-model:open="batchRemoveOpen" @update:open="(v: boolean) => !v && closeBatchRemove()">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批次移除</DialogTitle>
          <DialogDescription>
            確定要將所選的 {{ selectedRows.length }} 位成員移出此專案嗎？移出後將無法再存取此專案。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="closeBatchRemove">取消</Button>
          <Button variant="destructive" :disabled="batchRemoveLoading" @click="confirmBatchRemove">
            <Loader2 v-if="batchRemoveLoading" class="mr-2 size-4 animate-spin" />
            移除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 專案成員模組權限覆寫 -->
    <Dialog
      :open="projectPermDialogOpen"
      @update:open="(v: boolean) => !v && closeProjectPermDialog()"
    >
      <DialogContent
        class="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-4 overflow-hidden sm:max-w-7xl sm:w-full"
      >
        <DialogHeader class="shrink-0">
          <DialogTitle>
            專案權限 — {{ projectPermMember?.user.name || projectPermMember?.user.email || '成員' }}
          </DialogTitle>
          <DialogDescription>
            僅影響此成員在本專案的模組權限。「重設為租戶範本」會依該成員目前的租戶權限範本重新寫入本專案，不影響其他專案。表頭勾選可全選／取消該欄；「專案成員」列之新增／更新／刪除不可調整，僅「讀取」有效。
            標示「平台未開通」之列與租戶後台「租戶資訊」之模組開通一致，無法勾選。
            <span
              v-if="projectPermHighlightModuleIds.length > 0 && !projectPermLoading"
              class="mt-2 block text-foreground"
            >
              目前有
              {{ projectPermHighlightModuleIds.length }}
              個模組與租戶範本／角色預設不同，列上以「專案客製」標籤與底色標示；編輯勾選後會即時更新標示。
            </span>
          </DialogDescription>
        </DialogHeader>
        <div v-if="projectPermLoading" class="flex shrink-0 justify-center py-12">
          <Loader2 class="size-8 animate-spin text-muted-foreground" />
        </div>
        <template v-else>
          <div class="flex min-h-0 flex-1 flex-col gap-4">
            <div class="min-h-0 flex-1 overflow-hidden">
              <PermissionMatrixForm
                v-model="projectPermModules"
                class="min-h-[200px]"
                :highlight-module-ids="projectPermHighlightModuleIds"
                :platform-disabled-module-ids="platformDisabledModuleIds"
              />
            </div>
            <p v-if="projectPermError" class="shrink-0 text-sm text-destructive">
              {{ projectPermError }}
            </p>
            <DialogFooter
              class="shrink-0 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"
            >
              <Button
                variant="outline"
                :disabled="projectPermSaving || projectPermResetting"
                @click="closeProjectPermDialog"
              >
                取消
              </Button>
              <Button
                variant="outline"
                :disabled="projectPermSaving || projectPermResetting"
                @click="resetProjectPermOverrides"
              >
                <Loader2 v-if="projectPermResetting" class="mr-2 size-4 animate-spin" />
                重設為租戶範本
              </Button>
              <Button
                :disabled="projectPermSaving || projectPermResetting"
                @click="saveProjectPermOverrides"
              >
                <Loader2 v-if="projectPermSaving" class="mr-2 size-4 animate-spin" />
                儲存
              </Button>
            </DialogFooter>
          </div>
        </template>
      </DialogContent>
    </Dialog>
  </div>
</template>
