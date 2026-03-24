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
import { ref, computed, onMounted, watch, h } from 'vue'
import { valueUpdater } from '@/lib/utils'
import { apiClient } from '@/api/client'
import { API_PATH } from '@/constants'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import type { ApiResponse } from '@/types'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import AdminMembersRowActions from '@/views/admin/AdminMembersRowActions.vue'
import PermissionMatrixForm from '@/components/common/PermissionMatrixForm.vue'
import type { AdminUserItem } from '@/types'
import { Plus, Loader2, Trash2 } from 'lucide-vue-next'
import {
  fetchTenantPermissionTemplate,
  replaceTenantPermissionTemplate,
  applyTenantPermissionPreset,
  toFullModulesPayload,
  type ModulesMap,
  type PresetKey,
} from '@/api/project-permissions'
import {
  PERMISSION_PRESET_OPTIONS,
  effectivePlatformDisabledModuleIds,
  type PermissionModuleId,
} from '@/constants/permission-modules'
import { getAdminTenantModuleEntitlements } from '@/api/admin'

type SystemRoleOption = 'project_user' | 'tenant_admin' | 'platform_admin'
type MemberTypeOption = 'internal' | 'external'

const authStore = useAuthStore()
const adminStore = useAdminStore()
const list = ref<AdminUserItem[]>([])
const rowSelection = ref<Record<string, boolean>>({})
const loading = ref(true)
const ALL_MEMBERS_VALUE = '__all__'
const memberTypeFilter = ref<string>(ALL_MEMBERS_VALUE)
const dialogOpen = ref(false)
const form = ref({
  email: '',
  password: '',
  name: '',
  systemRole: 'project_user' as SystemRoleOption,
  memberType: 'internal' as MemberTypeOption,
})
const submitting = ref(false)
const errorMessage = ref('')

const tenantIdParam = computed(() => {
  if (authStore.isPlatformAdmin && adminStore.selectedTenantId)
    return { tenantId: adminStore.selectedTenantId }
  return {}
})

/** 權限範本 API 用的租戶 id（平台方須已選租戶） */
const tenantIdForPermissionTemplate = computed((): string | undefined => {
  if (authStore.isPlatformAdmin) return adminStore.selectedTenantId ?? undefined
  return authStore.user?.tenantId ?? undefined
})

const systemRoleOptions = computed<{ value: SystemRoleOption; label: string }[]>(() => {
  const base = [
    { value: 'project_user' as const, label: '專案使用者' },
    { value: 'tenant_admin' as const, label: '租戶管理員' },
  ]
  if (authStore.isPlatformAdmin) {
    return [...base, { value: 'platform_admin' as const, label: '平台管理員' }]
  }
  return base
})

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

function statusLabel(status: string | undefined): string {
  return status === 'suspended' ? '已停用' : '使用中'
}

const viewDialogOpen = ref(false)
const viewMember = ref<AdminUserItem | null>(null)
const viewMemberLoading = ref(false)
const viewMemberError = ref('')
async function openViewDialog(member: AdminUserItem) {
  viewMember.value = null
  viewMemberError.value = ''
  viewDialogOpen.value = true
  viewMemberLoading.value = true
  try {
    const { data } = await apiClient.get<ApiResponse<AdminUserItem>>(
      `${API_PATH.ADMIN_USERS}/${member.id}`
    )
    viewMember.value = data.data ?? null
  } catch {
    viewMemberError.value = '無法載入成員資料'
  } finally {
    viewMemberLoading.value = false
  }
}
function closeViewDialog() {
  viewDialogOpen.value = false
  viewMember.value = null
  viewMemberError.value = ''
}

const toggleStatusLoading = ref(false)
async function toggleMemberStatus(member: AdminUserItem) {
  const nextStatus = member.status === 'suspended' ? 'active' : 'suspended'
  toggleStatusLoading.value = true
  viewMemberError.value = ''
  try {
    await apiClient.patch<ApiResponse<AdminUserItem>>(`${API_PATH.ADMIN_USERS}/${member.id}`, {
      status: nextStatus,
    })
    await loadMembers()
    if (viewMember.value?.id === member.id) {
      viewMember.value = { ...viewMember.value, status: nextStatus }
    }
  } catch (err: unknown) {
    const res =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        : null
    viewMemberError.value = res?.message ?? '更新狀態失敗'
  } finally {
    toggleStatusLoading.value = false
  }
}

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/** 平台關閉之模組（權限矩陣列鎖定，與租戶資訊頁一致） */
const platformDisabledModuleIds = ref<PermissionModuleId[]>([])

