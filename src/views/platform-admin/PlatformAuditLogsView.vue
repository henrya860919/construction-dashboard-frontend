<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table'
import { ref, computed, onMounted, watch, h } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Eye, Search } from 'lucide-vue-next'
import { fetchAuditLogs, type AuditLogItem } from '@/api/platform'
import { localDateEndIso, localDateStartIso } from '@/lib/utils'
import {
  AUDIT_ACTION_LABELS,
  AUDIT_RESOURCE_TYPE_LABELS,
  getAuditActionLabel,
  getAuditResourceTypeLabel,
} from '@/constants/audit'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import DataTableToolbarShell from '@/components/common/data-table/DataTableToolbarShell.vue'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTableFilterPill from '@/components/common/data-table/DataTableFilterPill.vue'
import DataTableServerDateRangePill from '@/components/common/data-table/DataTableServerDateRangePill.vue'

const ALL_VALUE = '__all__'
const list = ref<AuditLogItem[]>([])
const meta = ref<{ page: number; limit: number; total: number } | null>(null)
const loading = ref(true)
const page = ref(1)
const limit = ref(20)
const actionFilter = ref(ALL_VALUE)
const resourceTypeFilter = ref(ALL_VALUE)
const searchFilter = ref('')
const fromDate = ref('')
const toDate = ref('')
const detailDialogOpen = ref(false)
const selectedDetailRow = ref<AuditLogItem | null>(null)

