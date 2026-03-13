<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  fetchTenants,
  createTenant,
  updateTenant,
  fetchPlatformUsers,
  resetUserPassword,
  type TenantItem,
  type CreateTenantPayload,
  type UpdateTenantPayload,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { buildTenantManagePath } from '@/constants/routes'
import { Plus, UserPlus, MoreHorizontal, Pencil, PauseCircle, PlayCircle, Loader2, KeyRound, Trash2 } from 'lucide-vue-next'
import { RouterLink } from 'vue-router'

const list = ref<TenantItem[]>([])
const selectedTenantIds = ref<Set<string>>(new Set())
const isAllTenantsSelected = computed(() => list.value.length > 0 && selectedTenantIds.value.size === list.value.length)
const isSomeTenantsSelected = computed(() => selectedTenantIds.value.size > 0)
function toggleAllTenants(checked: boolean) {
  if (checked) list.value.forEach((t) => selectedTenantIds.value.add(t.id))
  else selectedTenantIds.value.clear()
  selectedTenantIds.value = new Set(selectedTenantIds.value)
}
function toggleTenant(id: string, checked: boolean) {
  if (checked) selectedTenantIds.value.add(id)
  else selectedTenantIds.value.delete(id)
  selectedTenantIds.value = new Set(selectedTenantIds.value)
}
const loading = ref(true)
const ALL_STATUS_VALUE = '__all__'
const statusFilter = ref<string>(ALL_STATUS_VALUE)
const createDialogOpen = ref(false)
const createForm = ref({ name: '', slug: '', status: 'active' as 'active' | 'suspended', expiresAt: '', userLimit: '' as string | number, fileSizeLimitMb: '', storageQuotaMb: '' })
const createSubmitting = ref(false)
const createErrorMessage = ref('')

const editDialogOpen = ref(false)
const editingTenant = ref<TenantItem | null>(null)
const editForm = ref<{ name: string; slug: string; status: 'active' | 'suspended'; expiresAt: string; userLimit: string; fileSizeLimitMb: string; storageQuotaMb: string }>({ name: '', slug: '', status: 'active', expiresAt: '', userLimit: '', fileSizeLimitMb: '', storageQuotaMb: '' })
const editSubmitting = ref(false)
const editErrorMessage = ref('')
const editTenantUsers = ref<PlatformUserItem[]>([])
const editTenantUsersLoading = ref(false)

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

async function openEditDialog(tenant: TenantItem) {
  editingTenant.value = tenant
  const exp = tenant.expiresAt ? tenant.expiresAt.slice(0, 10) : ''
  editForm.value = {
    name: tenant.name,
    slug: tenant.slug ?? '',
    status: tenant.status === 'suspended' ? 'suspended' : 'active',
    expiresAt: exp,
    userLimit: tenant.userLimit != null ? String(tenant.userLimit) : '',
    fileSizeLimitMb: tenant.fileSizeLimitMb != null ? String(tenant.fileSizeLimitMb) : '',
    storageQuotaMb: tenant.storageQuotaMb != null ? String(tenant.storageQuotaMb) : '',
  }
  editErrorMessage.value = ''
  editTenantUsers.value = []
  editDialogOpen.value = true
  editTenantUsersLoading.value = true
  try {
    const { list: users } = await fetchPlatformUsers({ tenantId: tenant.id, limit: 50 })
    editTenantUsers.value = users ?? []
  } catch {
    editTenantUsers.value = []
  } finally {
    editTenantUsersLoading.value = false
  }
}

function closeEditDialog() {
  editDialogOpen.value = false
  editingTenant.value = null
  editTenantUsers.value = []
  editErrorMessage.value = ''
}