async function loadPlatformModuleEntitlements() {
  const tid = tenantIdForPermissionTemplate.value
  if (authStore.isPlatformAdmin && !tid) {
    platformDisabledModuleIds.value = []
    return
  }
  try {
    const mod = await getAdminTenantModuleEntitlements(tid)
    platformDisabledModuleIds.value = effectivePlatformDisabledModuleIds(
      mod.moduleEntitlementsGranted,
      mod.disabledModuleIds
    )
  } catch {
    platformDisabledModuleIds.value = []
  }
}

async function loadMembers() {
  loading.value = true
  try {
    const params: { page?: number; limit?: number; tenantId?: string; memberType?: string } = {
      page: 1,
      limit: 100,
      ...tenantIdParam.value,
    }
    if (memberTypeFilter.value && memberTypeFilter.value !== ALL_MEMBERS_VALUE)
      params.memberType = memberTypeFilter.value
    const { data } = await apiClient.get<
      ApiResponse<AdminUserItem[]> & { meta: { page: number; limit: number; total: number } }
    >(API_PATH.ADMIN_USERS, { params })
    list.value = data.data ?? []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadPlatformModuleEntitlements()
  void loadMembers()
})

watch(
  () => adminStore.selectedTenantId,
  () => {
    void loadPlatformModuleEntitlements()
    void loadMembers()
  }
)

function resetForm() {
  form.value = {
    email: '',
    password: '',
    name: '',
    systemRole: 'project_user',
    memberType: 'internal',
  }
  errorMessage.value = ''
}

async function submitCreate() {
  const email = form.value.email?.trim()
  const password = form.value.password
  if (!email || !password) {
    errorMessage.value = '請輸入 Email 與密碼'
    return
  }
  if (password.length < 6) {
    errorMessage.value = '密碼至少 6 碼'
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    const body: {
      email: string
      password: string
      name?: string
      systemRole: SystemRoleOption
      memberType: MemberTypeOption
      tenantId?: string | null
    } = {
      email,
      password,
      name: form.value.name?.trim() || undefined,
      systemRole: form.value.systemRole,
      memberType: form.value.memberType,
    }
    if (authStore.isPlatformAdmin && adminStore.selectedTenantId) {
      body.tenantId = adminStore.selectedTenantId
    }
    await apiClient.post<ApiResponse<AdminUserItem>>(API_PATH.ADMIN_USERS, body)
    dialogOpen.value = false
    resetForm()
    await loadMembers()
  } catch (err: unknown) {
    const res =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        : null
    errorMessage.value = res?.message ?? '新增失敗'
  } finally {
    submitting.value = false
  }
}

function onOpenChange(open: boolean) {
  dialogOpen.value = open
  if (!open) resetForm()
}

const batchDeleteOpen = ref(false)
const batchDeleteLoading = ref(false)
const batchDeleteError = ref('')
function openBatchDelete() {
  batchDeleteError.value = ''
  batchDeleteOpen.value = true
}
function closeBatchDelete() {
  batchDeleteOpen.value = false
  batchDeleteError.value = ''
}
const sorting = ref<SortingState>([])
const columns = computed<ColumnDef<AdminUserItem, unknown>[]>(() => [
  {
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
  },
  {
    id: 'nameEmail',
    header: '姓名 / Email',
    cell: ({ row }) => {
      const u = row.original
      return h('div', { class: 'font-medium text-foreground' }, [
        h('span', {}, u.name || '—'),
        h('span', { class: 'block text-xs text-muted-foreground' }, u.email),
      ])
    },
  },
  {
    accessorKey: 'systemRole',
    header: '系統角色',
    cell: ({ row }) => h('div', { class: 'text-muted-foreground' }, systemRoleLabel(row.original.systemRole)),
  },
  {
    accessorKey: 'memberType',
    header: '成員類型',
    cell: ({ row }) =>
      h(Badge, {
        variant: row.original.memberType === 'external' ? 'secondary' : 'default',
        class: 'font-normal',
      }, () => memberTypeLabel(row.original.memberType)),
  },
  {
    accessorKey: 'status',
    header: '狀態',
    cell: ({ row }) =>
      h(Badge, {
        variant: (row.original.status ?? 'active') === 'suspended' ? 'secondary' : 'default',
        class: 'font-normal',
      }, () => statusLabel(row.original.status)),
  },
  {
    accessorKey: 'createdAt',
    header: '建立日期',
    cell: ({ row }) =>
      h('div', { class: 'text-muted-foreground text-sm' }, formatDate(row.original.createdAt)),
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'w-[80px]' }),
    cell: ({ row }) =>
      h('div', { class: 'flex justify-end' }, [
        h(AdminMembersRowActions, {
          row: row.original,
          showPermissionTemplate: row.original.systemRole !== 'platform_admin',
          onView: openViewDialog,
          onToggleStatus: toggleMemberStatus,
          onPermissionTemplate: openPermissionTemplateDialog,
        }),
      ]),
    enableSorting: false,
  },
])

