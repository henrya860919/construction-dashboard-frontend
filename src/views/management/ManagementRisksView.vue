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
import { ref, computed, watch, h, nextTick } from 'vue'
import { useRoute } from 'vue-router'
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
import { Label } from '@/components/ui/label'
import { getIssueRisks, createIssueRisk, updateIssueRisk, deleteIssueRisk } from '@/api/issue-risks'
import { getProjectMembers } from '@/api/project'
import { listProjectWbs } from '@/api/wbs'
import type { WbsNode } from '@/types/wbs'
import type {
  IssueRiskItem,
  IssueRiskUrgency,
  IssueRiskStatus,
  IssueRiskWbsTask,
} from '@/types/issue-risk'
import type { ProjectMemberItem } from '@/types'
import { Plus, Loader2, ListTree, AlertCircle, Clock, AlertTriangle } from 'lucide-vue-next'
import StateCard from '@/components/common/StateCard.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import ManagementRisksRowActions from '@/views/management/ManagementRisksRowActions.vue'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { ensureProjectPermission } from '@/lib/permission-toast'

const route = useRoute()
const projectId = computed(() => (route.params.projectId as string) ?? '')
const riskPerm = useProjectModuleActions(projectId, 'project.risk')

function getProjectId(): string {
  return projectId.value
}

const loading = ref(true)
const list = ref<IssueRiskItem[]>([])
const errorMessage = ref('')

const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingItem = ref<IssueRiskItem | null>(null)
const formDescription = ref('')
const formAssigneeId = ref<string>('')
const formUrgency = ref<IssueRiskUrgency>('medium')
const formStatus = ref<IssueRiskStatus>('open')
const formWbsNodeIds = ref<string[]>([])
const formSubmitting = ref(false)
const formError = ref('')

const members = ref<ProjectMemberItem[]>([])
const membersLoading = ref(false)

const wbsInlineOpen = ref(false)
const wbsTree = ref<WbsNode[]>([])
const wbsTreeLoading = ref(false)
const wbsSelectedIds = ref<Set<string>>(new Set())

const removeDialogOpen = ref(false)
const removingItem = ref<IssueRiskItem | null>(null)
const removing = ref(false)

const batchDeleteOpen = ref(false)
const batchDeleteLoading = ref(false)

/** 統計：總數、待處理、處理中、高／緊急 */
const stats = computed(() => {
  const items = list.value
  return {
    total: items.length,
    open: items.filter((i) => i.status === 'open').length,
    inProgress: items.filter((i) => i.status === 'in_progress').length,
    highUrgency: items.filter((i) => i.urgency === 'high' || i.urgency === 'critical').length,
  }
})

const URGENCY_LABELS: Record<IssueRiskUrgency, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '緊急',
}

const STATUS_LABELS: Record<IssueRiskStatus, string> = {
  open: '待處理',
  in_progress: '處理中',
  resolved: '已解決',
  closed: '已結案',
}

/** 從 WBS 樹收集葉節點（無子項目的節點） */
function collectLeafNodes(nodes: WbsNode[]): IssueRiskWbsTask[] {
  const result: IssueRiskWbsTask[] = []
  function walk(ns: WbsNode[]) {
    for (const n of ns) {
      const hasChildren = n.children && n.children.length > 0
      if (!hasChildren) {
        result.push({ id: n.id, code: n.code, name: n.name })
      } else {
        walk(n.children!)
      }
    }
  }
  walk(nodes)
  return result
}

/** 影像任務顯示：編號＋項目名稱，多個用逗號 */
function formatWbsTasksDisplay(tasks: IssueRiskWbsTask[]): string {
  if (!tasks?.length) return '—'
  return tasks.map((t) => `${t.code} ${t.name}`).join('，')
}

async function loadList() {
  const id = getProjectId()
  if (!id) return
  loading.value = true
  errorMessage.value = ''
  try {
    list.value = await getIssueRisks(id)
  } catch {
    errorMessage.value = '無法載入議題風險列表'
  } finally {
    loading.value = false
  }
}

