<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table'
import { FlexRender } from '@tanstack/vue-table'
import { ref, computed, onMounted, h } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, Eye } from 'lucide-vue-next'
import { fetchAuditLogs, type AuditLogItem } from '@/api/platform'
import {
  AUDIT_ACTION_LABELS,
  AUDIT_RESOURCE_TYPE_LABELS,
  getAuditActionLabel,
  getAuditResourceTypeLabel,
} from '@/constants/audit'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'

const ALL_VALUE = '__all__'
const list = ref<AuditLogItem[]>([])
const meta = ref<{ page: number; limit: number; total: number } | null>(null)
const loading = ref(true)
const page = ref(1)
const limit = ref(20)
const actionFilter = ref(ALL_VALUE)
const resourceTypeFilter = ref(ALL_VALUE)
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
const hasFilters = computed(
  () =>
    actionFilter.value !== ALL_VALUE ||
    resourceTypeFilter.value !== ALL_VALUE ||
    fromDate.value !== '' ||
    toDate.value !== ''
)

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
      from?: string
      to?: string
    } = { page: page.value, limit: limit.value }
    if (actionFilter.value && actionFilter.value !== ALL_VALUE) params.action = actionFilter.value
    if (resourceTypeFilter.value && resourceTypeFilter.value !== ALL_VALUE) params.resourceType = resourceTypeFilter.value
    if (fromDate.value) params.from = fromDate.value
    if (toDate.value) params.to = toDate.value
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

function applyFilters() {
  page.value = 1
  load()
}

function clearFilters() {
  actionFilter.value = ALL_VALUE
  resourceTypeFilter.value = ALL_VALUE
  fromDate.value = ''
  toDate.value = ''
  page.value = 1
  load()
}

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
    cell: ({ row }) => h('span', { class: 'tabular-nums text-foreground' }, formatDateTime(row.original.createdAt)),
  },
  {
    id: 'user',
    header: () => '操作者',
    cell: ({ row }) =>
      h('span', { class: 'text-foreground' }, row.original.user ? (row.original.user.name || row.original.user.email) : '—'),
  },
  {
    accessorKey: 'action',
    header: () => '動作',
    cell: ({ row }) => h('span', { class: 'font-medium text-foreground' }, actionLabel(row.original.action)),
  },
  {
    accessorKey: 'resourceType',
    header: () => '資源類型',
    cell: ({ row }) => h('span', { class: 'text-muted-foreground' }, resourceTypeLabel(row.original.resourceType)),
  },
  {
    accessorKey: 'resourceId',
    header: () => '資源 ID',
    cell: ({ row }) =>
      h('span', { class: 'font-mono text-xs text-muted-foreground' }, row.original.resourceId ? row.original.resourceId.slice(0, 12) + '…' : '—'),
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
        () => [h(Eye, { class: 'size-3.5' }), ' 查看詳情']
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
      load()
    }
  },
  getRowId: (row) => row.id,
})

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">稽核日誌</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        檢視平台關鍵操作紀錄（租戶、使用者、專案等），可依動作、資源類型、日期篩選。
      </p>
    </div>

    <!-- 工具列：篩選在左（無勾選列，故無右側批次操作） -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <Select v-model="actionFilter">
          <SelectTrigger class="w-[140px] bg-background">
            <SelectValue placeholder="動作" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt in ACTION_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="resourceTypeFilter">
          <SelectTrigger class="w-[120px] bg-background">
            <SelectValue placeholder="資源類型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="opt in RESOURCE_OPTIONS" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Input v-model="fromDate" type="date" class="w-40 bg-background" />
        <span class="text-muted-foreground">～</span>
        <Input v-model="toDate" type="date" class="w-40 bg-background" />
        <Button variant="secondary" @click="applyFilters">查詢</Button>
        <Button v-if="hasFilters" variant="ghost" @click="clearFilters">清除</Button>
      </div>
    </div>

    <!-- 表格區塊（與使用者總覽同：rounded-lg border bg-card p-4；無勾選列） -->
    <div class="rounded-lg border border-border bg-card p-4">
      <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 class="size-8 animate-spin" />
      </div>
      <template v-else>
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
                <TableHead
                  v-for="header in headerGroup.headers"
                  :key="header.id"
                  :class="header.id === 'details' ? 'max-w-[200px]' : ''"
                >
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
                >
                  <TableCell
                    v-for="cell in row.getVisibleCells()"
                    :key="cell.id"
                    :class="cell.column.id === 'details' ? 'max-w-[200px] text-xs' : ''"
                  >
                    <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                  </TableCell>
                </TableRow>
              </template>
              <template v-else>
                <TableRow>
                  <TableCell :colspan="6" class="h-24 text-center text-muted-foreground">
                    尚無稽核紀錄或目前篩選無結果。
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>
        <DataTablePagination v-if="meta" :table="table" hide-selection-info />
      </template>
    </div>

    <!-- 詳情 Dialog：修改前 / 修改後或完整 JSON -->
    <Dialog v-model:open="detailDialogOpen">
      <DialogContent class="max-h-[85vh] max-w-2xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>稽核詳情</DialogTitle>
        </DialogHeader>
        <div v-if="selectedDetailRow" class="flex flex-1 flex-col gap-4 overflow-y-auto">
          <div v-if="selectedDetailRow.user" class="text-sm text-muted-foreground">
            {{ selectedDetailRow.user.name || selectedDetailRow.user.email }}
            · {{ actionLabel(selectedDetailRow.action) }} · {{ formatDateTime(selectedDetailRow.createdAt) }}
          </div>
          <template v-if="hasBeforeAfter(selectedDetailRow.details)">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <p class="text-sm font-medium text-foreground">修改前</p>
                <pre class="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground whitespace-pre-wrap break-words">{{ formatDetailJson(detailBefore(selectedDetailRow.details)) }}</pre>
              </div>
              <div class="space-y-2">
                <p class="text-sm font-medium text-foreground">修改後</p>
                <pre class="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground whitespace-pre-wrap break-words">{{ formatDetailJson(detailAfter(selectedDetailRow.details)) }}</pre>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="space-y-2">
              <p class="text-sm font-medium text-foreground">詳情</p>
              <pre class="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground whitespace-pre-wrap break-words">{{ formatDetailJson(selectedDetailRow.details) }}</pre>
            </div>
          </template>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
