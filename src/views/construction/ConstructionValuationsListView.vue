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
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTableFeatureToolbar from '@/components/common/data-table/DataTableFeatureToolbar.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import { useClientDataTable } from '@/composables/useClientDataTable'
import { buildProjectPath, ROUTE_PATH, ROUTE_NAME } from '@/constants/routes'
import { formatMoneyNtd } from '@/lib/format-number'
import {
  listAllConstructionValuations,
  deleteConstructionValuation,
  getConstructionValuationListSummary,
  type ConstructionValuationListItemDto,
  type ConstructionValuationListSummaryDto,
} from '@/api/construction-valuations'
import StateCard from '@/components/common/StateCard.vue'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import {
  CircleHelp,
  HeartHandshake,
  Loader2,
  PartyPopper,
  Plus,
  Sparkles,
  Wallet,
  Banknote,
  PieChart,
} from 'lucide-vue-next'
import type { TableListFeatures } from '@/types/data-table'

const route = useRoute()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const perm = useProjectModuleActions(projectId, 'construction.valuation')

const newPath = computed(() =>
  buildProjectPath(projectId.value, ROUTE_PATH.PROJECT_CONSTRUCTION_DIARY_VALUATION_NEW)
)

const list = ref<ConstructionValuationListItemDto[]>([])
const loading = ref(true)
const summary = ref<ConstructionValuationListSummaryDto | null>(null)
const summaryLoading = ref(false)
const errorMessage = ref('')
const batchDeleteOpen = ref(false)
const batchDeleteLoading = ref(false)
const helpOpen = ref(false)

/** 僅全文搜尋，無分面／多欄排序／欄位顯示 */
const TABLE_FEATURES: TableListFeatures = {
  search: true,
  filtersAndSort: false,
  columnVisibility: false,
}

const COLUMN_LABELS: Record<string, string> = {
  valuationDate: '估驗日期',
  title: '標題／摘要',
  currentPeriodTotalAmount: '本次估驗金額合計',
  createdAt: '建立時間',
}

const valuationsGlobalFilterFn: FilterFn<ConstructionValuationListItemDto> = (
  row,
  _columnId,
  filterValue
) => {
  const q = String(filterValue ?? '')
    .trim()
    .toLowerCase()
  if (!q) return true
  const r = row.original
  const dateStr = (r.valuationDate ?? '').toLowerCase()
  const title = (r.title ?? '').toLowerCase()
  const remark = (r.headerRemark ?? '').toLowerCase()
  const amount = formatMoneyNtd(r.currentPeriodTotalAmount).toLowerCase()
  const createdIso = r.createdAt.toLowerCase()
  const createdLocal = new Date(r.createdAt).toLocaleString('zh-TW').toLowerCase()
  return [dateStr, title, remark, amount, createdIso, createdLocal].some((p) => p.includes(q))
}

async function load() {
  if (!projectId.value) return
  loading.value = true
  try {
    list.value = await listAllConstructionValuations(projectId.value)
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

async function loadSummary() {
  if (!projectId.value) {
    summary.value = null
    return
  }
  summaryLoading.value = true
  try {
    summary.value = await getConstructionValuationListSummary(projectId.value)
  } catch {
    summary.value = null
  } finally {
    summaryLoading.value = false
  }
}

const selectColumn: ColumnDef<ConstructionValuationListItemDto, unknown> = {
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

const columns = computed<ColumnDef<ConstructionValuationListItemDto, unknown>[]>(() => [
  selectColumn,
  {
    accessorKey: 'valuationDate',
    id: 'valuationDate',
    header: () => '估驗日期',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'tabular-nums text-foreground' },
        row.original.valuationDate?.trim() || '—'
      ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'title',
    id: 'title',
    header: () => '標題／摘要',
    cell: ({ row }) =>
      h('span', { class: 'text-muted-foreground' }, row.original.title?.trim() || '—'),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'amount',
    header: () => '本次估驗金額合計',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'tabular-nums text-foreground' },
        formatMoneyNtd(row.original.currentPeriodTotalAmount)
      ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'createdAt',
    id: 'createdAt',
    header: () => '建立時間',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-xs text-muted-foreground tabular-nums' },
        new Date(row.original.createdAt).toLocaleString('zh-TW')
      ),
    enableSorting: false,
    enableHiding: false,
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
          class: 'inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline',
        },
        () => '開啟'
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
  globalFilterFn: valuationsGlobalFilterFn,
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
      await deleteConstructionValuation(projectId.value, item.id)
    }
    closeBatchDelete()
    table.setRowSelection({})
    await Promise.all([load(), loadSummary()])
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
      summary.value = null
      loading.value = false
      return
    }
    resetTableState()
    void Promise.all([load(), loadSummary()])
  },
  { immediate: true }
)

