<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table'
import { FlexRender } from '@tanstack/vue-table'
import { ref, computed, watch, h } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { valueUpdater } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, ClipboardList, Plus } from 'lucide-vue-next'
import StateCard from '@/components/common/StateCard.vue'
import {
  listProjectSelfInspectionTemplates,
  listProjectSelfInspectionImportCatalog,
  importProjectSelfInspectionTemplate,
  removeProjectSelfInspectionTemplate,
} from '@/api/project-self-inspections'
import type {
  ProjectSelfInspectionTemplateItem,
  SelfInspectionImportCatalogItem,
} from '@/api/project-self-inspections'
import { ROUTE_NAME } from '@/constants/routes'
import SelfCheckTemplatesRowActions from '@/views/construction/SelfCheckTemplatesRowActions.vue'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => (route.params.projectId as string) ?? '')

const list = ref<ProjectSelfInspectionTemplateItem[]>([])
const loading = ref(true)
const errorMessage = ref('')
const rowSelection = ref<Record<string, boolean>>({})

const importOpen = ref(false)
const importCatalog = ref<SelfInspectionImportCatalogItem[]>([])
const importCatalogLoading = ref(false)
/** 勾選要匯入的 template id（僅未匯入者可選） */
const importSelection = ref<Record<string, boolean>>({})
const importSubmitting = ref(false)
const importError = ref('')

const importCatalogSelectable = computed(() => importCatalog.value.filter((r) => !r.imported))
const selectedImportIds = computed(() =>
  Object.keys(importSelection.value).filter((id) => importSelection.value[id])
)
const importHeaderAllChecked = computed(() => {
  const rows = importCatalogSelectable.value
  if (rows.length === 0) return false
  return rows.every((r) => importSelection.value[r.id])
})
const importHeaderIndeterminate = computed(() => {
  const rows = importCatalogSelectable.value
  const n = rows.filter((r) => importSelection.value[r.id]).length
  return n > 0 && n < rows.length
})

const removeOpen = ref(false)
const removingRow = ref<ProjectSelfInspectionTemplateItem | null>(null)
const removing = ref(false)
const removeError = ref('')

const totalTemplates = computed(() => list.value.length)
const totalInspections = computed(() => list.value.reduce((s, t) => s + t.recordCount, 0))

async function loadList() {
  const pid = projectId.value
  if (!pid) return
  loading.value = true
  errorMessage.value = ''
  try {
    list.value = await listProjectSelfInspectionTemplates(pid)
  } catch {
    list.value = []
    errorMessage.value = '無法載入已匯入樣板'
  } finally {
    loading.value = false
  }
}

function goTemplate(row: ProjectSelfInspectionTemplateItem) {
  router.push({
    name: ROUTE_NAME.PROJECT_CONSTRUCTION_SELF_CHECK_TEMPLATE,
    params: { projectId: projectId.value, templateId: row.id },
  })
}

async function openImportDialog() {
  importOpen.value = true
  importError.value = ''
  importSelection.value = {}
  const pid = projectId.value
  if (!pid) return
  importCatalogLoading.value = true
  try {
    importCatalog.value = await listProjectSelfInspectionImportCatalog(pid)
  } catch {
    importCatalog.value = []
    importError.value = '無法載入樣板清單'
  } finally {
    importCatalogLoading.value = false
  }
}

function closeImportDialog() {
  importOpen.value = false
  importError.value = ''
  importSelection.value = {}
}

function toggleImportRow(row: SelfInspectionImportCatalogItem, checked: boolean | 'indeterminate') {
  if (row.imported) return
  const on = checked === true
  const next = { ...importSelection.value }
  if (on) next[row.id] = true
  else delete next[row.id]
  importSelection.value = next
}

function toggleImportHeader(checked: boolean | 'indeterminate') {
  const on = checked === true
  if (!on) {
    importSelection.value = {}
    return
  }
  const next: Record<string, boolean> = {}
  for (const r of importCatalog.value) {
    if (!r.imported) next[r.id] = true
  }
  importSelection.value = next
}

async function confirmImport() {
  const pid = projectId.value
  const ids = selectedImportIds.value
  if (!pid || ids.length === 0) return
  importSubmitting.value = true
  importError.value = ''
  try {
    for (const tid of ids) {
      await importProjectSelfInspectionTemplate(pid, tid)
    }
    closeImportDialog()
    await loadList()
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    importError.value = ax.response?.data?.error?.message ?? '匯入失敗'
  } finally {
    importSubmitting.value = false
  }
}

function openRemoveDialog(row: ProjectSelfInspectionTemplateItem) {
  if (row.recordCount > 0) return
  removingRow.value = row
  removeError.value = ''
  removeOpen.value = true
}

function closeRemoveDialog() {
  removeOpen.value = false
  removingRow.value = null
  removeError.value = ''
}

