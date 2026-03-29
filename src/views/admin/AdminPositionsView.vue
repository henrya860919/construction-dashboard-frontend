<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from 'vue'
import type { ColumnDef, FilterFn } from '@tanstack/vue-table'
import {
  adminListOrgPositions,
  adminListOrgDepartments,
  adminCreateOrgPosition,
  adminUpdateOrgPosition,
  adminDeleteOrgPosition,
  type OrgDepartmentDto,
  type OrgPositionDto,
} from '@/api/organization'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import DataTableColumnHeader from '@/components/common/data-table/DataTableColumnHeader.vue'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTableFeatureToolbar from '@/components/common/data-table/DataTableFeatureToolbar.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import { useClientDataTable } from '@/composables/useClientDataTable'
import type { TableListFeatures } from '@/types/data-table'
import { Plus, Loader2 } from 'lucide-vue-next'
import AdminPositionsRowActions from '@/views/admin/AdminPositionsRowActions.vue'
import OrgDeptPickerTree, {
  type OrgDeptPickerNode,
} from '@/components/org/OrgDeptPickerTree.vue'

const authStore = useAuthStore()
const adminStore = useAdminStore()

const tenantIdQuery = computed(() => {
  if (authStore.isPlatformAdmin) return adminStore.selectedTenantId ?? undefined
  return authStore.user?.tenantId ?? undefined
})

const platformNeedsTenant = computed(
  () => authStore.isPlatformAdmin && !adminStore.selectedTenantId
)

const positionsTab = ref<'shared' | 'byDepartment'>('shared')
const flatDepts = ref<OrgDepartmentDto[]>([])
const selectedDepartmentId = ref<string>('')

const sharedList = ref<OrgPositionDto[]>([])
const deptScopedList = ref<OrgPositionDto[]>([])

const loadingMeta = ref(true)
const loadingDeptPositions = ref(false)
const errorMessage = ref('')

const dialogOpen = ref(false)
const editRow = ref<OrgPositionDto | null>(null)
/** 新增時：從哪個分頁開啟（決定預設 departmentId） */
const createContext = ref<'shared' | 'department'>('shared')
const formName = ref('')
const formLevel = ref(1)
const formApprovalLimit = ref('')
/** 編輯時：'__shared__' 或部門 id */
const formApplicability = ref<string>('__shared__')
const submitting = ref(false)
const formError = ref('')

const tableFeatures = {
  search: true,
  filtersAndSort: false,
  columnVisibility: false,
} satisfies TableListFeatures

const COLUMN_LABELS: Record<string, string> = {
  name: '職位名稱',
  level: '層級',
  approvalLimit: '核准上限',
  actions: '操作',
}

function approvalLabel(p: OrgPositionDto) {
  if (p.approvalLimit === null) return '無上限'
  return p.approvalLimit
}

function buildDeptPath(deptId: string): string {
  const map = new Map(flatDepts.value.map((d) => [d.id, d]))
  const parts: string[] = []
  let cur: string | null = deptId
  const guard = new Set<string>()
  while (cur && !guard.has(cur)) {
    guard.add(cur)
    const d = map.get(cur)
    if (!d) break
    parts.unshift(d.name)
    cur = d.parentId
  }
  return parts.join(' › ')
}

function buildActiveDeptTree(flat: OrgDepartmentDto[]): OrgDeptPickerNode[] {
  const active = flat.filter((d) => d.status === 'active')
  const activeIds = new Set(active.map((d) => d.id))
  const byParent = new Map<string | null, OrgDepartmentDto[]>()
  for (const d of active) {
    const pid = d.parentId && activeIds.has(d.parentId) ? d.parentId : null
    const list = byParent.get(pid) ?? []
    list.push(d)
    byParent.set(pid, list)
  }
  for (const list of byParent.values()) {
    list.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-Hant')
    )
  }
  function build(pid: string | null): OrgDeptPickerNode[] {
    return (byParent.get(pid) ?? []).map((dept) => ({
      dept,
      children: build(dept.id),
    }))
  }
  return build(null)
}

