<script setup lang="ts">
import type { ColumnDef, FilterFn } from '@tanstack/vue-table'
import { ref, computed, onMounted, watch, h } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Loader2 } from 'lucide-vue-next'
import { fetchUsage, type TenantUsageItem } from '@/api/platform'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import DataTableFeatureToolbar from '@/components/common/data-table/DataTableFeatureToolbar.vue'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTableFilterPill from '@/components/common/data-table/DataTableFilterPill.vue'
import { useClientDataTable } from '@/composables/useClientDataTable'
import type { TableListFeatures } from '@/types/data-table'

const list = ref<TenantUsageItem[]>([])
const loading = ref(true)

const ALL_STATUS = 'all' as const
const statusFilter = ref<string>(ALL_STATUS)
const usageStatusPillOptions = computed(() => {
  const rows = list.value
  const n = (s: string) => rows.filter((r) => r.status === s).length
  return [
    { value: ALL_STATUS, label: '全部狀態', count: rows.length },
    { value: 'active', label: '啟用', count: n('active') },
    { value: 'suspended', label: '停用', count: n('suspended') },
  ]
})

const TABLE_FEATURES: TableListFeatures = {
  search: true,
  filtersAndSort: false,
  columnVisibility: false,
}
const COLUMN_LABELS: Record<string, string> = {}

const statusFilteredData = computed(() => {
  const rows = list.value
  if (statusFilter.value === ALL_STATUS) return rows
  return rows.filter((r) => r.status === statusFilter.value)
})

const usageGlobalFilterFn: FilterFn<TenantUsageItem> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? '').trim().toLowerCase()
  if (!q) return true
  const r = row.original
  const statusLabel = r.status === 'active' ? '啟用' : '停用'
  const parts = [
    r.name,
    r.slug ?? '',
    statusLabel.toLowerCase(),
    r.status.toLowerCase(),
    r.id.toLowerCase(),
  ].map((s) => String(s).toLowerCase())
  return parts.some((x) => x.includes(q))
}

