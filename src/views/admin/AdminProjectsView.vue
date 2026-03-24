<script setup lang="ts">
import type { ColumnDef, FilterFn } from '@tanstack/vue-table'
import { ref, computed, watch, onMounted, h } from 'vue'
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import DataTableColumnHeader from '@/components/common/data-table/DataTableColumnHeader.vue'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import DataTableFeatureToolbar from '@/components/common/data-table/DataTableFeatureToolbar.vue'
import DataTableFilterPill from '@/components/common/data-table/DataTableFilterPill.vue'
import { useClientDataTable } from '@/composables/useClientDataTable'
import type { TableListFeatures } from '@/types/data-table'
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

const projectStatusPillOptions = computed(() => {
  const items = list.value
  const n = (status: string) => items.filter((p) => p.status === status).length
  return [
    { label: '全部狀態', value: ALL_STATUS_VALUE, count: items.length },
    { label: '使用中', value: 'active', count: n('active') },
    { label: '已封存', value: 'archived', count: n('archived') },
  ]
})

const TABLE_FEATURES: TableListFeatures = {
  search: true,
  filtersAndSort: true,
  columnVisibility: false,
}

const COLUMN_LABELS: Record<string, string> = {
  name: '專案名稱',
  code: '代碼',
  status: '狀態',
  createdAt: '建立日期',
}

const filteredByStatus = computed(() => {
  const items = list.value
  if (statusFilter.value === ALL_STATUS_VALUE) return items
  return items.filter((p) => p.status === statusFilter.value)
})

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

const projectsGlobalFilterFn: FilterFn<ProjectItem> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? '').trim().toLowerCase()
  if (!q) return true
  const p = row.original
  const dateStr = formatDate(p.createdAt).toLowerCase()
  const parts = [
    p.name,
    p.description ?? '',
    p.code ?? '',
    statusLabel(p.status).toLowerCase(),
    p.status.toLowerCase(),
    p.createdAt?.toLowerCase() ?? '',
    p.updatedAt?.toLowerCase() ?? '',
    dateStr,
  ].map((s) => String(s).toLowerCase())
  return parts.some((x) => x.includes(q))
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
    const tid = authStore.isPlatformAdmin ? (adminStore.selectedTenantId ?? undefined) : undefined
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

async function init() {
  await loadProjectCreateGate()
  await loadProjects()
}

onMounted(() => {
  void init()
})

function resetForm() {
  form.value = { name: '', description: '', code: '' }
  errorMessage.value = ''
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

const selectColumn: ColumnDef<ProjectItem, unknown> = {
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
  enableHiding: false,
}

const columns = computed<ColumnDef<ProjectItem, unknown>[]>(() => [
  selectColumn,
  {
    accessorKey: 'name',
    id: 'name',
    meta: { label: '專案名稱' },
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column,
        title: '專案名稱',
        class: 'text-foreground',
      }),
    cell: ({ row }) => {
      const p = row.original
      return h('div', { class: 'font-medium text-foreground' }, [
        h('span', {}, p.name),
        p.description
          ? h(
              'p',
              { class: 'mt-0.5 truncate text-xs text-muted-foreground', title: p.description },
              p.description
            )
          : null,
      ])
    },
    enableHiding: false,
  },
  {
    accessorKey: 'code',
    id: 'code',
    meta: { label: '代碼' },
    header: ({ column }) =>
      h(DataTableColumnHeader, { column, title: '代碼', class: 'text-foreground' }),
    cell: ({ row }) => h('div', { class: 'text-muted-foreground' }, row.original.code || '—'),
    enableHiding: false,
  },
  {
    accessorKey: 'status',
    id: 'status',
    meta: { label: '狀態' },
    header: ({ column }) =>
      h(DataTableColumnHeader, { column, title: '狀態', class: 'text-foreground' }),
    cell: ({ row }) =>
      h(
        Badge,
        {
          variant: row.original.status === 'archived' ? 'secondary' : 'default',
          class: 'font-normal',
        },
        () => statusLabel(row.original.status)
      ),
    enableHiding: false,
  },
  {
    accessorKey: 'createdAt',
    id: 'createdAt',
    meta: { label: '建立日期' },
    header: ({ column }) =>
      h(DataTableColumnHeader, { column, title: '建立日期', class: 'text-foreground' }),
    cell: ({ row }) =>
      h('div', { class: 'text-sm text-muted-foreground' }, formatDate(row.original.createdAt)),
    sortingFn: 'alphanumeric',
    enableHiding: false,
  },
  {
    id: 'actions',
    header: () => '',
    cell: ({ row }) =>
      h('div', { class: 'flex justify-end' }, [
        h(AdminProjectsRowActions, {
          row: row.original,
          onEnter: (id: string) => goToProject(id),
        }),
      ]),
    enableSorting: false,
    enableHiding: false,
  },
])

