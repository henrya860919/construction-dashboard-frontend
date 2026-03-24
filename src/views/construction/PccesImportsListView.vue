<script setup lang="ts">
import type { ColumnDef, FilterFn } from '@tanstack/vue-table'
import { computed, h, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { isAxiosError } from 'axios'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import DataTableFeatureToolbar from '@/components/common/data-table/DataTableFeatureToolbar.vue'
import { useClientDataTable } from '@/composables/useClientDataTable'
import { ROUTE_NAME } from '@/constants/routes'
import {
  listPccesImports,
  deletePccesImport,
  approvePccesImport,
  displayPccesVersionLabel,
  downloadPccesChangeListExcelTemplate,
  type PccesImportSummary,
} from '@/api/pcces-imports'
import { getApiErrorMessage } from '@/lib/api-error'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { toast } from '@/components/ui/sonner'
import type { TableListFeatures } from '@/types/data-table'
import PccesImportsRowActions from '@/views/construction/PccesImportsRowActions.vue'
import {
  BadgeCheck,
  CircleHelp,
  FileStack,
  FolderGit2,
  Loader2,
  Plus,
  ChevronDown,
  Download,
  Sparkles,
} from 'lucide-vue-next'

const route = useRoute()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const perm = useProjectModuleActions(projectId, 'construction.pcces')

const list = ref<PccesImportSummary[]>([])
const loading = ref(true)

const deleteOpen = ref(false)
const deleteTarget = ref<PccesImportSummary | null>(null)
const deleteLoading = ref(false)
const approvingId = ref<string | null>(null)
const downloadingChangeListTemplate = ref(false)
const helpOpen = ref(false)

/** 僅全文搜尋，無分面／多欄排序／欄位顯示 */
const TABLE_FEATURES: TableListFeatures = {
  search: true,
  filtersAndSort: false,
  columnVisibility: false,
}

const COLUMN_LABELS: Record<string, string> = {
  version: '版次',
  versionName: '版本名稱',
  fileName: '檔名',
  documentType: '類型',
  counts: '筆數',
  createdAt: '匯入時間',
  effective: '生效（日誌）',
  approval: '核定',
}

/** 全量 XML 上傳（與明細頁帶入的 context 對齊） */
const uploadXmlRoute = computed(() => ({
  name: ROUTE_NAME.PROJECT_CONSTRUCTION_PCCES_UPLOAD,
  params: { projectId: projectId.value },
  query: { context: 'xml' },
}))

/** 列表新到舊，預設以最新一版為 Excel 變更基底 */
const excelChangeFromLatestRoute = computed(() => ({
  name: ROUTE_NAME.PROJECT_CONSTRUCTION_PCCES_EXCEL_CHANGE,
  params: { projectId: projectId.value },
  query:
    list.value.length > 0 ? { baseImportId: list.value[0].id } : ({} as Record<string, string>),
}))

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 施工日誌選版用之「生效」日曆日顯示 */
function formatDailyLogEffective(row: PccesImportSummary) {
  if (!row.approvedAt) return '—'
  if (row.approvalEffectiveAt) return formatDate(row.approvalEffectiveAt)
  return `同核定 ${formatDate(row.approvedAt)}`
}

const pccesImportsGlobalFilterFn: FilterFn<PccesImportSummary> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? '')
    .trim()
    .toLowerCase()
  if (!q) return true
  const r = row.original
  const versionStr = `第 ${r.version} 版`.toLowerCase()
  const label = displayPccesVersionLabel(r).toLowerCase()
  const file = (r.fileName ?? '').toLowerCase()
  const docType = (r.documentType ?? '').toLowerCase()
  const counts = `${r.itemCount}（葉節點 ${r.generalCount}）`.toLowerCase()
  const createdIso = r.createdAt.toLowerCase()
  const createdLocal = new Date(r.createdAt).toLocaleString('zh-TW').toLowerCase()
  const effectiveLower = formatDailyLogEffective(r).toLowerCase()
  const approval = r.approvedAt ? '已核定' : '待核定'
  return [
    versionStr,
    label,
    file,
    docType,
    counts,
    createdIso,
    createdLocal,
    effectiveLower,
    approval,
  ].some((p) => p.includes(q))
}

