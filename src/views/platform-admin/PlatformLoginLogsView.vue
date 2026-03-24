<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table'
import { ref, computed, onMounted, watch, h } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search } from 'lucide-vue-next'
import { fetchLoginLogs, type LoginLogItem } from '@/api/platform'
import { localDateEndIso, localDateStartIso } from '@/lib/utils'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import DataTableToolbarShell from '@/components/common/data-table/DataTableToolbarShell.vue'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTableFilterPill from '@/components/common/data-table/DataTableFilterPill.vue'
import DataTableServerDateRangePill from '@/components/common/data-table/DataTableServerDateRangePill.vue'

const SUCCESS_FILTER_OPTIONS = [
  { value: 'all', label: '全部結果' },
  { value: 'true', label: '成功' },
  { value: 'false', label: '失敗' },
]

const list = ref<LoginLogItem[]>([])
const meta = ref<{ page: number; limit: number; total: number } | null>(null)
const loading = ref(true)
const page = ref(1)
const limit = ref(20)
const queryFilter = ref('')
const successFilter = ref<string>('all')
const fromDate = ref('')
const toDate = ref('')

const totalPages = computed(() => (meta.value ? Math.ceil(meta.value.total / limit.value) : 0))

const toolbarHasActiveFilters = computed(
  () =>
    queryFilter.value.trim() !== '' ||
    successFilter.value !== 'all' ||
    fromDate.value !== '' ||
    toDate.value !== '',
)

const emptyText = computed(() => {
  if (!meta.value || meta.value.total === 0) {
    return toolbarHasActiveFilters.value
      ? '目前篩選條件下沒有登入紀錄。'
      : '尚無登入紀錄。'
  }
  return '此頁無資料'
})

async function load() {
  loading.value = true
  try {
    const params: {
      page: number
      limit: number
      q?: string
      success?: boolean
      from?: string
      to?: string
    } = {
      page: page.value,
      limit: limit.value,
    }
    if (queryFilter.value.trim()) params.q = queryFilter.value.trim()
    if (successFilter.value === 'true') params.success = true
    if (successFilter.value === 'false') params.success = false
    if (fromDate.value) params.from = localDateStartIso(fromDate.value)
    if (toDate.value) params.to = localDateEndIso(toDate.value)
    const res = await fetchLoginLogs(params)
    list.value = res.list
    meta.value = res.meta ?? null
  } catch {
    list.value = []
    meta.value = null
  } finally {
    loading.value = false
  }
}

function clearFilters() {
  queryFilter.value = ''
  successFilter.value = 'all'
  fromDate.value = ''
  toDate.value = ''
  page.value = 1
  void load()
}

watch([successFilter, fromDate, toDate], () => {
  page.value = 1
  void load()
})

watchDebounced(
  queryFilter,
  () => {
    page.value = 1
    void load()
  },
  { debounce: 400 },
)

function formatDateTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const columns = computed<ColumnDef<LoginLogItem, unknown>[]>(() => [
  {
    accessorKey: 'createdAt',
    header: () => '時間',
    cell: ({ row }) =>
      h('span', { class: 'tabular-nums text-foreground' }, formatDateTime(row.original.createdAt)),
  },
  {
    accessorKey: 'email',
    header: () => 'Email',
    cell: ({ row }) => h('span', { class: 'font-medium text-foreground' }, row.original.email),
  },
  {
    accessorKey: 'success',
    header: () => '結果',
    cell: ({ row }) =>
      h(
        Badge,
        {
          variant: row.original.success ? 'default' : 'destructive',
          class: 'font-normal',
        },
        () => (row.original.success ? '成功' : '失敗'),
      ),
  },
  {
    accessorKey: 'failureReason',
    header: () => '失敗原因',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'max-w-[180px] truncate text-muted-foreground' },
        row.original.failureReason ?? '—',
      ),
  },
  {
    accessorKey: 'ipAddress',
    header: () => 'IP',
    cell: ({ row }) =>
      h('span', { class: 'font-mono text-sm text-muted-foreground' }, row.original.ipAddress ?? '—'),
  },
])

const table = useVueTable({
  get data() {
    return list.value
  },
  get columns() {
    return columns.value
  },
  getCoreRowModel: getCoreRowModel(),
  manualPagination: true,
  get pageCount() {
    return totalPages.value || 1
  },
  state: {
    get pagination() {
      return { pageIndex: page.value - 1, pageSize: limit.value }
    },
  },
  onPaginationChange: (updater) => {
    const prev = { pageIndex: page.value - 1, pageSize: limit.value }
    const next = typeof updater === 'function' ? updater(prev) : updater
    if (next) {
      page.value = next.pageIndex + 1
      limit.value = next.pageSize
      void load()
    }
  },
  getRowId: (row) => row.id,
})

onMounted(() => {
  void load()
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">登入紀錄</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        檢視平台登入嘗試（成功與失敗）。變更結果或日期會立即查詢；關鍵字輸入後會短暫延遲再查詢。使用「重設」可清空所有條件。
      </p>
    </div>

    <DataTableToolbarShell
      :table="table"
      :column-labels="{}"
      :has-active-filters="toolbarHasActiveFilters"
      :show-multi-sort="false"
      :show-column-visibility="false"
      @reset="clearFilters"
    >
      <template #filters>
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div class="relative min-w-0 max-w-sm flex-1 basis-full sm:min-w-[240px] sm:basis-auto">
            <Search
              class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              v-model="queryFilter"
              type="search"
              placeholder="Email、IP、失敗原因…"
              class="h-8 w-full bg-background pl-9 sm:max-w-sm"
              :disabled="loading"
              autocomplete="off"
            />
          </div>
          <DataTableFilterPill
            v-model="successFilter"
            title="登入結果"
            all-value="all"
            :options="SUCCESS_FILTER_OPTIONS"
            :disabled="loading"
          />
          <DataTableServerDateRangePill
            title="時間區間"
            :from="fromDate"
            :to="toDate"
            :disabled="loading"
            @update:from="(v) => (fromDate = v)"
            @update:to="(v) => (toDate = v)"
          />
        </div>
      </template>
      <template #actions />
    </DataTableToolbarShell>

    <div class="rounded-lg border border-border bg-card">
      <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 class="size-8 animate-spin" />
      </div>
      <DataTableFeatureSection v-else :table="table" :empty-text="emptyText" />
    </div>
    <div v-if="!loading && meta && meta.total > 0" class="mt-4">
      <DataTablePagination :table="table" hide-selection-info />
    </div>
  </div>
</template>