async function loadMembers() {
  const id = getProjectId()
  if (!id) return
  membersLoading.value = true
  try {
    members.value = await getProjectMembers(id)
  } finally {
    membersLoading.value = false
  }
}

function openCreateDialog() {
  if (!ensureProjectPermission(riskPerm.canCreate.value, 'create')) return
  formMode.value = 'create'
  editingItem.value = null
  formDescription.value = ''
  formAssigneeId.value = ''
  formUrgency.value = 'medium'
  formStatus.value = 'open'
  formWbsNodeIds.value = []
  formError.value = ''
  formOpen.value = true
  loadMembers()
  if (wbsTree.value.length === 0) {
    listProjectWbs(getProjectId()).then((tree) => {
      wbsTree.value = tree
    })
  }
}

function openEditDialog(row: IssueRiskItem) {
  formMode.value = 'edit'
  editingItem.value = row
  formDescription.value = row.description
  formAssigneeId.value = row.assigneeId ?? ''
  formUrgency.value = row.urgency
  formStatus.value = row.status
  formWbsNodeIds.value = row.wbsTasks.map((t) => t.id)
  formError.value = ''
  formOpen.value = true
  loadMembers()
  if (wbsTree.value.length === 0) {
    listProjectWbs(getProjectId()).then((tree) => {
      wbsTree.value = tree
    })
  }
}

function closeFormDialog() {
  formOpen.value = false
  wbsInlineOpen.value = false
  editingItem.value = null
}

const wbsInlineBlockRef = ref<HTMLElement | null>(null)

function openWbsSelector() {
  wbsSelectedIds.value = new Set(formWbsNodeIds.value)
  wbsInlineOpen.value = true
  if (wbsTree.value.length === 0) {
    wbsTreeLoading.value = true
    listProjectWbs(getProjectId())
      .then((tree) => {
        wbsTree.value = tree
      })
      .finally(() => {
        wbsTreeLoading.value = false
      })
  }
  nextTick(() => {
    wbsInlineBlockRef.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  })
}

function closeWbsInline() {
  wbsInlineOpen.value = false
}

function confirmWbsSelector() {
  formWbsNodeIds.value = Array.from(wbsSelectedIds.value)
  wbsInlineOpen.value = false
}

function toggleWbsLeaf(id: string) {
  const next = new Set(wbsSelectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  wbsSelectedIds.value = next
}

const leafNodes = computed(() => collectLeafNodes(wbsTree.value))

/** 表單中已選影像任務的顯示文字（編號＋項目名稱，多個逗號） */
const formWbsDisplayText = computed(() => {
  const ids = formWbsNodeIds.value
  if (!ids.length) return '未選擇'
  const leaves = leafNodes.value
  const items = ids
    .map((id) => leaves.find((l) => l.id === id))
    .filter(Boolean) as IssueRiskWbsTask[]
  if (items.length) return items.map((t) => `${t.code} ${t.name}`).join('，')
  if (editingItem.value?.wbsTasks?.length && ids.length === editingItem.value.wbsTasks.length) {
    return editingItem.value.wbsTasks.map((t) => `${t.code} ${t.name}`).join('，')
  }
  return `已選 ${ids.length} 項`
})

async function submitForm() {
  if (formMode.value === 'create') {
    if (!ensureProjectPermission(riskPerm.canCreate.value, 'create')) return
  } else if (editingItem.value) {
    if (!ensureProjectPermission(riskPerm.canUpdate.value, 'change')) return
  }
  const desc = formDescription.value.trim()
  if (!desc) {
    formError.value = '請填寫議題說明'
    return
  }
  formSubmitting.value = true
  formError.value = ''
  const id = getProjectId()
  try {
    const assigneeId = formAssigneeId.value.trim() || null
    if (formMode.value === 'create') {
      await createIssueRisk(id, {
        description: desc,
        assigneeId,
        urgency: formUrgency.value,
        status: formStatus.value,
        wbsNodeIds: formWbsNodeIds.value,
      })
    } else if (editingItem.value) {
      await updateIssueRisk(id, editingItem.value.id, {
        description: desc,
        assigneeId,
        urgency: formUrgency.value,
        status: formStatus.value,
        wbsNodeIds: formWbsNodeIds.value,
      })
    }
    formOpen.value = false
    closeFormDialog()
    await loadList()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: { message?: string } } } }
    formError.value = err.response?.data?.error?.message ?? '儲存失敗'
  } finally {
    formSubmitting.value = false
  }
}