async function submitEdit() {
  const tenant = editingTenant.value
  if (!tenant) return
  const name = editForm.value.name?.trim()
  if (!name) {
    editErrorMessage.value = '請輸入租戶名稱'
    return
  }
  editSubmitting.value = true
  editErrorMessage.value = ''
  try {
    const payload: UpdateTenantPayload = {
      name,
      slug: editForm.value.slug?.trim() || null,
      status: editForm.value.status,
      expiresAt: editForm.value.expiresAt ? editForm.value.expiresAt + 'T23:59:59.000Z' : null,
      userLimit: editForm.value.userLimit === '' ? null : Number(editForm.value.userLimit),
      fileSizeLimitMb: editForm.value.fileSizeLimitMb === '' ? null : Number(editForm.value.fileSizeLimitMb),
      storageQuotaMb: editForm.value.storageQuotaMb === '' ? null : Number(editForm.value.storageQuotaMb),
    }
    await updateTenant(tenant.id, payload)
    closeEditDialog()
    await loadTenants()
  } catch (err: unknown) {
    const res =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
        : null
    editErrorMessage.value = res?.message ?? '更新失敗'
  } finally {
    editSubmitting.value = false
  }
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
async function confirmBatchDelete() {
  const ids = Array.from(selectedTenantIds.value)
  if (!ids.length) return
  batchDeleteLoading.value = true
  batchDeleteError.value = ''
  try {
    for (const id of ids) {
      await apiClient.delete(`${API_PATH.PLATFORM_TENANTS}/${id}`)
    }
    selectedTenantIds.value = new Set()
    closeBatchDelete()
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
        建立、編輯、停用租戶，設定到期日與使用限制（人員數、上傳與儲存容量）。
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
        <template v-if="selectedTenantIds.size > 0">
          <span class="text-sm text-muted-foreground">已選 {{ selectedTenantIds.size }} 項</span>
          <ButtonGroup>
            <Button
              variant="outline"
              size="sm"
              @click="selectedTenantIds = new Set()"
            >
              取消選取
            </Button>
            <Button
              variant="outline"
              size="sm"
              class="text-destructive hover:bg-destructive/10 hover:text-destructive"
              @click="openBatchDelete"
            >
              <Trash2 class="mr-1.5 size-4" />
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
    <div class="rounded-lg border border-border bg-card">
      <div v-if="loading" class="flex items-center justify-center py-16">
          <Loader2 class="size-8 animate-spin text-muted-foreground" />
        </div>
        <div v-else-if="!list.length" class="py-16 text-center text-sm text-muted-foreground">
          尚無租戶，或目前篩選無結果。點擊「新增租戶」建立第一筆。
        </div>
        <Table v-else>
          <TableHeader>
            <TableRow class="border-border hover:bg-transparent">
              <TableHead class="w-10">
                <Checkbox
                  :checked="isAllTenantsSelected || (isSomeTenantsSelected && 'indeterminate')"
                  :aria-label="'全選'"
                  @update:checked="(v: boolean | 'indeterminate') => toggleAllTenants(v === true)"
                />
              </TableHead>
              <TableHead class="text-foreground">租戶名稱</TableHead>
              <TableHead class="text-muted-foreground">Slug</TableHead>
              <TableHead class="text-muted-foreground">帳號</TableHead>
              <TableHead class="text-muted-foreground">狀態</TableHead>
              <TableHead class="text-muted-foreground">到期日</TableHead>
              <TableHead class="text-muted-foreground">人員 / 專案</TableHead>
              <TableHead class="text-muted-foreground">限制（預覽）</TableHead>
              <TableHead class="w-[100px] text-muted-foreground">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="t in list"
              :key="t.id"
              class="border-border"
            >
              <TableCell class="w-10">
                <Checkbox
                  :checked="selectedTenantIds.has(t.id)"
                  :aria-label="'選取 ' + t.name"
                  @update:checked="(v: boolean | 'indeterminate') => toggleTenant(t.id, v === true)"
                />
              </TableCell>
              <TableCell class="font-medium text-foreground">
                <RouterLink
                  :to="buildTenantManagePath(t.id)"
                  class="text-primary underline-offset-4 hover:underline"
                >
                  {{ t.name }}
                </RouterLink>
              </TableCell>
              <TableCell class="text-muted-foreground">{{ t.slug || '—' }}</TableCell>
              <TableCell>
                <Badge :variant="(t._count?.users ?? 0) > 0 ? 'default' : 'secondary'" class="font-normal">
                  {{ (t._count?.users ?? 0) > 0 ? '已設定' : '未設定' }}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge :variant="t.status === 'active' ? 'default' : 'secondary'" class="font-normal">
                  {{ t.status === 'active' ? '使用中' : '已停用' }}
                </Badge>
              </TableCell>
              <TableCell>
                <span :class="isExpired(t.expiresAt) ? 'text-destructive' : 'text-muted-foreground'">
                  {{ formatDate(t.expiresAt) }}
                </span>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ t._count?.users ?? '—' }} / {{ t._count?.projects ?? '—' }}
              </TableCell>
              <TableCell class="text-muted-foreground text-xs">
                <template v-if="t.userLimit != null || t.fileSizeLimitMb != null || t.storageQuotaMb != null">
                  <span v-if="t.userLimit != null">人員 {{ t.userLimit }}</span>
                  <span v-if="t.fileSizeLimitMb != null">{{ t.userLimit != null ? ' · ' : '' }}單檔 {{ t.fileSizeLimitMb }} MB</span>
                  <span v-if="t.storageQuotaMb != null">{{ (t.userLimit != null || t.fileSizeLimitMb != null) ? ' · ' : '' }}總量 {{ t.storageQuotaMb }} MB</span>
                </template>
                <span v-else>—</span>
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon" class="size-8">
                      <MoreHorizontal class="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem @click="openEditDialog(t)">
                      <Pencil class="size-4" />
                      編輯
                    </DropdownMenuItem>
                    <DropdownMenuItem v-if="(t._count?.users ?? 0) === 0" @click="openAddUserDialog(t)">
                      <UserPlus class="size-4" />
                      建立帳號
                    </DropdownMenuItem>
                    <DropdownMenuItem v-if="(t._count?.users ?? 0) > 0" @click="openResetPasswordDialog(t)">
                      <KeyRound class="size-4" />
                      重設密碼
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="toggleStatus(t)">
                      <PauseCircle v-if="t.status === 'active'" class="size-4" />
                      <PlayCircle v-else class="size-4" />
                      {{ t.status === 'active' ? '停用' : '啟用' }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
    </div>

    <!-- Edit dialog -->
    <Dialog :open="editDialogOpen" @update:open="(v: boolean) => { if (!v) closeEditDialog() }">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>編輯租戶</DialogTitle>
          <DialogDescription>
            修改租戶名稱、狀態、到期日與使用限制。
          </DialogDescription>
        </DialogHeader>
        <form v-if="editingTenant" class="grid gap-4 py-4" @submit.prevent="submitEdit">
          <div class="grid gap-2">
            <label for="edit-name" class="text-sm font-medium text-foreground">租戶名稱</label>
            <Input id="edit-name" v-model="editForm.name" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <label for="edit-slug" class="text-sm font-medium text-foreground">Slug</label>
            <Input id="edit-slug" v-model="editForm.slug" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <label class="text-sm font-medium text-foreground">狀態</label>
            <Select v-model="editForm.status">
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
            <label for="edit-expires" class="text-sm font-medium text-foreground">到期日</label>
            <Input id="edit-expires" v-model="editForm.expiresAt" type="date" class="bg-background" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="grid gap-2">
              <label for="edit-userLimit" class="text-sm font-medium text-foreground">人員上限</label>
              <Input id="edit-userLimit" v-model="editForm.userLimit" type="number" min="0" placeholder="不限制" class="bg-background" />
            </div>
            <div class="grid gap-2">
              <label for="edit-fileSize" class="text-sm font-medium text-foreground">單筆上傳 (MB)</label>
              <Input id="edit-fileSize" v-model="editForm.fileSizeLimitMb" type="number" min="0" placeholder="不限制" class="bg-background" />
            </div>
          </div>
          <div class="grid gap-2">
            <label for="edit-storage" class="text-sm font-medium text-foreground">總儲存容量 (MB)</label>
            <Input id="edit-storage" v-model="editForm.storageQuotaMb" type="number" min="0" placeholder="不限制" class="bg-background" />
          </div>
          <!-- 租戶帳號 -->
          <div class="space-y-2 border-t border-border pt-4">
            <p class="text-sm font-medium text-foreground">租戶帳號</p>
            <p class="text-xs text-muted-foreground">此租戶下已建立的登入帳號</p>
            <div v-if="editTenantUsersLoading" class="flex items-center gap-2 py-2 text-sm text-muted-foreground">
              <Loader2 class="size-4 animate-spin" />
              載入中…
            </div>
            <ul v-else-if="editTenantUsers.length === 0" class="rounded-md border border-border bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
              尚無帳號
            </ul>
            <ul v-else class="space-y-1.5 rounded-md border border-border bg-muted/20 px-3 py-2">
              <li
                v-for="u in editTenantUsers"
                :key="u.id"
                class="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span class="font-medium text-foreground">{{ u.name || u.email }}</span>
                <span class="text-muted-foreground">{{ u.email }}</span>
                <Badge variant="secondary" class="shrink-0 text-xs">{{ u.systemRole === 'tenant_admin' ? '租戶管理員' : u.systemRole === 'platform_admin' ? '平台管理員' : '專案使用者' }}</Badge>
              </li>
            </ul>
          </div>
          <p v-if="editErrorMessage" class="text-sm text-destructive">{{ editErrorMessage }}</p>
          <DialogFooter>
            <Button type="button" variant="outline" @click="closeEditDialog">取消</Button>
            <Button type="submit" :disabled="editSubmitting">
              <Loader2 v-if="editSubmitting" class="size-4 animate-spin" />
              {{ editSubmitting ? '儲存中…' : '儲存' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

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
            確定要刪除所選的 {{ selectedTenantIds.size }} 個租戶？刪除後無法復原。
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
