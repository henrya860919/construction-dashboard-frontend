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
import { ref, computed, onMounted, h } from 'vue'
import { valueUpdater } from '@/lib/utils'
import {
  fetchTenants,
  createTenant,
  updateTenant,
  fetchPlatformUsers,
  resetUserPassword,
  type TenantItem,
  type CreateTenantPayload,
  type PlatformUserItem,
} from '@/api/platform'
import { apiClient } from '@/api/client'
import { API_PATH } from '@/constants'
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
import PlatformTenantsRowActions from '@/views/platform-admin/PlatformTenantsRowActions.vue'
import { buildTenantManagePath } from '@/constants/routes'
import { Plus, Loader2, Trash2 } from 'lucide-vue-next'
import { RouterLink, useRouter } from 'vue-router'

const router = useRouter()

const list = ref<TenantItem[]>([])
const rowSelection = ref<Record<string, boolean>>({})
const loading = ref(true)
const ALL_STATUS_VALUE = '__all__'
const statusFilter = ref<string>(ALL_STATUS_VALUE)
const createDialogOpen = ref(false)
const createForm = ref({ name: '', slug: '', status: 'active' as 'active' | 'suspended', expiresAt: '', userLimit: '' as string | number, fileSizeLimitMb: '', storageQuotaMb: '' })
const createSubmitting = ref(false)
const createErrorMessage = ref('')

const addUserDialogOpen = ref(false)
const selectedTenant = ref<TenantItem | null>(null)
const userForm = ref({ email: '', password: '', name: '' })
const userSubmitting = ref(false)
const userErrorMessage = ref('')

const resetPasswordDialogOpen = ref(false)
const resetPasswordTenant = ref<TenantItem | null>(null)
const tenantUsers = ref<PlatformUserItem[]>([])
const tenantUsersLoading = ref(false)
const resetPasswordUserId = ref('')
const resetPasswordNewPassword = ref('')
const resetPasswordSubmitting = ref(false)
const resetPasswordErrorMessage = ref('')

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

function isExpired(iso: string | null | undefined): boolean {
  if (!iso) return false
  return new Date(iso) < new Date()
}