async function load() {
  if (!projectId.value) return
  loading.value = true
  try {
    list.value = await listPccesImports(projectId.value)
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

function openDelete(row: PccesImportSummary) {
  deleteTarget.value = row
  deleteOpen.value = true
}

function closeDeleteDialog() {
  deleteOpen.value = false
  deleteTarget.value = null
}

async function approveImport(row: PccesImportSummary) {
  if (!projectId.value) return
  if (!perm.canUpdate.value) {
    toast.error('您沒有核定權限')
    return
  }
  if (row.approvedAt) return
  approvingId.value = row.id
  try {
    await approvePccesImport(projectId.value, row.id)
    toast.success(`第 ${row.version} 版已核定`)
    await load()
  } catch (e) {
    const msg = isAxiosError(e)
      ? (e.response?.data as { error?: { message?: string } })?.error?.message
      : null
    toast.error(msg ?? '核定失敗')
  } finally {
    approvingId.value = null
  }
}

async function downloadChangeListTemplateFile() {
  if (!projectId.value || downloadingChangeListTemplate.value) return
  downloadingChangeListTemplate.value = true
  try {
    await downloadPccesChangeListExcelTemplate(projectId.value)
    toast.success('已下載樣板')
  } catch (e) {
    toast.error('下載樣板失敗', { description: getApiErrorMessage(e) })
  } finally {
    downloadingChangeListTemplate.value = false
  }
}

async function confirmDelete() {
  if (!projectId.value || !deleteTarget.value) return
  if (!perm.canDelete.value) {
    toast.error('您沒有刪除權限')
    return
  }
  deleteLoading.value = true
  try {
    await deletePccesImport(projectId.value, deleteTarget.value.id)
    toast.success(`已刪除第 ${deleteTarget.value.version} 版匯入`)
    closeDeleteDialog()
    await load()
  } catch (e) {
    const msg = isAxiosError(e)
      ? (e.response?.data as { error?: { message?: string } })?.error?.message
      : null
    toast.error(msg ?? '刪除失敗')
  } finally {
    deleteLoading.value = false
  }
}

const columns = computed<ColumnDef<PccesImportSummary, unknown>[]>(() => [
  {
    id: 'version',
    accessorFn: (r) => r.version,
    header: () => '版次',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'tabular-nums font-medium text-muted-foreground' },
        `第 ${row.original.version} 版`
      ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'versionName',
    header: () => '版本名稱',
    cell: ({ row }) =>
      h('span', { class: 'font-medium text-foreground' }, displayPccesVersionLabel(row.original)),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'fileName',
    id: 'fileName',
    header: () => '檔名',
    cell: ({ row }) => h('span', { class: 'text-foreground' }, row.original.fileName),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'documentType',
    id: 'documentType',
    header: () => '類型',
    cell: ({ row }) =>
      h('span', { class: 'text-muted-foreground' }, row.original.documentType ?? '—'),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'counts',
    header: () => '筆數',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'tabular-nums text-sm text-muted-foreground' },
        `${row.original.itemCount}（葉節點 ${row.original.generalCount}）`
      ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'createdAt',
    id: 'createdAt',
    header: () => '匯入時間',
    cell: ({ row }) =>
      h('span', { class: 'text-sm text-muted-foreground' }, formatDate(row.original.createdAt)),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'effective',
    header: () => '生效（日誌）',
    cell: ({ row }) =>
      h('span', { class: 'text-xs text-muted-foreground' }, formatDailyLogEffective(row.original)),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'approval',
    header: () => h('div', { class: 'text-center' }, '核定'),
    cell: ({ row }) =>
      row.original.approvedAt
        ? h('div', { class: 'text-center text-sm text-muted-foreground' }, '已核定')
        : h('div', { class: 'text-center text-sm font-medium text-foreground' }, '待核定'),
    enableSorting: false,
    enableHiding: false,
  },
  {
    id: 'actions',
    header: () => '',
    cell: ({ row }) =>
      h(PccesImportsRowActions, {
        row: row.original,
        projectId: projectId.value,
        showApprove: perm.canUpdate.value && !row.original.approvedAt,
        canDelete: perm.canDelete.value,
        approvingId: approvingId.value,
        onApprove: approveImport,
        onDelete: openDelete,
      }),
    enableSorting: false,
    enableHiding: false,
  },
])

