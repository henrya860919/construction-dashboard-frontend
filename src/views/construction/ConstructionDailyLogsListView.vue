<script setup lang="ts">
import type { ColumnDef, FilterFn } from '@tanstack/vue-table'
import { computed, h, ref, watch } from 'vue'
import { useRoute, RouterLink, type RouteLocationRaw } from 'vue-router'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
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
import DataTableFeatureToolbar from '@/components/common/data-table/DataTableFeatureToolbar.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import { useClientDataTable } from '@/composables/useClientDataTable'
import { buildProjectPath, ROUTE_PATH, ROUTE_NAME } from '@/constants/routes'
import { CONSTRUCTION_DAILY_LOG_BREADCRUMB_STATE_KEY } from '@/lib/construction-daily-log-breadcrumb'
import { formatThousands } from '@/lib/format-number'
import {
  listAllConstructionDailyLogs,
  deleteConstructionDailyLog,
  type ConstructionDailyLogListItemDto,
} from '@/api/construction-daily-logs'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { BookOpenText, CircleHelp, CloudSun, Loader2, Plus, Sparkles, Trees } from 'lucide-vue-next'
import type { TableListFeatures } from '@/types/data-table'

const route = useRoute()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const perm = useProjectModuleActions(projectId, 'construction.diary')

const list = ref<ConstructionDailyLogListItemDto[]>([])
const loading = ref(true)
const errorMessage = ref('')
const batchDeleteOpen = ref(false)
const batchDeleteLoading = ref(false)
const helpOpen = ref(false)

/** 全文搜尋 + 填表日期區間；無欄位顯示開關；保留表頭排序（填表日期） */
const TABLE_FEATURES: TableListFeatures = {
  search: true,
  filtersAndSort: true,
  columnVisibility: false,
}

const COLUMN_LABELS: Record<string, string> = {
  logDate: '填表日期',
  reportNo: '表報編號',
  plannedProgress: '預定進度（%）',
  actualProgress: '實際進度（%）',
}

const diaryGlobalFilterFn: FilterFn<ConstructionDailyLogListItemDto> = (
  row,
  _columnId,
  filterValue
) => {
  const q = String(filterValue ?? '')
    .trim()
    .toLowerCase()
  if (!q) return true
  const r = row.original
  const planned =
    r.plannedProgress == null
      ? ''
      : formatThousands(r.plannedProgress, { maximumFractionDigits: 2 })
  const actual = (r.actualProgress ?? '').toLowerCase()
  const parts = [
    r.logDate,
    r.reportNo ?? '',
    r.weatherAm ?? '',
    r.weatherPm ?? '',
    r.projectName ?? '',
    planned.toLowerCase(),
    actual,
  ].map((s) => String(s).toLowerCase())
  return parts.some((p) => p.includes(q))
}

