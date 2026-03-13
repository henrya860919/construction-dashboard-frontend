<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table'
import { FlexRender } from '@tanstack/vue-table'
import { ref, computed, onMounted, h } from 'vue'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Search } from 'lucide-vue-next'
import { fetchLoginLogs, type LoginLogItem } from '@/api/platform'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'

const list = ref<LoginLogItem[]>([])
const meta = ref<{ page: number; limit: number; total: number } | null>(null)
const loading = ref(true)
const page = ref(1)
const limit = ref(20)
const emailFilter = ref('')
const successFilter = ref<string>('all')
const fromDate = ref('')
const toDate = ref('')

const totalPages = computed(() => (meta.value ? Math.ceil(meta.value.total / limit.value) : 0))
const hasFilters = computed(
  () =>
    emailFilter.value.trim() !== '' ||
    successFilter.value !== 'all' ||
    fromDate.value !== '' ||
    toDate.value !== ''
)

async function load() {
  loading.value = true
  try {
    const params: {
      page: number
      limit: number
      email?: string
      success?: boolean
      from?: string
      to?: string
    } = {
      page: page.value,
      limit: limit.value,
    }
    if (emailFilter.value.trim()) params.email = emailFilter.value.trim()
    if (successFilter.value === 'true') params.success = true
    if (successFilter.value === 'false') params.success = false
    if (fromDate.value) params.from = fromDate.value
    if (toDate.value) params.to = toDate.value
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

function applyFilters() {
  page.value = 1
  load()
}

function clearFilters() {
  emailFilter.value = ''
  successFilter.value = 'all'
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
        () => (row.original.success ? '成功' : '失敗')
      ),
  },
  {
    accessorKey: 'failureReason',
    header: () => '失敗原因',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'max-w-[180px] truncate text-muted-foreground' },
        row.original.failureReason ?? '—'
      ),
  },
  {
    accessorKey: 'ipAddress',
    header: () => 'IP',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'font-mono text-sm text-muted-foreground' },
        row.original.ipAddress ?? '—'
      ),
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
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">登入紀錄</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        檢視平台登入嘗試（成功與失敗），可依 Email、結果、日期篩選。
      </p>
    </div>

    <!-- 工具列：篩選在左（無勾選列，故無右側批次操作） -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <div class="relative w-56">
          <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="emailFilter"
            placeholder="Email"
            class="pl-9 bg-background"
            @keyup.enter="applyFilters"
          />
        </div>
        <Select v-model="successFilter">
          <SelectTrigger class="w-[120px] bg-background">
            <SelectValue placeholder="結果" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="true">成功</SelectItem>
            <SelectItem value="false">失敗</SelectItem>
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
                >
                  <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
                    <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                  </TableCell>
                </TableRow>
              </template>
              <template v-else>
                <TableRow>
                  <TableCell :colspan="5" class="h-24 text-center text-muted-foreground">
                    尚無登入紀錄或目前篩選無結果。
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>
        <DataTablePagination v-if="meta" :table="table" hide-selection-info />
      </template>
    </div>
  </div>
</template>
