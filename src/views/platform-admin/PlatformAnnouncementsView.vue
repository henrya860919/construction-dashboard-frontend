<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { getCoreRowModel, getPaginationRowModel, useVueTable } from '@tanstack/vue-table'
import { ref, computed, onMounted, watch, h } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { valueUpdater } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Input } from '@/components/ui/input'
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
import DataTableToolbarShell from '@/components/common/data-table/DataTableToolbarShell.vue'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTableFilterPill from '@/components/common/data-table/DataTableFilterPill.vue'
import PlatformAnnouncementsRowActions from '@/views/platform-admin/PlatformAnnouncementsRowActions.vue'
import { Loader2, Plus, Search, Trash2 } from 'lucide-vue-next'
import {
  fetchPlatformAnnouncements,
  createPlatformAnnouncement,
  updatePlatformAnnouncement,
  deletePlatformAnnouncement,
  fetchTenants,
  type PlatformAnnouncementItem,
  type TenantItem,
} from '@/api/platform'

const ALL_TARGET = 'all' as const
const targetScopePillOptions = computed(() => {
  const rows = list.value
  const globalCount = rows.filter((r) => !r.targetTenantIds || r.targetTenantIds.length === 0).length
  const specificCount = rows.filter((r) => (r.targetTenantIds?.length ?? 0) > 0).length
  return [
    { value: ALL_TARGET, label: '全部對象', count: rows.length },
    { value: 'global', label: '全平台', count: globalCount },
    { value: 'specific', label: '指定租戶', count: specificCount },
  ]
})
const list = ref<PlatformAnnouncementItem[]>([])
const loading = ref(true)
const tenants = ref<TenantItem[]>([])
const rowSelection = ref<Record<string, boolean>>({})
const targetScopeFilter = ref<string>(ALL_TARGET)
const dialogOpen = ref(false)
const dialogMode = ref<'create' | 'edit'>('create')
const editingId = ref<string | null>(null)
const form = ref({
  title: '',
  body: '',
  publishedAt: '',
  expiresAt: '',
  targetSpecificTenants: false,
  targetTenantIds: [] as string[],
})
const submitting = ref(false)
const errorMessage = ref('')
const batchDeleteOpen = ref(false)
const batchDeleteLoading = ref(false)
const batchDeleteError = ref('')
const searchQuery = ref('')

const displayList = computed(() => {
  let rows = list.value
  if (targetScopeFilter.value === 'global') {
    rows = rows.filter((r) => !r.targetTenantIds || r.targetTenantIds.length === 0)
  } else if (targetScopeFilter.value === 'specific') {
    rows = rows.filter((r) => (r.targetTenantIds?.length ?? 0) > 0)
  }
  return rows
})

const toolbarHasActiveFilters = computed(
  () => searchQuery.value.trim() !== '' || targetScopeFilter.value !== ALL_TARGET,
)

async function load() {
  loading.value = true
  try {
    const res = await fetchPlatformAnnouncements({
      page: 1,
      limit: 500,
      q: searchQuery.value.trim() || undefined,
    })
    list.value = res.list ?? []
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  searchQuery.value = ''
  targetScopeFilter.value = ALL_TARGET
  rowSelection.value = {}
  void load()
}

watchDebounced(
  searchQuery,
  () => {
    rowSelection.value = {}
    void load()
  },
  { debounce: 400 },
)

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
  form.value = {
    title: '',
    body: '',
    publishedAt: '',
    expiresAt: '',
    targetSpecificTenants: false,
    targetTenantIds: [],
  }
  errorMessage.value = ''
  void loadTenants()
  dialogOpen.value = true
}

function openEdit(row: PlatformAnnouncementItem) {
  dialogMode.value = 'edit'
  editingId.value = row.id
  const ids = row.targetTenantIds
  form.value = {
    title: row.title,
    body: row.body,
    publishedAt: row.publishedAt ? row.publishedAt.slice(0, 19) : '',
    expiresAt: row.expiresAt ? row.expiresAt.slice(0, 19) : '',
    targetSpecificTenants: !!(ids && ids.length > 0),
    targetTenantIds: ids ?? [],
  }
  errorMessage.value = ''
  void loadTenants()
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
    const msg =
      e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : '操作失敗'
    errorMessage.value = msg
  } finally {
    submitting.value = false
  }
}