const table = useVueTable({
  get data() {
    return list.value
  },
  get columns() {
    return columns.value
  },
  getCoreRowModel: getCoreRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
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
const selectedCount = computed(() => selectedRows.value.length)

function clearSelection() {
  rowSelection.value = {}
}

const permDialogOpen = ref(false)
const permMember = ref<AdminUserItem | null>(null)
const permModules = ref<ModulesMap>({})
const permLoading = ref(false)
const permSaving = ref(false)
const permPresetLoading = ref(false)
const permError = ref('')
const permPresetKey = ref<PresetKey | ''>('')

async function openPermissionTemplateDialog(member: AdminUserItem) {
  permMember.value = member
  permError.value = ''
  permPresetKey.value = ''
  permDialogOpen.value = true
  permLoading.value = true
  const tid = tenantIdForPermissionTemplate.value
  if (authStore.isPlatformAdmin && !tid) {
    permError.value = '請先於後台頂部選擇租戶，再編輯權限範本'
    permLoading.value = false
    return
  }
  try {
    permModules.value = await fetchTenantPermissionTemplate(member.id, tid)
  } catch {
    permError.value = '無法載入權限範本'
    permModules.value = {}
  } finally {
    permLoading.value = false
  }
}

function closePermissionTemplateDialog() {
  permDialogOpen.value = false
  permMember.value = null
  permError.value = ''
  permModules.value = {}
}

async function applyPermissionPreset() {
  const member = permMember.value
  const key = permPresetKey.value
  const tid = tenantIdForPermissionTemplate.value
  if (!member || !key) return
  permPresetLoading.value = true
  permError.value = ''
  try {
    permModules.value = await applyTenantPermissionPreset(member.id, key, tid)
  } catch (e: unknown) {
    const res =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        : null
    permError.value = res?.message ?? '套用預設失敗'
  } finally {
    permPresetLoading.value = false
  }
}

async function savePermissionTemplate() {
  const member = permMember.value
  const tid = tenantIdForPermissionTemplate.value
  if (!member) return
  permSaving.value = true
  permError.value = ''
  try {
    const payload = toFullModulesPayload(permModules.value)
    permModules.value = await replaceTenantPermissionTemplate(member.id, payload, tid)
    closePermissionTemplateDialog()
  } catch (e: unknown) {
    const res =
      e && typeof e === 'object' && 'response' in e
        ? (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        : null
    permError.value = res?.message ?? '儲存失敗'
  } finally {
    permSaving.value = false
  }
}

async function confirmBatchDelete() {
  const ids = selectedRows.value.map((r) => r.original.id)
  if (!ids.length) return
  batchDeleteLoading.value = true
  batchDeleteError.value = ''
  try {
    for (const id of ids) {
      await apiClient.delete(`${API_PATH.ADMIN_USERS}/${id}`)
    }
    closeBatchDelete()
    rowSelection.value = {}
    await loadMembers()
  } catch (err: unknown) {
    const res =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        : null
    batchDeleteError.value = res?.message ?? '批次刪除失敗'
  } finally {
    batchDeleteLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">成員管理</h1>
      <p class="text-sm text-muted-foreground">
        管理本租戶使用者：區分內部／外部成員。可於「權限範本」設定加入專案時複製的模組權限；專案內亦可由租戶／平台管理員覆寫單一成員。
      </p>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <Select v-model="memberTypeFilter" @update:model-value="loadMembers">
          <SelectTrigger class="w-[140px] bg-background">
            <SelectValue placeholder="全部成員" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_MEMBERS_VALUE">全部成員</SelectItem>
            <SelectItem value="internal">內部成員</SelectItem>
            <SelectItem value="external">外部成員</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <template v-if="hasSelection">
          <span class="text-sm text-muted-foreground">已選 {{ selectedCount }} 項</span>
          <ButtonGroup>
            <Button variant="outline" @click="clearSelection">
              取消選取
            </Button>
            <Button
              variant="outline"
              class="text-destructive hover:text-destructive"
              @click="openBatchDelete"
            >
              <Trash2 class="size-4" />
              批次刪除
            </Button>
          </ButtonGroup>
        </template>
        <Dialog :open="dialogOpen" @update:open="onOpenChange">
          <DialogTrigger as-child>
            <Button class="gap-2">
              <Plus class="size-4" />
              新增成員
            </Button>
          </DialogTrigger>
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>新增成員</DialogTitle>
              <DialogDescription>
                建立本租戶新使用者。請選擇為內部成員或外部成員；所屬租戶由您的帳號或目前選取的租戶帶入。
              </DialogDescription>
            </DialogHeader>
            <form class="grid gap-4 py-4" @submit.prevent="submitCreate">
              <div class="grid gap-2">
                <label for="member-type" class="text-sm font-medium text-foreground"
                  >成員類型</label
                >
                <Select v-model="form.memberType">
                  <SelectTrigger class="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">內部成員</SelectItem>
                    <SelectItem value="external">外部成員</SelectItem>
                  </SelectContent>
                </Select>
                <p class="text-xs text-muted-foreground">
                  內部成員：公司內部同仁；外部成員：協力廠商、顧問等。權限於專案內再細部設定。
                </p>
              </div>
              <div class="grid gap-2">
                <label for="member-email" class="text-sm font-medium text-foreground">Email</label>
                <Input
                  id="member-email"
                  v-model="form.email"
                  type="email"
                  placeholder="user@example.com"
                  class="bg-background"
                />
              </div>
              <div class="grid gap-2">
                <label for="member-password" class="text-sm font-medium text-foreground"
                  >密碼</label
                >
                <Input
                  id="member-password"
                  v-model="form.password"
                  type="password"
                  placeholder="至少 6 碼"
                  class="bg-background"
                />
              </div>
              <div class="grid gap-2">
                <label for="member-name" class="text-sm font-medium text-foreground"
                  >姓名（選填）</label
                >
                <Input
                  id="member-name"
                  v-model="form.name"
                  placeholder="顯示名稱"
                  class="bg-background"
                />
              </div>
              <div class="grid gap-2">
                <label class="text-sm font-medium text-foreground">系統角色</label>
                <Select v-model="form.systemRole">
                  <SelectTrigger class="bg-background">
                    <SelectValue placeholder="選擇角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in systemRoleOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p v-if="errorMessage" class="text-sm text-destructive">
                {{ errorMessage }}
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" @click="dialogOpen = false"> 取消 </Button>
                <Button type="submit" :disabled="submitting">
                  <Loader2 v-if="submitting" class="size-4 animate-spin" />
                  {{ submitting ? '建立中…' : '建立' }}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>

    <div class="rounded-lg border border-border bg-card p-4">
      <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 class="size-8 animate-spin" />
      </div>
      <template v-else>
        <Table>
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
                <TableCell :colspan="7" class="h-24 text-center text-muted-foreground">
                  尚無成員，或目前篩選無結果。點擊「新增成員」建立第一筆。
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
        <DataTablePagination :table="table" />
      </template>
    </div>

    <Dialog :open="batchDeleteOpen" @update:open="(v: boolean) => !v && closeBatchDelete()">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批次刪除成員</DialogTitle>
          <DialogDescription>
            確定要刪除所選的 {{ selectedCount }} 位成員？刪除後無法復原。
          </DialogDescription>
        </DialogHeader>
        <p v-if="batchDeleteError" class="text-sm text-destructive">{{ batchDeleteError }}</p>
        <DialogFooter>
          <Button variant="outline" :disabled="batchDeleteLoading" @click="closeBatchDelete"
            >取消</Button
          >
          <Button variant="destructive" :disabled="batchDeleteLoading" @click="confirmBatchDelete">
            <Loader2 v-if="batchDeleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 檢視成員資料 -->
    <Dialog :open="viewDialogOpen" @update:open="(v: boolean) => !v && closeViewDialog()">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>成員資料</DialogTitle>
          <DialogDescription> 檢視成員基本資料。停用後該成員將無法登入系統。 </DialogDescription>
        </DialogHeader>
        <div v-if="viewMemberLoading" class="flex justify-center py-8">
          <Loader2 class="size-8 animate-spin text-muted-foreground" />
        </div>
        <template v-else-if="viewMember">
          <div class="grid gap-4 py-2">
            <div class="grid gap-1.5">
              <span class="text-xs font-medium text-muted-foreground">姓名</span>
              <p class="text-sm text-foreground">{{ viewMember.name || '—' }}</p>
            </div>
            <div class="grid gap-1.5">
              <span class="text-xs font-medium text-muted-foreground">Email</span>
              <p class="text-sm text-foreground">{{ viewMember.email }}</p>
            </div>
            <div class="grid gap-1.5">
              <span class="text-xs font-medium text-muted-foreground">系統角色</span>
              <p class="text-sm text-foreground">{{ systemRoleLabel(viewMember.systemRole) }}</p>
            </div>
            <div class="grid gap-1.5">
              <span class="text-xs font-medium text-muted-foreground">成員類型</span>
              <p class="text-sm text-foreground">{{ memberTypeLabel(viewMember.memberType) }}</p>
            </div>
            <div class="grid gap-1.5">
              <span class="text-xs font-medium text-muted-foreground">狀態</span>
              <p class="text-sm text-foreground">
                <Badge
                  :variant="
                    (viewMember.status ?? 'active') === 'suspended' ? 'secondary' : 'default'
                  "
                  class="font-normal"
                >
                  {{ statusLabel(viewMember.status) }}
                </Badge>
              </p>
            </div>
            <div class="grid gap-1.5">
              <span class="text-xs font-medium text-muted-foreground">建立日期</span>
              <p class="text-sm text-foreground">{{ formatDate(viewMember.createdAt) }}</p>
            </div>
          </div>
          <p v-if="viewMemberError" class="text-sm text-destructive">{{ viewMemberError }}</p>
          <DialogFooter>
            <Button variant="outline" @click="closeViewDialog">關閉</Button>
            <Button
              v-if="(viewMember.status ?? 'active') === 'suspended'"
              :disabled="toggleStatusLoading"
              @click="toggleMemberStatus(viewMember)"
            >
              <Loader2 v-if="toggleStatusLoading" class="mr-2 size-4 animate-spin" />
              啟用帳號
            </Button>
            <Button
              v-else
              variant="secondary"
              :disabled="toggleStatusLoading"
              @click="toggleMemberStatus(viewMember)"
            >
              <Loader2 v-if="toggleStatusLoading" class="mr-2 size-4 animate-spin" />
              停用帳號
            </Button>
          </DialogFooter>
        </template>
        <p v-else-if="viewMemberError" class="py-4 text-sm text-destructive">
          {{ viewMemberError }}
        </p>
      </DialogContent>
    </Dialog>

    <!-- 租戶權限範本（新進專案時複製） -->
    <Dialog :open="permDialogOpen" @update:open="(v: boolean) => !v && closePermissionTemplateDialog()">
      <DialogContent
        class="flex max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-4 overflow-hidden sm:max-w-7xl sm:w-full"
      >
        <DialogHeader class="shrink-0">
          <DialogTitle>權限範本 — {{ permMember?.name || permMember?.email || '成員' }}</DialogTitle>
          <DialogDescription>
            此矩陣為「加入專案時」複製到該成員的預設模組權限；不影響已存在專案內已覆寫的權限。表頭勾選可全選／取消該欄（略過不可編輯的儲存格）。
            標示「平台未開通」之列由平台設定關閉，與租戶資訊頁模組開通狀態一致，無法在此勾選。
          </DialogDescription>
        </DialogHeader>
        <div v-if="permLoading" class="flex shrink-0 justify-center py-12">
          <Loader2 class="size-8 animate-spin text-muted-foreground" />
        </div>
        <template v-else>
          <div class="flex min-h-0 flex-1 flex-col gap-4">
            <div class="flex shrink-0 flex-wrap items-end gap-3 border-b border-border pb-4">
              <div class="grid gap-2">
                <label class="text-sm font-medium text-foreground">一鍵套用預設</label>
                <Select v-model="permPresetKey">
                  <SelectTrigger class="w-[220px] bg-background">
                    <SelectValue placeholder="選擇預設角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in PERMISSION_PRESET_OPTIONS"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                :disabled="!permPresetKey || permPresetLoading"
                @click="applyPermissionPreset"
              >
                <Loader2 v-if="permPresetLoading" class="mr-2 size-4 animate-spin" />
                套用至表單
              </Button>
            </div>
            <div class="min-h-0 flex-1 overflow-hidden">
              <PermissionMatrixForm
                v-model="permModules"
                :platform-disabled-module-ids="platformDisabledModuleIds"
                class="min-h-[200px]"
              />
            </div>
            <p v-if="permError" class="shrink-0 text-sm text-destructive">{{ permError }}</p>
            <DialogFooter class="shrink-0 border-t border-border pt-4">
              <Button variant="outline" :disabled="permSaving" @click="closePermissionTemplateDialog">
                取消
              </Button>
              <Button :disabled="permSaving" @click="savePermissionTemplate">
                <Loader2 v-if="permSaving" class="mr-2 size-4 animate-spin" />
                儲存
              </Button>
            </DialogFooter>
          </div>
        </template>
      </DialogContent>
    </Dialog>
  </div>
</template>
