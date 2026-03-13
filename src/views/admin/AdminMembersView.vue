<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { AdminUserItem } from '@/types'
import {
  Plus,
  Loader2,
  Trash2,
  MoreHorizontal,
  Eye,
  PauseCircle,
  PlayCircle,
} from 'lucide-vue-next'

type SystemRoleOption = 'project_user' | 'tenant_admin' | 'platform_admin'
type MemberTypeOption = 'internal' | 'external'

const authStore = useAuthStore()
const adminStore = useAdminStore()
const list = ref<AdminUserItem[]>([])
const selectedMemberIds = ref<Set<string>>(new Set())
const isAllMembersSelected = computed(
  () => list.value.length > 0 && selectedMemberIds.value.size === list.value.length
)
const isSomeMembersSelected = computed(() => selectedMemberIds.value.size > 0)
function toggleAllMembers(checked: boolean) {
  if (checked) list.value.forEach((u) => selectedMemberIds.value.add(u.id))
  else selectedMemberIds.value.clear()
  selectedMemberIds.value = new Set(selectedMemberIds.value)
}
function toggleMember(id: string, checked: boolean) {
  if (checked) selectedMemberIds.value.add(id)
  else selectedMemberIds.value.delete(id)
  selectedMemberIds.value = new Set(selectedMemberIds.value)
}
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

onMounted(loadMembers)

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
async function confirmBatchDelete() {
  const ids = Array.from(selectedMemberIds.value)
  if (!ids.length) return
  batchDeleteLoading.value = true
  batchDeleteError.value = ''
  try {
    for (const id of ids) {
      await apiClient.delete(`${API_PATH.ADMIN_USERS}/${id}`)
    }
    selectedMemberIds.value = new Set()
    closeBatchDelete()
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
        管理本租戶使用者：區分內部成員與外部成員，邀請、指派專案與角色。權限細節於進入專案後再設定。
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
        <template v-if="selectedMemberIds.size > 0">
          <span class="text-sm text-muted-foreground">已選 {{ selectedMemberIds.size }} 項</span>
          <ButtonGroup>
            <Button variant="outline" size="sm" @click="selectedMemberIds = new Set()">
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

    <div class="rounded-lg border border-border bg-card">
      <div v-if="loading" class="flex items-center justify-center py-16">
        <Loader2 class="size-8 animate-spin text-muted-foreground" />
      </div>
      <div v-else-if="!list.length" class="py-16 text-center text-sm text-muted-foreground">
        尚無成員，或目前篩選無結果。點擊「新增成員」建立第一筆。
      </div>
      <Table v-else>
        <TableHeader>
          <TableRow class="border-border hover:bg-transparent">
            <TableHead class="w-10">
              <Checkbox
                :checked="isAllMembersSelected || (isSomeMembersSelected && 'indeterminate')"
                aria-label="全選"
                @update:checked="(v: boolean | 'indeterminate') => toggleAllMembers(v === true)"
              />
            </TableHead>
            <TableHead class="text-foreground">姓名 / Email</TableHead>
            <TableHead class="text-muted-foreground">系統角色</TableHead>
            <TableHead class="text-muted-foreground">成員類型</TableHead>
            <TableHead class="text-muted-foreground">狀態</TableHead>
            <TableHead class="text-muted-foreground">建立日期</TableHead>
            <TableHead class="w-[80px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="u in list" :key="u.id" class="border-border">
            <TableCell class="w-10">
              <Checkbox
                :checked="selectedMemberIds.has(u.id)"
                :aria-label="'選取 ' + (u.name || u.email)"
                @update:checked="(v: boolean | 'indeterminate') => toggleMember(u.id, v === true)"
              />
            </TableCell>
            <TableCell class="font-medium text-foreground">
              <div>
                <span>{{ u.name || '—' }}</span>
                <span class="block text-xs text-muted-foreground">{{ u.email }}</span>
              </div>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ systemRoleLabel(u.systemRole) }}
            </TableCell>
            <TableCell>
              <Badge
                :variant="u.memberType === 'external' ? 'secondary' : 'default'"
                class="font-normal"
              >
                {{ memberTypeLabel(u.memberType) }}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge
                :variant="(u.status ?? 'active') === 'suspended' ? 'secondary' : 'default'"
                class="font-normal"
              >
                {{ statusLabel(u.status) }}
              </Badge>
            </TableCell>
            <TableCell class="text-muted-foreground text-sm">
              {{ formatDate(u.createdAt) }}
            </TableCell>
            <TableCell class="w-[80px] text-right">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="size-8" aria-label="更多">
                    <MoreHorizontal class="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem @click="openViewDialog(u)">
                    <Eye class="mr-2 size-4" />
                    檢視
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-if="(u.status ?? 'active') === 'suspended'"
                    @click="toggleMemberStatus(u)"
                  >
                    <PlayCircle class="mr-2 size-4" />
                    啟用
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    v-else
                    class="text-destructive focus:text-destructive"
                    @click="toggleMemberStatus(u)"
                  >
                    <PauseCircle class="mr-2 size-4" />
                    停用
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog :open="batchDeleteOpen" @update:open="(v: boolean) => !v && closeBatchDelete()">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批次刪除成員</DialogTitle>
          <DialogDescription>
            確定要刪除所選的 {{ selectedMemberIds.size }} 位成員？刪除後無法復原。
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
  </div>
</template>
