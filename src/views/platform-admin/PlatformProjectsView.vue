<script setup lang="ts">
import type { ColumnDef, FilterFn } from '@tanstack/vue-table'
import { ref, computed, onMounted, watch, h } from 'vue'
import { apiClient } from '@/api/client'
import { API_PATH } from '@/constants'
import {
  fetchPlatformProjects,
  fetchTenants,
  type PlatformProjectItem,
  type TenantItem,
} from '@/api/platform'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import DataTableColumnHeader from '@/components/common/data-table/DataTableColumnHeader.vue'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import DataTableFeatureToolbar from '@/components/common/data-table/DataTableFeatureToolbar.vue'
import DataTableFilterPill from '@/components/common/data-table/DataTableFilterPill.vue'
import { useClientDataTable } from '@/composables/useClientDataTable'
import type { TableListFeatures } from '@/types/data-table'
import { Loader2, Trash2 } from 'lucide-vue-next'

const list = ref<PlatformProjectItem[]>([])
const tenants = ref<TenantItem[]>([])
const loading = ref(true)
const tenantsLoading = ref(true)
const ALL_TENANTS_VALUE = '__all__'
const tenantFilter = ref<string>(ALL_TENANTS_VALUE)

const tenantPillOptions = computed(() => [
  { value: ALL_TENANTS_VALUE, label: '全部租戶' },
  ...tenants.value.map((t) => ({
    value: t.id,
    label: t.slug ? `${t.name}（${t.slug}）` : t.name,
  })),
])

const TABLE_FEATURES: TableListFeatures = {
  search: true,
  filtersAndSort: true,
  columnVisibility: false,
}

const COLUMN_LABELS: Record<string, string> = {
  name: '專案名稱',
  code: '代碼',
  tenantName: '所屬租戶',
  status: '狀態',
  createdAt: '建立日期',
}

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

const platformProjectsGlobalFilterFn: FilterFn<PlatformProjectItem> = (
  row,
  _columnId,
  filterValue
) => {
  const q = String(filterValue ?? '').trim().toLowerCase()
  if (!q) return true
  const p = row.original
  const dateStr = formatDate(p.createdAt).toLowerCase()
  const parts = [
    p.name,
    p.description ?? '',
    p.code ?? '',
    p.tenantName ?? '',
    p.tenantId ?? '',
    statusLabel(p.status).toLowerCase(),
    p.status.toLowerCase(),
    p.createdAt?.toLowerCase() ?? '',
    p.updatedAt?.toLowerCase() ?? '',
    dateStr,
  ].map((s) => String(s).toLowerCase())
  return parts.some((x) => x.includes(q))
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

async function loadProjects() {
  loading.value = true
  try {
    const params: { page?: number; limit?: number; tenantId?: string } = {
      page: 1,
      limit: 100,
    }
    if (tenantFilter.value && tenantFilter.value !== ALL_TENANTS_VALUE)
      params.tenantId = tenantFilter.value
    const { list: items } = await fetchPlatformProjects(params)
    list.value = items ?? []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadTenants().then(() => loadProjects())
})

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

const selectColumn: ColumnDef<PlatformProjectItem, unknown> = {
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

const columns = computed<ColumnDef<PlatformProjectItem, unknown>[]>(() => [
  selectColumn,
  {
    accessorKey: 'name',
    id: 'name',
    meta: { label: COLUMN_LABELS.name },
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column,
        title: COLUMN_LABELS.name,
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
    meta: { label: COLUMN_LABELS.code },
    header: ({ column }) =>
      h(DataTableColumnHeader, { column, title: COLUMN_LABELS.code, class: 'text-foreground' }),
    cell: ({ row }) => h('div', { class: 'text-muted-foreground' }, row.original.code || '—'),
    enableHiding: false,
  },
  {
    accessorKey: 'tenantName',
    id: 'tenantName',
    meta: { label: COLUMN_LABELS.tenantName },
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column,
        title: COLUMN_LABELS.tenantName,
        class: 'text-foreground',
      }),
    cell: ({ row }) =>
      h('div', { class: 'text-muted-foreground' }, row.original.tenantName || '—'),
    enableHiding: false,
  },
  {
    accessorKey: 'status',
    id: 'status',
    meta: { label: COLUMN_LABELS.status },
    header: ({ column }) =>
      h(DataTableColumnHeader, { column, title: COLUMN_LABELS.status, class: 'text-foreground' }),
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
    meta: { label: COLUMN_LABELS.createdAt },
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column,
        title: COLUMN_LABELS.createdAt,
        class: 'text-foreground',
      }),
    cell: ({ row }) =>
      h('div', { class: 'text-sm text-muted-foreground' }, formatDate(row.original.createdAt)),
    sortingFn: 'alphanumeric',
    enableHiding: false,
  },
])

const { table, globalFilter, hasActiveFilters, resetTableState } = useClientDataTable({
  data: list,
  columns,
  features: TABLE_FEATURES,
  getRowId: (row) => row.id,
  globalFilterFn: platformProjectsGlobalFilterFn,
  initialPageSize: 10,
})

watch(tenantFilter, () => {
  resetTableState()
  void loadProjects()
})

const toolbarHasActiveFilters = computed(
  () => hasActiveFilters.value || tenantFilter.value !== ALL_TENANTS_VALUE,
)

function resetAllListFilters() {
  resetTableState()
  tenantFilter.value = ALL_TENANTS_VALUE
}

const selectedRows = computed(() => table.getSelectedRowModel().rows)
const hasSelection = computed(() => selectedRows.value.length > 0)
const selectedCount = computed(() => selectedRows.value.length)

const projectsEmptyText = computed(() => {
  if (list.value.length === 0) {
    if (tenantFilter.value !== ALL_TENANTS_VALUE) return '此租戶下尚無專案'
    if (globalFilter.value.trim()) return '沒有符合條件的資料'
    return '尚無專案，變更租戶篩選或建立專案後將顯示於此。'
  }
  return '沒有符合條件的資料'
})

function clearSelection() {
  table.setRowSelection({})
}

async function confirmBatchDelete() {
  const ids = selectedRows.value.map((r) => r.original.id)
  if (!ids.length) return
  batchDeleteLoading.value = true
  batchDeleteError.value = ''
  try {
    for (const id of ids) {
      await apiClient.delete(`${API_PATH.PLATFORM_PROJECTS}/${id}`)
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
      <h1 class="text-xl font-semibold tracking-tight text-foreground">專案總覽</h1>
      <p class="text-sm text-muted-foreground">
        檢視平台全部專案，可依租戶篩選。可搜尋專案名稱、說明、代碼、所屬租戶、狀態與建立日期。
      </p>
    </div>

    <DataTableFeatureToolbar
      :table="table"
      :features="TABLE_FEATURES"
      :column-labels="COLUMN_LABELS"
      :has-active-filters="toolbarHasActiveFilters"
      :global-filter="globalFilter"
      :search-disabled="loading"
      search-placeholder="搜尋專案名稱、說明、代碼、租戶、狀態、建立日期…"
      @reset="resetAllListFilters"
    >
      <template #prepend-filters>
        <DataTableFilterPill
          v-model="tenantFilter"
          title="所屬租戶"
          :all-value="ALL_TENANTS_VALUE"
          :options="tenantPillOptions"
          :disabled="tenantsLoading || loading"
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
        </div>
      </template>
    </DataTableFeatureToolbar>

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
