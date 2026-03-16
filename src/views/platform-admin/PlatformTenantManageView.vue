<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  getTenant,
  updateTenant,
  fetchPlatformUsers,
  fetchPlatformProjects,
  resetUserPassword,
} from '@/api/platform'
import { useTenantStore } from '@/stores/tenant'
import type { TenantItem, UpdateTenantPayload, PlatformUserItem, PlatformProjectItem } from '@/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Badge } from '@/components/ui/badge'
import StateCard from '@/components/common/StateCard.vue'
import { Users, FolderKanban, HardDrive, Loader2, KeyRound, ArrowLeft, Pencil, UserPlus } from 'lucide-vue-next'
import { apiClient } from '@/api/client'
import { API_PATH } from '@/constants'
import type { ApiResponse } from '@/types'

const route = useRoute()
const tenantStore = useTenantStore()

function getTenantId(): string {
  return (route.params.tenantId as string) ?? ''
}

const tenant = ref<TenantItem | null>(null)
const loading = ref(true)
const errorMessage = ref('')

const members = ref<PlatformUserItem[]>([])
const membersLoading = ref(false)
const projects = ref<PlatformProjectItem[]>([])
const projectsLoading = ref(false)

const settingsForm = ref({
  name: '',
  slug: '',
  status: 'active' as 'active' | 'suspended',
  expiresAt: '',
  userLimit: '',
  fileSizeLimitMb: '',
  storageQuotaMb: '',
})
const settingsSaving = ref(false)
const settingsError = ref('')
const settingsEditing = ref(false)

const resetPasswordOpen = ref(false)
const resetPasswordUser = ref<PlatformUserItem | null>(null)
const resetPasswordValue = ref('')
const resetPasswordSaving = ref(false)

const addAccountOpen = ref(false)
const addAccountForm = ref({ email: '', password: '', name: '' })
const addAccountSaving = ref(false)
const addAccountError = ref('')

const memberCount = computed(() => tenant.value?._count?.users ?? 0)
const projectCount = computed(() => tenant.value?._count?.projects ?? 0)
const storageDisplay = computed(() => '—')

async function loadTenant() {
  const id = getTenantId()
  if (!id) return
  loading.value = true
  errorMessage.value = ''
  try {
    const t = await getTenant(id)
    tenant.value = t ?? null
    if (t) {
      tenantStore.setCurrentTenantName(t.name)
      const exp = t.expiresAt ? t.expiresAt.slice(0, 10) : ''
      settingsForm.value = {
        name: t.name,
        slug: t.slug ?? '',
        status: t.status === 'suspended' ? 'suspended' : 'active',
        expiresAt: exp,
        userLimit: t.userLimit != null ? String(t.userLimit) : '',
        fileSizeLimitMb: t.fileSizeLimitMb != null ? String(t.fileSizeLimitMb) : '',
        storageQuotaMb: t.storageQuotaMb != null ? String(t.storageQuotaMb) : '',
      }
      await loadMembers()
    }
  } catch {
    errorMessage.value = '無法載入租戶'
  } finally {
    loading.value = false
  }
}

async function loadMembers() {
  const id = getTenantId()
  if (!id) return
  membersLoading.value = true
  try {
    const { list } = await fetchPlatformUsers({ tenantId: id, limit: 100 })
    members.value = list ?? []
  } catch {
    members.value = []
  } finally {
    membersLoading.value = false
  }
}

async function loadProjects() {
  const id = getTenantId()
  if (!id) return
  projectsLoading.value = true
  try {
    const { list } = await fetchPlatformProjects({ tenantId: id, limit: 100 })
    projects.value = list ?? []
  } catch {
    projects.value = []
  } finally {
    projectsLoading.value = false
  }
}

onMounted(() => {
  loadTenant()
})
watch(() => route.params.tenantId, () => {
  loadTenant()
})

