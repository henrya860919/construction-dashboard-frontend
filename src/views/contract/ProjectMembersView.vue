<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import { FlexRender } from '@tanstack/vue-table'
import type { SortingState } from '@tanstack/vue-table'
import { ref, computed, watch, h } from 'vue'
import { useRoute } from 'vue-router'
import { valueUpdater } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  getProjectMembers,
  getProjectMembersAvailable,
  addProjectMember,
  setProjectMemberStatus,
  removeProjectMember,
} from '@/api/project'
import type { ProjectMemberItem, ProjectMemberAvailableItem } from '@/types'
import { Plus, Loader2 } from 'lucide-vue-next'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import ProjectMembersRowActions from '@/views/contract/ProjectMembersRowActions.vue'
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

const sorting = ref<SortingState>([])
const rowSelection = ref<Record<string, boolean>>({})

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

async function confirmRemove() {
  const member = removingMember.value
  if (!member) return
  removing.value = true
  errorMessage.value = ''
  try {
    await removeProjectMember(getProjectId(), member.userId)
    closeRemoveDialog()
    rowSelection.value = {}
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
}

const columns = computed<ColumnDef<ProjectMemberItem, unknown>[]>(() => {
  const dataCols: ColumnDef<ProjectMemberItem, unknown>[] = [
    {
      accessorKey: 'user.name',
      id: 'name',
      header: () => '姓名',
      cell: ({ row }) =>
        h('div', { class: 'font-medium text-foreground' }, row.original.user.name || '—'),
    },
    {
      accessorKey: 'user.email',
      id: 'email',
      header: () => 'Email',
      cell: ({ row }) =>
        h('div', { class: 'text-muted-foreground' }, row.original.user.email),
    },
    {
      accessorKey: 'user.systemRole',
      id: 'systemRole',
      header: () => '系統角色',
      cell: ({ row }) =>
        h('div', { class: 'text-foreground' }, systemRoleLabel(row.original.user.systemRole)),
    },
    {
      accessorKey: 'user.memberType',
      id: 'memberType',
      header: () => '成員類型',
      cell: ({ row }) =>
        h('div', { class: 'text-foreground' }, memberTypeLabel(row.original.user.memberType)),
    },
    {
      accessorKey: 'user.status',
      id: 'accountStatus',
      header: () => '帳號狀態',
      cell: ({ row }) =>
        h('div', { class: 'text-foreground' }, statusLabel(row.original.user.status)),
    },
    {
      accessorKey: 'status',
      id: 'projectStatus',
      header: () => '專案狀態',
      cell: ({ row }) =>
        h('div', { class: 'text-foreground' }, projectStatusLabel(row.original.status)),
    },
    {
      id: 'actions',
      header: () => h('div', { class: 'w-[4rem]' }),
      cell: ({ row }) => {
        const showPermMatrix =
          canManageMemberPermissionMatrix.value &&
          row.original.user.systemRole !== 'platform_admin'
        const anyRowAction =
          canUpdateMembers.value || canDeleteMembers.value || showPermMatrix
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
    },
  ]
  const withSelect =
    canUpdateMembers.value || canDeleteMembers.value ? [selectColumn, ...dataCols] : dataCols
  return withSelect
})

const columnCount = computed(() => columns.value.length)

const table = useVueTable({
  get data() {
    return list.value
  },
  get columns() {
    return columns.value
  },
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  onSortingChange: (updater) => valueUpdater(updater, sorting),
  onRowSelectionChange: (updater) => valueUpdater(updater, rowSelection),
  state: {
    get sorting() {
      return sorting.value
    },
    get rowSelection() {
      return rowSelection.value
    },
  },
  getRowId: (row) => row.id,
  initialState: {
    pagination: { pageSize: 10 },
  },
})

const selectedRows = computed(() => table.getSelectedRowModel().rows)
const hasSelection = computed(() => selectedRows.value.length > 0)

function clearSelection() {
  rowSelection.value = {}
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
    rowSelection.value = {}
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
    rowSelection.value = {}
    await loadMembers()
  } catch {
    errorMessage.value = '批次移除失敗'
  } finally {
    batchRemoveLoading.value = false
  }
}

watch(projectId, (id) => {
  if (id) loadMembers()
}, { immediate: true })
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-muted-foreground">
      專案成員來自租戶成員，可將同租戶的成員加入此專案；一成員可參與多個專案。
      <template v-if="canShowMemberToolbar">
        成員名單與新增／停用／移除依「專案成員」模組權限；租戶／平台管理員不受細粒度限制。
        「專案權限」矩陣覆寫僅租戶管理員或平台管理員可編輯。
      </template>
      <template v-else-if="canReadMembers">您目前僅能檢視名單。</template>
    </p>

    <!-- 工具列：已選 + ButtonGroup + 新增成員在右 -->
    <div
      v-if="canShowMemberToolbar"
      class="flex flex-wrap items-center justify-end gap-3"
    >
      <template v-if="hasSelection && (canUpdateMembers || canDeleteMembers)">
        <span class="text-sm text-muted-foreground">已選 {{ selectedRows.length }} 項</span>
        <ButtonGroup>
          <Button variant="outline" @click="clearSelection">取消選取</Button>
          <Button
            v-if="canUpdateMembers"
            variant="outline"
            :disabled="!selectedRows.some((r) => r.original.status === 'active')"
            @click="openBatchSuspend"
          >
            批次停用
          </Button>
          <Button
            v-if="canDeleteMembers"
            variant="outline"
            class="text-destructive hover:text-destructive"
            @click="openBatchRemove"
          >
            批次移除
          </Button>
        </ButtonGroup>
      </template>
      <Button v-if="canCreateMembers" variant="default" @click="openAddDialog">
        <Plus class="mr-2 size-4" />
        新增成員
      </Button>
    </div>

    <!-- 表格區塊（無 Card 包覆，依規範使用 rounded-lg border border-border bg-card p-4） -->
    <div class="rounded-lg border border-border bg-card p-4">
      <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
      <div v-else-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 class="size-8 animate-spin" />
      </div>
      <template v-else>
        <Table v-if="list.length > 0">
          <TableHeader>
            <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
              <TableHead v-for="header in headerGroup.headers" :key="header.id">
                <FlexRender
                  v-if="!header.isPlaceholder"
                  :render="header.column.columnDef.header"
                  :props="header.getContext()"
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="table.getRowModel().rows?.length">
              <TableRow
                v-for="row in table.getRowModel().rows"
                :key="row.id"
                :data-state="row.getIsSelected() ? 'selected' : undefined"
              >
                <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </TableCell>
              </TableRow>
            </template>
            <template v-else>
              <TableRow>
                <TableCell :colspan="columnCount" class="h-24 text-center text-muted-foreground">
                  尚無專案成員
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
        <template v-if="list.length > 0">
          <DataTablePagination :table="table" />
        </template>
        <div
          v-else
          class="flex flex-col items-center justify-center py-16 text-muted-foreground"
        >
          <p class="text-sm">尚無專案成員</p>
          <p v-if="canCreateMembers" class="mt-1 text-xs">請從「新增成員」加入同租戶的成員</p>
        </div>
      </template>
    </div>

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
                <SelectItem
                  v-for="u in availableUsers"
                  :key="u.id"
                  :value="u.id"
                >
                  {{ u.name || u.email }} ({{ u.email }})
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="availableUsers.length === 0 && !availableLoading" class="text-xs text-muted-foreground">
              無可加入的成員（同租戶成員已全在專案中，或專案未綁定租戶）
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="closeAddDialog">
            取消
          </Button>
          <Button
            :disabled="!selectedUserId || adding"
            @click="submitAdd"
          >
            <Loader2 v-if="adding" class="mr-2 size-4 animate-spin" />
            新增
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 移除確認 Dialog -->
    <Dialog v-model:open="removeDialogOpen" @update:open="(v: boolean) => !v && closeRemoveDialog()">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>移除專案成員</DialogTitle>
          <DialogDescription>
            確定要將「{{ removingMember?.user.name || removingMember?.user.email }}」移出此專案嗎？移出後該成員將無法再存取此專案。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="closeRemoveDialog">
            取消
          </Button>
          <Button
            variant="destructive"
            :disabled="removing"
            @click="confirmRemove"
          >
            <Loader2 v-if="removing" class="mr-2 size-4 animate-spin" />
            移除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 批次停用確認 -->
    <Dialog v-model:open="batchSuspendOpen" @update:open="(v: boolean) => !v && closeBatchSuspend()">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批次停用</DialogTitle>
          <DialogDescription>
            確定要停用所選的 {{ selectedRows.filter((r) => r.original.status === 'active').length }} 位成員嗎？停用後將無法存取此專案。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="closeBatchSuspend">取消</Button>
          <Button
            :disabled="batchSuspendLoading"
            @click="confirmBatchSuspend"
          >
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
          <Button
            variant="destructive"
            :disabled="batchRemoveLoading"
            @click="confirmBatchRemove"
          >
            <Loader2 v-if="batchRemoveLoading" class="mr-2 size-4 animate-spin" />
            移除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 專案成員模組權限覆寫 -->
    <Dialog :open="projectPermDialogOpen" @update:open="(v: boolean) => !v && closeProjectPermDialog()">
      <DialogContent
        class="max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] overflow-y-auto sm:max-w-7xl sm:w-full"
      >
        <DialogHeader>
          <DialogTitle>
            專案權限 — {{ projectPermMember?.user.name || projectPermMember?.user.email || '成員' }}
          </DialogTitle>
          <DialogDescription>
            僅影響此成員在本專案的模組權限。「重設為租戶範本」會依該成員目前的租戶權限範本重新寫入本專案，不影響其他專案。
            <span
              v-if="projectPermHighlightModuleIds.length > 0 && !projectPermLoading"
              class="mt-2 block text-foreground"
            >
              目前有 {{ projectPermHighlightModuleIds.length }} 個模組與租戶範本／角色預設不同，列上以「專案客製」標籤與底色標示；編輯勾選後會即時更新標示。
            </span>
          </DialogDescription>
        </DialogHeader>
        <div v-if="projectPermLoading" class="flex justify-center py-12">
          <Loader2 class="size-8 animate-spin text-muted-foreground" />
        </div>
        <template v-else>
          <div class="py-4">
            <PermissionMatrixForm
              v-model="projectPermModules"
              :highlight-module-ids="projectPermHighlightModuleIds"
            />
          </div>
          <p v-if="projectPermError" class="text-sm text-destructive">{{ projectPermError }}</p>
          <DialogFooter class="flex flex-col gap-2 sm:flex-row sm:justify-end">
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
            <Button :disabled="projectPermSaving || projectPermResetting" @click="saveProjectPermOverrides">
              <Loader2 v-if="projectPermSaving" class="mr-2 size-4 animate-spin" />
              儲存
            </Button>
          </DialogFooter>
        </template>
      </DialogContent>
    </Dialog>
  </div>
</template>
