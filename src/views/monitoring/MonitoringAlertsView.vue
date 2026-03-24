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
import { ref, computed, onMounted, h } from 'vue'
import { useRoute } from 'vue-router'
import { valueUpdater } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2 } from 'lucide-vue-next'
import { fetchAlertHistory, type AlertHistoryItem } from '@/api/alerts'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import MonitoringAlertsRowActions from '@/views/monitoring/MonitoringAlertsRowActions.vue'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { ensureProjectPermission } from '@/lib/permission-toast'

defineProps<{ embedded?: boolean }>()

const route = useRoute()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const monitorPerm = useProjectModuleActions(projectId, 'construction.monitor')

const list = ref<AlertHistoryItem[]>([])
const loading = ref(true)
const errorMessage = ref('')
const detailOpen = ref(false)
const selectedAlert = ref<AlertHistoryItem | null>(null)

const startDate = ref('')
const endDate = ref('')

const sorting = ref<SortingState>([])
const rowSelection = ref<Record<string, boolean>>({})

function setDefaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)
  endDate.value = end.toISOString().slice(0, 10)
  startDate.value = start.toISOString().slice(0, 10)
}

async function load() {
  if (!startDate.value || !endDate.value) return
  loading.value = true
  errorMessage.value = ''
  try {
    list.value = await fetchAlertHistory({
      projectId: projectId.value,
      startDate: startDate.value,
      endDate: endDate.value,
      limit: 200,
    })
  } catch {
    list.value = []
    errorMessage.value = '無法載入警報紀錄'
  } finally {
    loading.value = false
  }
}

function openDetail(row: AlertHistoryItem) {
  selectedAlert.value = row
  detailOpen.value = true
}

function formatDateTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const levelLabel = (level: string) => {
  if (level === 'alarm') return '警報'
  if (level === 'attention') return '注意'
  return '正常'
}

const levelVariant = (level: string): 'destructive' | 'secondary' | 'outline' => {
  if (level === 'alarm') return 'destructive'
  if (level === 'attention') return 'secondary'
  return 'outline'
}

const columns = computed<ColumnDef<AlertHistoryItem, unknown>[]>(() => [
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
    accessorKey: 'title',
    id: 'title',
    header: () => '類型',
    cell: ({ row }) => h('div', { class: 'font-medium text-foreground' }, row.original.title),
  },
  {
    accessorKey: 'level',
    id: 'level',
    header: () => '等級',
    cell: ({ row }) =>
      h(Badge, { variant: levelVariant(row.original.level) }, () => levelLabel(row.original.level)),
  },
  {
    accessorKey: 'value',
    id: 'value',
    header: () => '摘要',
    cell: ({ row }) =>
      h('div', { class: 'max-w-[240px] truncate text-muted-foreground' }, row.original.value),
  },
  {
    accessorKey: 'createdAt',
    id: 'createdAt',
    header: () => '時間',
    cell: ({ row }) =>
      h(
        'div',
        { class: 'tabular-nums text-muted-foreground' },
        formatDateTime(row.original.createdAt)
      ),
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'w-[80px]' }),
    cell: ({ row }) =>
      h(MonitoringAlertsRowActions, {
        row: row.original,
        onView: (r) => {
          if (!ensureProjectPermission(monitorPerm.canRead.value, 'read')) return
          openDetail(r)
        },
      }),
    enableSorting: false,
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
  getPaginationRowModel: getPaginationRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
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

function clearSelection() {
  rowSelection.value = {}
}

onMounted(() => {
  setDefaultDateRange()
  load()
})
</script>

<template>
  <div class="space-y-4">
    <template v-if="!embedded">
      <h1 class="text-xl font-semibold text-foreground">歷史警報</h1>
      <p class="text-sm text-muted-foreground">
        目前顯示政府（氣象署等）警特報紀錄；之後可支援手動新增。
      </p>
    </template>

    <!-- 工具列：篩選在左、已選+ButtonGroup 在右 -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <Input v-model="startDate" type="date" class="w-[10rem]" />
        <span class="text-muted-foreground">～</span>
        <Input v-model="endDate" type="date" class="w-[10rem]" />
        <Button variant="outline" :disabled="loading" @click="load">
          <Loader2 v-if="loading" class="mr-2 size-4 animate-spin" />
          查詢
        </Button>
      </div>
      <div class="flex flex-wrap items-center justify-end gap-3">
        <template v-if="hasSelection">
          <span class="text-sm text-muted-foreground">已選 {{ selectedRows.length }} 項</span>
          <ButtonGroup>
            <Button variant="outline" size="sm" @click="clearSelection">取消選取</Button>
          </ButtonGroup>
        </template>
      </div>
    </div>

    <div class="rounded-lg border border-border bg-card">
      <p v-if="errorMessage" class="mb-3 px-4 pt-4 text-sm text-destructive">{{ errorMessage }}</p>
      <div v-else-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
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
              <template v-if="list.length === 0">
                <TableRow>
                  <TableCell :colspan="6" class="h-24 text-center text-muted-foreground">
                    此區間無警報紀錄
                  </TableCell>
                </TableRow>
              </template>
              <template v-else-if="table.getRowModel().rows.length">
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
                    此頁無資料
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>
      </template>
    </div>
    <div v-if="!loading && !errorMessage && list.length > 0" class="mt-4">
      <DataTablePagination :table="table" />
    </div>

    <Dialog v-model:open="detailOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>警報詳情</DialogTitle>
        </DialogHeader>
        <div v-if="selectedAlert" class="space-y-3 text-sm">
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">類型</span>
            <span class="font-medium text-foreground">{{ selectedAlert.title }}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">等級</span>
            <Badge :variant="levelVariant(selectedAlert.level)">
              {{ levelLabel(selectedAlert.level) }}
            </Badge>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">摘要</span>
            <span class="text-right text-foreground">{{ selectedAlert.value }}</span>
          </div>
          <div v-if="selectedAlert.description" class="flex flex-col gap-1">
            <span class="text-muted-foreground">說明</span>
            <p class="rounded border border-border bg-muted/30 p-2 text-foreground">
              {{ selectedAlert.description }}
            </p>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">時間</span>
            <span class="tabular-nums text-foreground">{{
              formatDateTime(selectedAlert.createdAt)
            }}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