const { table, globalFilter, hasActiveFilters, resetTableState } = useClientDataTable({
  data: list,
  columns,
  features: TABLE_FEATURES,
  getRowId: (row) => row.id,
  globalFilterFn: pccesImportsGlobalFilterFn,
  enableRowSelection: false,
  initialPageSize: 20,
})

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

const importsEmptyText = computed(() => {
  if (!projectId.value) return '缺少專案 ID'
  const q = globalFilter.value.trim()
  if (list.value.length === 0) {
    return q
      ? '沒有符合條件的資料'
      : '尚無匯入紀錄，請透過「首次匯入／上傳 XML」建立版本。'
  }
  return '沒有符合條件的資料'
})
</script>

<template>
  <div class="min-w-0 space-y-4">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0 flex-1">
        <h1 class="text-xl font-semibold tracking-tight text-foreground">PCCES 匯入紀錄</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          依版次新到舊排列；第 1 版顯示為「原契約」，其餘版本名稱於上傳或 Excel
          確認時自訂，可於明細修改。各版可另填「核定生效時間」供施工日誌依填表日對應契約欄位版本。可刪除整次匯入（軟刪除，無法復原）。
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
      您沒有 PCCES 匯入檢視權限（<code class="rounded bg-muted px-1 py-0.5 text-xs"
        >construction.pcces</code
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
        search-placeholder="搜尋版次、版本名稱、檔名、類型、筆數、匯入／生效時間、核定狀態…"
        @reset="resetTableState"
      >
        <template #actions>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="downloadingChangeListTemplate || loading"
              @click="downloadChangeListTemplateFile"
            >
              <Download
                class="size-4"
                :class="{ 'animate-pulse': downloadingChangeListTemplate }"
                aria-hidden="true"
              />
              {{ downloadingChangeListTemplate ? '下載中…' : '下載樣板' }}
            </Button>
            <template v-if="perm.canCreate.value">
              <Button v-if="list.length === 0" size="sm" class="gap-2" as-child>
                <RouterLink :to="uploadXmlRoute" class="inline-flex items-center gap-2">
                  <Plus class="size-4" />
                  首次匯入（XML）
                </RouterLink>
              </Button>
              <DropdownMenu v-else>
                <DropdownMenuTrigger as-child>
                  <Button type="button" size="sm" class="gap-2">
                    <Plus class="size-4" />
                    新增版本
                    <ChevronDown class="size-4 opacity-70" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" class="w-[min(20rem,calc(100vw-2rem))]">
                  <DropdownMenuItem as-child class="cursor-pointer">
                    <RouterLink
                      :to="uploadXmlRoute"
                      class="flex w-full flex-col items-start gap-0.5 py-2"
                    >
                      <span class="font-medium">上傳 PCCES XML</span>
                      <span class="text-xs font-normal text-muted-foreground">
                        完整 eTender 標單；與 Excel 變更產生的版本不同
                      </span>
                    </RouterLink>
                  </DropdownMenuItem>
                  <DropdownMenuItem as-child class="cursor-pointer">
                    <RouterLink
                      :to="excelChangeFromLatestRoute"
                      class="flex w-full flex-col items-start gap-0.5 py-2"
                    >
                      <span class="font-medium">Excel 變更</span>
                      <span class="text-xs font-normal text-muted-foreground">
                        以目前列表最上方（最新）版本為基底；若要以其他版為基底，請至該版明細頁使用「Excel
                        變更」
                      </span>
                    </RouterLink>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </template>
          </div>
        </template>
      </DataTableFeatureToolbar>

      <div class="rounded-lg border border-border bg-card">
        <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 class="size-8 animate-spin" />
        </div>
        <DataTableFeatureSection v-else :table="table" :empty-text="importsEmptyText" />
      </div>
      <div v-if="!loading && projectId && list.length > 0" class="mt-4">
        <DataTablePagination :table="table" hide-selection-info />
      </div>
    </template>

    <AlertDialog :open="deleteOpen" @update:open="(v: boolean) => !v && closeDeleteDialog()">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>刪除此匯入版本？</AlertDialogTitle>
          <AlertDialogDescription>
            將一併移除第 {{ deleteTarget?.version }} 版的所有工項與歸檔
            XML（軟刪除，後台無法復原）。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleteLoading">取消</AlertDialogCancel>
          <Button variant="destructive" :disabled="deleteLoading" @click="confirmDelete">
            <Loader2 v-if="deleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog v-model:open="helpOpen">
      <DialogContent
        class="flex max-h-[min(92vh,46rem)] max-w-2xl flex-col gap-0 overflow-hidden border-chart-4/25 p-0 sm:max-w-2xl"
      >
        <DialogHeader
          class="shrink-0 space-y-3 border-b border-chart-4/25 bg-gradient-to-br from-chart-4/20 via-primary/10 to-chart-2/15 px-6 py-5 text-left"
        >
          <div class="flex items-start gap-3">
            <div
              class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-chart-4/25 text-chart-4 shadow-sm ring-2 ring-chart-4/30"
            >
              <FileStack class="size-6" aria-hidden="true" />
            </div>
            <div class="min-w-0 pt-0.5">
              <DialogTitle class="text-xl font-bold tracking-tight text-foreground">
                PCCES 匯入紀錄小幫手
              </DialogTitle>
              <DialogDescription class="mt-1.5 text-sm font-medium leading-relaxed text-chart-4">
                契約工項「版本」怎麼來、怎麼用，一次看懂 🌈
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div class="min-h-0 flex-1 space-y-4 overflow-y-auto bg-muted/20 px-6 py-4 text-sm">
          <div class="rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-sm ring-1 ring-border/60">
            <p class="flex items-center gap-2 font-bold text-primary">
              <FolderGit2 class="size-4 shrink-0" aria-hidden="true" />
              這一頁在管什麼？
            </p>
            <p class="mt-2 leading-relaxed text-foreground">
              這裡是整個專案的
              <span class="font-bold text-primary">「價目／工項目錄」年代表</span>
              ：第 1 版通常是原契約，之後每一次變更或重匯，就多一個新版本。施工日誌、估驗計價都會來這裡找「當時有效的約定」。
            </p>
            <p class="mt-2 leading-relaxed text-muted-foreground">
              同一個工項在換版時會<span class="font-semibold text-foreground">延續編號邏輯</span>，日誌與估驗加總才不會斷掉。
            </p>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div class="rounded-2xl border border-chart-2/30 bg-chart-2/8 p-4 shadow-sm">
              <p class="font-bold text-chart-2">路線 A：上傳 XML</p>
              <p class="mt-2 leading-relaxed text-foreground">
                把政府標單的 PCCES／eTender XML 整包匯入。第 1 版常顯示「原契約」；
                <span class="font-bold text-destructive">從第 2 版起記得要取名字</span>，方便日後辨識。
              </p>
              <p class="mt-2 text-xs leading-relaxed text-muted-foreground">
                檔案也會試著存進附件庫；就算附件沒存成功，已匯入的工項通常仍保留。
              </p>
            </div>
            <div class="rounded-2xl border border-chart-5/30 bg-chart-5/8 p-4 shadow-sm">
              <p class="font-bold text-chart-5">路線 B：Excel 變更</p>
              <p class="mt-2 leading-relaxed text-foreground">
                以某一版當「底」，複製出完整新再套用試算表變更。本頁按「新增版本 → Excel 變更」預設用
                <span class="font-semibold text-chart-5">列表最上面那一版（最新）</span>；若要拿舊版當底，請到該版明細頁操作。
              </p>
              <p class="mt-2 text-xs leading-relaxed text-muted-foreground">
                工具列「下載樣板」可拿到工程變更清單格式。
              </p>
            </div>
          </div>

          <div class="rounded-2xl border border-destructive/35 bg-destructive/10 p-4 shadow-sm">
            <p class="flex items-center gap-2 text-base font-bold text-destructive">
              <BadgeCheck class="size-5 shrink-0" aria-hidden="true" />
              核定＝開給日誌／估驗用的通行證
            </p>
            <ul class="mt-2 list-inside list-disc space-y-1.5 leading-relaxed text-foreground">
              <li>狀態是「待核定」時，那一版還<span class="font-bold text-destructive">不能</span>給日誌選工項。</li>
              <li>按核定後，有權限的同事就能在日誌／估驗里引用（依各功能規則）。</li>
              <li>
                填日誌那一天，系統會自動挑「那天以前已核定、版號最新」的那一版，來決定您看到的契約數量與單價。
              </li>
              <li>
                欄位「生效（日誌）」讓您對齊實務上的「文到日」；沒特別填，就以核定當天為準。
              </li>
            </ul>
          </div>

          <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p class="flex items-center gap-2 font-bold text-foreground">
              <Sparkles class="size-4 shrink-0 text-primary" aria-hidden="true" />
              列表欄位快速導覽
            </p>
            <div class="mt-3 overflow-hidden rounded-xl border border-border">
              <table class="w-full min-w-[16rem] border-collapse text-left text-sm">
                <thead>
                  <tr class="border-b border-border bg-muted/60">
                    <th class="px-3 py-2.5 font-bold text-foreground">您看到的</th>
                    <th class="px-3 py-2.5 font-bold text-foreground">代表意思</th>
                  </tr>
                </thead>
                <tbody>
                  <tr class="border-b border-border bg-primary/5">
                    <td class="px-3 py-2.5 align-top font-semibold text-primary">版次／名稱</td>
                    <td class="px-3 py-2.5 leading-relaxed text-foreground">
                      第幾次匯入、您幫它取的名字（第 1 版常叫原契約）。
                    </td>
                  </tr>
                  <tr class="border-b border-border bg-chart-4/5">
                    <td class="px-3 py-2.5 align-top font-semibold text-chart-4">檔名／類型</td>
                    <td class="px-3 py-2.5 leading-relaxed text-foreground">從哪個 XML 來，或這版是 Excel 變更產生的。</td>
                  </tr>
                  <tr class="border-b border-border bg-chart-2/5">
                    <td class="px-3 py-2.5 align-top font-semibold text-chart-2">筆數</td>
                    <td class="px-3 py-2.5 leading-relaxed text-foreground">
                      全部工項列數；括號內是「真的能填數量的細項」有幾列。
                    </td>
                  </tr>
                  <tr class="border-b border-border bg-muted/40">
                    <td class="px-3 py-2.5 align-top font-semibold text-foreground">匯入時間</td>
                    <td class="px-3 py-2.5 leading-relaxed text-foreground">這一版什麼時候進系統。</td>
                  </tr>
                  <tr class="bg-destructive/5">
                    <td class="px-3 py-2.5 align-top font-bold text-destructive">生效／核定</td>
                    <td class="px-3 py-2.5 leading-relaxed text-foreground">
                      核定了沒、以及日誌對齊契約時參考的生效資訊。
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p class="font-bold text-foreground">權限與刪除（請小心）</p>
            <ul class="mt-2 list-inside list-disc space-y-1.5 leading-relaxed text-foreground">
              <li>誰能看、誰能上傳、誰能核定、誰能刪整版，都由管理員在權限里分開設定。</li>
              <li>
                <span class="font-bold text-destructive">刪除一整版</span>
                會讓這一版的工項從畫面上消失（後台亦無法還原），請務必確認無誤再按。
              </li>
              <li>維護 PCCES 和寫施工日誌可以是不同人，兩邊權限可獨立開。</li>
            </ul>
          </div>

          <div class="rounded-2xl border border-primary/20 bg-muted/40 p-4 shadow-sm">
            <p class="font-bold text-primary">跟日誌、估驗為什麼要對齊？</p>
            <p class="mt-2 leading-relaxed text-foreground">
              日誌記「做了多少」、估驗記「請了多少錢」，底層都認同一套工項脈絡，數字才不會各跑各的。您在各頁存檔的內容，也會以當下為準留下來，不會被日後改版任意洗掉。
            </p>
          </div>

          <div class="rounded-2xl border border-chart-5/35 bg-chart-5/10 p-4 shadow-sm">
            <p class="font-bold text-chart-5">上傳或匯入失敗？可能原因</p>
            <ul class="mt-2 list-inside list-disc space-y-1.5 leading-relaxed text-foreground">
              <li>XML 格式不對、缺段落、或工項編號重複 → 請檢查檔案是否為正確標單。</li>
              <li>第 2 版起沒填版本名稱 → 補上再試。</li>
              <li>單次匯入列數極多，明細頁一次全開被擋下 → 改分頁瀏覽或洽管理員。</li>
              <li>Excel 變更找不到對應工項或選錯父層 → 對照基底版清單再調整。</li>
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
