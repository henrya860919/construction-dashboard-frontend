<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { getCoreRowModel, useVueTable, FlexRender } from '@tanstack/vue-table'
import { computed, h, onMounted, ref } from 'vue'
import { useRoute, RouterLink, type RouteLocationRaw } from 'vue-router'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import { buildProjectPath, ROUTE_PATH, ROUTE_NAME } from '@/constants/routes'
import { formatThousands } from '@/lib/format-number'
import {
  listConstructionValuations,
  type ConstructionValuationListItemDto,
} from '@/api/construction-valuations'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { Loader2, Plus } from 'lucide-vue-next'

const route = useRoute()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const perm = useProjectModuleActions(projectId, 'construction.valuation')

const newPath = computed(() =>
  buildProjectPath(projectId.value, ROUTE_PATH.PROJECT_CONSTRUCTION_DIARY_VALUATION_NEW)
)

const list = ref<ConstructionValuationListItemDto[]>([])
const meta = ref<{ page: number; limit: number; total: number } | null>(null)
const loading = ref(true)
const page = ref(1)
const limit = ref(20)

const totalPages = computed(() => (meta.value ? Math.ceil(meta.value.total / limit.value) : 0))

async function load() {
  loading.value = true
  try {
    const res = await listConstructionValuations(projectId.value, {
      page: page.value,
      limit: limit.value,
    })
    list.value = res.list
    meta.value = res.meta
  } catch {
    list.value = []
    meta.value = null
  } finally {
    loading.value = false
  }
}

const columns = computed<ColumnDef<ConstructionValuationListItemDto, unknown>[]>(() => [
  {
    accessorKey: 'valuationDate',
    header: () => '估驗日期',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'tabular-nums text-foreground' },
        row.original.valuationDate?.trim() || '—'
      ),
  },
  {
    accessorKey: 'title',
    header: () => '標題／摘要',
    cell: ({ row }) =>
      h('span', { class: 'text-muted-foreground' }, row.original.title?.trim() || '—'),
  },
  {
    id: 'amount',
    header: () => '本次估驗金額合計',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'tabular-nums text-foreground' },
        formatThousands(row.original.currentPeriodTotalAmount, { maximumFractionDigits: 2 })
      ),
  },
  {
    accessorKey: 'createdAt',
    header: () => '建立時間',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-xs text-muted-foreground tabular-nums' },
        new Date(row.original.createdAt).toLocaleString()
      ),
  },
  {
    id: 'actions',
    header: () => '',
    cell: ({ row }) => {
      const to: RouteLocationRaw = {
        name: ROUTE_NAME.PROJECT_CONSTRUCTION_DIARY_VALUATION_DETAIL,
        params: { projectId: projectId.value, valuationId: row.original.id },
      }
      return h(
        RouterLink,
        {
          to,
          class:
            'inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline',
        },
        () => '開啟'
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
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold text-foreground">估驗計價</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        每次估驗一筆主檔；明細可自核定 PCCES 帶入。本次可估驗數量＝上限扣除他次已估驗與本次填寫。
      </p>
    </div>

    <div v-if="!perm.canRead.value" class="text-sm text-muted-foreground">
      您沒有估驗計價檢視權限（<code class="rounded bg-muted px-1 py-0.5 text-xs">construction.valuation</code>）。
    </div>

    <template v-else>
      <div class="flex flex-wrap items-center justify-end gap-3">
        <Button v-if="perm.canCreate.value" class="gap-2" as-child>
          <RouterLink :to="newPath" class="inline-flex items-center gap-2">
            <Plus class="size-4" />
            新增估驗
          </RouterLink>
        </Button>
      </div>

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
              <TableRow v-if="list.length === 0">
                <TableCell :colspan="columns.length" class="h-24 text-center text-muted-foreground">
                  尚無估驗紀錄，請點「新增估驗」建立。
                </TableCell>
              </TableRow>
              <TableRow v-for="row in table.getRowModel().rows" :key="row.id">
                <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div v-if="list.length > 0" class="mt-4">
            <DataTablePagination :table="table" hide-selection-info />
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