function openRemoveDialog(row: IssueRiskItem) {
  removingItem.value = row
  removeDialogOpen.value = true
}

function closeRemoveDialog() {
  removeDialogOpen.value = false
  removingItem.value = null
}

async function confirmRemove() {
  const item = removingItem.value
  if (!item) return
  removing.value = true
  errorMessage.value = ''
  try {
    await deleteIssueRisk(getProjectId(), item.id)
    closeRemoveDialog()
    rowSelection.value = {}
    await loadList()
  } catch {
    errorMessage.value = '刪除失敗'
  } finally {
    removing.value = false
  }
}

const sorting = ref<SortingState>([])
const rowSelection = ref<Record<string, boolean>>({})

const columns = computed<ColumnDef<IssueRiskItem, unknown>[]>(() => [
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
    accessorKey: 'description',
    id: 'description',
    header: () => '議題說明／現況說明',
    cell: ({ row }) =>
      h(
        'div',
        { class: 'max-w-[280px] truncate text-foreground', title: row.original.description },
        row.original.description || '—'
      ),
  },
  {
    accessorKey: 'assignee',
    id: 'assignee',
    header: () => '負責人',
    cell: ({ row }) =>
      h(
        'div',
        { class: 'text-foreground' },
        row.original.assignee?.name || row.original.assignee?.email || '—'
      ),
  },
  {
    accessorKey: 'urgency',
    id: 'urgency',
    header: () => '緊急程度',
    cell: ({ row }) =>
      h(
        'div',
        { class: 'text-foreground' },
        URGENCY_LABELS[row.original.urgency] ?? row.original.urgency
      ),
  },
  {
    accessorKey: 'wbsTasks',
    id: 'wbsTasks',
    header: () => '影像任務',
    cell: ({ row }) =>
      h(
        'div',
        {
          class: 'max-w-[240px] truncate text-foreground',
          title: formatWbsTasksDisplay(row.original.wbsTasks),
        },
        formatWbsTasksDisplay(row.original.wbsTasks)
      ),
  },
  {
    accessorKey: 'status',
    id: 'status',
    header: () => '狀態',
    cell: ({ row }) =>
      h(
        'div',
        { class: 'text-foreground' },
        STATUS_LABELS[row.original.status] ?? row.original.status
      ),
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'w-[4rem]' }),
    cell: ({ row }) =>
      h(ManagementRisksRowActions, {
        row: row.original,
        updatingId: null,
        canEdit: riskPerm.canUpdate.value,
        canRemove: riskPerm.canDelete.value,
        onEdit: openEditDialog,
        onRemove: openRemoveDialog,
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
      await deleteIssueRisk(getProjectId(), item.id)
    }
    closeBatchDelete()
    rowSelection.value = {}
    await loadList()
  } catch {
    errorMessage.value = '批次刪除失敗'
  } finally {
    batchDeleteLoading.value = false
  }
}

watch(
  projectId,
  (id) => {
    if (id) loadList()
  },
  { immediate: true }
)
</script>