function remove(row: PlatformAnnouncementItem) {
  if (!confirm(`確定要刪除公告「${row.title}」？`)) return
  deletePlatformAnnouncement(row.id)
    .then(load)
    .catch(() => {})
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', { dateStyle: 'short', timeStyle: 'short' })
}

function targetLabel(row: PlatformAnnouncementItem) {
  const ids = row.targetTenantIds
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
      h(
        'span',
        { class: 'tabular-nums text-muted-foreground' },
        formatDate(row.original.publishedAt),
      ),
  },
  {
    accessorKey: 'expiresAt',
    header: () => '下架時間',
    cell: ({ row }) =>
      h(
        'span',
        { class: 'tabular-nums text-muted-foreground' },
        formatDate(row.original.expiresAt),
      ),
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
    return displayList.value
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

watch(targetScopeFilter, () => {
  table.setPageIndex(0)
  rowSelection.value = {}
})

const selectedRows = computed(() => table.getSelectedRowModel().rows)
const hasSelection = computed(() => selectedRows.value.length > 0)
const selectedCount = computed(() => selectedRows.value.length)

const emptyText = computed(() => {
  if (list.value.length === 0) {
    return searchQuery.value.trim()
      ? '搜尋無符合的公告。'
      : '尚無公告，點擊「新增公告」建立。'
  }
  if (displayList.value.length === 0) return '此對象篩選下沒有公告。'
  return '此頁無資料'
})

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
    const msg =
      e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : '批次刪除失敗'
    batchDeleteError.value = msg
  } finally {
    batchDeleteLoading.value = false
  }
}

onMounted(() => {
  void load()
  void loadTenants()
})
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-col gap-1">
      <h1 class="text-xl font-semibold tracking-tight text-foreground">平台公告</h1>
      <p class="text-sm text-muted-foreground">
        發佈維護通知或政策變更。關鍵字會於輸入後自動查詢 API；可篩選對象（全平台／指定租戶）。使用「重設」清空條件。
      </p>
    </div>

    <DataTableToolbarShell
      :table="table"
      :column-labels="{}"
      :has-active-filters="toolbarHasActiveFilters"
      :show-multi-sort="false"
      :show-column-visibility="false"
      @reset="resetFilters"
    >
      <template #filters>
        <div class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <div class="relative min-w-0 max-w-sm flex-1 basis-full sm:min-w-[240px] sm:basis-auto">
            <Search
              class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              v-model="searchQuery"
              type="search"
              placeholder="標題、內文關鍵字…"
              class="h-8 w-full bg-background pl-9 sm:max-w-sm"
              :disabled="loading"
              autocomplete="off"
            />
          </div>
          <DataTableFilterPill
            v-model="targetScopeFilter"
            title="對象"
            :all-value="ALL_TARGET"
            :options="targetScopePillOptions"
            :disabled="loading"
          />
        </div>
      </template>
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
          <Button size="sm" @click="openCreate">
            <Plus class="mr-2 size-4" />
            新增公告
          </Button>
        </div>
      </template>
    </DataTableToolbarShell>

    <div class="rounded-lg border border-border bg-card">
      <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 class="size-8 animate-spin" />
      </div>
      <DataTableFeatureSection v-else :table="table" :empty-text="emptyText" />
    </div>
    <div v-if="!loading && displayList.length > 0" class="mt-4">
      <DataTablePagination :table="table" />
    </div>

    <Dialog
      :open="batchDeleteOpen"
      @update:open="
        (v: boolean) => {
          if (!v) closeBatchDelete()
        }
      "
    >
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
            <label
              for="title"
              class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >標題</label
            >
            <Input id="title" v-model="form.title" placeholder="公告標題" class="bg-background" />
          </div>
          <div class="grid gap-2">
            <label
              for="body"
              class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >內容</label
            >
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
            <Switch id="targetSpecificTenants" v-model="form.targetSpecificTenants" />
            <label for="targetSpecificTenants" class="text-sm font-medium leading-none"
              >指定租戶（開啟後可多選，未開啟則為全平台）</label
            >
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
