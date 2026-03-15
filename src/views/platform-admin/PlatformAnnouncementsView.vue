<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { getCoreRowModel, getPaginationRowModel, useVueTable } from '@tanstack/vue-table'
import { FlexRender } from '@tanstack/vue-table'
import { ref, computed, onMounted, h } from 'vue'
import { valueUpdater } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Input } from '@/components/ui/input'
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
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import PlatformAnnouncementsRowActions from '@/views/platform-admin/PlatformAnnouncementsRowActions.vue'
import { Loader2, Megaphone, Plus, Trash2 } from 'lucide-vue-next'
import {
  fetchPlatformAnnouncements,
  createPlatformAnnouncement,
  updatePlatformAnnouncement,
  deletePlatformAnnouncement,
  fetchTenants,
  type PlatformAnnouncementItem,
  type TenantItem,
} from '@/api/platform'

const list = ref<PlatformAnnouncementItem[]>([])
const loading = ref(true)
const tenants = ref<TenantItem[]>([])
const rowSelection = ref<Record<string, boolean>>({})
const dialogOpen = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingId = ref<string | null>(null)
const form = ref({ title: '', body: '', publishedAt: '', expiresAt: '', targetSpecificTenants: false, targetTenantIds: [] as string[] })
const submitting = ref(false)
const errorMessage = ref('')
const batchDeleteOpen = ref(false)
const batchDeleteLoading = ref(false)
const batchDeleteError = ref('')