function onTabChange(value: string | number) {
  const v = String(value)
  if (v === 'members') loadMembers()
  if (v === 'projects') loadProjects()
}

async function saveSettings() {
  const t = tenant.value
  if (!t) return
  const name = settingsForm.value.name?.trim()
  if (!name) {
    settingsError.value = '請輸入租戶名稱'
    return
  }
  settingsSaving.value = true
  settingsError.value = ''
  try {
    const payload: UpdateTenantPayload = {
      name,
      slug: settingsForm.value.slug?.trim() || null,
      status: settingsForm.value.status,
      expiresAt: settingsForm.value.expiresAt ? settingsForm.value.expiresAt + 'T23:59:59.000Z' : null,
      userLimit: settingsForm.value.userLimit === '' ? null : Number(settingsForm.value.userLimit),
      fileSizeLimitMb: settingsForm.value.fileSizeLimitMb === '' ? null : Number(settingsForm.value.fileSizeLimitMb),
      storageQuotaMb: settingsForm.value.storageQuotaMb === '' ? null : Number(settingsForm.value.storageQuotaMb),
    }
    await updateTenant(t.id, payload)
    await loadTenant()
    settingsEditing.value = false
  } catch (err: unknown) {
    const res = err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
      : null
    settingsError.value = res?.message ?? '更新失敗'
  } finally {
    settingsSaving.value = false
  }
}

function openResetPassword(u: PlatformUserItem) {
  resetPasswordUser.value = u
  resetPasswordValue.value = ''
  resetPasswordOpen.value = true
}

function closeResetPassword() {
  resetPasswordOpen.value = false
  resetPasswordUser.value = null
}

async function submitResetPassword() {
  const u = resetPasswordUser.value
  if (!u || !resetPasswordValue.value.trim() || resetPasswordValue.value.length < 6) return
  resetPasswordSaving.value = true
  try {
    await resetUserPassword(u.id, resetPasswordValue.value)
    closeResetPassword()
  } finally {
    resetPasswordSaving.value = false
  }
}

function openAddAccount() {
  addAccountForm.value = { email: '', password: '', name: '' }
  addAccountError.value = ''
  addAccountOpen.value = true
}

function closeAddAccount() {
  addAccountOpen.value = false
}

async function submitAddAccount() {
  const t = tenant.value
  if (!t) return
  const email = addAccountForm.value.email?.trim()
  const password = addAccountForm.value.password
  if (!email || !password) {
    addAccountError.value = '請輸入 Email 與密碼'
    return
  }
  if (password.length < 6) {
    addAccountError.value = '密碼至少 6 碼'
    return
  }
  addAccountSaving.value = true
  addAccountError.value = ''
  try {
    await apiClient.post<ApiResponse<unknown>>(API_PATH.ADMIN_USERS, {
      email,
      password,
      name: addAccountForm.value.name?.trim() || undefined,
      systemRole: 'tenant_admin',
      tenantId: t.id,
    })
    closeAddAccount()
    await loadMembers()
    await loadTenant()
  } catch (err: unknown) {
    const res = err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
      : null
    addAccountError.value = res?.message ?? '新增失敗'
  } finally {
    addAccountSaving.value = false
  }
}