const { table, globalFilter, hasActiveFilters, resetTableState } = useClientDataTable({
  data: filteredByStatus,
  columns,
  features: TABLE_FEATURES,
  getRowId: (row) => row.id,
  globalFilterFn: projectsGlobalFilterFn,
  initialPageSize: 10,
})

const toolbarHasActiveFilters = computed(
  () => hasActiveFilters.value || statusFilter.value !== ALL_STATUS_VALUE,
)

function resetAllListFilters() {
  statusFilter.value = ALL_STATUS_VALUE
  resetTableState()
}

watch(statusFilter, () => {
  resetTableState()
})

const selectedRows = computed(() => table.getSelectedRowModel().rows)
const hasSelection = computed(() => selectedRows.value.length > 0)
const selectedCount = computed(() => selectedRows.value.length)

function clearSelection() {
  table.setRowSelection({})
}

const projectsEmptyText = computed(() => {
  if (list.value.length === 0) {
    if (statusFilter.value !== ALL_STATUS_VALUE) return '此狀態下尚無專案'
    if (globalFilter.value.trim()) return '沒有符合條件的資料'
    return '尚無專案，點「新增專案」建立第一筆。'
  }
  if (filteredByStatus.value.length === 0 && statusFilter.value !== ALL_STATUS_VALUE) {
    return '此狀態下尚無專案'
  }
  return '沒有符合條件的資料'
})

watch(
  () => adminStore.selectedTenantId,
  () => {
    if (authStore.isPlatformAdmin) {
      resetTableState()
      void loadProjectCreateGate()
      void loadProjects()
    }
  }
)

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
    table.setRowSelection({})
    await loadProjects()
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
    table.setRowSelection({})
    await loadProjects()
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
  <div class="space-y-4">
    <div class="flex flex-col gap-1">
      <h1 class="text-xl font-semibold tracking-tight text-foreground">專案管理</h1>
      <p class="text-sm text-muted-foreground">
        管理本租戶專案：新增專案、檢視狀態與建立日期，進入專案後可進行儀表板與成員維護。可搜尋名稱、說明、代碼、狀態與日期。
      </p>
    </div>

    <DataTableFeatureToolbar
      :table="table"
      :features="TABLE_FEATURES"
      :column-labels="COLUMN_LABELS"
      :has-active-filters="toolbarHasActiveFilters"
      :global-filter="globalFilter"
      :search-disabled="loading"
      search-placeholder="搜尋專案名稱、說明、代碼、狀態、建立日期…"
      @reset="resetAllListFilters"
    >
      <template #prepend-filters>
        <DataTableFilterPill
          title="狀態"
          v-model="statusFilter"
          :options="projectStatusPillOptions"
          :all-value="ALL_STATUS_VALUE"
          :disabled="loading"
        />
      </template>
      <template #actions>
        <div class="flex flex-wrap items-center justify-end gap-3">
              <template v-if="hasSelection">
                <span class="text-sm text-muted-foreground">已選 {{ selectedCount }} 項</span>
                <ButtonGroup>
                  <Button variant="outline" size="sm" @click="clearSelection">取消選取</Button>
                  <Button
                    variant="outline"
                    size="sm"
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
                    size="sm"
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
                      <label for="project-name" class="text-sm font-medium text-foreground"
                        >專案名稱</label
                      >
                      <Input
                        id="project-name"
                        v-model="form.name"
                        placeholder="例：北區道路改善工程"
                        class="bg-background"
                      />
                    </div>
                    <div class="grid gap-2">
                      <label for="project-description" class="text-sm font-medium text-foreground"
                        >說明（選填）</label
                      >
                      <Input
                        id="project-description"
                        v-model="form.description"
                        placeholder="專案簡述"
                        class="bg-background"
                      />
                    </div>
                    <div class="grid gap-2">
                      <label for="project-code" class="text-sm font-medium text-foreground"
                        >專案代碼（選填）</label
                      >
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
      </template>
    </DataTableFeatureToolbar>

    <p v-if="projectCreateGateHint" class="text-sm text-muted-foreground">
      {{ projectCreateGateHint }}
    </p>

    <div class="rounded-lg border border-border bg-card">
      <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 class="size-8 animate-spin" />
      </div>
      <DataTableFeatureSection v-else :table="table" :empty-text="projectsEmptyText" />
    </div>
    <div v-if="!loading && list.length > 0" class="mt-4">
      <DataTablePagination :table="table" />
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
          <Button variant="outline" :disabled="batchDeleteLoading" @click="closeBatchDelete">
            取消
          </Button>
          <Button variant="destructive" :disabled="batchDeleteLoading" @click="confirmBatchDelete">
            <Loader2 v-if="batchDeleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
