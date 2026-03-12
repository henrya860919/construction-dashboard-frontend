<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { apiClient } from '@/api/client'
import { API_PATH } from '@/constants'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import type { ApiResponse } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import type { AdminUserItem } from '@/types'
import { Plus, Loader2 } from 'lucide-vue-next'

type SystemRoleOption = 'project_user' | 'tenant_admin' | 'platform_admin'
type MemberTypeOption = 'internal' | 'external'

const authStore = useAuthStore()
const adminStore = useAdminStore()
const list = ref<AdminUserItem[]>([])
const selectedMemberIds = ref<Set<string>>(new Set())
const isAllMembersSelected = computed(() => list.value.length > 0 && selectedMemberIds.value.size === list.value.length)
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

function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

async function loadMembers() {
  loading.value = true
  try {
    const params: { page?: number; limit?: number; tenantId?: string; memberType?: string } = {
      page: 1,
      limit: 100,
      ...tenantIdParam.value,
    }
    if (memberTypeFilter.value && memberTypeFilter.value !== ALL_MEMBERS_VALUE) params.memberType = memberTypeFilter.value
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
                  <label for="member-type" class="text-sm font-medium text-foreground">成員類型</label>
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
                  <label for="member-password" class="text-sm font-medium text-foreground">密碼</label>
                  <Input
                    id="member-password"
                    v-model="form.password"
                    type="password"
                    placeholder="至少 6 碼"
                    class="bg-background"
                  />
                </div>
                <div class="grid gap-2">
                  <label for="member-name" class="text-sm font-medium text-foreground">姓名（選填）</label>
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
                  <Button type="button" variant="outline" @click="dialogOpen = false">
                    取消
                  </Button>
                  <Button type="submit" :disabled="submitting">
                    <Loader2 v-if="submitting" class="size-4 animate-spin" />
                    {{ submitting ? '建立中…' : '建立' }}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
    </div>

    <Card class="border-border bg-card">
      <CardContent class="p-4">
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
              <TableHead class="text-muted-foreground">建立日期</TableHead>
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
                <Badge :variant="u.memberType === 'external' ? 'secondary' : 'default'" class="font-normal">
                  {{ memberTypeLabel(u.memberType) }}
                </Badge>
              </TableCell>
              <TableCell class="text-muted-foreground text-sm">
                {{ formatDate(u.createdAt) }}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
</template>