function storageDisplay(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function quotaDisplay(quotaMb: number | null): string {
  if (quotaMb == null) return '無限制'
  if (quotaMb >= 1024) return `${(quotaMb / 1024).toFixed(1)} GB`
  return `${quotaMb} MB`
}

const storagePercent = (row: TenantUsageItem): number | null => {
  if (row.storageQuotaMb == null || row.storageQuotaMb <= 0) return null
  const usedMb = row.storageUsageBytes / 1024 / 1024
  return Math.min(100, (usedMb / row.storageQuotaMb) * 100)
}

const isOverQuota = (row: TenantUsageItem): boolean => {
  if (row.storageQuotaMb == null) return false
  const usedMb = row.storageUsageBytes / 1024 / 1024
  return usedMb > row.storageQuotaMb
}

const isExpiringSoon = (row: TenantUsageItem): boolean => {
  if (!row.expiresAt) return false
  const exp = new Date(row.expiresAt).getTime()
  const in30Days = Date.now() + 30 * 24 * 60 * 60 * 1000
  return exp <= in30Days && exp > Date.now()
}

const isExpired = (row: TenantUsageItem): boolean => {
  if (!row.expiresAt) return false
  return new Date(row.expiresAt).getTime() < Date.now()
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

async function load() {
  loading.value = true
  try {
    list.value = await fetchUsage()
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

const columns = computed<ColumnDef<TenantUsageItem, unknown>[]>(() => [
  {
    accessorKey: 'name',
    header: () => '租戶',
    cell: ({ row }) => {
      const r = row.original
      return h('div', [
        h('div', { class: 'font-medium text-foreground' }, r.name),
        r.slug ? h('div', { class: 'text-xs text-muted-foreground' }, r.slug) : null,
      ])
    },
  },
  {
    accessorKey: 'status',
    header: () => '狀態',
    cell: ({ row }) => {
      const r = row.original
      const badges = [
        h(Badge, { variant: r.status === 'active' ? 'default' : 'secondary' }, () =>
          r.status === 'active' ? '啟用' : '停用',
        ),
      ]
      if (isExpired(r)) {
        badges.push(h(Badge, { variant: 'destructive', class: 'ml-1' }, () => '已到期'))
      } else if (isExpiringSoon(r)) {
        badges.push(
          h(
            Badge,
            {
              variant: 'outline',
              class:
                'ml-1 border-amber-500 text-amber-600 dark:border-amber-500 dark:text-amber-400',
            },
            () => '即將到期',
          ),
        )
      }
      return h('div', badges)
    },
  },
  {
    accessorKey: 'userCount',
    header: () => '使用者',
    cell: ({ row }) => {
      const r = row.original
      return h('span', { class: 'tabular-nums text-foreground' }, [
        r.userCount,
        r.userLimit != null
          ? h('span', { class: 'text-muted-foreground' }, ` / ${r.userLimit}`)
          : null,
      ])
    },
  },
  {
    accessorKey: 'projectCount',
    header: () => '專案',
    cell: ({ row }) =>
      h('span', { class: 'tabular-nums text-foreground' }, String(row.original.projectCount)),
  },
  {
    id: 'storage',
    header: () => h('span', { class: 'min-w-[200px]' }, '儲存用量'),
    cell: ({ row }) => {
      const r = row.original
      const pct = storagePercent(r)
      return h('div', { class: 'flex min-w-[200px] flex-col gap-1' }, [
        h('span', { class: 'text-foreground' }, storageDisplay(r.storageUsageBytes)),
        h('span', { class: 'text-xs text-muted-foreground' }, quotaDisplay(r.storageQuotaMb)),
        pct != null
          ? h(Progress, {
              modelValue: pct,
              class: ['h-2 w-32', isOverQuota(r) ? '[&>div]:bg-destructive' : ''],
            })
          : null,
        isOverQuota(r) ? h('span', { class: 'text-xs text-destructive' }, '已超用') : null,
      ])
    },
  },
  {
    accessorKey: 'expiresAt',
    header: () => '到期日',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'tabular-nums text-muted-foreground' },
        formatDate(row.original.expiresAt),
      ),
  },
])

const { table, globalFilter, hasActiveFilters, resetTableState } = useClientDataTable({
  data: statusFilteredData,
  columns,
  features: TABLE_FEATURES,
  getRowId: (row) => row.id,
  globalFilterFn: usageGlobalFilterFn,
  initialPageSize: 10,
  enableRowSelection: false,
})

watch(statusFilter, () => {
  resetTableState()
})

const toolbarHasActiveFilters = computed(
  () => hasActiveFilters.value || statusFilter.value !== ALL_STATUS,
)

function resetAllFilters() {
  statusFilter.value = ALL_STATUS
  resetTableState()
}

const emptyText = computed(() => {
  if (list.value.length === 0) return '尚無租戶或用量資料。'
  if (statusFilteredData.value.length === 0) return '此狀態下沒有租戶。'
  if (globalFilter.value.trim() && table.getFilteredRowModel().rows.length === 0)
    return '目前搜尋無符合的租戶。'
  return '此頁無資料'
})

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">用量總覽</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        各租戶的使用者數、專案數與儲存用量。可依狀態篩選，並搜尋租戶名稱、slug、狀態；使用「重設」清空條件。
      </p>
    </div>

    <DataTableFeatureToolbar
      :table="table"
      :features="TABLE_FEATURES"
      :column-labels="COLUMN_LABELS"
      :has-active-filters="toolbarHasActiveFilters"
      :global-filter="globalFilter"
      :search-disabled="loading"
      search-placeholder="搜尋租戶名稱、slug、狀態…"
      :collapse-when-row-selection="false"
      @reset="resetAllFilters"
    >
      <template #prepend-filters>
        <DataTableFilterPill
          v-model="statusFilter"
          title="租戶狀態"
          :all-value="ALL_STATUS"
          :options="usageStatusPillOptions"
          :disabled="loading"
        />
      </template>
      <template #actions />
    </DataTableFeatureToolbar>

    <div class="rounded-lg border border-border bg-card">
      <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 class="size-8 animate-spin" />
      </div>
      <DataTableFeatureSection v-else :table="table" :empty-text="emptyText" />
    </div>
    <div v-if="!loading && list.length > 0" class="mt-4">
      <DataTablePagination :table="table" hide-selection-info />
    </div>
  </div>
</template>