const deptTreeRoots = computed(() => buildActiveDeptTree(flatDepts.value))

/** 樹狀前序走訪，供預設選取第一個啟用部門 */
const activeDepartmentsInTreeOrder = computed(() => {
  const out: OrgDepartmentDto[] = []
  function walk(nodes: OrgDeptPickerNode[]) {
    for (const n of nodes) {
      out.push(n.dept)
      walk(n.children)
    }
  }
  walk(deptTreeRoots.value)
  return out
})

const activeDepartmentsSorted = computed(() => {
  return flatDepts.value
    .filter((d) => d.status === 'active')
    .map((d) => ({
      ...d,
      path: buildDeptPath(d.id),
    }))
    .sort((a, b) => a.path.localeCompare(b.path, 'zh-Hant'))
})

const deptTreeCollapsedIds = ref<Set<string>>(new Set())

function toggleDeptTreeCollapse(id: string) {
  const next = new Set(deptTreeCollapsedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  deptTreeCollapsedIds.value = next
}

const applicabilityOptions = computed(() => {
  const roots = [{ value: '__shared__' as const, label: '全公司共用' }]
  const rest = activeDepartmentsSorted.value.map((d) => ({
    value: d.id,
    label: d.path,
  }))
  return [...roots, ...rest]
})

const globalFilterFn: FilterFn<OrgPositionDto> = (row, _columnId, filterValue) => {
  const q = String(filterValue ?? '')
    .trim()
    .toLowerCase()
  if (!q) return true
  return row.original.name.toLowerCase().includes(q)
}

function makeColumns(): ColumnDef<OrgPositionDto>[] {
  return [
    {
      accessorKey: 'name',
      header: ({ column }) => h(DataTableColumnHeader, { column, title: '職位名稱' }),
      meta: { label: '職位名稱', searchable: true },
    },
    {
      accessorKey: 'level',
      header: ({ column }) => h(DataTableColumnHeader, { column, title: '層級' }),
      cell: ({ row }) => `Lv.${row.original.level}`,
      meta: { label: '層級' },
    },
    {
      id: 'approvalLimit',
      header: '核准上限',
      cell: ({ row }) => approvalLabel(row.original),
      enableSorting: false,
      meta: { label: '核准上限' },
    },
    {
      id: 'actions',
      header: () => h('div', { class: 'text-right text-foreground' }, '操作'),
      cell: ({ row }) =>
        h('div', { class: 'flex justify-end' }, [
          h(AdminPositionsRowActions, {
            row: row.original,
            onEdit: (r: OrgPositionDto) => openEdit(r),
            onDelete: (r: OrgPositionDto) => void removeRow(r),
          }),
        ]),
      enableSorting: false,
      enableHiding: false,
    },
  ]
}

const tableColumns = computed(() => makeColumns())

const {
  table: sharedTable,
  globalFilter: sharedGlobalFilter,
  hasActiveFilters: sharedHasActiveFilters,
  resetTableState: resetSharedTable,
} = useClientDataTable({
  data: sharedList,
  columns: tableColumns,
  features: tableFeatures,
  getRowId: (row) => row.id,
  globalFilterFn,
  enableRowSelection: false,
})

const {
  table: deptTable,
  globalFilter: deptGlobalFilter,
  hasActiveFilters: deptHasActiveFilters,
  resetTableState: resetDeptTable,
} = useClientDataTable({
  data: deptScopedList,
  columns: tableColumns,
  features: tableFeatures,
  getRowId: (row) => row.id,
  globalFilterFn,
  enableRowSelection: false,
})

async function loadDepartments() {
  const tid = tenantIdQuery.value
  if (!tid) {
    flatDepts.value = []
    return
  }
  flatDepts.value = await adminListOrgDepartments(tid)
}

async function loadSharedPositions() {
  const tid = tenantIdQuery.value
  if (!tid) {
    sharedList.value = []
    return
  }
  sharedList.value = await adminListOrgPositions(tid, null)
}

async function loadDepartmentScopedPositions() {
  const tid = tenantIdQuery.value
  const deptId = selectedDepartmentId.value
  if (!tid || !deptId) {
    deptScopedList.value = []
    return
  }
  loadingDeptPositions.value = true
  try {
    const rows = await adminListOrgPositions(tid, deptId)
    deptScopedList.value = rows.filter((p) => p.departmentId === deptId)
  } catch {
    deptScopedList.value = []
  } finally {
    loadingDeptPositions.value = false
  }
}

async function bootstrap() {
  errorMessage.value = ''
  loadingMeta.value = true
  if (platformNeedsTenant.value) {
    flatDepts.value = []
    sharedList.value = []
    deptScopedList.value = []
    selectedDepartmentId.value = ''
    loadingMeta.value = false
    return
  }
  try {
    await loadDepartments()
    await loadSharedPositions()
    if (!selectedDepartmentId.value && activeDepartmentsInTreeOrder.value.length > 0) {
      selectedDepartmentId.value = activeDepartmentsInTreeOrder.value[0]!.id
    }
    if (selectedDepartmentId.value) {
      await loadDepartmentScopedPositions()
    }
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    errorMessage.value = ax.response?.data?.error?.message ?? '無法載入資料'
    sharedList.value = []
    deptScopedList.value = []
  } finally {
    loadingMeta.value = false
  }
}

watch(tenantIdQuery, () => {
  selectedDepartmentId.value = ''
  void bootstrap()
})

watch(selectedDepartmentId, () => {
  if (positionsTab.value === 'byDepartment') void loadDepartmentScopedPositions()
})

watch(positionsTab, (t) => {
  if (t === 'byDepartment' && selectedDepartmentId.value) void loadDepartmentScopedPositions()
})

function openCreateShared() {
  createContext.value = 'shared'
  editRow.value = null
  formName.value = ''
  formLevel.value = 1
  formApprovalLimit.value = ''
  formApplicability.value = '__shared__'
  formError.value = ''
  dialogOpen.value = true
}

function openCreateDepartment() {
  if (!selectedDepartmentId.value) {
    errorMessage.value = '請先選擇左側部門'
    return
  }
  createContext.value = 'department'
  editRow.value = null
  formName.value = ''
  formLevel.value = 1
  formApprovalLimit.value = ''
  formApplicability.value = selectedDepartmentId.value
  formError.value = ''
  dialogOpen.value = true
}

function openEdit(row: OrgPositionDto) {
  createContext.value = row.departmentId ? 'department' : 'shared'
  editRow.value = row
  formName.value = row.name
  formLevel.value = row.level
  formApprovalLimit.value =
    row.approvalLimit === null ? '' : row.approvalLimit === '0' ? '0' : row.approvalLimit
  formApplicability.value = row.departmentId ?? '__shared__'
  formError.value = ''
  dialogOpen.value = true
}

function parseApprovalLimit(): number | null | undefined | 'invalid' {
  const s = formApprovalLimit.value.trim()
  if (s === '') return undefined
  if (s.toLowerCase() === 'null' || s === '無') return null
  const n = Number(s)
  if (!Number.isFinite(n)) return 'invalid'
  return n
}

function resolveDepartmentIdForSubmit(): string | null {
  if (!editRow.value) {
    if (createContext.value === 'shared') return null
    return selectedDepartmentId.value || null
  }
  return formApplicability.value === '__shared__' ? null : formApplicability.value
}

async function submitForm() {
  formError.value = ''
  const name = formName.value.trim()
  if (!name) {
    formError.value = '請輸入職位名稱'
    return
  }
  const parsed = parseApprovalLimit()
  if (parsed === 'invalid') {
    formError.value = '請輸入有效數字，或留空表示沿用／無上限'
    return
  }
  const approvalLimit = parsed
  const deptId = resolveDepartmentIdForSubmit()
  if (!editRow.value && createContext.value === 'department' && !deptId) {
    formError.value = '缺少部門，請由「依部門」分頁新增'
    return
  }
  submitting.value = true
  try {
    const tid = tenantIdQuery.value
    if (editRow.value) {
      const body: Parameters<typeof adminUpdateOrgPosition>[1] = {
        name,
        level: formLevel.value,
        departmentId: deptId,
      }
      if (approvalLimit !== undefined) body.approvalLimit = approvalLimit
      await adminUpdateOrgPosition(editRow.value.id, body, tid)
    } else {
      await adminCreateOrgPosition(
        {
          name,
          level: formLevel.value,
          approvalLimit: approvalLimit === undefined ? null : approvalLimit,
          departmentId: deptId,
        },
        tid
      )
    }
    dialogOpen.value = false
    await bootstrap()
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    formError.value = ax.response?.data?.error?.message ?? '儲存失敗'
  } finally {
    submitting.value = false
  }
}

async function removeRow(row: OrgPositionDto) {
  if (!confirm(`確定刪除職位「${row.name}」？無使用中指派才可刪除。`)) return
  try {
    await adminDeleteOrgPosition(row.id, tenantIdQuery.value)
    await bootstrap()
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    errorMessage.value = ax.response?.data?.error?.message ?? '刪除失敗'
  }
}

onMounted(() => {
  void bootstrap()
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">職位管理</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        <strong class="font-medium text-foreground">全公司共用</strong>職位適用於各部門指派；
        <strong class="font-medium text-foreground">依部門</strong>職位僅能在該部門的組織指派中使用。簽呈核准上限：空白為無上限，0
        為不可核准。
      </p>
    </div>

    <div
      v-if="platformNeedsTenant"
      class="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground"
    >
      請先在頂欄選擇要管理的租戶。
    </div>

    <template v-else>
      <Tabs v-model="positionsTab" class="w-full">
        <TabsList class="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="shared">全公司共用</TabsTrigger>
          <TabsTrigger value="byDepartment">依部門</TabsTrigger>
        </TabsList>

        <TabsContent value="shared" class="mt-4 space-y-4 outline-none">
          <DataTableFeatureToolbar
            v-if="!loadingMeta"
            :table="sharedTable"
            :features="tableFeatures"
            :column-labels="COLUMN_LABELS"
            :has-active-filters="sharedHasActiveFilters"
            :global-filter="sharedGlobalFilter"
            search-placeholder="搜尋職位名稱…"
            :collapse-when-row-selection="false"
            @reset="resetSharedTable"
          >
            <template #actions>
              <Button size="sm" class="h-8 gap-2" @click="openCreateShared">
                <Plus class="size-4" aria-hidden="true" />
                新增共用職位
              </Button>
            </template>
          </DataTableFeatureToolbar>

          <div class="rounded-lg border border-border bg-card">
            <div
              v-if="loadingMeta"
              class="flex items-center justify-center py-12 text-muted-foreground"
            >
              <Loader2 class="size-8 animate-spin" aria-hidden="true" />
            </div>
            <template v-else>
              <p v-if="errorMessage && !sharedList.length" class="p-4 text-sm text-destructive">
                {{ errorMessage }}
              </p>
              <DataTableFeatureSection
                v-else
                :table="sharedTable"
                empty-text="尚無全公司共用職位，請新增。"
              />
            </template>
          </div>

          <DataTablePagination
            v-if="!loadingMeta && sharedList.length > 0"
            class="mt-4"
            :table="sharedTable"
            hide-selection-info
          />
        </TabsContent>

        <TabsContent value="byDepartment" class="mt-4 outline-none">
          <div
            v-if="loadingMeta"
            class="flex items-center justify-center rounded-lg border border-border bg-card py-12 text-muted-foreground"
          >
            <Loader2 class="size-8 animate-spin" aria-hidden="true" />
          </div>
          <div
            v-else-if="!deptTreeRoots.length"
            class="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground"
          >
            尚無啟用中的部門，請先到「組織管理」建立部門後，再新增部門專用職位。
          </div>
          <div
            v-else
            class="flex min-h-[min(28rem,60vh)] flex-col gap-4 rounded-lg border border-border bg-card md:flex-row md:gap-0"
          >
            <ScrollArea
              class="h-[min(40vh,16rem)] w-full shrink-0 border-border md:h-auto md:max-h-[min(70vh,560px)] md:w-[min(100%,17rem)] md:border-r"
            >
              <div class="p-2">
                <p class="px-2 pb-2 text-xs font-medium text-muted-foreground">部門</p>
                <OrgDeptPickerTree
                  :nodes="deptTreeRoots"
                  :selected-id="selectedDepartmentId"
                  :collapsed-ids="deptTreeCollapsedIds"
                  @select="selectedDepartmentId = $event"
                  @toggle-collapse="toggleDeptTreeCollapse"
                />
              </div>
            </ScrollArea>

            <div class="min-w-0 flex-1 space-y-4 p-4 pt-2 md:p-4">
              <DataTableFeatureToolbar
                :table="deptTable"
                :features="tableFeatures"
                :column-labels="COLUMN_LABELS"
                :has-active-filters="deptHasActiveFilters"
                :global-filter="deptGlobalFilter"
                search-placeholder="搜尋職位名稱…"
                :collapse-when-row-selection="false"
                @reset="resetDeptTable"
              >
                <template #actions>
                  <Button
                    size="sm"
                    class="h-8 gap-2"
                    :disabled="!selectedDepartmentId"
                    @click="openCreateDepartment"
                  >
                    <Plus class="size-4" aria-hidden="true" />
                    新增此部門職位
                  </Button>
                </template>
              </DataTableFeatureToolbar>

              <div class="rounded-lg border border-border bg-background">
                <div
                  v-if="loadingDeptPositions"
                  class="flex items-center justify-center py-12 text-muted-foreground"
                >
                  <Loader2 class="size-8 animate-spin" aria-hidden="true" />
                </div>
                <DataTableFeatureSection
                  v-else
                  :table="deptTable"
                  empty-text="此部門尚無專用職位；指派時仍可使用「全公司共用」職位。"
                />
              </div>

              <DataTablePagination
                v-if="!loadingDeptPositions && deptScopedList.length > 0"
                :table="deptTable"
                hide-selection-info
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog v-model:open="dialogOpen">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{{ editRow ? '編輯職位' : '新增職位' }}</DialogTitle>
            <DialogDescription>
              核准上限：留空則新增時為無上限；編輯時留空表示不變更。輸入 0 表示不可核准。
            </DialogDescription>
          </DialogHeader>
          <div class="grid gap-4 py-2">
            <div v-if="editRow" class="grid gap-2">
              <Label for="pos-applicability">適用範圍</Label>
              <Select v-model="formApplicability">
                <SelectTrigger id="pos-applicability" class="bg-background">
                  <SelectValue placeholder="選擇" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in applicabilityOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <p class="text-xs text-muted-foreground">
                改為「全公司共用」或變更部門時，請確認無與現有指派規則衝突。
              </p>
            </div>
            <div v-else-if="createContext === 'shared'" class="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              將建立為<strong class="text-foreground">全公司共用</strong>職位，各部門指派皆可選用。
            </div>
            <div v-else class="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              將建立為部門「<span class="font-medium text-foreground">{{
                selectedDepartmentId ? buildDeptPath(selectedDepartmentId) : '—'
              }}</span>」專用職位。
            </div>
            <div class="grid gap-2">
              <Label for="pos-name">名稱</Label>
              <Input id="pos-name" v-model="formName" placeholder="例如：工程部主任" />
            </div>
            <div class="grid gap-2">
              <Label for="pos-level">層級（1–5）</Label>
              <Input id="pos-level" v-model.number="formLevel" type="number" min="1" max="5" />
            </div>
            <div class="grid gap-2">
              <Label for="pos-limit">核准上限（選填）</Label>
              <Input
                id="pos-limit"
                v-model="formApprovalLimit"
                placeholder="空白＝無上限；0＝不可核准"
              />
            </div>
            <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" @click="dialogOpen = false">取消</Button>
            <Button type="button" :disabled="submitting" @click="submitForm">
              {{ submitting ? '儲存中…' : '儲存' }}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>
