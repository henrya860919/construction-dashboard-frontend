<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiClient } from '@/api/client'
import { API_PATH } from '@/constants'
import {
  fetchPlatformUsers,
  fetchTenants,
  resetUserPassword,
  type PlatformUserItem,
  type TenantItem,
} from '@/api/platform'
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
import { Loader2, MoreHorizontal, KeyRound, Users, Trash2 } from 'lucide-vue-next'

const list = ref<PlatformUserItem[]>([])
const tenants = ref<TenantItem[]>([])
const loading = ref(true)
const tenantsLoading = ref(true)

const ALL_TENANTS_VALUE = '__all__'
const ALL_ROLE_VALUE = '__all__'
const ALL_MEMBER_TYPE_VALUE = '__all__'
const tenantFilter = ref<string>(ALL_TENANTS_VALUE)
const systemRoleFilter = ref<string>(ALL_ROLE_VALUE)
const memberTypeFilter = ref<string>(ALL_MEMBER_TYPE_VALUE)

const selectedUserIds = ref<Set<string>>(new Set())
const isAllSelected = computed(() => list.value.length > 0 && selectedUserIds.value.size === list.value.length)
const isSomeSelected = computed(() => selectedUserIds.value.size > 0)

function toggleAll(checked: boolean) {
  if (checked) list.value.forEach((u) => selectedUserIds.value.add(u.id))
  else selectedUserIds.value.clear()
  selectedUserIds.value = new Set(selectedUserIds.value)
}

