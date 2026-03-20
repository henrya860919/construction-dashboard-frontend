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
import { useRouter } from 'vue-router'
import { apiClient } from '@/api/client'
import { API_PATH } from '@/constants'
import { buildProjectPath } from '@/constants/routes'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import { getAdminTenantModuleEntitlements } from '@/api/admin'
import { tenantModuleGateAllowsOperations } from '@/constants/permission-modules'
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
import AdminProjectsRowActions from '@/views/admin/AdminProjectsRowActions.vue'
import type { ProjectItem } from '@/types'
import { Plus, Loader2, Trash2 } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminStore()
const list = ref<ProjectItem[]>([])
const loading = ref(true)
const dialogOpen = ref(false)
const form = ref({ name: '', description: '', code: '' })
const submitting = ref(false)
const errorMessage = ref('')

const projectCreateGateLoading = ref(true)
const projectCreateAllowed = ref(false)
const projectCreateGateHint = ref('')

const ALL_STATUS_VALUE = '__all__'
const statusFilter = ref<string>(ALL_STATUS_VALUE)

const filteredList = computed(() => {
  const items = list.value
  if (statusFilter.value === ALL_STATUS_VALUE) return items
  return items.filter((p) => p.status === statusFilter.value)
})

const rowSelection = ref<Record<string, boolean>>({})

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

async function loadProjectCreateGate() {
  projectCreateGateLoading.value = true
  projectCreateGateHint.value = ''
  try {
    if (authStore.isPlatformAdmin && !adminStore.selectedTenantId) {
      projectCreateAllowed.value = false
      projectCreateGateHint.value = '請先於後台頂部選擇租戶，始可新增專案。'
      return
    }
    const tid = authStore.isPlatformAdmin ? adminStore.selectedTenantId ?? undefined : undefined
    const mod = await getAdminTenantModuleEntitlements(tid)
    projectCreateAllowed.value = tenantModuleGateAllowsOperations(
      mod.moduleEntitlementsGranted,
      mod.disabledModuleIds
    )
    if (!projectCreateAllowed.value) {
      projectCreateGateHint.value =
        '平台尚未為此租戶完成「模組開通」設定，或所有模組均已關閉，無法新增專案。請至平台後台 → 租戶管理 → 模組開通儲存至少一項開通模組。'
    }
  } catch {
    projectCreateAllowed.value = false
    projectCreateGateHint.value = '無法確認模組開通狀態，暫時無法新增專案。'
  } finally {
    projectCreateGateLoading.value = false
  }
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

onMounted(async () => {
  await loadProjectCreateGate()
  await loadProjects()
})

watch(
  () => adminStore.selectedTenantId,
  () => {
    if (authStore.isPlatformAdmin) {
      void loadProjectCreateGate()
      void loadProjects()
    }
  }
)

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
const columns = computed<ColumnDef<ProjectItem, unknown>[]>(() => [
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
    header: '專案名稱',
    cell: ({ row }) => {
      const p = row.original
      return h('div', { class: 'font-medium text-foreground' }, [
        h('span', {}, p.name),
        p.description
          ? h('p', { class: 'mt-0.5 truncate text-xs text-muted-foreground', title: p.description }, p.description)
          : null,
      ])
    },
  },
  {
    accessorKey: 'code',
    header: '代碼',
    cell: ({ row }) => h('div', { class: 'text-muted-foreground' }, row.original.code || '—'),
  },
  {
    accessorKey: 'status',
    header: '狀態',
    cell: ({ row }) =>
      h(Badge, {
        variant: row.original.status === 'archived' ? 'secondary' : 'default',
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
        h(AdminProjectsRowActions, {
          row: row.original,
          onEnter: (id: string) => goToProject(id),
        }),
      ]),
    enableSorting: false,
  },
])

const table = useVueTable({
  get data() {
    return filteredList.value
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
      await apiClient.delete(`${API_PATH.ADMIN_PROJECTS}/${id}`)
    }
    closeBatchDelete()
    rowSelection.value = {}
    await loadProjects()
  } catch (err: unknown) {
    const res = err && typeof err === 'object' && 'response' in err
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
      <div class="flex flex-wrap items-center gap-3">
        <template v-if="hasSelection">
          <span class="text-sm text-muted-foreground">已選 {{ selectedCount }} 項</span>
          <ButtonGroup>
            <Button
              variant="outline"
              @click="clearSelection"
            >
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
            <Button
              class="gap-2"
              :disabled="projectCreateGateLoading || !projectCreateAllowed"
              :title="projectCreateGateHint || undefined"
            >
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
    </div>

    <p v-if="projectCreateGateHint" class="text-sm text-muted-foreground">
      {{ projectCreateGateHint }}
    </p>

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
                <TableCell :colspan="6" class="h-24 text-center text-muted-foreground">
                  <span class="block">尚無專案，或目前篩選無結果。</span>
                  <span class="mt-1 block">點擊「新增專案」建立第一筆。</span>
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
          <DialogTitle>批次刪除專案</DialogTitle>
          <DialogDescription>
            確定要刪除所選的 {{ selectedCount }} 個專案？刪除後無法復原。
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
