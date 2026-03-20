<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table'
import { FlexRender } from '@tanstack/vue-table'
import { ref, computed, watch, h, onUnmounted } from 'vue'
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
import { ArrowLeft, Loader2, Plus, ClipboardList } from 'lucide-vue-next'
import StateCard from '@/components/common/StateCard.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import {
  getProjectSelfInspectionTemplateHub,
  listProjectSelfInspectionRecords,
} from '@/api/project-self-inspections'
import type { SelfInspectionRecordItem } from '@/api/project-self-inspections'
import { ROUTE_NAME } from '@/constants/routes'
import { useSelfCheckBreadcrumbStore } from '@/stores/selfCheckBreadcrumb'
import SelfCheckRecordsRowActions from '@/views/construction/SelfCheckRecordsRowActions.vue'
import { useProjectModuleActions } from '@/composables/useProjectModuleActions'
import { ensureProjectPermission } from '@/lib/permission-toast'

const route = useRoute()
const router = useRouter()
const selfCheckBreadcrumbStore = useSelfCheckBreadcrumbStore()

const projectId = computed(() => (route.params.projectId as string) ?? '')
const inspectionPerm = useProjectModuleActions(projectId, 'construction.inspection')
const templateId = computed(() => (route.params.templateId as string) ?? '')

const hubLoading = ref(true)
const hubError = ref('')
const templateName = ref('')
const recordCount = ref(0)

const list = ref<SelfInspectionRecordItem[]>([])
const meta = ref<{ page: number; limit: number; total: number } | null>(null)
const listLoading = ref(false)
const listError = ref('')

const page = ref(1)
const limit = ref(20)
const rowSelection = ref<Record<string, boolean>>({})

const totalPages = computed(() => (meta.value ? Math.ceil(meta.value.total / limit.value) : 0))

function formatDateTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function loadHub() {
  const pid = projectId.value
  const tid = templateId.value
  if (!pid || !tid) return
  hubLoading.value = true
  hubError.value = ''
  selfCheckBreadcrumbStore.setTemplateTitle(null)
  try {
    const hub = await getProjectSelfInspectionTemplateHub(pid, tid)
    templateName.value = hub.template.name
    recordCount.value = hub.recordCount
    selfCheckBreadcrumbStore.setTemplateTitle(hub.template.name)
  } catch {
    templateName.value = ''
    recordCount.value = 0
    hubError.value = '無法載入樣板資訊'
  } finally {
    hubLoading.value = false
  }
}

async function loadRecords() {
  const pid = projectId.value
  const tid = templateId.value
  if (!pid || !tid) return
  listLoading.value = true
  listError.value = ''
  try {
    const res = await listProjectSelfInspectionRecords(pid, tid, {
      page: page.value,
      limit: limit.value,
    })
    list.value = res.data
    meta.value = res.meta
  } catch {
    list.value = []
    meta.value = null
    listError.value = '無法載入查驗紀錄'
  } finally {
    listLoading.value = false
  }
}

function goBack() {
  router.push({
    name: ROUTE_NAME.PROJECT_CONSTRUCTION_SELF_CHECK,
    params: { projectId: projectId.value },
  })
}

function goNew() {
  if (!ensureProjectPermission(inspectionPerm.canCreate.value, 'create')) return
  router.push({
    name: ROUTE_NAME.PROJECT_CONSTRUCTION_SELF_CHECK_NEW,
    params: { projectId: projectId.value, templateId: templateId.value },
  })
}

function goRecord(row: SelfInspectionRecordItem) {
  router.push({
    name: ROUTE_NAME.PROJECT_CONSTRUCTION_SELF_CHECK_RECORD,
    params: {
      projectId: projectId.value,
      templateId: templateId.value,
      recordId: row.id,
    },
  })
}

watch(
  [projectId, templateId],
  () => {
    page.value = 1
    rowSelection.value = {}
    loadHub().then(() => {
      if (!hubError.value) loadRecords()
    })
  },
  { immediate: true }
)

onUnmounted(() => {
  selfCheckBreadcrumbStore.setTemplateTitle(null)
})

const columns = computed<ColumnDef<SelfInspectionRecordItem, unknown>[]>(() => [
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
    accessorKey: 'createdAt',
    id: 'createdAt',
    header: () => '填寫時間',
    cell: ({ row }) =>
      h('span', { class: 'tabular-nums text-foreground' }, formatDateTime(row.original.createdAt)),
  },
  {
    id: 'filledBy',
    header: () => '填寫者',
    cell: ({ row }) => {
      const u = row.original.filledBy
      const label = u?.name?.trim() || u?.email || '—'
      return h('span', { class: 'text-foreground' }, label)
    },
  },
  {
    id: 'actions',
    header: () => '',
    cell: ({ row }) =>
      h(SelfCheckRecordsRowActions, {
        onView: () => {
          if (!ensureProjectPermission(inspectionPerm.canRead.value, 'read')) return
          goRecord(row.original)
        },
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
  manualPagination: true,
  get pageCount() {
    return totalPages.value || 1
  },
  onRowSelectionChange: (updater) => valueUpdater(updater, rowSelection),
  state: {
    get pagination() {
      return { pageIndex: page.value - 1, pageSize: limit.value }
    },
    get rowSelection() {
      return rowSelection.value
    },
  },
  onPaginationChange: (updater) => {
    const prev = { pageIndex: page.value - 1, pageSize: limit.value }
    const next = typeof updater === 'function' ? updater(prev) : updater
    if (next) {
      rowSelection.value = {}
      page.value = next.pageIndex + 1
      limit.value = next.pageSize
      loadRecords()
    }
  },
  enableRowSelection: true,
  getRowId: (row) => row.id,
})
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <Button variant="outline" class="gap-1.5" @click="goBack">
          <ArrowLeft class="size-4" />
          樣板列表
        </Button>
        <h1 class="text-xl font-semibold text-foreground">
          {{ hubLoading ? '載入中…' : templateName || '自主查驗' }}
        </h1>
      </div>
      <Button
        :disabled="hubLoading || !!hubError"
        class="gap-1.5"
        @click="goNew"
      >
        <Plus class="size-4" />
        新增查驗紀錄
      </Button>
    </div>

    <div v-if="hubError" class="rounded-lg border border-destructive/50 bg-card px-4 py-3 text-sm text-destructive">
      {{ hubError }}
    </div>

    <StateCard v-else-if="!hubLoading" title="本專案查驗次數">
      <template #icon>
        <ClipboardList class="size-6 text-muted-foreground" />
      </template>
      <p class="text-3xl font-bold tabular-nums text-foreground">{{ recordCount }}</p>
      <p class="mt-1 text-xs text-muted-foreground">此樣板於本專案累計填寫筆數</p>
    </StateCard>

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
      <div v-if="listError" class="border-b border-border px-4 py-3 text-sm text-destructive">
        {{ listError }}
      </div>
      <div
        v-if="listLoading"
        class="flex items-center justify-center gap-2 py-16 text-muted-foreground"
      >
        <Loader2 class="size-5 animate-spin" />
        <span>載入紀錄…</span>
      </div>
      <template v-else>
        <Table>
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
                尚無查驗紀錄，請按「新增查驗紀錄」開始填寫。
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <DataTablePagination v-if="meta && meta.total > 0" :table="table" hide-selection-info />
      </template>
    </div>
  </div>
</template>
