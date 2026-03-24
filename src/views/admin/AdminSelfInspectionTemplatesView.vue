<script setup lang="ts">
import type { ColumnDef, FilterFn } from '@tanstack/vue-table'
import { ref, onMounted, computed, h, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import DataTableColumnHeader from '@/components/common/data-table/DataTableColumnHeader.vue'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import DataTableFeatureToolbar from '@/components/common/data-table/DataTableFeatureToolbar.vue'
import { useClientDataTable } from '@/composables/useClientDataTable'
import type { TableListFeatures } from '@/types/data-table'
import AdminSelfInspectionTemplatesRowActions from '@/views/admin/AdminSelfInspectionTemplatesRowActions.vue'
import {
  listSelfInspectionTemplates,
  createSelfInspectionTemplate,
  updateSelfInspectionTemplate,
  deleteSelfInspectionTemplate,
} from '@/api/self-inspection-templates'
import type { SelfInspectionTemplateItem } from '@/api/self-inspection-templates'
import { ROUTE_NAME } from '@/constants/routes'
import { useRouter } from 'vue-router'
import { Loader2, Trash2, Plus } from 'lucide-vue-next'

const authStore = useAuthStore()
const router = useRouter()
const tenantId = computed(() => authStore.user?.tenantId ?? null)

const list = ref<SelfInspectionTemplateItem[]>([])
const loading = ref(true)

const TABLE_FEATURES: TableListFeatures = {
  search: true,
  filtersAndSort: true,
  columnVisibility: false,
}

const COLUMN_LABELS: Record<string, string> = {
  name: '名稱',
  description: '說明',
  blockCount: '區塊數',
  status: '狀態',
  updatedAt: '更新時間',
}

const addDialogOpen = ref(false)
const addForm = ref({ name: '', description: '' })
const addLoading = ref(false)
const addError = ref('')

const editDialogOpen = ref(false)
const editTarget = ref<SelfInspectionTemplateItem | null>(null)
const editForm = ref({ name: '', description: '', status: 'active' as 'active' | 'archived' })
const editLoading = ref(false)

const deleteDialogOpen = ref(false)
const deleteTarget = ref<SelfInspectionTemplateItem | null>(null)
const deleteLoading = ref(false)

const batchDeleteOpen = ref(false)
const batchDeleteLoading = ref(false)

async function fetchList() {
  loading.value = true
  try {
    list.value = await listSelfInspectionTemplates(tenantId.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => fetchList())

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusLabel(status: string): string {
  return status === 'archived' ? '已封存' : '使用中'
}

const selfInspectionTemplatesGlobalFilterFn: FilterFn<SelfInspectionTemplateItem> = (
  row,
  _columnId,
  filterValue
) => {
  const q = String(filterValue ?? '').trim().toLowerCase()
  if (!q) return true
  const t = row.original
  const dateStr = formatDate(t.updatedAt).toLowerCase()
  const createdStr = formatDate(t.createdAt).toLowerCase()
  const parts = [
    t.name,
    t.description ?? '',
    String(t.blockCount),
    statusLabel(t.status).toLowerCase(),
    t.status.toLowerCase(),
    t.createdAt?.toLowerCase() ?? '',
    t.updatedAt?.toLowerCase() ?? '',
    dateStr,
    createdStr,
  ].map((s) => String(s).toLowerCase())
  return parts.some((x) => x.includes(q))
}

function openAdd() {
  addForm.value = { name: '', description: '' }
  addError.value = ''
  addDialogOpen.value = true
}

function openEdit(row: SelfInspectionTemplateItem) {
  editTarget.value = row
  editForm.value = {
    name: row.name,
    description: row.description ?? '',
    status: row.status === 'archived' ? 'archived' : 'active',
  }
  editDialogOpen.value = true
}

async function submitEdit() {
  if (!editTarget.value) return
  editLoading.value = true
  try {
    await updateSelfInspectionTemplate(
      editTarget.value.id,
      {
        name: editForm.value.name.trim() || undefined,
        description: editForm.value.description.trim() || null,
        status: editForm.value.status,
      },
      tenantId.value
    )
    editDialogOpen.value = false
    await fetchList()
  } finally {
    editLoading.value = false
  }
}

function openDelete(row: SelfInspectionTemplateItem) {
  deleteTarget.value = row
  deleteDialogOpen.value = true
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleteLoading.value = true
  try {
    await deleteSelfInspectionTemplate(deleteTarget.value.id, tenantId.value)
    deleteDialogOpen.value = false
    await fetchList()
  } finally {
    deleteLoading.value = false
  }
}

function goOpen(row: SelfInspectionTemplateItem) {
  router.push({
    name: ROUTE_NAME.ADMIN_SELF_INSPECTION_TEMPLATE_DETAIL,
    params: { templateId: row.id },
  })
}

const selectColumn: ColumnDef<SelfInspectionTemplateItem, unknown> = {
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
  enableHiding: false,
}

const columns = computed<ColumnDef<SelfInspectionTemplateItem, unknown>[]>(() => [
  selectColumn,
  {
    accessorKey: 'name',
    id: 'name',
    meta: { label: COLUMN_LABELS.name },
    header: ({ column }) =>
      h(DataTableColumnHeader, { column, title: COLUMN_LABELS.name, class: 'text-foreground' }),
    cell: ({ row }) =>
      h(
        RouterLink,
        {
          to: {
            name: ROUTE_NAME.ADMIN_SELF_INSPECTION_TEMPLATE_DETAIL,
            params: { templateId: row.original.id },
          },
          class:
            'font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm',
        },
        () => row.original.name
      ),
    enableHiding: false,
  },
  {
    accessorKey: 'description',
    id: 'description',
    meta: { label: COLUMN_LABELS.description },
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column,
        title: COLUMN_LABELS.description,
        class: 'text-foreground',
      }),
    cell: ({ row }) =>
      h(
        'div',
        {
          class: 'max-w-[220px] truncate text-muted-foreground',
          title: row.original.description ?? '',
        },
        row.original.description || '—'
      ),
    enableHiding: false,
  },
  {
    accessorKey: 'blockCount',
    id: 'blockCount',
    meta: { label: COLUMN_LABELS.blockCount },
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column,
        title: COLUMN_LABELS.blockCount,
        class: 'text-foreground',
      }),
    cell: ({ row }) =>
      h('div', { class: 'text-sm tabular-nums text-muted-foreground' }, row.original.blockCount),
    enableHiding: false,
  },
  {
    accessorKey: 'status',
    id: 'status',
    meta: { label: COLUMN_LABELS.status },
    header: ({ column }) =>
      h(DataTableColumnHeader, { column, title: COLUMN_LABELS.status, class: 'text-foreground' }),
    cell: ({ row }) =>
      row.original.status === 'archived'
        ? h(Badge, { variant: 'secondary', class: 'font-normal' }, () => '已封存')
        : h(Badge, { variant: 'outline', class: 'font-normal' }, () => '使用中'),
    enableHiding: false,
  },
  {
    accessorKey: 'updatedAt',
    id: 'updatedAt',
    meta: { label: COLUMN_LABELS.updatedAt },
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column,
        title: COLUMN_LABELS.updatedAt,
        class: 'text-foreground',
      }),
    cell: ({ row }) =>
      h('div', { class: 'text-sm text-muted-foreground' }, formatDate(row.original.updatedAt)),
    sortingFn: 'alphanumeric',
    enableHiding: false,
  },
  {
    id: 'actions',
    header: () => '',
    cell: ({ row }) =>
      h('div', { class: 'flex justify-end' }, [
        h(AdminSelfInspectionTemplatesRowActions, {
          row: row.original,
          onOpen: goOpen,
          onEdit: openEdit,
          onDelete: openDelete,
        }),
      ]),
    enableSorting: false,
    enableHiding: false,
  },
])