async function load() {
  if (!projectId.value) return
  loading.value = true
  try {
    list.value = await listAllConstructionDailyLogs(projectId.value)
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

function weatherBrief(row: ConstructionDailyLogListItemDto) {
  const a = row.weatherAm?.trim()
  const p = row.weatherPm?.trim()
  if (a && p) return `${a}／${p}`
  return a || p || '—'
}

const newLogPath = computed(() =>
  buildProjectPath(projectId.value, ROUTE_PATH.PROJECT_CONSTRUCTION_DIARY_LOG_NEW)
)

const selectColumn: ColumnDef<ConstructionDailyLogListItemDto, unknown> = {
  id: 'select',
  header: ({ table }) =>
    h(Checkbox, {
      checked: table.getIsAllPageRowsSelected()
        ? true
        : table.getIsSomePageRowsSelected()
          ? 'indeterminate'
          : false,
      'onUpdate:checked': (v: boolean | 'indeterminate') => table.toggleAllPageRowsSelected(!!v),
      'aria-label': '全選此頁',
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

const columns = computed<ColumnDef<ConstructionDailyLogListItemDto, unknown>[]>(() => [
  selectColumn,
  {
    accessorKey: 'logDate',
    id: 'logDate',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column, title: '填表日期', class: 'text-foreground' }),
    meta: {
      label: '填表日期',
      searchable: true,
      filter: { type: 'dateRange', title: '填表日期' },
    },
    filterFn: (row, _columnId, raw) => {
      const v = raw as { from?: string; to?: string } | undefined
      if (!v?.from && !v?.to) return true
      const logDate = row.original.logDate
      if (v.from && logDate < v.from) return false
      if (v.to && logDate > v.to) return false
      return true
    },
    sortingFn: 'alphanumeric',
    cell: ({ row }) => h('span', { class: 'tabular-nums text-foreground' }, row.original.logDate),
    enableHiding: false,
  },
  {
    accessorKey: 'reportNo',
    id: 'reportNo',
    header: () => '表報編號',
    cell: ({ row }) =>
      h('span', { class: 'text-muted-foreground' }, row.original.reportNo?.trim() || '—'),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'weather',
    header: () => '天氣（上／下）',
    cell: ({ row }) =>
      h('span', { class: 'text-sm text-muted-foreground' }, weatherBrief(row.original)),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'plannedProgress',
    id: 'plannedProgress',
    header: () => '預定進度（%）',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'tabular-nums text-muted-foreground' },
        row.original.plannedProgress == null
          ? '—'
          : formatThousands(row.original.plannedProgress, { maximumFractionDigits: 2 })
      ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'actualProgress',
    id: 'actualProgress',
    header: () => '實際進度（%）',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'tabular-nums text-foreground' },
        row.original.actualProgress == null
          ? '—'
          : formatThousands(row.original.actualProgress, { maximumFractionDigits: 2 })
      ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'actions',
    header: () => '',
    cell: ({ row }) => {
      const to: RouteLocationRaw = {
        name: ROUTE_NAME.PROJECT_CONSTRUCTION_DIARY_LOG_DETAIL,
        params: { projectId: projectId.value, logId: row.original.id },
        state: { [CONSTRUCTION_DAILY_LOG_BREADCRUMB_STATE_KEY]: row.original.logDate },
      }
      return h(
        RouterLink,
        {
          to,
          class: 'inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline',
        },
        () => '編輯'
      )
    },
    enableSorting: false,
    enableHiding: false,
  },
])

const { table, globalFilter, hasActiveFilters, resetTableState } = useClientDataTable({
  data: list,
  columns,
  features: TABLE_FEATURES,
  getRowId: (row) => row.id,
  globalFilterFn: diaryGlobalFilterFn,
  initialPageSize: 20,
})

const selectedRows = computed(() => table.getSelectedRowModel().rows)
const hasSelection = computed(() => selectedRows.value.length > 0)
const selectedCount = computed(() => selectedRows.value.length)

function clearSelection() {
  table.setRowSelection({})
}

function openBatchDelete() {
  batchDeleteOpen.value = true
}

function closeBatchDelete() {
  batchDeleteOpen.value = false
}

async function confirmBatchDelete() {
  const rows = selectedRows.value.map((r) => r.original)
  if (!rows.length) return
  batchDeleteLoading.value = true
  errorMessage.value = ''
  try {
    for (const item of rows) {
      await deleteConstructionDailyLog(projectId.value, item.id)
    }
    closeBatchDelete()
    table.setRowSelection({})
    await load()
  } catch {
    errorMessage.value = '批次刪除失敗'
  } finally {
    batchDeleteLoading.value = false
  }
}

watch(
  projectId,
  (id) => {
    if (!id) {
      list.value = []
      loading.value = false
      return
    }
    resetTableState()
    void load()
  },
  { immediate: true }
)

const logsEmptyText = computed(() => {
  if (!projectId.value) return '缺少專案 ID'
  const q = globalFilter.value.trim()
  if (list.value.length === 0) {
    return q ? '沒有符合條件的資料' : '尚無日誌，請點「新增日誌」建立。'
  }
  return '沒有符合條件的資料'
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-semibold tracking-tight text-foreground">施工日誌</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          公共工程依附表四格式；同一專案同一填表日期僅能一筆。支援全文搜尋，並可透過工具列「填表日期」設定起迄日做區間篩選。
        </p>
      </div>
      <Button
        v-if="perm.canRead.value"
        type="button"
        variant="outline"
        size="sm"
        class="shrink-0 gap-2 self-start"
        @click="helpOpen = true"
      >
        <CircleHelp class="size-4" />
        說明
      </Button>
    </div>

    <div v-if="!perm.canRead.value" class="text-sm text-muted-foreground">
      您沒有施工日誌檢視權限（<code class="rounded bg-muted px-1 py-0.5 text-xs"
        >construction.diary</code
      >）。
    </div>

    <template v-else>
      <DataTableFeatureToolbar
        v-if="!loading && projectId"
        :table="table"
        :features="TABLE_FEATURES"
        :column-labels="COLUMN_LABELS"
        :has-active-filters="hasActiveFilters"
        :global-filter="globalFilter"
        search-placeholder="搜尋日期、表報編號、天氣、進度…"
        @reset="resetTableState"
      >
        <template #actions>
          <div class="flex flex-wrap items-center justify-end gap-3">
            <template v-if="hasSelection">
              <span class="text-sm text-muted-foreground">已選 {{ selectedCount }} 項</span>
              <ButtonGroup>
                <Button variant="outline" size="sm" @click="clearSelection">取消選取</Button>
                <Button
                  v-if="perm.canDelete.value"
                  variant="outline"
                  size="sm"
                  class="text-destructive hover:text-destructive"
                  @click="openBatchDelete"
                >
                  批次刪除
                </Button>
              </ButtonGroup>
            </template>
            <Button
              v-if="perm.canCreate.value && !hasSelection"
              size="sm"
              variant="default"
              class="gap-2"
              as-child
            >
              <RouterLink :to="newLogPath" class="inline-flex items-center gap-2">
                <Plus class="size-4" />
                新增日誌
              </RouterLink>
            </Button>
          </div>
        </template>
      </DataTableFeatureToolbar>

      <div class="rounded-lg border border-border bg-card">
        <p v-if="errorMessage" class="px-4 pt-4 text-sm text-destructive">{{ errorMessage }}</p>
        <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 class="size-8 animate-spin" />
        </div>
        <DataTableFeatureSection v-else :table="table" :empty-text="logsEmptyText" />
      </div>
      <div v-if="!loading && projectId && list.length > 0" class="mt-4">
        <DataTablePagination :table="table" />
      </div>
    </template>

    <Dialog v-model:open="batchDeleteOpen" @update:open="(v: boolean) => !v && closeBatchDelete()">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批次刪除</DialogTitle>
          <DialogDescription>
            確定刪除已選的 {{ selectedCount }} 筆施工日誌？無法復原。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="closeBatchDelete">取消</Button>
          <Button variant="destructive" :disabled="batchDeleteLoading" @click="confirmBatchDelete">
            {{ batchDeleteLoading ? '刪除中…' : '刪除' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="helpOpen">
      <DialogContent
        class="flex max-h-[min(92vh,44rem)] max-w-2xl flex-col gap-0 overflow-hidden border-chart-2/25 p-0 sm:max-w-2xl"
      >
        <DialogHeader
          class="shrink-0 space-y-3 border-b border-chart-2/25 bg-gradient-to-br from-chart-2/20 via-primary/10 to-chart-4/15 px-6 py-5 text-left"
        >
          <div class="flex items-start gap-3">
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-chart-2/25 text-chart-2 shadow-sm ring-2 ring-chart-2/30"
            >
              <CloudSun class="size-6" aria-hidden="true" />
            </div>
            <div class="min-w-0 pt-0.5">
              <DialogTitle class="text-xl font-bold tracking-tight text-foreground">
                施工日誌小幫手
              </DialogTitle>
              <DialogDescription class="mt-1.5 text-sm font-medium leading-relaxed text-chart-2">
                依附表四的每日紀錄，重點一次講清楚 ✨
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 px-6 py-4 text-sm">
          <div class="rounded-2xl border border-chart-2/30 bg-card p-4 shadow-sm ring-1 ring-border/60">
            <p class="flex items-center gap-2 font-bold text-chart-2">
              <BookOpenText class="size-4 shrink-0" aria-hidden="true" />
              一張日誌裡有什麼？
            </p>
            <p class="mt-2 leading-relaxed text-foreground">
              您可以想成「<span class="font-semibold text-primary">封面</span>」加「<span
                class="font-semibold text-primary"
                >內頁明細</span
              >」：封面是日期、天氣、表報編號、整體進度與安全欄位；內頁是施工項目、材料、人力機具。
            </p>
            <p class="mt-2 leading-relaxed text-muted-foreground">
              每次按儲存，系統會整張重存一次明細，確保資料一致。同一個專案、同一天只能有一張日誌，重複會提醒您。
            </p>
          </div>

          <div class="rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-sm">
            <p class="flex items-center gap-2 font-bold text-primary">
              <Trees class="size-4 shrink-0" aria-hidden="true" />
              跟 PCCES（價目／工項）怎麼配合？
            </p>
            <ul class="mt-2 list-inside list-disc space-y-1.5 leading-relaxed text-foreground">
              <li>只能選 <span class="font-bold text-primary">已經核定</span> 過的價目版本。</li>
              <li>
                您選的<span class="font-semibold text-foreground">填表日期</span>，會決定畫面上「契約數量、單價」依哪一次核定版本顯示；換版後舊日期仍看得到當時的約定。
              </li>
              <li>
                系統會幫您加總「填表日以前」同一工項做過多少，方便填本日完成量與累計。
              </li>
              <li>
                存檔後，契約數字會跟著當次表單一起留下來，之後價目再改版也不會偷偷改掉您當天填的紀錄。
              </li>
              <li>只有「最底層、真的要做的」工項才填數量；大項、目錄列不會叫您硬填。</li>
            </ul>
          </div>

          <div class="rounded-2xl border border-chart-4/30 bg-chart-4/8 p-4 shadow-sm">
            <p class="flex items-center gap-2 font-bold text-chart-4">
              <Sparkles class="size-4 shrink-0" aria-hidden="true" />
              「預定進度 %」從哪來？
            </p>
            <p class="mt-2 leading-relaxed text-foreground">
              若專案有設定進度曲線，系統會依填表日落在曲線的哪一段，自動內插出預定％。
            </p>
            <p class="mt-2 leading-relaxed text-foreground">
              若沒有曲線，就用
              <span class="font-semibold text-chart-4">開工日＋核定工期</span>
              線性推算，最高 100%。
            </p>
            <p class="mt-2 font-semibold text-muted-foreground">
              「實際進度 %」則是人在表單上填的，代表現場主觀判斷。
            </p>
          </div>

          <div class="rounded-2xl border border-destructive/35 bg-destructive/10 p-4 shadow-sm">
            <p class="text-base font-bold text-destructive">跟估驗計價的關係（超重要）</p>
            <p class="mt-2 leading-relaxed text-foreground">
              估驗請款時，系統會參考施工日誌里<span class="font-bold text-destructive">同一工項累積做了多少</span>（會跨價目版本接續計算），再跟契約上限、已請款一起把關。
            </p>
            <p class="mt-2 leading-relaxed text-muted-foreground">
              這樣日誌、估驗、價目三邊才不會各說各話。
            </p>
          </div>

          <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p class="font-bold text-foreground">這一頁怎麼操作？</p>
            <ul class="mt-2 list-inside list-disc space-y-1.5 leading-relaxed text-foreground">
              <li>搜尋：日期、表報編號、天氣、工程名稱、進度顯示文字都找得到。</li>
              <li>用工具列的「填表日期」可篩選一段期間，也能排序。</li>
              <li>勾選多筆可批次刪除（需權限）。</li>
              <li>
                看日誌需要「施工日誌」權限；上傳／維護 PCCES 是另一組權限，可請管理員分開開。
              </li>
            </ul>
          </div>

          <div class="rounded-2xl border border-chart-5/35 bg-chart-5/10 p-4 shadow-sm">
            <p class="font-bold text-chart-5">存檔被擋下來？常見狀況</p>
            <ul class="mt-2 list-inside list-disc space-y-1.5 leading-relaxed text-foreground">
              <li>同一天已經有一張日誌 → 請改編輯那一張，不要重複新增同一天。</li>
              <li>專案還沒核定 PCCES 就想綁工項 → 請先到「PCCES 匯入紀錄」完成核定。</li>
              <li>累計完成量超過契約數量 → 請核對現場與契約／變更內容。</li>
              <li>同一張日誌里同一個 PCCES 工項重複出現 → 請刪掉重複列。</li>
            </ul>
          </div>
        </div>

        <DialogFooter class="shrink-0 border-t border-border bg-muted/30 px-6 py-3 sm:justify-end">
          <Button type="button" variant="default" size="sm" class="font-semibold" @click="helpOpen = false">
            好，我懂了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