async function load() {
  loading.value = true
  try {
    const res = await fetchPlatformAnnouncements({ page: 1, limit: 500 })
    list.value = res.list ?? []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

async function loadTenants() {
  try {
    const { list: items } = await fetchTenants({ limit: 200 })
    tenants.value = items ?? []
  } catch {
    tenants.value = []
  }
}

function openCreate() {
  dialogMode.value = 'create'
  editingId.value = null
  form.value = { title: '', body: '', publishedAt: '', expiresAt: '', targetSpecificTenants: false, targetTenantIds: [] }
  errorMessage.value = ''
  loadTenants()
  dialogOpen.value = true
}

function openEdit(row: PlatformAnnouncementItem) {
  dialogMode.value = 'edit'
  editingId.value = row.id
  const ids = row.targetTenantIds as string[] | null
  form.value = {
    title: row.title,
    body: row.body,
    publishedAt: row.publishedAt ? row.publishedAt.slice(0, 19) : '',
    expiresAt: row.expiresAt ? row.expiresAt.slice(0, 19) : '',
    targetSpecificTenants: !!(ids && ids.length > 0),
    targetTenantIds: ids ?? [],
  }
  errorMessage.value = ''
  loadTenants()
  dialogOpen.value = true
}

async function submit() {
  if (!form.value.title.trim()) {
    errorMessage.value = '請填寫標題'
    return
  }
  if (form.value.targetSpecificTenants && form.value.targetTenantIds.length === 0) {
    errorMessage.value = '指定租戶時請至少選擇一個租戶'
    return
  }
  submitting.value = true
  errorMessage.value = ''
  try {
    const payload = {
      title: form.value.title.trim(),
      body: form.value.body,
      publishedAt: form.value.publishedAt ? new Date(form.value.publishedAt).toISOString() : null,
      expiresAt: form.value.expiresAt ? new Date(form.value.expiresAt).toISOString() : null,
      targetTenantIds: form.value.targetSpecificTenants ? form.value.targetTenantIds : null,
    }
    if (dialogMode.value === 'create') {
      await createPlatformAnnouncement(payload)
    } else if (editingId.value) {
      await updatePlatformAnnouncement(editingId.value, payload)
    }
    dialogOpen.value = false
    await load()
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '操作失敗'
    errorMessage.value = msg
  } finally {
    submitting.value = false
  }
}

function remove(row: PlatformAnnouncementItem) {
  if (!confirm(`確定要刪除公告「${row.title}」？`)) return
  deletePlatformAnnouncement(row.id).then(load).catch(() => {})
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
}

function targetLabel(row: PlatformAnnouncementItem) {
  const ids = row.targetTenantIds as string[] | null
  if (!ids || ids.length === 0) return '全平台'
  return `指定 ${ids.length} 個租戶`
}

const columns = computed<ColumnDef<PlatformAnnouncementItem, unknown>[]>(() => [
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
    header: () => '標題',
    cell: ({ row }) => h('span', { class: 'font-medium text-foreground' }, row.original.title),
  },
  {
    id: 'target',
    header: () => '對象',
    cell: ({ row }) => h('span', { class: 'text-muted-foreground' }, targetLabel(row.original)),
  },
  {
    accessorKey: 'publishedAt',
    header: () => '發佈時間',
    cell: ({ row }) =>
      h('span', { class: 'tabular-nums text-muted-foreground' }, formatDate(row.original.publishedAt)),
  },
  {
    accessorKey: 'expiresAt',
    header: () => '下架時間',
    cell: ({ row }) =>
      h('span', { class: 'tabular-nums text-muted-foreground' }, formatDate(row.original.expiresAt)),
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'w-[100px] text-muted-foreground' }, '操作'),
    cell: ({ row }) =>
      h('div', { class: 'flex' }, [
        h(PlatformAnnouncementsRowActions, {
          row: row.original,
          onEdit: openEdit,
          onDelete: remove,
        }),
      ]),
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
  onRowSelectionChange: (updater) => valueUpdater(updater, rowSelection),
  state: {
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
const selectedCount = computed(() => selectedRows.value.length)

function clearSelection() {
  rowSelection.value = {}
}

function openBatchDelete() {
  batchDeleteError.value = ''
  batchDeleteOpen.value = true
}

function closeBatchDelete() {
  batchDeleteOpen.value = false
  batchDeleteError.value = ''
}

async function confirmBatchDelete() {
  const ids = selectedRows.value.map((r) => r.original.id)
  if (!ids.length) return
  batchDeleteLoading.value = true
  batchDeleteError.value = ''
  try {
    for (const id of ids) {
      await deletePlatformAnnouncement(id)
    }
    closeBatchDelete()
    rowSelection.value = {}
    await load()
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '批次刪除失敗'
    batchDeleteError.value = msg
  } finally {
    batchDeleteLoading.value = false
  }
}

onMounted(() => {
  load()
  loadTenants()
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">平台公告</h1>
      <p class="text-sm text-muted-foreground">
        發佈維護通知或政策變更，可選擇全平台或指定租戶。
      </p>
    </div>

    <!-- 工具列：右側 已選 + ButtonGroup + 新增公告 -->
    <div class="flex flex-wrap items-center justify-end gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <template v-if="hasSelection">
          <span class="text-sm text-muted-foreground">已選 {{ selectedCount }} 項</span>
          <ButtonGroup>
            <Button variant="outline" @click="clearSelection">
              取消選取
            </Button>
            <Button
              variant="outline"
              class="text-destructive hover:text-destructive"
              @click="openBatchDelete"
            >
              <Trash2 class="size-4" />
              批次刪除
            </Button>
          </ButtonGroup>
        </template>
        <Button @click="openCreate">
          <Plus class="mr-2 size-4" />
          新增公告
        </Button>
      </div>
    </div>

    <!-- 表格區塊（規範：rounded-lg border bg-card，不用 Card 包） -->
    <div class="rounded-lg border border-border bg-card p-4">
      <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 class="size-8 animate-spin" />
      </div>
      <template v-else>
        <div v-if="!list.length" class="py-16 text-center text-sm text-muted-foreground">
          <Megaphone class="mx-auto mb-2 size-10 opacity-50" />
          <p>尚無公告，點擊「新增公告」建立。</p>
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
                      尚無公告，點擊「新增公告」建立。
                    </TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>
          </div>
          <DataTablePagination :table="table" />
        </template>
      </template>
    </div>

    <!-- 批次刪除確認 -->
    <Dialog :open="batchDeleteOpen" @update:open="(v: boolean) => { if (!v) closeBatchDelete() }">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>批次刪除公告</DialogTitle>
          <DialogDescription>
            確定要刪除所選的 {{ selectedCount }} 則公告？刪除後無法復原。
          </DialogDescription>
        </DialogHeader>
        <p v-if="batchDeleteError" class="text-sm text-destructive">{{ batchDeleteError }}</p>
        <DialogFooter>
          <Button variant="outline" @click="closeBatchDelete">取消</Button>
          <Button variant="destructive" :disabled="batchDeleteLoading" @click="confirmBatchDelete">
            <Loader2 v-if="batchDeleteLoading" class="mr-2 size-4 animate-spin" />
            刪除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{{ dialogMode === 'create' ? '新增公告' : '編輯公告' }}</DialogTitle>
          <DialogDescription>填寫標題與內容，可設定發佈／下架時間與對象。</DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <label for="title" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">標題</label>
            <Input id="title" v-model="form.title" placeholder="公告標題" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <label for="body" class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">內容</label>
            <textarea
              id="body"
              v-model="form.body"
              rows="4"
              class="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="公告內容"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="grid gap-2">
              <label class="text-sm font-medium leading-none">發佈時間（選填）</label>
              <Input v-model="form.publishedAt" type="datetime-local" class="bg-background" />
            </div>
            <div class="grid gap-2">
              <label class="text-sm font-medium leading-none">下架時間（選填）</label>
              <Input v-model="form.expiresAt" type="datetime-local" class="bg-background" />
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <Switch id="targetSpecificTenants" v-model:checked="form.targetSpecificTenants" />
            <label for="targetSpecificTenants" class="text-sm font-medium leading-none">指定租戶（開啟後可多選，未開啟則為全平台）</label>
          </div>
          <div v-if="form.targetSpecificTenants" class="grid gap-2">
            <label class="text-sm font-medium leading-none">選擇要顯示的租戶（可多選）</label>
            <p v-if="!tenants.length" class="text-sm text-muted-foreground">正在載入租戶列表…</p>
            <div v-else class="flex flex-wrap gap-2">
              <label
                v-for="t in tenants"
                :key="t.id"
                class="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
              >
                <input
                  v-model="form.targetTenantIds"
                  type="checkbox"
                  :value="t.id"
                  class="rounded border-input"
                />
                {{ t.name }}
              </label>
            </div>
          </div>
          <p v-if="errorMessage" class="text-sm text-destructive">{{ errorMessage }}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" @click="dialogOpen = false">取消</Button>
          <Button :disabled="submitting" @click="submit">
            <Loader2 v-if="submitting" class="mr-2 size-4 animate-spin" />
            {{ dialogMode === 'create' ? '建立' : '儲存' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