function openResetPasswordFromSettings() {
  if (members.value.length === 1) {
    resetPasswordUser.value = members.value[0]
  } else {
    resetPasswordUser.value = null
  }
  resetPasswordValue.value = ''
  resetPasswordOpen.value = true
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    project_user: '專案使用者',
    tenant_admin: '租戶管理員',
    platform_admin: '平台管理員',
  }
  return map[role] ?? role
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col gap-4">
    <div class="flex flex-wrap items-center gap-4 shrink-0">
      <Button variant="ghost" size="icon" as-child>
        <router-link :to="'/platform-admin/tenants'">
          <ArrowLeft class="size-4" />
        </router-link>
      </Button>
      <div>
        <h1 class="text-xl font-semibold tracking-tight text-foreground">
          {{ tenant?.name ?? '租戶管理' }}
        </h1>
        <p class="mt-1 text-sm text-muted-foreground">
          檢視與管理此租戶的基本設定、成員與專案
        </p>
      </div>
    </div>

    <p v-if="errorMessage" class="text-sm text-destructive shrink-0">{{ errorMessage }}</p>

    <div v-if="loading" class="flex flex-1 items-center justify-center py-12">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else-if="tenant">
      <!-- 上：統計卡片（與儀表板 StateCard 同規範） -->
      <div class="grid shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StateCard title="成員總數">
          <template #icon>
            <Users class="size-6 text-muted-foreground" />
          </template>
          <p class="text-3xl font-bold tabular-nums text-foreground">{{ memberCount }}</p>
          <p class="mt-1 text-xs text-muted-foreground">此租戶成員數</p>
        </StateCard>
        <StateCard title="專案總數">
          <template #icon>
            <FolderKanban class="size-6 text-muted-foreground" />
          </template>
          <p class="text-3xl font-bold tabular-nums text-foreground">{{ projectCount }}</p>
          <p class="mt-1 text-xs text-muted-foreground">此租戶專案數</p>
        </StateCard>
        <StateCard title="總使用儲存空間">
          <template #icon>
            <HardDrive class="size-6 text-muted-foreground" />
          </template>
          <p class="text-3xl font-bold tabular-nums text-foreground">{{ storageDisplay }}</p>
          <p class="mt-1 text-xs text-muted-foreground">尚未統計</p>
        </StateCard>
      </div>

      <!-- 下：Tabs Card 滿版 -->
      <Card class="border-border flex min-h-0 flex-1 flex-col">
        <CardContent class="flex min-h-0 flex-1 flex-col pt-6">
          <Tabs default-value="settings" @update:model-value="onTabChange" class="flex min-h-0 flex-1 flex-col">
            <TabsList class="mb-4 shrink-0 bg-muted/50">
              <TabsTrigger value="settings">基本設定</TabsTrigger>
              <TabsTrigger value="members">成員列表</TabsTrigger>
              <TabsTrigger value="projects">專案列表</TabsTrigger>
            </TabsList>
            <TabsContent value="settings" class="mt-0 min-h-0 flex-1 overflow-auto">
              <div class="flex flex-col gap-4">
                <div class="flex justify-end gap-2 shrink-0">
                  <Button v-if="!settingsEditing" type="button" variant="outline" @click="settingsEditing = true">
                    <Pencil class="mr-2 size-4" />
                    編輯
                  </Button>
                  <template v-else>
                    <Button type="button" variant="outline" @click="settingsEditing = false">取消</Button>
                    <Button type="button" :disabled="settingsSaving" @click="saveSettings()">
                      <Loader2 v-if="settingsSaving" class="mr-2 size-4 animate-spin" />
                      {{ settingsSaving ? '儲存中…' : '儲存' }}
                    </Button>
                  </template>
                </div>
                <form class="w-full" @submit.prevent="saveSettings">
                  <div class="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <!-- 租戶帳號：尚未建立顯示新建帳號，已建立顯示重設密碼 -->
                    <div class="flex flex-col gap-2 sm:col-span-2 lg:col-span-3">
                      <label class="text-sm font-medium text-foreground">租戶帳號</label>
                      <div class="flex flex-wrap items-center gap-2">
                        <span v-if="membersLoading" class="text-sm text-muted-foreground">載入中…</span>
                        <template v-else-if="members.length === 0">
                          <span class="text-sm text-muted-foreground">尚未建立</span>
                          <Button type="button" size="sm" variant="outline" :disabled="!settingsEditing" @click="openAddAccount">
                            <UserPlus class="mr-1.5 size-4" />
                            新建帳號
                          </Button>
                        </template>
                        <template v-else>
                          <span class="text-sm text-foreground">{{ members[0].name || members[0].email }}</span>
                          <span v-if="members.length > 1" class="text-xs text-muted-foreground">等 {{ members.length }} 個帳號</span>
                          <Button type="button" size="sm" variant="outline" :disabled="!settingsEditing" @click="openResetPasswordFromSettings">
                            <KeyRound class="mr-1.5 size-4" />
                            重設密碼
                          </Button>
                        </template>
                      </div>
                    </div>
                    <div class="grid gap-2">
                      <label class="text-sm font-medium text-foreground">租戶名稱</label>
                      <Input v-model="settingsForm.name" class="bg-background" :disabled="!settingsEditing" />
                    </div>
                    <div class="grid gap-2">
                      <label class="text-sm font-medium text-foreground">Slug</label>
                      <Input v-model="settingsForm.slug" class="bg-background" placeholder="選填" :disabled="!settingsEditing" />
                    </div>
                    <div class="grid gap-2">
                      <label class="text-sm font-medium text-foreground">狀態</label>
                      <Select v-model="settingsForm.status" :disabled="!settingsEditing">
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
                      <label class="text-sm font-medium text-foreground">到期日</label>
                      <Input v-model="settingsForm.expiresAt" type="date" class="bg-background" :disabled="!settingsEditing" />
                    </div>
                    <div class="grid gap-2">
                      <label class="text-sm font-medium text-foreground">人員上限</label>
                      <Input v-model="settingsForm.userLimit" type="number" min="0" placeholder="不限制" class="bg-background" :disabled="!settingsEditing" />
                    </div>
                    <div class="grid gap-2">
                      <label class="text-sm font-medium text-foreground">單筆上傳 (MB)</label>
                      <Input v-model="settingsForm.fileSizeLimitMb" type="number" min="0" placeholder="不限制" class="bg-background" :disabled="!settingsEditing" />
                    </div>
                    <div class="grid gap-2 sm:col-span-2 lg:col-span-1">
                      <label class="text-sm font-medium text-foreground">總儲存容量 (MB)</label>
                      <Input v-model="settingsForm.storageQuotaMb" type="number" min="0" placeholder="不限制" class="bg-background" :disabled="!settingsEditing" />
                    </div>
                  </div>
                  <p v-if="settingsError" class="mt-4 text-sm text-destructive">{{ settingsError }}</p>
                </form>
              </div>
            </TabsContent>

            <TabsContent value="members" class="mt-0 min-h-0 flex-1 overflow-auto">
              <div class="h-full space-y-4">
                <div v-if="membersLoading" class="flex justify-center py-8">
                  <Loader2 class="size-6 animate-spin text-muted-foreground" />
                </div>
                <div v-else-if="members.length === 0" class="rounded-md border border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
                  尚無成員
                </div>
                <Table v-else>
                  <TableHeader>
                    <TableRow class="border-border hover:bg-transparent">
                      <TableHead class="text-foreground">姓名 / Email</TableHead>
                      <TableHead class="text-muted-foreground">角色</TableHead>
                      <TableHead class="text-muted-foreground">建立日期</TableHead>
                      <TableHead class="w-[100px] text-muted-foreground">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="u in members" :key="u.id" class="border-border">
                      <TableCell class="font-medium text-foreground">
                        {{ u.name || u.email }}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" class="font-normal">{{ roleLabel(u.systemRole) }}</Badge>
                      </TableCell>
                      <TableCell class="text-muted-foreground">{{ formatDate(u.createdAt) }}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" class="gap-1" @click="openResetPassword(u)">
                          <KeyRound class="size-4" />
                          重設密碼
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="projects" class="mt-0 min-h-0 flex-1 overflow-auto">
              <div v-if="projectsLoading" class="flex justify-center py-8">
                <Loader2 class="size-6 animate-spin text-muted-foreground" />
              </div>
              <div v-else-if="projects.length === 0" class="rounded-md border border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
                此租戶尚無專案
              </div>
              <Table v-else>
                <TableHeader>
                  <TableRow class="border-border hover:bg-transparent">
                    <TableHead class="text-foreground">專案名稱</TableHead>
                    <TableHead class="text-muted-foreground">代碼</TableHead>
                    <TableHead class="text-muted-foreground">狀態</TableHead>
                    <TableHead class="text-muted-foreground">建立日期</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-for="p in projects" :key="p.id" class="border-border">
                    <TableCell class="font-medium text-foreground">{{ p.name }}</TableCell>
                    <TableCell class="text-muted-foreground">{{ p.code || '—' }}</TableCell>
                    <TableCell>
                      <Badge :variant="p.status === 'active' ? 'default' : 'secondary'" class="font-normal">
                        {{ p.status === 'active' ? '使用中' : '已封存' }}
                      </Badge>
                    </TableCell>
                    <TableCell class="text-muted-foreground">{{ formatDate(p.createdAt) }}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </template>
  </div>

  <!-- 新建帳號 -->
  <Dialog :open="addAccountOpen" @update:open="(v: boolean) => { if (!v) closeAddAccount() }">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>新建租戶帳號</DialogTitle>
        <DialogDescription>
          為此租戶建立登入帳號，角色為租戶管理員。建立後請將帳密提供給該租戶使用。
        </DialogDescription>
      </DialogHeader>
      <form class="grid gap-4 py-4" @submit.prevent="submitAddAccount">
        <div class="grid gap-2">
          <label class="text-sm font-medium text-foreground">Email</label>
          <Input v-model="addAccountForm.email" type="email" required />
        </div>
        <div class="grid gap-2">
          <label class="text-sm font-medium text-foreground">密碼</label>
          <Input v-model="addAccountForm.password" type="password" placeholder="至少 6 碼" required />
        </div>
        <div class="grid gap-2">
          <label class="text-sm font-medium text-foreground">姓名（選填）</label>
          <Input v-model="addAccountForm.name" />
        </div>
        <p v-if="addAccountError" class="text-sm text-destructive">{{ addAccountError }}</p>
        <DialogFooter>
          <Button type="button" variant="outline" @click="closeAddAccount">取消</Button>
          <Button type="submit" :disabled="addAccountSaving">
            <Loader2 v-if="addAccountSaving" class="mr-2 size-4 animate-spin" />
            建立
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <!-- 重設密碼 -->
  <Dialog :open="resetPasswordOpen" @update:open="(v: boolean) => { if (!v) closeResetPassword() }">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>重設密碼</DialogTitle>
        <DialogDescription>
          <template v-if="members.length > 1 && !resetPasswordUser">選擇要重設密碼的帳號</template>
          <template v-else-if="resetPasswordUser">為 {{ resetPasswordUser.email }} 設定新密碼</template>
        </DialogDescription>
      </DialogHeader>
      <div class="grid gap-4 py-4">
        <div v-if="members.length > 1 && !resetPasswordUser" class="grid gap-2">
          <label class="text-sm font-medium text-foreground">選擇要重設密碼的帳號</label>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="u in members"
              :key="u.id"
              type="button"
              variant="outline"
              size="sm"
              @click="resetPasswordUser = u"
            >
              {{ u.name || u.email }} ({{ u.email }})
            </Button>
          </div>
        </div>
        <div v-if="resetPasswordUser" class="grid gap-2">
          <label class="text-sm font-medium text-foreground">新密碼</label>
          <Input v-model="resetPasswordValue" type="password" placeholder="至少 6 碼" />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="closeResetPassword">取消</Button>
        <Button
          :disabled="resetPasswordSaving || !resetPasswordUser || !resetPasswordValue.trim() || resetPasswordValue.length < 6"
          @click="submitResetPassword"
        >
          <Loader2 v-if="resetPasswordSaving" class="mr-2 size-4 animate-spin" />
          確定
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