const { table, globalFilter, hasActiveFilters, resetTableState } = useClientDataTable({
  data: list,
  columns,
  features: TABLE_FEATURES,
  getRowId: (row) => row.id,
  globalFilterFn: selfInspectionTemplatesGlobalFilterFn,
  initialPageSize: 10,
})

watch(tenantId, () => {
  resetTableState()
  void fetchList()
})

const selectedRows = computed(() => table.getSelectedRowModel().rows)
const hasSelection = computed(() => selectedRows.value.length > 0)
const selectedCount = computed(() => selectedRows.value.length)

const templatesEmptyText = computed(() => {
  if (list.value.length === 0) {
    if (globalFilter.value.trim()) return '沒有符合條件的資料'
    return '尚無樣板，點「新增樣板」開始建立。'
  }
  return '沒有符合條件的資料'
})

function clearSelection() {
  table.setRowSelection({})
}

function openBatchDelete() {
  batchDeleteOpen.value = true
}
function closeBatchDelete() {
  if (!batchDeleteLoading.value) batchDeleteOpen.value = false
}

async function submitAdd() {
  if (!addForm.value.name.trim()) {
    addError.value = '請填寫樣板名稱'
    return
  }
  addLoading.value = true
  addError.value = ''
  try {
    await createSelfInspectionTemplate(
      {
        name: addForm.value.name.trim(),
        description: addForm.value.description.trim() || null,
      },
      tenantId.value
    )
    addDialogOpen.value = false
    table.setRowSelection({})
    await fetchList()
  } catch (err: unknown) {
    const msg =
      err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
            ?.message
        : '新增失敗'
    addError.value = msg ?? '新增失敗'
  } finally {
    addLoading.value = false
  }
}