function toggleOne(id: string, checked: boolean) {
  if (checked) selectedUserIds.value.add(id)
  else selectedUserIds.value.delete(id)
  selectedUserIds.value = new Set(selectedUserIds.value)
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function systemRoleLabel(role: string): string {
  const map: Record<string, string> = {
    platform_admin: '平台管理員',
    tenant_admin: '租戶管理員',
    project_user: '專案使用者',
  }
  return map[role] ?? role
}

function memberTypeLabel(type: string): string {
  return type === 'external' ? '外部成員' : '內部成員'
}

async function loadTenants() {
  tenantsLoading.value = true
  try {
    const { list: items } = await fetchTenants({ page: 1, limit: 200 })
    tenants.value = items ?? []
  } catch {
    tenants.value = []
  } finally {
    tenantsLoading.value = false
  }
}

async function loadUsers() {
  loading.value = true
  try {
    const params: {
      page?: number
      limit?: number
      tenantId?: string
      systemRole?: string
      memberType?: string
    } = { page: 1, limit: 100 }
    if (tenantFilter.value && tenantFilter.value !== ALL_TENANTS_VALUE) params.tenantId = tenantFilter.value
    if (systemRoleFilter.value && systemRoleFilter.value !== ALL_ROLE_VALUE) params.systemRole = systemRoleFilter.value
    if (memberTypeFilter.value && memberTypeFilter.value !== ALL_MEMBER_TYPE_VALUE) params.memberType = memberTypeFilter.value
    const { list: items } = await fetchPlatformUsers(params)
    list.value = items ?? []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTenants().then(() => loadUsers())
})

function onFilterChange() {
  loadUsers()
}

// 重設密碼
const resetPasswordDialogOpen = ref(false)
const resetPasswordUser = ref<PlatformUserItem | null>(null)
const resetPasswordNewPassword = ref('')
const resetPasswordSubmitting = ref(false)
const resetPasswordErrorMessage = ref('')

function openResetPasswordDialog(user: PlatformUserItem) {
  resetPasswordUser.value = user
  resetPasswordNewPassword.value = ''
  resetPasswordErrorMessage.value = ''
  resetPasswordDialogOpen.value = true
}

function closeResetPasswordDialog() {
  resetPasswordDialogOpen.value = false
  resetPasswordUser.value = null
  resetPasswordNewPassword.value = ''
  resetPasswordErrorMessage.value = ''
}

async function submitResetPassword() {
  const user = resetPasswordUser.value
  if (!user) return
  const newPw = resetPasswordNewPassword.value.trim()
  if (newPw.length < 6) {
    resetPasswordErrorMessage.value = '新密碼至少 6 碼'
    return
  }
  resetPasswordSubmitting.value = true
  resetPasswordErrorMessage.value = ''
  try {
    await resetUserPassword(user.id, newPw)
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
  const ids = Array.from(selectedUserIds.value)
  if (!ids.length) return
  batchDeleteLoading.value = true
  batchDeleteError.value = ''
  try {
    for (const id of ids) {
      await apiClient.delete(`${API_PATH.PLATFORM_USERS}/${id}`)
    }
    selectedUserIds.value = new Set()
    closeBatchDelete()
    await loadUsers()
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
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">使用者總覽</h1>
      <p class="text-sm text-muted-foreground">
        檢視平台全部使用者，可依租戶、系統角色、成員類型篩選；可為使用者重設密碼。
      </p>
    </div>

    <!-- 篩選列與多選工具列：表格外、表格上方 -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <Select v-model="tenantFilter" @update:model-value="onFilterChange">
          <SelectTrigger class="w-[160px] bg-background">
            <SelectValue placeholder="租戶" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_TENANTS_VALUE">全部租戶</SelectItem>
            <SelectItem
              v-for="t in tenants"
              :key="t.id"
              :value="t.id"
            >
              {{ t.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="systemRoleFilter" @update:model-value="onFilterChange">
          <SelectTrigger class="w-[140px] bg-background">
            <SelectValue placeholder="系統角色" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_ROLE_VALUE">全部角色</SelectItem>
            <SelectItem value="platform_admin">平台管理員</SelectItem>
            <SelectItem value="tenant_admin">租戶管理員</SelectItem>
            <SelectItem value="project_user">專案使用者</SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="memberTypeFilter" @update:model-value="onFilterChange">
          <SelectTrigger class="w-[140px] bg-background">
            <SelectValue placeholder="成員類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_MEMBER_TYPE_VALUE">全部類型</SelectItem>
            <SelectItem value="internal">內部成員</SelectItem>
            <SelectItem value="external">外部成員</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div v-if="selectedUserIds.size > 0" class="flex flex-wrap items-center gap-3">
        <span class="text-sm text-muted-foreground">已選 {{ selectedUserIds.size }} 項</span>
        <ButtonGroup>
          <Button
            variant="outline"
            size="sm"
            @click="selectedUserIds = new Set()"
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
      </div>
    </div>

    <div class="rounded-lg border border-border bg-card">
      <div v-if="loading" class="flex items-center justify-center py-16">
          <Loader2 class="size-8 animate-spin text-muted-foreground" />
        </div>
        <div v-else-if="!list.length" class="py-16 text-center text-sm text-muted-foreground">
          <Users class="mx-auto mb-2 size-10 opacity-50" />
          <p>尚無使用者，或目前篩選無結果。</p>
        </div>
        <Table v-else>
          <TableHeader>
            <TableRow class="border-border hover:bg-transparent">
              <TableHead class="w-10">
                <Checkbox
                  :checked="isAllSelected || (isSomeSelected && 'indeterminate')"
                  aria-label="全選"
                  @update:checked="(v: boolean | 'indeterminate') => toggleAll(v === true)"
                />
              </TableHead>
              <TableHead class="text-foreground">姓名 / Email</TableHead>
              <TableHead class="text-muted-foreground">系統角色</TableHead>
              <TableHead class="text-muted-foreground">成員類型</TableHead>
              <TableHead class="text-muted-foreground">所屬租戶</TableHead>
              <TableHead class="text-muted-foreground">建立日期</TableHead>
              <TableHead class="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="u in list"
              :key="u.id"
              class="border-border"
            >
              <TableCell class="w-10">
                <Checkbox
                  :checked="selectedUserIds.has(u.id)"
                  :aria-label="'選取 ' + (u.name || u.email)"
                  @update:checked="(v: boolean | 'indeterminate') => toggleOne(u.id, v === true)"
                />
              </TableCell>
              <TableCell class="font-medium text-foreground">
                <div>
                  <span>{{ u.name || '—' }}</span>
                  <span class="block text-xs text-muted-foreground">{{ u.email }}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge :variant="u.systemRole === 'platform_admin' ? 'default' : 'secondary'" class="font-normal">
                  {{ systemRoleLabel(u.systemRole) }}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge :variant="u.memberType === 'external' ? 'secondary' : 'outline'" class="font-normal">
                  {{ memberTypeLabel(u.memberType) }}
                </Badge>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ u.tenantName ?? '—' }}
              </TableCell>
              <TableCell class="text-muted-foreground text-sm">
                {{ formatDate(u.createdAt) }}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" size="icon" class="size-8">
                      <MoreHorizontal class="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem @click="openResetPasswordDialog(u)">
                      <KeyRound class="size-4" />
                      重設密碼
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
    </div>

    <!-- 重設密碼 Dialog -->
    <Dialog :open="resetPasswordDialogOpen" @update:open="(v: boolean) => { if (!v) closeResetPasswordDialog() }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>重設密碼</DialogTitle>
          <DialogDescription>
            <template v-if="resetPasswordUser">
              為「{{ resetPasswordUser.name || resetPasswordUser.email }}」重設登入密碼（例如忘記密碼時）。新密碼至少 6 碼。
            </template>
          </DialogDescription>
        </DialogHeader>
        <form v-if="resetPasswordUser" class="grid gap-4 py-4" @submit.prevent="submitResetPassword">
          <div class="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            {{ resetPasswordUser.email }}
          </div>
          <div class="grid gap-2">
            <label for="reset-pw-new" class="text-sm font-medium text-foreground">新密碼</label>
            <Input
              id="reset-pw-new"
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
        </form>
      </DialogContent>
    </Dialog>

    <Dialog :open="batchDeleteOpen" @update:open="(v: boolean) => !v && closeBatchDelete()">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批次刪除使用者</DialogTitle>
          <DialogDescription>
            確定要刪除所選的 {{ selectedUserIds.size }} 位使用者？刪除後無法復原。
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