async function loadTenants() {
  loading.value = true
  try {
    const params: { page?: number; limit?: number; status?: string } = { page: 1, limit: 100 }
    if (statusFilter.value && statusFilter.value !== ALL_STATUS_VALUE) params.status = statusFilter.value
    const { list: items } = await fetchTenants(params)
    list.value = items ?? []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadTenants)

function resetCreateForm() {
  createForm.value = { name: '', slug: '', status: 'active', expiresAt: '', userLimit: '', fileSizeLimitMb: '', storageQuotaMb: '' }
  createErrorMessage.value = ''
}

async function submitCreate() {
  const name = createForm.value.name?.trim()
  if (!name) {
    createErrorMessage.value = '請輸入租戶名稱'
    return
  }
  createSubmitting.value = true
  createErrorMessage.value = ''
  try {
    const payload: CreateTenantPayload = {
      name,
      slug: createForm.value.slug?.trim() || undefined,
      status: createForm.value.status,
    }
    if (createForm.value.expiresAt) payload.expiresAt = createForm.value.expiresAt + 'T23:59:59.000Z'
    const ul = createForm.value.userLimit
    if (ul !== '' && ul !== undefined) payload.userLimit = typeof ul === 'string' ? (ul === '' ? null : parseInt(ul, 10)) : ul
    const fl = createForm.value.fileSizeLimitMb
    if (fl !== '' && fl !== undefined) payload.fileSizeLimitMb = typeof fl === 'string' ? (fl === '' ? null : parseInt(fl, 10)) : fl
    const sq = createForm.value.storageQuotaMb
    if (sq !== '' && sq !== undefined) payload.storageQuotaMb = typeof sq === 'string' ? (sq === '' ? null : parseInt(sq, 10)) : sq
    await createTenant(payload)
    createDialogOpen.value = false
    resetCreateForm()
    await loadTenants()
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
        : '新增失敗'
    createErrorMessage.value = msg ?? '新增失敗'
  } finally {
    createSubmitting.value = false
  }
}

function goToTenantManage(tenant: TenantItem) {
  void router.push(buildTenantManagePath(tenant.id))
}

function openAddUserDialog(tenant: TenantItem) {
  selectedTenant.value = tenant
  userForm.value = { email: '', password: '', name: '' }
  userErrorMessage.value = ''
  addUserDialogOpen.value = true
}

function closeAddUserDialog() {
  addUserDialogOpen.value = false
  selectedTenant.value = null
  userForm.value = { email: '', password: '', name: '' }
  userErrorMessage.value = ''
}

async function submitAddUser() {
  const tenant = selectedTenant.value
  if (!tenant) return
  const email = userForm.value.email?.trim()
  const password = userForm.value.password
  if (!email || !password) {
    userErrorMessage.value = '請輸入 Email 與密碼'
    return
  }
  if (password.length < 6) {
    userErrorMessage.value = '密碼至少 6 碼'
    return
  }
  userSubmitting.value = true
  userErrorMessage.value = ''
  try {
    await apiClient.post<ApiResponse<unknown>>(API_PATH.ADMIN_USERS, {
      email,
      password,
      name: userForm.value.name?.trim() || undefined,
      systemRole: 'tenant_admin',
      tenantId: tenant.id,
    })
    closeAddUserDialog()
    await loadTenants()
  } catch (err: unknown) {
    const res =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        : null
    userErrorMessage.value = res?.message ?? '新增失敗'
  } finally {
    userSubmitting.value = false
  }
}

async function toggleStatus(tenant: TenantItem) {
  try {
    await updateTenant(tenant.id, {
      status: tenant.status === 'active' ? 'suspended' : 'active',
    })
    await loadTenants()
  } catch {
    // could toast
  }
}

async function openResetPasswordDialog(tenant: TenantItem) {
  resetPasswordTenant.value = tenant
  tenantUsers.value = []
  resetPasswordUserId.value = ''
  resetPasswordNewPassword.value = ''
  resetPasswordErrorMessage.value = ''
  resetPasswordDialogOpen.value = true
  tenantUsersLoading.value = true
  try {
    const { list } = await fetchPlatformUsers({ tenantId: tenant.id, limit: 100 })
    tenantUsers.value = list ?? []
    if (tenantUsers.value.length === 1) resetPasswordUserId.value = tenantUsers.value[0].id
  } catch {
    tenantUsers.value = []
  } finally {
    tenantUsersLoading.value = false
  }
}

function closeResetPasswordDialog() {
  resetPasswordDialogOpen.value = false
  resetPasswordTenant.value = null
  tenantUsers.value = []
  resetPasswordUserId.value = ''
  resetPasswordNewPassword.value = ''
  resetPasswordErrorMessage.value = ''
}

async function submitResetPassword() {
  const newPw = resetPasswordNewPassword.value.trim()
  if (!resetPasswordUserId.value) {
    resetPasswordErrorMessage.value = '請選擇要重設密碼的帳號'
    return
  }
  if (newPw.length < 6) {
    resetPasswordErrorMessage.value = '新密碼至少 6 碼'
    return
  }
  resetPasswordSubmitting.value = true
  resetPasswordErrorMessage.value = ''
  try {
    await resetUserPassword(resetPasswordUserId.value, newPw)
    closeResetPasswordDialog()
  } catch (err: unknown) {
    const res =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        : null
    resetPasswordErrorMessage.value = res?.message ?? '重設失敗'
  } finally {
    resetPasswordSubmitting.value = false
  }
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
function limitsPreview(t: TenantItem): string {
  const parts: string[] = []
  if (t.userLimit != null) parts.push(`人員 ${t.userLimit}`)
  if (t.fileSizeLimitMb != null) parts.push(`單檔 ${t.fileSizeLimitMb} MB`)
  if (t.storageQuotaMb != null) parts.push(`總量 ${t.storageQuotaMb} MB`)
  return parts.length ? parts.join(' · ') : '—'
}

const columns = computed<ColumnDef<TenantItem, unknown>[]>(() => [
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
    accessorKey: 'name',
    header: '租戶名稱',
    cell: ({ row }) => {
      const t = row.original
      return h(RouterLink, {
        to: buildTenantManagePath(t.id),
        class: 'font-medium text-primary underline-offset-4 hover:underline',
      }, () => t.name)
    },
  },
  {
    accessorKey: 'slug',
    header: 'Slug',
    cell: ({ row }) => h('div', { class: 'text-muted-foreground' }, row.original.slug || '—'),
  },
  {
    id: 'primaryAdminEmail',
    header: '租戶管理員 Email',
    cell: ({ row }) => {
      const email = row.original.primaryAdminEmail
      return h(
        'div',
        {
          class: email
            ? 'max-w-[220px] truncate text-sm text-foreground'
            : 'text-sm text-muted-foreground',
          title: email ?? undefined,
        },
        email ?? '—'
      )
    },
  },
  {
    accessorKey: 'status',
    header: '狀態',
    cell: ({ row }) =>
      h(Badge, {
        variant: row.original.status === 'active' ? 'default' : 'secondary',
        class: 'font-normal',
      }, () => row.original.status === 'active' ? '使用中' : '已停用'),
  },
  {
    accessorKey: 'expiresAt',
    header: '到期日',
    cell: ({ row }) => {
      const t = row.original
      return h('span', {
        class: isExpired(t.expiresAt) ? 'text-destructive' : 'text-muted-foreground',
      }, formatDate(t.expiresAt))
    },
  },
  {
    id: 'usersProjects',
    header: '人員 / 專案',
    cell: ({ row }) =>
      h('div', { class: 'text-muted-foreground' }, `${row.original._count?.users ?? '—'} / ${row.original._count?.projects ?? '—'}`),
  },
  {
    id: 'limits',
    header: '限制（預覽）',
    cell: ({ row }) =>
      h('div', { class: 'text-muted-foreground text-xs' }, limitsPreview(row.original)),
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'w-[100px] text-muted-foreground' }, '操作'),
    cell: ({ row }) =>
      h('div', { class: 'flex' }, [
        h(PlatformTenantsRowActions, {
          row: row.original,
          onEdit: goToTenantManage,
          onAddUser: openAddUserDialog,
          onResetPassword: openResetPasswordDialog,
          onToggleStatus: toggleStatus,
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

async function confirmBatchDelete() {
  const ids = selectedRows.value.map((r) => r.original.id)
  if (!ids.length) return
  batchDeleteLoading.value = true
  batchDeleteError.value = ''
  try {
    for (const id of ids) {
      await apiClient.delete(`${API_PATH.PLATFORM_TENANTS}/${id}`)
    }
    closeBatchDelete()
    rowSelection.value = {}
    await loadTenants()
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
    <!-- Page header -->
    <div class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">租戶管理</h1>
      <p class="text-sm text-muted-foreground">
        建立租戶；點租戶名稱或「編輯」進入租戶詳情頁設定基本資料、模組開通與成員。列表可快速停用／啟用、建立帳號或重設密碼。
      </p>
    </div>

    <!-- Toolbar: filter + 多選工具列（表格外、表格上方）+ 新增 -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <Select v-model="statusFilter" @update:model-value="loadTenants">
          <SelectTrigger class="w-[140px] bg-background">
            <SelectValue placeholder="全部狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_STATUS_VALUE">全部狀態</SelectItem>
            <SelectItem value="active">使用中</SelectItem>
            <SelectItem value="suspended">已停用</SelectItem>
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
        <Dialog :open="createDialogOpen" @update:open="(v: boolean) => { createDialogOpen = v; if (!v) resetCreateForm() }">
          <DialogTrigger as-child>
            <Button class="gap-2">
              <Plus class="size-4" />
              新增租戶
            </Button>
          </DialogTrigger>
            <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>新增租戶</DialogTitle>
                <DialogDescription>
                  建立新租戶（廠商／公司）。名稱為必填；可設定到期日與使用限制。
                </DialogDescription>
              </DialogHeader>
              <form class="grid gap-4 py-4" @submit.prevent="submitCreate">
                <div class="grid gap-2">
                  <label for="create-name" class="text-sm font-medium text-foreground">租戶名稱</label>
                  <Input id="create-name" v-model="createForm.name" placeholder="例：XX 營造" class="bg-background" />
                </div>
                <div class="grid gap-2">
                  <label for="create-slug" class="text-sm font-medium text-foreground">Slug（選填）</label>
                  <Input id="create-slug" v-model="createForm.slug" placeholder="例：xx-construction" class="bg-background" />
                </div>
                <div class="grid gap-2">
                  <label class="text-sm font-medium text-foreground">狀態</label>
                  <Select v-model="createForm.status">
                    <SelectTrigger class="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">使用中</SelectItem>
                      <SelectItem value="suspended">已停用</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="grid gap-2">
                  <label for="create-expires" class="text-sm font-medium text-foreground">到期日（選填）</label>
                  <Input id="create-expires" v-model="createForm.expiresAt" type="date" class="bg-background" />
                </div>
                <div class="grid grid-cols-2 gap-4">
                  <div class="grid gap-2">
                    <label for="create-userLimit" class="text-sm font-medium text-foreground">人員上限</label>
                    <Input id="create-userLimit" v-model="createForm.userLimit" type="number" min="0" placeholder="不限制" class="bg-background" />
                  </div>
                  <div class="grid gap-2">
                    <label for="create-fileSize" class="text-sm font-medium text-foreground">單筆上傳 (MB)</label>
                    <Input id="create-fileSize" v-model="createForm.fileSizeLimitMb" type="number" min="0" placeholder="不限制" class="bg-background" />
                  </div>
                </div>
                <div class="grid gap-2">
                  <label for="create-storage" class="text-sm font-medium text-foreground">總儲存容量 (MB)</label>
                  <Input id="create-storage" v-model="createForm.storageQuotaMb" type="number" min="0" placeholder="不限制" class="bg-background" />
                </div>
                <p v-if="createErrorMessage" class="text-sm text-destructive">{{ createErrorMessage }}</p>
                <DialogFooter>
                  <Button type="button" variant="outline" @click="createDialogOpen = false">取消</Button>
                  <Button type="submit" :disabled="createSubmitting">
                    <Loader2 v-if="createSubmitting" class="size-4 animate-spin" />
                    {{ createSubmitting ? '建立中…' : '建立' }}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
      </div>
    </div>

    <!-- Table -->
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
                <TableCell :colspan="9" class="h-24 text-center text-muted-foreground">
                  尚無租戶，或目前篩選無結果。點擊「新增租戶」建立第一筆。
                </TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
        <DataTablePagination :table="table" />
      </template>
    </div>

    <!-- Add user dialog -->
    <Dialog :open="addUserDialogOpen" @update:open="(v: boolean) => { if (!v) closeAddUserDialog() }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>為租戶新增帳號</DialogTitle>
          <DialogDescription>
            <template v-if="selectedTenant">
              為「{{ selectedTenant.name }}」建立登入帳號。建立後請將帳密提供給該租戶使用。
            </template>
          </DialogDescription>
        </DialogHeader>
        <form class="grid gap-4 py-4" @submit.prevent="submitAddUser">
          <div class="grid gap-2">
            <label for="add-user-email" class="text-sm font-medium text-foreground">Email</label>
            <Input id="add-user-email" v-model="userForm.email" type="email" placeholder="user@example.com" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <label for="add-user-password" class="text-sm font-medium text-foreground">密碼</label>
            <Input id="add-user-password" v-model="userForm.password" type="password" placeholder="至少 6 碼" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <label for="add-user-name" class="text-sm font-medium text-foreground">姓名（選填）</label>
            <Input id="add-user-name" v-model="userForm.name" placeholder="顯示名稱" class="bg-background" />
          </div>
          <p v-if="userErrorMessage" class="text-sm text-destructive">{{ userErrorMessage }}</p>
          <DialogFooter>
            <Button type="button" variant="outline" @click="closeAddUserDialog">取消</Button>
            <Button type="submit" :disabled="userSubmitting">
              <Loader2 v-if="userSubmitting" class="size-4 animate-spin" />
              {{ userSubmitting ? '建立中…' : '建立帳號' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Reset password dialog -->
    <Dialog :open="resetPasswordDialogOpen" @update:open="(v: boolean) => { if (!v) closeResetPasswordDialog() }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>重設密碼</DialogTitle>
          <DialogDescription>
            <template v-if="resetPasswordTenant">
              為「{{ resetPasswordTenant.name }}」的帳號重設密碼（例如使用者忘記密碼時）。新密碼至少 6 碼。
            </template>
          </DialogDescription>
        </DialogHeader>
        <form class="grid gap-4 py-4" @submit.prevent="submitResetPassword">
          <div v-if="tenantUsersLoading" class="flex items-center justify-center py-6">
            <Loader2 class="size-6 animate-spin text-muted-foreground" />
          </div>
          <template v-else>
            <div class="grid gap-2">
              <label for="reset-user" class="text-sm font-medium text-foreground">選擇帳號</label>
              <Select v-model="resetPasswordUserId">
                <SelectTrigger id="reset-user" class="bg-background">
                  <SelectValue placeholder="請選擇要重設的帳號" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="u in tenantUsers"
                    :key="u.id"
                    :value="u.id"
                  >
                    {{ u.name || u.email }} ({{ u.email }})
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-if="tenantUsers.length === 0 && !tenantUsersLoading" class="text-sm text-muted-foreground">
              此租戶尚無帳號，請先使用「帳號」按鈕新增。
            </div>
            <template v-else>
              <div class="grid gap-2">
                <label for="reset-new-password" class="text-sm font-medium text-foreground">新密碼</label>
                <Input
                  id="reset-new-password"
                  v-model="resetPasswordNewPassword"
                  type="password"
                  placeholder="至少 6 碼"
                  class="bg-background"
                />
              </div>
              <p v-if="resetPasswordErrorMessage" class="text-sm text-destructive">{{ resetPasswordErrorMessage }}</p>
              <DialogFooter>
                <Button type="button" variant="outline" @click="closeResetPasswordDialog">取消</Button>
                <Button type="submit" :disabled="resetPasswordSubmitting">
                  <Loader2 v-if="resetPasswordSubmitting" class="size-4 animate-spin" />
                  {{ resetPasswordSubmitting ? '重設中…' : '重設密碼' }}
                </Button>
              </DialogFooter>
            </template>
          </template>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog :open="batchDeleteOpen" @update:open="(v: boolean) => !v && closeBatchDelete()">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批次刪除租戶</DialogTitle>
          <DialogDescription>
            確定要刪除所選的 {{ selectedCount }} 個租戶？刪除後無法復原。
          </DialogDescription>
        </DialogHeader>
        <p v-if="batchDeleteError" class="text-sm text-destructive">{{ batchDeleteError }}</p>
        <DialogFooter>
          <Button variant="outline" :disabled="batchDeleteLoading" @click="closeBatchDelete">取消</Button>
          <Button variant="destructive" :disabled="batchDeleteLoading" @click="confirmBatchDelete">
            <Loader2 v-if="batchDeleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