async function confirmBatchDelete() {
  const ids = selectedRows.value.map((r) => r.original.id)
  if (ids.length === 0) return
  batchDeleteLoading.value = true
  try {
    for (const id of ids) {
      await deleteSelfInspectionTemplate(id, tenantId.value)
    }
    closeBatchDelete()
    table.setRowSelection({})
    await fetchList()
  } finally {
    batchDeleteLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-1">
      <h1 class="text-xl font-semibold tracking-tight text-foreground">自主檢查樣板</h1>
      <p class="text-sm text-muted-foreground">
        管理租戶內所有查驗表單樣板；建立後可於樣板內新增區塊，供現場自主檢查或專案引用（後續串接）。可搜尋名稱、說明、區塊數、狀態與更新時間。
      </p>
    </div>

    <div class="min-w-0 flex-1">
      <DataTableFeatureToolbar
        v-if="!loading"
        :table="table"
        :features="TABLE_FEATURES"
        :column-labels="COLUMN_LABELS"
        :has-active-filters="hasActiveFilters"
        :global-filter="globalFilter"
        search-placeholder="搜尋名稱、說明、區塊數、狀態、更新時間…"
        @reset="resetTableState"
      >
        <template #actions>
          <div class="flex flex-wrap items-center justify-end gap-3">
            <template v-if="hasSelection">
              <span class="text-sm text-muted-foreground">已選 {{ selectedCount }} 項</span>
              <ButtonGroup>
                <Button variant="outline" size="sm" @click="clearSelection">取消選取</Button>
                <Button
                  variant="outline"
                  size="sm"
                  class="text-destructive hover:text-destructive"
                  @click="openBatchDelete"
                >
                  <Trash2 class="size-4" />
                  批次刪除
                </Button>
              </ButtonGroup>
            </template>
            <Button size="sm" class="gap-2" @click="openAdd">
              <Plus class="size-4" />
              新增樣板
            </Button>
          </div>
        </template>
      </DataTableFeatureToolbar>
    </div>

    <div class="rounded-lg border border-border bg-card">
      <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 class="size-8 animate-spin" />
      </div>
      <DataTableFeatureSection v-else :table="table" :empty-text="templatesEmptyText" />
    </div>
    <div v-if="!loading && list.length > 0" class="mt-4">
      <DataTablePagination :table="table" />
    </div>

    <Dialog :open="addDialogOpen" @update:open="(v) => (addDialogOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新增自主檢查樣板</DialogTitle>
          <DialogDescription>建立後請進入樣板內新增查驗區塊</DialogDescription>
        </DialogHeader>
        <form class="grid gap-4 py-2" @submit.prevent="submitAdd">
          <div class="grid gap-2">
            <Label for="sit-name">名稱</Label>
            <Input
              id="sit-name"
              v-model="addForm.name"
              placeholder="例：每週安全自主檢查"
              class="bg-background"
            />
          </div>
          <div class="grid gap-2">
            <Label for="sit-desc">說明（選填）</Label>
            <Input
              id="sit-desc"
              v-model="addForm.description"
              placeholder="用途簡述"
              class="bg-background"
            />
          </div>
          <p v-if="addError" class="text-sm text-destructive">{{ addError }}</p>
          <DialogFooter>
            <Button type="button" variant="outline" @click="addDialogOpen = false">取消</Button>
            <Button type="submit" :disabled="addLoading">
              <Loader2 v-if="addLoading" class="mr-2 size-4 animate-spin" />
              建立
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog :open="editDialogOpen" @update:open="(v) => (editDialogOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>編輯樣板</DialogTitle>
          <DialogDescription>更新名稱、說明與狀態</DialogDescription>
        </DialogHeader>
        <form class="grid gap-4 py-2" @submit.prevent="submitEdit">
          <div class="grid gap-2">
            <Label for="sit-edit-name">名稱</Label>
            <Input id="sit-edit-name" v-model="editForm.name" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <Label for="sit-edit-desc">說明</Label>
            <Input id="sit-edit-desc" v-model="editForm.description" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <Label for="sit-edit-status">狀態</Label>
            <select
              id="sit-edit-status"
              v-model="editForm.status"
              class="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="active">使用中</option>
              <option value="archived">已封存</option>
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" @click="editDialogOpen = false">取消</Button>
            <Button type="submit" :disabled="editLoading">
              <Loader2 v-if="editLoading" class="mr-2 size-4 animate-spin" />
              儲存
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog :open="deleteDialogOpen" @update:open="(v) => (deleteDialogOpen = v)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>刪除樣板</DialogTitle>
          <DialogDescription>
            確定要刪除「{{ deleteTarget?.name }}」？底下所有區塊一併刪除，且無法復原。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="deleteLoading" @click="deleteDialogOpen = false">
            取消
          </Button>
          <Button variant="destructive" :disabled="deleteLoading" @click="confirmDelete">
            <Loader2 v-if="deleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog :open="batchDeleteOpen" @update:open="(v) => !v && closeBatchDelete()">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>批次刪除樣板</DialogTitle>
          <DialogDescription>
            確定要刪除所選的 {{ selectedCount }} 個樣板？此操作無法復原。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" :disabled="batchDeleteLoading" @click="closeBatchDelete">
            取消
          </Button>
          <Button variant="destructive" :disabled="batchDeleteLoading" @click="confirmBatchDelete">
            <Loader2 v-if="batchDeleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