<template>
  <div class="space-y-4">
    <!-- 統計卡（與儀表板 StateCard 同規範） -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StateCard title="總議題數">
        <template #icon>
          <ListTree class="size-6 text-muted-foreground" />
        </template>
        <p class="text-3xl font-bold tabular-nums text-foreground">
          {{ stats.total }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">本專案議題與風險總數</p>
      </StateCard>
      <StateCard title="待處理">
        <template #icon>
          <AlertCircle class="size-6 text-muted-foreground" />
        </template>
        <p class="text-3xl font-bold tabular-nums text-foreground">
          {{ stats.open }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">狀態為待處理</p>
      </StateCard>
      <StateCard title="處理中">
        <template #icon>
          <Clock class="size-6 text-muted-foreground" />
        </template>
        <p class="text-3xl font-bold tabular-nums text-foreground">
          {{ stats.inProgress }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">狀態為處理中</p>
      </StateCard>
      <StateCard title="高／緊急">
        <template #icon>
          <AlertTriangle class="size-6 text-muted-foreground" />
        </template>
        <p class="text-3xl font-bold tabular-nums text-foreground">
          {{ stats.highUrgency }}
        </p>
        <p class="mt-1 text-xs text-muted-foreground">緊急程度為高或緊急</p>
      </StateCard>
    </div>

    <p class="text-sm text-muted-foreground">
      管理專案議題與風險，可設定負責人、緊急程度、影像任務（僅能選擇 WBS 葉節點）與狀態。
    </p>

    <div class="flex flex-wrap items-center justify-end gap-3">
      <template v-if="hasSelection">
        <span class="text-sm text-muted-foreground">已選 {{ selectedRows.length }} 項</span>
        <ButtonGroup>
          <Button variant="outline" size="sm" @click="clearSelection">取消選取</Button>
          <Button
            v-if="riskPerm.canDelete"
            variant="outline"
            size="sm"
            class="text-destructive hover:text-destructive"
            @click="openBatchDelete"
          >
            批次刪除
          </Button>
        </ButtonGroup>
      </template>
      <Button variant="default" @click="openCreateDialog">
        <Plus class="mr-2 size-4" />
        新增議題
      </Button>
    </div>

    <div class="rounded-lg border border-border bg-card">
      <p v-if="errorMessage" class="px-4 pt-4 text-sm text-destructive">{{ errorMessage }}</p>
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
                  <TableCell :colspan="7" class="h-24 text-center text-muted-foreground">
                    尚無議題風險，請點「新增議題」建立第一筆。
                  </TableCell>
                </TableRow>
              </template>
              <template v-else-if="table.getRowModel().rows?.length">
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
                  <TableCell :colspan="7" class="h-24 text-center text-muted-foreground">
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
      <DataTablePagination :table="table" hide-selection-info />
    </div>

    <!-- 新增/編輯表單 Dialog -->
    <Dialog v-model:open="formOpen" @update:open="(v: boolean) => !v && closeFormDialog()">
      <DialogContent class="sm:max-w-lg overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{{ formMode === 'create' ? '新增議題' : '編輯議題' }}</DialogTitle>
          <DialogDescription>
            填寫議題說明、負責人、緊急程度、影像任務（僅可選 WBS 葉節點）與狀態。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
          <div class="space-y-2">
            <Label for="form-desc">議題說明／現況說明</Label>
            <textarea
              id="form-desc"
              v-model="formDescription"
              placeholder="請描述議題或現況"
              rows="3"
              class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none disabled:pointer-events-none disabled:opacity-50 md:text-sm resize-y min-h-[80px]"
            />
          </div>
          <div class="space-y-2">
            <Label for="form-assignee">負責人</Label>
            <select
              id="form-assignee"
              v-model="formAssigneeId"
              :disabled="membersLoading"
              class="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 disabled:opacity-50"
            >
              <option value="">未指定</option>
              <option v-for="m in members" :key="m.userId" :value="m.userId">
                {{ m.user.name || m.user.email }}
              </option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-2">
              <Label for="form-urgency">緊急程度</Label>
              <select
                id="form-urgency"
                v-model="formUrgency"
                class="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2"
              >
                <option v-for="(label, key) in URGENCY_LABELS" :key="key" :value="key">
                  {{ label }}
                </option>
              </select>
            </div>
            <div class="space-y-2">
              <Label for="form-status">狀態</Label>
              <select
                id="form-status"
                v-model="formStatus"
                class="border-input bg-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2"
              >
                <option v-for="(label, key) in STATUS_LABELS" :key="key" :value="key">
                  {{ label }}
                </option>
              </select>
            </div>
          </div>
          <div class="space-y-2">
            <Label>影像任務（WBS 葉節點）</Label>
            <button
              type="button"
              class="border-input bg-background hover:bg-muted/50 focus-visible:ring-ring flex w-full items-center justify-start gap-2 rounded-md border px-3 py-2 text-left text-sm font-normal outline-none focus-visible:ring-2"
              @click.prevent.stop="openWbsSelector"
            >
              <ListTree class="size-4 shrink-0 text-muted-foreground" />
              <span class="truncate text-foreground">{{ formWbsDisplayText }}</span>
            </button>
            <!-- 內嵌於表單內選擇，避免雙層 Dialog 導致無法點擊 -->
            <div
              v-if="wbsInlineOpen"
              ref="wbsInlineBlockRef"
              class="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
            >
              <p class="text-xs font-medium text-muted-foreground">
                點擊項目可勾選／取消（僅葉節點）
              </p>
              <div v-if="wbsTreeLoading" class="flex items-center justify-center py-6">
                <Loader2 class="size-6 animate-spin text-muted-foreground" />
              </div>
              <div v-else class="max-h-[200px] overflow-y-auto space-y-0.5">
                <button
                  v-for="leaf in leafNodes"
                  :key="leaf.id"
                  type="button"
                  class="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-foreground hover:bg-muted focus:bg-muted/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  @click="toggleWbsLeaf(leaf.id)"
                >
                  <Checkbox
                    :id="`wbs-inline-${leaf.id}`"
                    :checked="wbsSelectedIds.has(leaf.id)"
                    class="pointer-events-none shrink-0"
                  />
                  <span class="min-w-0 shrink-0 font-medium">{{ leaf.code }}</span>
                  <span class="min-w-0 flex-1 truncate text-muted-foreground">{{ leaf.name }}</span>
                </button>
                <p
                  v-if="leafNodes.length === 0"
                  class="py-3 text-center text-xs text-muted-foreground"
                >
                  此專案尚無 WBS 葉節點，請先至 WBS 清單建立項目。
                </p>
              </div>
              <div class="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="flex-1"
                  @click="closeWbsInline"
                >
                  取消
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  class="flex-1"
                  @click="confirmWbsSelector"
                >
                  確定
                </Button>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="closeFormDialog">取消</Button>
          <Button :disabled="formSubmitting" @click="submitForm">
            <Loader2 v-if="formSubmitting" class="mr-2 size-4 animate-spin" />
            {{ formMode === 'create' ? '新增' : '儲存' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 刪除確認 -->
    <Dialog
      v-model:open="removeDialogOpen"
      @update:open="(v: boolean) => !v && closeRemoveDialog()"
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>刪除議題</DialogTitle>
          <DialogDescription>
            確定要刪除此議題嗎？「{{ removingItem?.description?.slice(0, 50)
            }}{{ (removingItem?.description?.length ?? 0) > 50 ? '…' : '' }}」將無法復原。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="closeRemoveDialog">取消</Button>
          <Button variant="destructive" :disabled="removing" @click="confirmRemove">
            <Loader2 v-if="removing" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 批次刪除確認 -->
    <Dialog v-model:open="batchDeleteOpen" @update:open="(v: boolean) => !v && closeBatchDelete()">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批次刪除</DialogTitle>
          <DialogDescription>
            確定要刪除所選的 {{ selectedRows.length }} 筆議題嗎？此操作無法復原。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" @click="closeBatchDelete">取消</Button>
          <Button variant="destructive" :disabled="batchDeleteLoading" @click="confirmBatchDelete">
            <Loader2 v-if="batchDeleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
