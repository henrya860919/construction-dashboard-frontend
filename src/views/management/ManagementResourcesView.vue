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
import { ref, computed, watch, h } from 'vue'
import { useRoute } from 'vue-router'
import { valueUpdater } from '@/lib/utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Input } from '@/components/ui/input'
import {
  getProjectResources,
  createProjectResource,
  updateProjectResource,
  deleteProjectResource,
} from '@/api/resources'
import type { ProjectResourceItem, ProjectResourceType } from '@/types/resource'
import { Plus, Loader2 } from 'lucide-vue-next'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import ManagementResourcesRowActions from '@/views/management/ManagementResourcesRowActions.vue'

const TAB_VALUES = ['labor', 'equipment', 'material'] as const
const TAB_LABELS: Record<(typeof TAB_VALUES)[number], string> = {
  labor: '人力',
  equipment: '機具',
  material: '材料',
}

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const activeTab = ref<ProjectResourceType>('labor')
const list = ref<ProjectResourceItem[]>([])
const loading = ref(false)
const errorMessage = ref('')

const formOpen = ref(false)
const formMode = ref<'create' | 'edit'>('create')
const editingItem = ref<ProjectResourceItem | null>(null)
const formName = ref('')
const formUnit = ref('')
const formUnitCost = ref<number>(0)
const formCapacityType = ref('')
const formDailyCapacity = ref<string>('')
const formDescription = ref('')
const formSubmitting = ref(false)
const formError = ref('')

const removeDialogOpen = ref(false)
const removingItem = ref<ProjectResourceItem | null>(null)
const removing = ref(false)

const batchDeleteOpen = ref(false)
const batchDeleteLoading = ref(false)

const sorting = ref<SortingState>([])
const rowSelection = ref<Record<string, boolean>>({})

async function loadList() {
  const id = projectId.value
  if (!id) return
  loading.value = true
  errorMessage.value = ''
  try {
    list.value = await getProjectResources(id, activeTab.value)
  } catch {
    errorMessage.value = '無法載入資源列表'
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  formMode.value = 'create'
  editingItem.value = null
  formName.value = ''
  formUnit.value = ''
  formUnitCost.value = 0
  formCapacityType.value = ''
  formDailyCapacity.value = ''
  formDescription.value = ''
  formError.value = ''
  formOpen.value = true
}

function openEditDialog(row: ProjectResourceItem) {
  formMode.value = 'edit'
  editingItem.value = row
  formName.value = row.name
  formUnit.value = row.unit
  formUnitCost.value = row.unitCost
  formCapacityType.value = row.capacityType ?? ''
  formDailyCapacity.value = row.dailyCapacity != null ? String(row.dailyCapacity) : ''
  formDescription.value = row.description ?? ''
  formError.value = ''
  formOpen.value = true
}

function closeFormDialog() {
  formOpen.value = false
  editingItem.value = null
}

async function submitForm() {
  const name = formName.value.trim()
  if (!name) {
    formError.value = '請填寫名稱'
    return
  }
  const unit = formUnit.value.trim()
  if (!unit) {
    formError.value = '請填寫單位'
    return
  }
  const unitCost = Number(formUnitCost.value)
  if (Number.isNaN(unitCost) || unitCost < 0) {
    formError.value = '請填寫有效的單位成本'
    return
  }
  const dailyCapacityVal = String(formDailyCapacity.value ?? '').trim()
  const dailyCapacity = dailyCapacityVal === '' ? null : Number(dailyCapacityVal)
  if (dailyCapacityVal !== '' && (Number.isNaN(dailyCapacity!) || (dailyCapacity ?? 0) < 0)) {
    formError.value = '每日容量請填寫有效數字'
    return
  }

  formSubmitting.value = true
  formError.value = ''
  const id = projectId.value
  try {
    if (formMode.value === 'create') {
      await createProjectResource(id, {
        type: activeTab.value,
        name,
        unit,
        unitCost,
        capacityType: formCapacityType.value.trim() || null,
        dailyCapacity,
        description: formDescription.value.trim() || null,
      })
    } else if (editingItem.value) {
      await updateProjectResource(id, editingItem.value.id, {
        name,
        unit,
        unitCost,
        capacityType: formCapacityType.value.trim() || null,
        dailyCapacity,
        description: formDescription.value.trim() || null,
      })
    }
    closeFormDialog()
    await loadList()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: { message?: string } } } }
    formError.value = err.response?.data?.error?.message ?? '儲存失敗'
  } finally {
    formSubmitting.value = false
  }
}