const ACTION_OPTIONS = [
  { value: ALL_VALUE, label: '全部動作' },
  ...Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label })),
]
const RESOURCE_OPTIONS = [
  { value: ALL_VALUE, label: '全部類型' },
  ...Object.entries(AUDIT_RESOURCE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

const totalPages = computed(() => (meta.value ? Math.ceil(meta.value.total / limit.value) : 0))

const toolbarHasActiveFilters = computed(
  () =>
    searchFilter.value.trim() !== '' ||
    actionFilter.value !== ALL_VALUE ||
    resourceTypeFilter.value !== ALL_VALUE ||
    fromDate.value !== '' ||
    toDate.value !== '',
)

const emptyText = computed(() => {
  if (!meta.value || meta.value.total === 0) {
    return toolbarHasActiveFilters.value
      ? '目前篩選條件下沒有稽核紀錄。'
      : '尚無稽核紀錄。'
  }
  return '此頁無資料'
})

function actionLabel(action: string): string {
  return getAuditActionLabel(action)
}

function resourceTypeLabel(resourceType: string): string {
  return getAuditResourceTypeLabel(resourceType)
}

async function load() {
  loading.value = true
  try {
    const params: {
      page: number
      limit: number
      action?: string
      resourceType?: string
      search?: string
      from?: string
      to?: string
    } = { page: page.value, limit: limit.value }
    if (searchFilter.value.trim()) params.search = searchFilter.value.trim()
    if (actionFilter.value && actionFilter.value !== ALL_VALUE) params.action = actionFilter.value
    if (resourceTypeFilter.value && resourceTypeFilter.value !== ALL_VALUE)
      params.resourceType = resourceTypeFilter.value
    if (fromDate.value) params.from = localDateStartIso(fromDate.value)
    if (toDate.value) params.to = localDateEndIso(toDate.value)
    const res = await fetchAuditLogs(params)
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
  searchFilter.value = ''
  actionFilter.value = ALL_VALUE
  resourceTypeFilter.value = ALL_VALUE
  fromDate.value = ''
  toDate.value = ''
  page.value = 1
  void load()
}

watch([actionFilter, resourceTypeFilter, fromDate, toDate], () => {
  page.value = 1
  void load()
})

watchDebounced(
  searchFilter,
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

function detailsSummary(details: unknown): string {
  if (details == null) return '—'
  if (typeof details === 'object' && details !== null) {
    const d = details as Record<string, unknown>
    if ('before' in d && 'after' in d) return '修改前 / 修改後（點擊查看）'
    try {
      return JSON.stringify(details).slice(0, 60) + (JSON.stringify(details).length > 60 ? '…' : '')
    } catch {
      return '—'
    }
  }
  return String(details)
}

function openDetail(row: AuditLogItem) {
  selectedDetailRow.value = row
  detailDialogOpen.value = true
}

function hasBeforeAfter(details: unknown): details is { before: unknown; after: unknown } {
  return (
    details != null &&
    typeof details === 'object' &&
    'before' in (details as object) &&
    'after' in (details as object)
  )
}

function formatDetailJson(val: unknown): string {
  if (val == null) return '—'
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}

function detailBefore(details: unknown): unknown {
  return hasBeforeAfter(details) ? details.before : null
}

function detailAfter(details: unknown): unknown {
  return hasBeforeAfter(details) ? details.after : null
}

const columns = computed<ColumnDef<AuditLogItem, unknown>[]>(() => [
  {
    accessorKey: 'createdAt',
    header: () => '時間',
    cell: ({ row }) =>
      h('span', { class: 'tabular-nums text-foreground' }, formatDateTime(row.original.createdAt)),
  },
  {
    id: 'user',
    header: () => '操作者',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-foreground' },
        row.original.user ? row.original.user.name || row.original.user.email : '—',
      ),
  },
  {
    accessorKey: 'action',
    header: () => '動作',
    cell: ({ row }) =>
      h('span', { class: 'font-medium text-foreground' }, actionLabel(row.original.action)),
  },
  {
    accessorKey: 'resourceType',
    header: () => '資源類型',
    cell: ({ row }) =>
      h('span', { class: 'text-muted-foreground' }, resourceTypeLabel(row.original.resourceType)),
  },
  {
    accessorKey: 'resourceId',
    header: () => '資源 ID',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'font-mono text-xs text-muted-foreground' },
        row.original.resourceId ? row.original.resourceId.slice(0, 12) + '…' : '—',
      ),
  },
  {
    id: 'details',
    header: () => '詳情',
    cell: ({ row }) => {
      const item = row.original
      if (item.details == null) return h('span', {}, '—')
      return h(
        Button,
        {
          variant: 'ghost',
          class: 'h-8 gap-1.5 text-muted-foreground hover:text-foreground',
          title: detailsSummary(item.details),
          onClick: () => openDetail(item),
        },
        () => [h(Eye, { class: 'size-3.5' }), ' 查看詳情'],
      )
    },
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
      <h1 class="text-xl font-semibold tracking-tight text-foreground">稽核日誌</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        檢視平台關鍵操作紀錄。變更動作、資源類型或日期會立即查詢；關鍵字輸入後會短暫延遲再查詢。使用「重設」可清空所有條件。
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
              v-model="searchFilter"
              type="search"
              placeholder="操作者、動作、資源、IP…"
              class="h-8 w-full bg-background pl-9 sm:max-w-sm"
              :disabled="loading"
              autocomplete="off"
            />
          </div>
          <DataTableFilterPill
            v-model="actionFilter"
            title="動作"
            :all-value="ALL_VALUE"
            :options="ACTION_OPTIONS"
            :disabled="loading"
          />
          <DataTableFilterPill
            v-model="resourceTypeFilter"
            title="資源類型"
            :all-value="ALL_VALUE"
            :options="RESOURCE_OPTIONS"
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

    <Dialog v-model:open="detailDialogOpen">
      <DialogContent class="flex max-h-[85vh] max-w-2xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>稽核詳情</DialogTitle>
        </DialogHeader>
        <div v-if="selectedDetailRow" class="flex flex-1 flex-col gap-4 overflow-y-auto">
          <div v-if="selectedDetailRow.user" class="text-sm text-muted-foreground">
            {{ selectedDetailRow.user.name || selectedDetailRow.user.email }}
            · {{ actionLabel(selectedDetailRow.action) }} ·
            {{ formatDateTime(selectedDetailRow.createdAt) }}
          </div>
          <template v-if="hasBeforeAfter(selectedDetailRow.details)">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <p class="text-sm font-medium text-foreground">修改前</p>
                <pre
                  class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground"
                  >{{ formatDetailJson(detailBefore(selectedDetailRow.details)) }}</pre
                >
              </div>
              <div class="space-y-2">
                <p class="text-sm font-medium text-foreground">修改後</p>
                <pre
                  class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground"
                  >{{ formatDetailJson(detailAfter(selectedDetailRow.details)) }}</pre
                >
              </div>
            </div>
          </template>
          <template v-else>
            <div class="space-y-2">
              <p class="text-sm font-medium text-foreground">詳情</p>
              <pre
                class="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground"
                >{{ formatDetailJson(selectedDetailRow.details) }}</pre
              >
            </div>
          </template>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