const valuationsEmptyText = computed(() => {
  if (!projectId.value) return '缺少專案 ID'
  const q = globalFilter.value.trim()
  if (list.value.length === 0) {
    return q ? '沒有符合條件的資料' : '尚無估驗紀錄，請點「新增估驗」建立。'
  }
  return '沒有符合條件的資料'
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-semibold tracking-tight text-foreground">估驗計價</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          每次估驗一筆主檔；明細可自核定 PCCES 帶入。本次可估驗數量＝上限扣除他次已估驗與本次填寫。
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
      您沒有估驗計價檢視權限（<code class="rounded bg-muted px-1 py-0.5 text-xs"
        >construction.valuation</code
      >）。
    </div>

    <template v-else>
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StateCard title="尚未請款金額">
          <template #icon>
            <Wallet class="size-6 text-muted-foreground" />
          </template>
          <div v-if="summaryLoading" class="flex justify-center py-4">
            <Loader2 class="size-8 animate-spin text-muted-foreground" />
          </div>
          <template v-else>
            <p class="text-3xl font-bold tabular-nums text-foreground">
              {{
                summary ? formatMoneyNtd(summary.unbilledAmount) : '—'
              }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              PCCES 末層：min(契約上限, 日誌累計)×單價 加總，扣除全專案已請款；純手填列未計入施作面。
            </p>
          </template>
        </StateCard>
        <StateCard title="已請款金額">
          <template #icon>
            <Banknote class="size-6 text-muted-foreground" />
          </template>
          <div v-if="summaryLoading" class="flex justify-center py-4">
            <Loader2 class="size-8 animate-spin text-muted-foreground" />
          </div>
          <template v-else>
            <p class="text-3xl font-bold tabular-nums text-foreground">
              {{
                summary ? formatMoneyNtd(summary.billedAmountTotal) : '—'
              }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              全專案各期估驗單「本次估驗金額」加總。
            </p>
          </template>
        </StateCard>
        <StateCard
          title="請款進度"
          :progress="
            summary && summary.billingProgress != null ? summary.billingProgress : undefined
          "
        >
          <template #icon>
            <PieChart class="size-6 text-muted-foreground" />
          </template>
          <div v-if="summaryLoading" class="flex justify-center py-4">
            <Loader2 class="size-8 animate-spin text-muted-foreground" />
          </div>
          <template v-else>
            <p class="text-3xl font-bold tabular-nums text-foreground">
              {{
                summary?.billingProgress != null ? `${summary.billingProgress}%` : '—'
              }}
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              已請款 ÷ 契約／變更後可計價上限（核定 PCCES 末層契約數量×單價 加總）。
            </p>
          </template>
        </StateCard>
      </div>

      <DataTableFeatureToolbar
        v-if="!loading && projectId"
        :table="table"
        :features="TABLE_FEATURES"
        :column-labels="COLUMN_LABELS"
        :has-active-filters="hasActiveFilters"
        :global-filter="globalFilter"
        search-placeholder="搜尋估驗日期、標題、備註、金額、建立時間…"
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
              <RouterLink :to="newPath" class="inline-flex items-center gap-2">
                <Plus class="size-4" />
                新增估驗
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
        <DataTableFeatureSection v-else :table="table" :empty-text="valuationsEmptyText" />
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
            確定刪除已選的 {{ selectedCount }} 筆估驗？無法復原。
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
        class="flex max-h-[min(92vh,44rem)] max-w-2xl flex-col gap-0 overflow-hidden border-primary/20 p-0 sm:max-w-2xl"
      >
        <DialogHeader
          class="shrink-0 space-y-3 border-b border-primary/20 bg-gradient-to-br from-primary/15 via-chart-4/10 to-chart-2/15 px-6 py-5 text-left"
        >
          <div class="flex items-start gap-3">
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/20 text-primary shadow-sm ring-2 ring-primary/25"
            >
              <Sparkles class="size-6" aria-hidden="true" />
            </div>
            <div class="min-w-0 pt-0.5">
              <DialogTitle class="text-xl font-bold tracking-tight text-foreground">
                估驗計價小幫手
              </DialogTitle>
              <DialogDescription class="mt-1.5 text-sm font-medium leading-relaxed text-primary">
                用白話幫您看懂這一頁在做什麼，存檔後錢怎麼算～
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 px-6 py-4 text-sm">
          <div class="rounded-2xl border border-chart-2/30 bg-card p-4 shadow-sm ring-1 ring-border/60">
            <p class="flex items-center gap-2 font-bold text-chart-2">
              <PartyPopper class="size-4 shrink-0" aria-hidden="true" />
              這裡是什麼地方？
            </p>
            <p class="mt-2 leading-relaxed text-foreground">
              每一次「估驗」就像開一張請款單：上面是標題與日期，下面一列列是工項。您可以從
              <span class="font-semibold text-primary">已核定的 PCCES 明細</span> 帶入項目，也可以自己手填補充。
            </p>
          </div>

          <div class="rounded-2xl border border-destructive/35 bg-destructive/10 p-4 shadow-sm">
            <p class="text-base font-bold text-destructive">請您記住這件事（很重要）</p>
            <p class="mt-2 leading-relaxed text-foreground">
              <span class="font-bold text-destructive">已經存檔的請款，就是歷史紀錄。</span>
              日後契約或價目換新版本，系統
              <span class="font-bold text-destructive">不會</span>
              偷偷把舊估驗的單價、金額改寫成新價。這樣帳才對得起當初請款的約定。
            </p>
            <p class="mt-2 leading-relaxed text-muted-foreground">
              同一張估驗單裡，從 PCCES 帶進來的列，<span class="font-semibold text-foreground">單價鎖定不能亂改</span>；新加進來的列則依您當下選到的內容為準。手填列不在這個限制裡。
            </p>
          </div>

          <div class="rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-sm">
            <p class="flex items-center gap-2 font-bold text-primary">
              <HeartHandshake class="size-4 shrink-0" aria-hidden="true" />
              表單上的「（七）本次止累計估驗金額」
            </p>
            <p class="mt-2 leading-relaxed text-foreground">
              算法是：
              <span class="font-bold text-primary">以前各期實際請過的金額加總</span>
              ＋
              <span class="font-bold text-primary">這一期您填的本次數量 × 單價</span>。
            </p>
            <p class="mt-2 font-bold text-destructive">
              不是用「累積數量 × 現在畫面上的單價」重算喔！
            </p>
            <p class="mt-1 leading-relaxed text-muted-foreground">
              所以契約單價調整後，第二期還沒填數量時，（七）仍會是您第一期實際請過的金額，不會被新單價放大或縮小。
            </p>
          </div>

          <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p class="font-bold text-foreground">上面三張彩色數字卡怎麼看？</p>
            <div class="mt-3 overflow-hidden rounded-xl border border-border">
              <table class="w-full min-w-[18rem] border-collapse text-left text-sm">
                <thead>
                  <tr class="border-b border-border bg-muted/60">
                    <th class="px-3 py-2.5 font-bold text-foreground">卡片</th>
                    <th class="px-3 py-2.5 font-bold text-foreground">白話說明</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-b border-border bg-primary/5">
                    <td class="px-3 py-2.5 align-top font-semibold text-primary">已請款金額</td>
                    <td class="px-3 py-2.5 leading-relaxed text-foreground">
                      整個專案裡，每一張估驗單「這次要請多少」加總起來，就是大家常說的已請款。
                    </td>
                  </tr>
                  <tr class="border-b border-border bg-chart-4/5">
                    <td class="px-3 py-2.5 align-top font-semibold text-chart-4">請款進度</td>
                    <td class="px-3 py-2.5 leading-relaxed text-foreground">
                      跟「契約上算得出來的上限總額」比一比，大約請了幾％。超過 100% 畫面會卡在
                      100%；若還沒有可用的契約資料會顯示「—」。
                    </td>
                  </tr>
                  <tr class="bg-chart-2/5">
                    <td class="px-3 py-2.5 align-top font-semibold text-chart-2">尚未請款金額</td>
                    <td class="px-3 py-2.5 leading-relaxed text-foreground">
                      用「施工做到哪、契約允許計價到哪」估一個還能請的空間，再扣掉已請款。若只有手填請款、沒有對到 PCCES
                      施作面，這裡有時會顯示 0，是系統算法使然，不是壞掉。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p class="font-bold text-foreground">這一頁可以怎麼用？</p>
            <ul class="mt-2 list-inside list-disc space-y-1.5 leading-relaxed text-foreground">
              <li>搜尋框：標題、日期、備註、金額文字都能搜。</li>
              <li>列表上的金額會帶 <span class="font-semibold text-primary">NT$</span>，方便一眼辨識。</li>
              <li>勾選多筆可批次刪除（需權限）；刪除後在後台無法還原，請謹慎。</li>
            </ul>
          </div>

          <div class="rounded-2xl border border-chart-5/35 bg-chart-5/10 p-4 shadow-sm">
            <p class="font-bold text-chart-5">儲存失敗時，常見原因</p>
            <ul class="mt-2 list-inside list-disc space-y-1.5 leading-relaxed text-foreground">
              <li>想改「已經在這張單上的」PCCES 列單價 → 系統會擋下來，保護已請款紀錄。</li>
              <li>本次或累計數量超過施工日誌完成量、或超過契約／變更上限 → 請回頭對照現場與契約。</li>
              <li>專案還沒有「已核定」的 PCCES，卻要綁定工項 → 請先到 PCCES 匯入紀錄完成核定。</li>
            </ul>
          </div>
        </div>

        <DialogFooter
          class="shrink-0 border-t border-border bg-muted/30 px-6 py-3 sm:justify-end"
        >
          <Button type="button" variant="default" size="sm" class="font-semibold" @click="helpOpen = false">
            好，我懂了
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