function openRemoveDialog(row: ProjectResourceItem) {
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
    await deleteProjectResource(projectId.value, item.id)
    closeRemoveDialog()
    rowSelection.value = {}
    await loadList()
  } catch {
    errorMessage.value = '刪除失敗'
  } finally {
    removing.value = false
  }
}

const columns = computed<ColumnDef<ProjectResourceItem, unknown>[]>(() => [
  {
    id: 'select',
    header: ({ table }) =>
      h(Checkbox, {
        checked:
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? 'indeterminate'
              : false,
        'onUpdate:checked': (v: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!v),
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
    header: () => '名稱',
    cell: ({ row }) =>
      h('div', { class: 'font-medium text-foreground' }, row.original.name),
  },
  {
    accessorKey: 'unit',
    id: 'unit',
    header: () => '單位',
    cell: ({ row }) =>
      h('div', { class: 'text-foreground' }, row.original.unit),
  },
  {
    accessorKey: 'unitCost',
    id: 'unitCost',
    header: () => '單位成本',
    cell: ({ row }) =>
      h('div', { class: 'text-foreground tabular-nums' }, String(row.original.unitCost)),
  },
  {
    accessorKey: 'capacityType',
    id: 'capacityType',
    header: () => '容量類型',
    cell: ({ row }) =>
      h('div', { class: 'text-foreground' }, row.original.capacityType ?? '—'),
  },
  {
    accessorKey: 'dailyCapacity',
    id: 'dailyCapacity',
    header: () => '每日容量',
    cell: ({ row }) =>
      h(
        'div',
        { class: 'text-foreground tabular-nums' },
        row.original.dailyCapacity != null ? String(row.original.dailyCapacity) : '—'
      ),
  },
  {
    accessorKey: 'description',
    id: 'description',
    header: () => '說明',
    cell: ({ row }) =>
      h(
        'div',
        {
          class: 'max-w-[200px] truncate text-foreground',
          title: row.original.description ?? '',
        },
        row.original.description ?? '—'
      ),
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'w-[4rem]' }),
    cell: ({ row }) =>
      h(ManagementResourcesRowActions, {
        row: row.original,
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
      await deleteProjectResource(projectId.value, item.id)
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

function onTabChange(value: string | number) {
  const s = String(value)
  if (TAB_VALUES.includes(s as ProjectResourceType)) {
    activeTab.value = s as ProjectResourceType
    rowSelection.value = {}
    loadList()
  }
}

watch(
  [projectId, activeTab],
  () => {
    if (projectId.value) loadList()
  },
  { immediate: true }
)
</script>

<template>
  <div class="space-y-4">
    <p class="text-sm text-muted-foreground">
      管理專案資源：人力、機具、材料。可設定名稱、單位、單位成本、容量類型、每日容量與說明。
    </p>

    <Tabs :model-value="activeTab" class="w-full" @update:model-value="onTabChange">
      <TabsList class="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="labor">{{ TAB_LABELS.labor }}</TabsTrigger>
        <TabsTrigger value="equipment">{{ TAB_LABELS.equipment }}</TabsTrigger>
        <TabsTrigger value="material">{{ TAB_LABELS.material }}</TabsTrigger>
      </TabsList>

      <TabsContent :value="activeTab" class="mt-4 space-y-4">
        <div class="flex flex-wrap items-center justify-end gap-3">
          <template v-if="hasSelection">
            <span class="text-sm text-muted-foreground">已選 {{ selectedRows.length }} 項</span>
            <ButtonGroup>
              <Button variant="outline" @click="clearSelection">取消選取</Button>
              <Button
                variant="outline"
                class="text-destructive hover:text-destructive"
                @click="openBatchDelete"
              >
                批次刪除
              </Button>
            </ButtonGroup>
          </template>
          <Button variant="default" @click="openCreateDialog">
            <Plus class="mr-2 size-4" />
            新增{{ TAB_LABELS[activeTab] }}
          </Button>
        </div>

        <div class="rounded-lg border border-border bg-card p-4">
          <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
          <div v-else-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 class="size-8 animate-spin" />
          </div>
          <template v-else>
            <Table v-if="list.length > 0">
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
                    :data-state="row.getIsSelected() ? 'selected' : undefined"
                  >
                    <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
                      <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                    </TableCell>
                  </TableRow>
                </template>
                <template v-else>
                  <TableRow>
                    <TableCell :colspan="8" class="h-24 text-center text-muted-foreground">
                      尚無資源
                    </TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>
            <template v-if="list.length > 0">
              <DataTablePagination :table="table" hide-selection-info />
            </template>
            <div
              v-else
              class="flex flex-col items-center justify-center py-16 text-muted-foreground"
            >
              <p class="text-sm">尚無資源</p>
              <p class="mt-1 text-xs">請點「新增{{ TAB_LABELS[activeTab] }}」建立第一筆</p>
            </div>
          </template>
        </div>
      </TabsContent>
    </Tabs>

    <!-- 新增/編輯表單 Dialog -->
    <Dialog v-model:open="formOpen" @update:open="(v: boolean) => !v && closeFormDialog()">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {{ formMode === 'create' ? `新增${TAB_LABELS[activeTab]}` : '編輯資源' }}
          </DialogTitle>
          <DialogDescription>
            填寫名稱、單位、單位成本、容量類型、每日容量與說明。
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
          <div class="space-y-2">
            <Label for="form-name">名稱</Label>
            <Input id="form-name" v-model="formName" placeholder="例：工程師、挖土機、水泥" />
          </div>
          <div class="space-y-2">
            <Label for="form-unit">單位</Label>
            <Input id="form-unit" v-model="formUnit" placeholder="例：人天、台、噸" />
          </div>
          <div class="space-y-2">
            <Label for="form-unit-cost">單位成本</Label>
            <Input
              id="form-unit-cost"
              v-model.number="formUnitCost"
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
            />
          </div>
          <div class="space-y-2">
            <Label for="form-capacity-type">容量類型（選填）</Label>
            <Input id="form-capacity-type" v-model="formCapacityType" placeholder="例：工時、台班" />
          </div>
          <div class="space-y-2">
            <Label for="form-daily-capacity">每日容量（選填）</Label>
            <Input
              id="form-daily-capacity"
              v-model="formDailyCapacity"
              type="number"
              min="0"
              step="0.01"
              placeholder="留空則不填"
            />
          </div>
          <div class="space-y-2">
            <Label for="form-desc">說明（選填）</Label>
            <textarea
              id="form-desc"
              v-model="formDescription"
              placeholder="補充說明"
              rows="3"
              class="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none disabled:pointer-events-none disabled:opacity-50 md:text-sm resize-y min-h-[80px]"
            />
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

    <!-- 單筆刪除確認 -->
    <Dialog v-model:open="removeDialogOpen" @update:open="(v: boolean) => !v && closeRemoveDialog()">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>確認刪除</DialogTitle>
          <DialogDescription>
            確定要刪除「{{ removingItem?.name }}」？此操作無法復原。
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
          <DialogTitle>確認批次刪除</DialogTitle>
          <DialogDescription>
            確定要刪除已選取的 {{ selectedRows.length }} 筆資源？此操作無法復原。
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
