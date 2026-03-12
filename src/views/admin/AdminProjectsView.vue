<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiClient } from '@/api/client'
import { API_PATH } from '@/constants'
import { buildProjectPath } from '@/constants/routes'
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
import type { ProjectItem } from '@/types'
import { Plus, Loader2, FolderKanban, ExternalLink } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminStore()
const list = ref<ProjectItem[]>([])
const loading = ref(true)
const dialogOpen = ref(false)
const form = ref({ name: '', description: '', code: '' })
const submitting = ref(false)
const errorMessage = ref('')

const ALL_STATUS_VALUE = '__all__'
const statusFilter = ref<string>(ALL_STATUS_VALUE)

const filteredList = computed(() => {
  const items = list.value
  if (statusFilter.value === ALL_STATUS_VALUE) return items
  return items.filter((p) => p.status === statusFilter.value)
})

const selectedProjectIds = ref<Set<string>>(new Set())
const isAllSelected = computed(() => filteredList.value.length > 0 && selectedProjectIds.value.size === filteredList.value.length)
const isSomeSelected = computed(() => selectedProjectIds.value.size > 0)

function toggleAll(checked: boolean) {
  if (checked) filteredList.value.forEach((p) => selectedProjectIds.value.add(p.id))
  else selectedProjectIds.value.clear()
  selectedProjectIds.value = new Set(selectedProjectIds.value)
}

function toggleOne(id: string, checked: boolean) {
  if (checked) selectedProjectIds.value.add(id)
  else selectedProjectIds.value.delete(id)
  selectedProjectIds.value = new Set(selectedProjectIds.value)
}

const tenantIdParam = computed(() => {
  if (authStore.isPlatformAdmin && adminStore.selectedTenantId)
    return { tenantId: adminStore.selectedTenantId }
  return {}
})

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function statusLabel(status: string): string {
  return status === 'archived' ? '已封存' : '使用中'
}

async function loadProjects() {
  loading.value = true
  try {
    const { data } = await apiClient.get<
      ApiResponse<ProjectItem[]> & { meta: { page: number; limit: number; total: number } }
    >(API_PATH.ADMIN_PROJECTS, {
      params: { page: 1, limit: 100, ...tenantIdParam.value },
    })
    list.value = data.data ?? []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadProjects)

function resetForm() {
  form.value = { name: '', description: '', code: '' }
  errorMessage.value = ''
}

async function submitCreate() {
  const name = form.value.name?.trim()
  if (!name) {
    errorMessage.value = '請輸入專案名稱'
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    const body: { name: string; description?: string; code?: string; tenantId?: string } = {
      name,
      description: form.value.description?.trim() || undefined,
      code: form.value.code?.trim() || undefined,
    }
    if (authStore.isPlatformAdmin && adminStore.selectedTenantId) {
      body.tenantId = adminStore.selectedTenantId
    }
    await apiClient.post<ApiResponse<ProjectItem>>(API_PATH.PROJECTS, body)
    dialogOpen.value = false
    resetForm()
    await loadProjects()
  } catch (err: unknown) {
    const res = err && typeof err === 'object' && 'response' in err
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

function goToProject(projectId: string) {
  router.push(buildProjectPath(projectId, '/dashboard'))
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">專案管理</h1>
      <p class="text-sm text-muted-foreground">
        管理本租戶專案：新增專案、檢視狀態與建立日期，進入專案後可進行儀表板與成員維護。
      </p>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <Select v-model="statusFilter">
          <SelectTrigger class="w-[140px] bg-background">
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="ALL_STATUS_VALUE">全部狀態</SelectItem>
            <SelectItem value="active">使用中</SelectItem>
            <SelectItem value="archived">已封存</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Dialog :open="dialogOpen" @update:open="onOpenChange">
        <DialogTrigger as-child>
          <Button class="gap-2">
            <Plus class="size-4" />
            新增專案
          </Button>
        </DialogTrigger>
            <DialogContent class="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>新增專案</DialogTitle>
                <DialogDescription>
                  建立新專案。名稱為必填；所屬租戶由您的帳號自動帶入。
                </DialogDescription>
              </DialogHeader>
              <form class="grid gap-4 py-4" @submit.prevent="submitCreate">
                <div class="grid gap-2">
                  <label for="project-name" class="text-sm font-medium text-foreground">專案名稱</label>
                  <Input
                    id="project-name"
                    v-model="form.name"
                    placeholder="例：北區道路改善工程"
                    class="bg-background"
                  />
                </div>
                <div class="grid gap-2">
                  <label for="project-description" class="text-sm font-medium text-foreground">說明（選填）</label>
                  <Input
                    id="project-description"
                    v-model="form.description"
                    placeholder="專案簡述"
                    class="bg-background"
                  />
                </div>
                <div class="grid gap-2">
                  <label for="project-code" class="text-sm font-medium text-foreground">專案代碼（選填）</label>
                  <Input
                    id="project-code"
                    v-model="form.code"
                    placeholder="例：DEMO-A"
                    class="bg-background"
                  />
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
        <div v-else-if="!filteredList.length" class="py-16 text-center text-sm text-muted-foreground">
          <FolderKanban class="mx-auto mb-2 size-10 opacity-50" />
          <p>尚無專案，或目前篩選無結果。</p>
          <p class="mt-1">點擊「新增專案」建立第一筆。</p>
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
              <TableHead class="text-foreground">專案名稱</TableHead>
              <TableHead class="text-muted-foreground">代碼</TableHead>
              <TableHead class="text-muted-foreground">狀態</TableHead>
              <TableHead class="text-muted-foreground">建立日期</TableHead>
              <TableHead class="w-[100px] text-muted-foreground">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="p in filteredList"
              :key="p.id"
              class="border-border"
            >
              <TableCell class="w-10">
                <Checkbox
                  :checked="selectedProjectIds.has(p.id)"
                  :aria-label="'選取 ' + p.name"
                  @update:checked="(v: boolean | 'indeterminate') => toggleOne(p.id, v === true)"
                />
              </TableCell>
              <TableCell class="font-medium text-foreground">
                <div>
                  <span>{{ p.name }}</span>
                  <p
                    v-if="p.description"
                    class="mt-0.5 truncate text-xs text-muted-foreground"
                    :title="p.description"
                  >
                    {{ p.description }}
                  </p>
                </div>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ p.code || '—' }}
              </TableCell>
              <TableCell>
                <Badge :variant="p.status === 'archived' ? 'secondary' : 'default'" class="font-normal">
                  {{ statusLabel(p.status) }}
                </Badge>
              </TableCell>
              <TableCell class="text-muted-foreground text-sm">
                {{ formatDate(p.createdAt) }}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  class="gap-1.5"
                  @click="goToProject(p.id)"
                >
                  <ExternalLink class="size-3.5" />
                  進入
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  </div>
</template>