async function confirmRemove() {
  const row = removingRow.value
  const pid = projectId.value
  if (!row || !pid || row.recordCount > 0) return
  removing.value = true
  removeError.value = ''
  try {
    await removeProjectSelfInspectionTemplate(pid, row.id)
    closeRemoveDialog()
    rowSelection.value = {}
    await loadList()
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    removeError.value = ax.response?.data?.error?.message ?? '移除失敗'
  } finally {
    removing.value = false
  }
}

function formatLinkedAt(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

watch(projectId, () => loadList(), { immediate: true })

const columns = computed<ColumnDef<ProjectSelfInspectionTemplateItem, unknown>[]>(() => [
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
    accessorKey: 'name',
    id: 'name',
    header: () => '樣板名稱',
    cell: ({ row }) =>
      h(
        'button',
        {
          type: 'button',
          class:
            'text-left font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
          onClick: () => goTemplate(row.original),
        },
        row.original.name || '—'
      ),
  },
  {
    accessorKey: 'description',
    id: 'description',
    header: () => '說明',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'line-clamp-2 text-sm text-muted-foreground' },
        row.original.description?.trim() || '—'
      ),
  },
  {
    accessorKey: 'linkedAt',
    id: 'linkedAt',
    header: () => '匯入時間',
    cell: ({ row }) =>
      h('span', { class: 'tabular-nums text-sm text-muted-foreground' }, formatLinkedAt(row.original.linkedAt)),
  },
  {
    accessorKey: 'recordCount',
    id: 'recordCount',
    header: () => '查驗次數',
    cell: ({ row }) =>
      h('span', { class: 'tabular-nums text-foreground' }, String(row.original.recordCount)),
  },
  {
    id: 'actions',
    header: () => '',
    cell: ({ row }) =>
      h(SelfCheckTemplatesRowActions, {
        canRemove: row.original.recordCount === 0,
        onOpenRecords: () => goTemplate(row.original),
        onRemove: () => openRemoveDialog(row.original),
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
  onRowSelectionChange: (updater) => valueUpdater(updater, rowSelection),
  state: {
    get rowSelection() {
      return rowSelection.value
    },
  },
  enableRowSelection: true,
  getRowId: (row) => row.id,
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-xl font-semibold text-foreground">自主檢查</h1>
      <Button class="gap-1.5" @click="openImportDialog">
        <Plus class="size-4" />
        匯入樣板
      </Button>
    </div>

    <p class="text-sm text-muted-foreground">
      請從租戶後台已啟用的樣板中匯入至本專案；已匯入者無法重複選取。僅當該樣板在本專案尚無查驗紀錄時，才可移除匯入。每完整填寫一張表計為一次查驗。
    </p>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StateCard title="已匯入樣板數">
        <template #icon>
          <ClipboardList class="size-6 text-muted-foreground" />
        </template>
        <div v-if="loading" class="flex items-center gap-2 text-muted-foreground">
          <Loader2 class="size-6 animate-spin" />
        </div>
        <template v-else>
          <p class="text-3xl font-bold tabular-nums text-foreground">{{ totalTemplates }}</p>
          <p class="mt-1 text-xs text-muted-foreground">本專案已選用之樣板</p>
        </template>
      </StateCard>
      <StateCard title="累計查驗次數">
        <template #icon>
          <ClipboardList class="size-6 text-muted-foreground" />
        </template>
        <div v-if="loading" class="flex items-center gap-2 text-muted-foreground">
          <Loader2 class="size-6 animate-spin" />
        </div>
        <template v-else>
          <p class="text-3xl font-bold tabular-nums text-foreground">{{ totalInspections }}</p>
          <p class="mt-1 text-xs text-muted-foreground">本專案所有已匯入樣板合計</p>
        </template>
      </StateCard>
    </div>

    <div class="flex flex-wrap items-center justify-end gap-3">
      <span
        v-if="Object.keys(rowSelection).length > 0"
        class="text-sm text-muted-foreground"
      >
        已選 {{ Object.keys(rowSelection).filter((k) => rowSelection[k]).length }} 項
      </span>
      <ButtonGroup v-if="Object.keys(rowSelection).length > 0">
        <Button variant="outline" @click="rowSelection = {}"> 取消選取 </Button>
      </ButtonGroup>
    </div>

    <div class="rounded-lg border border-border bg-card">
      <div v-if="errorMessage" class="border-b border-border px-4 py-3 text-sm text-destructive">
        {{ errorMessage }}
      </div>
      <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-muted-foreground">
        <Loader2 class="size-5 animate-spin" />
        <span>載入中…</span>
      </div>
      <Table v-else>
        <TableHeader>
          <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <TableHead v-for="header in headerGroup.headers" :key="header.id" class="whitespace-nowrap">
              <FlexRender
                v-if="!header.isPlaceholder"
                :render="header.column.columnDef.header"
                :props="header.getContext()"
              />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="table.getRowModel().rows.length">
            <TableRow
              v-for="row in table.getRowModel().rows"
              :key="row.id"
              :data-state="row.getIsSelected() && 'selected'"
            >
              <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
                <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="columns.length" class="h-24 text-center text-muted-foreground">
              尚未匯入任何樣板。請按「匯入樣板」，從租戶後台已啟用的樣板中選擇。
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="importOpen" @update:open="(v: boolean) => !v && closeImportDialog()">
      <DialogContent
        class="flex max-h-[min(90vh,44rem)] w-full max-w-[calc(100%-2rem)] flex-col gap-4 overflow-hidden sm:max-w-3xl"
      >
        <DialogHeader class="shrink-0 text-left">
          <DialogTitle>匯入樣板至本專案</DialogTitle>
          <DialogDescription>
            列出租戶後台狀態為啟用的樣板；已匯入本專案者無法勾選。可複選尚未匯入的樣板一次匯入。
          </DialogDescription>
        </DialogHeader>
        <div v-if="importCatalogLoading" class="flex shrink-0 items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 class="size-4 animate-spin" />
          載入中…
        </div>
        <template v-else-if="importCatalog.length === 0">
          <p class="shrink-0 py-2 text-sm text-muted-foreground">
            租戶後台尚無啟用中的樣板。
          </p>
        </template>
        <template v-else>
          <div
            v-if="importCatalogSelectable.length === 0"
            class="shrink-0 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground"
          >
            啟用中的樣板皆已匯入本專案。
          </div>
          <div class="min-h-0 flex-1 overflow-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow class="hover:bg-transparent">
                  <TableHead class="w-12">
                    <Checkbox
                      :checked="
                        importHeaderAllChecked
                          ? true
                          : importHeaderIndeterminate
                            ? 'indeterminate'
                            : false
                      "
                      :disabled="importCatalogSelectable.length === 0"
                      aria-label="全選可匯入樣板"
                      @update:checked="toggleImportHeader"
                    />
                  </TableHead>
                  <TableHead>樣板名稱</TableHead>
                  <TableHead class="hidden sm:table-cell">說明</TableHead>
                  <TableHead class="w-28 whitespace-nowrap text-right">狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="row in importCatalog"
                  :key="row.id"
                  :class="row.imported ? 'opacity-60' : 'cursor-pointer'"
                  @click="row.imported ? undefined : toggleImportRow(row, !importSelection[row.id])"
                >
                  <TableCell class="align-middle" @click.stop>
                    <Checkbox
                      :checked="!!importSelection[row.id]"
                      :disabled="row.imported"
                      :aria-label="`選取 ${row.name}`"
                      @update:checked="(v) => toggleImportRow(row, v)"
                    />
                  </TableCell>
                  <TableCell class="font-medium text-foreground">{{ row.name || '—' }}</TableCell>
                  <TableCell class="hidden max-w-xs truncate text-sm text-muted-foreground sm:table-cell">
                    {{ row.description?.trim() || '—' }}
                  </TableCell>
                  <TableCell class="text-right text-sm">
                    <span
                      v-if="row.imported"
                      class="tabular-nums text-muted-foreground"
                    >
                      已匯入
                    </span>
                    <span v-else class="text-primary">可匯入</span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </template>
        <p v-if="importError" class="shrink-0 text-sm text-destructive">{{ importError }}</p>
        <DialogFooter class="shrink-0 flex-col gap-2 sm:flex-row sm:justify-between sm:gap-0">
          <span
            v-if="selectedImportIds.length > 0"
            class="text-sm text-muted-foreground sm:mr-auto"
          >
            已選 {{ selectedImportIds.length }} 項
          </span>
          <div class="flex w-full flex-wrap justify-end gap-2 sm:w-auto">
            <Button variant="outline" :disabled="importSubmitting" @click="closeImportDialog"> 取消 </Button>
            <Button
              :disabled="
                importSubmitting ||
                importCatalogSelectable.length === 0 ||
                selectedImportIds.length === 0
              "
              @click="confirmImport"
            >
              <Loader2 v-if="importSubmitting" class="mr-2 size-4 animate-spin" />
              確認匯入
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="removeOpen" @update:open="(v: boolean) => !v && closeRemoveDialog()">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>移除匯入</DialogTitle>
          <DialogDescription>
            將「{{ removingRow?.name ?? '' }}」從本專案移除。僅在無查驗紀錄時可執行。
          </DialogDescription>
        </DialogHeader>
        <p v-if="removeError" class="text-sm text-destructive">{{ removeError }}</p>
        <DialogFooter class="gap-2 sm:gap-0">
          <Button variant="outline" :disabled="removing" @click="closeRemoveDialog"> 取消 </Button>
          <Button variant="destructive" :disabled="removing" @click="confirmRemove">
            <Loader2 v-if="removing" class="mr-2 size-4 animate-spin" />
            確認移除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
