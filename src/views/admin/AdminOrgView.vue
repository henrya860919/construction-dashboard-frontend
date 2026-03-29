<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table'
import { ref, onMounted, computed, watch, h, nextTick, provide } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { valueUpdater } from '@/lib/utils'
import { ROUTE_PATH, ROUTE_NAME } from '@/constants'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import {
  fetchOrgTree,
  adminListOrgDepartments,
  adminCreateOrgDepartment,
  adminUpdateOrgDepartment,
  adminDeleteOrgDepartment,
  adminListOrgAssignments,
  type OrgTreeResponse,
  type OrgDepartmentDto,
  type OrgMemberRow,
  type OrgDeptTreeNode,
} from '@/api/organization'
import { orgDeptAdminKey } from '@/composables/org-dept-admin-context'
import { orgDeptDetailKey } from '@/composables/org-dept-detail-context'
import OrgDeptTree from '@/components/org/OrgDeptTree.vue'
import OrgDeptDetailPanel from '@/components/org/OrgDeptDetailPanel.vue'
import OrgNetworkDiagram from '@/components/org/OrgNetworkDiagram.vue'
import { getAdminTenantInfo } from '@/api/admin'
import StateCard from '@/components/common/StateCard.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import AdminOrgAssignmentDialog from '@/components/org/AdminOrgAssignmentDialog.vue'
import { Loader2, Plus, Building2, Users, Network, UserPlus } from 'lucide-vue-next'

const authStore = useAuthStore()
const adminStore = useAdminStore()
const route = useRoute()
const router = useRouter()

const tenantIdQuery = computed(() => {
  if (authStore.isPlatformAdmin) return adminStore.selectedTenantId ?? undefined
  return authStore.user?.tenantId ?? undefined
})

const platformNeedsTenant = computed(
  () => authStore.isPlatformAdmin && !adminStore.selectedTenantId
)

const activeTab = ref<'chart' | 'network' | 'people'>('chart')

function syncOrgTabFromQuery() {
  const raw = route.query.tab
  const t = Array.isArray(raw) ? raw[0] : raw
  if (t === 'people' || t === 'network' || t === 'chart') {
    activeTab.value = t
  }
}

watch(
  () => route.query.tab,
  () => syncOrgTabFromQuery(),
  { immediate: true }
)

const loading = ref(true)
const errorMessage = ref('')
const tree = ref<OrgTreeResponse | null>(null)
const flatDepts = ref<OrgDepartmentDto[]>([])
const tenantDisplayName = ref('')
const orgNetworkRef = ref<InstanceType<typeof OrgNetworkDiagram> | null>(null)
/** 組織網路圖節點是否列出成員／職稱 */
const showOrgNetworkMembers = ref(true)

const dialogOpen = ref(false)
const formName = ref('')
const formParentId = ref<string>('__root__')
const submitting = ref(false)
const formError = ref('')

function findNodeById(nodes: OrgDeptTreeNode[], id: string): OrgDeptTreeNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNodeById(n.children, id)
    if (found) return found
  }
  return null
}

function collectDescendantIds(root: OrgDeptTreeNode): Set<string> {
  const s = new Set<string>()
  function walk(n: OrgDeptTreeNode) {
    s.add(n.id)
    for (const c of n.children) walk(c)
  }
  walk(root)
  return s
}

const editDialogOpen = ref(false)
const editingDeptId = ref<string | null>(null)
const editFormName = ref('')
const editFormParentId = ref<string>('__root__')
const editFormStatus = ref<'active' | 'archived'>('active')
const editFormError = ref('')
const editSubmitting = ref(false)

const deleteTarget = ref<OrgDeptTreeNode | null>(null)
const deleteSubmitting = ref(false)
const deleteErrorMessage = ref('')

const editExcludedIds = computed(() => {
  if (!tree.value || !editingDeptId.value) return new Set<string>()
  const node = findNodeById(tree.value.departments, editingDeptId.value)
  if (!node) return new Set<string>()
  return collectDescendantIds(node)
})

const editParentOptions = computed(() => {
  const roots = { label: '（頂層）', value: '__root__' as const }
  const ex = editExcludedIds.value
  return [
    roots,
    ...flatDepts.value.filter((d) => !ex.has(d.id)).map((d) => ({ label: d.name, value: d.id })),
  ]
})

function openEditDept(node: OrgDeptTreeNode) {
  editingDeptId.value = node.id
  editFormName.value = node.name
  editFormParentId.value = node.parentId ?? '__root__'
  editFormStatus.value = node.status === 'archived' ? 'archived' : 'active'
  editFormError.value = ''
  editDialogOpen.value = true
}

function openDeleteDept(node: OrgDeptTreeNode) {
  deleteTarget.value = node
  deleteErrorMessage.value = ''
}

provide(orgDeptAdminKey, {
  disabled: platformNeedsTenant,
  edit: openEditDept,
  delete: openDeleteDept,
})

const selectedDeptDetail = ref<OrgDeptTreeNode | null>(null)
const deptDetailSheetOpen = ref(false)

function openDeptDetail(node: OrgDeptTreeNode) {
  selectedDeptDetail.value = node
  deptDetailSheetOpen.value = true
}

const detailParentName = computed(() => {
  const d = selectedDeptDetail.value
  if (!d?.parentId) return null
  const p = flatDepts.value.find((x) => x.id === d.parentId)
  return p?.name ?? null
})

function onDeptDetailSheetOpenChange(v: boolean) {
  deptDetailSheetOpen.value = v
  if (!v) selectedDeptDetail.value = null
}

provide(orgDeptDetailKey, { openDetail: openDeptDetail })

const parentOptions = computed(() => {
  const roots = { label: '（頂層）', value: '__root__' as const }
  return [roots, ...flatDepts.value.map((d) => ({ label: d.name, value: d.id }))]
})

const rootDeptCount = computed(() => tree.value?.departments.length ?? 0)

/** 人員列表分頁 */
const ALL_DEPTS = '__all__'
const membersList = ref<OrgMemberRow[]>([])
const membersMeta = ref<{ page: number; limit: number; total: number } | null>(null)
const membersLoading = ref(false)
const membersError = ref('')
const membersPage = ref(1)
const membersLimit = ref(20)
const membersDeptFilter = ref(ALL_DEPTS)
const membersRowSelection = ref<Record<string, boolean>>({})

const totalMemberPages = computed(() =>
  membersMeta.value ? Math.ceil(membersMeta.value.total / membersLimit.value) : 0
)

async function loadChart() {
  if (platformNeedsTenant.value) {
    tree.value = null
    flatDepts.value = []
    tenantDisplayName.value = ''
    loading.value = false
    return
  }
  loading.value = true
  errorMessage.value = ''
  try {
    const tid = tenantIdQuery.value
    const [t, flat, tenantInfo] = await Promise.all([
      fetchOrgTree(tid),
      adminListOrgDepartments(tid),
      getAdminTenantInfo(tid).catch(() => null),
    ])
    tree.value = t
    flatDepts.value = flat
    tenantDisplayName.value = tenantInfo?.name?.trim() || ''
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    errorMessage.value = ax.response?.data?.error?.message ?? '無法載入組織資料'
    tree.value = null
    tenantDisplayName.value = ''
  } finally {
    loading.value = false
  }
}

async function loadMembers() {
  if (platformNeedsTenant.value) {
    membersList.value = []
    membersMeta.value = null
    return
  }
  membersLoading.value = true
  membersError.value = ''
  try {
    const tid = tenantIdQuery.value
    const res = await adminListOrgAssignments({
      tenantId: tid,
      departmentId: membersDeptFilter.value === ALL_DEPTS ? undefined : membersDeptFilter.value,
      page: membersPage.value,
      limit: membersLimit.value,
    })
    membersList.value = res.data
    membersMeta.value = res.meta
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    membersError.value = ax.response?.data?.error?.message ?? '無法載入人員列表'
    membersList.value = []
    membersMeta.value = null
  } finally {
    membersLoading.value = false
  }
}

async function submitEditDept() {
  if (!editingDeptId.value) return
  editFormError.value = ''
  const name = editFormName.value.trim()
  if (!name) {
    editFormError.value = '請輸入部門名稱'
    return
  }
  editSubmitting.value = true
  try {
    await adminUpdateOrgDepartment(
      editingDeptId.value,
      {
        name,
        parentId: editFormParentId.value === '__root__' ? null : editFormParentId.value,
        status: editFormStatus.value,
      },
      tenantIdQuery.value
    )
    editDialogOpen.value = false
    editingDeptId.value = null
    await loadChart()
    if (activeTab.value === 'people') await loadMembers()
    if (activeTab.value === 'network') nextTick(() => orgNetworkRef.value?.fitView?.())
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    editFormError.value = ax.response?.data?.error?.message ?? '更新失敗'
  } finally {
    editSubmitting.value = false
  }
}

async function confirmDeleteDept() {
  if (!deleteTarget.value) return
  deleteErrorMessage.value = ''
  deleteSubmitting.value = true
  try {
    await adminDeleteOrgDepartment(deleteTarget.value.id, tenantIdQuery.value)
    deleteTarget.value = null
    await loadChart()
    if (activeTab.value === 'people') await loadMembers()
    if (activeTab.value === 'network') nextTick(() => orgNetworkRef.value?.fitView?.())
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    deleteErrorMessage.value = ax.response?.data?.error?.message ?? '刪除失敗'
  } finally {
    deleteSubmitting.value = false
  }
}

async function submitCreate() {
  formError.value = ''
  const name = formName.value.trim()
  if (!name) {
    formError.value = '請輸入部門名稱'
    return
  }
  submitting.value = true
  try {
    await adminCreateOrgDepartment(
      {
        name,
        parentId: formParentId.value === '__root__' ? null : formParentId.value,
      },
      tenantIdQuery.value
    )
    dialogOpen.value = false
    formName.value = ''
    formParentId.value = '__root__'
    await loadChart()
    if (activeTab.value === 'people') await loadMembers()
    if (activeTab.value === 'network') nextTick(() => orgNetworkRef.value?.fitView?.())
  } catch (e: unknown) {
    const ax = e as { response?: { data?: { error?: { message?: string } } } }
    formError.value = ax.response?.data?.error?.message ?? '建立失敗'
  } finally {
    submitting.value = false
  }
}

const deptFilterOptions = computed(() => [
  { label: '全部部門', value: ALL_DEPTS },
  ...flatDepts.value.map((d) => ({ label: d.name, value: d.id })),
])

function approvalCell(limit: string | null) {
  if (limit === null) return '無上限'
  return limit
}

const membersColumns = computed<ColumnDef<OrgMemberRow, unknown>[]>(() => [
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
    header: () => h('div', { class: 'text-foreground' }, '姓名'),
    cell: ({ row }) => h('div', { class: 'font-medium text-foreground' }, row.original.name || '—'),
  },
  {
    accessorKey: 'departmentPath',
    id: 'departmentPath',
    header: () => h('div', { class: 'text-foreground' }, '部門路徑'),
    cell: ({ row }) =>
      h(
        'div',
        { class: 'max-w-[240px] text-sm text-muted-foreground' },
        row.original.departmentPath || '—'
      ),
  },
  {
    accessorKey: 'positionName',
    id: 'positionName',
    header: () => h('div', { class: 'text-foreground' }, '職位'),
    cell: ({ row }) => h('div', { class: 'text-foreground' }, row.original.positionName),
  },
  {
    accessorKey: 'level',
    id: 'level',
    header: () => h('div', { class: 'text-foreground' }, '層級'),
    cell: ({ row }) => h('span', { class: 'tabular-nums' }, `Lv.${row.original.level}`),
  },
  {
    id: 'approvalLimit',
    header: () => h('div', { class: 'text-foreground' }, '核准上限'),
    cell: ({ row }) =>
      h(
        'span',
        { class: 'tabular-nums text-muted-foreground text-sm' },
        approvalCell(row.original.approvalLimit)
      ),
    enableSorting: false,
  },
  {
    id: 'flags',
    header: () => h('div', { class: 'text-foreground' }, '註記'),
    cell: ({ row }) => {
      const chips: ReturnType<typeof h>[] = []
      if (row.original.isManager) {
        chips.push(h(Badge, { variant: 'secondary', class: 'text-xs font-normal' }, () => '主管'))
      }
      if (row.original.isPrimary) {
        chips.push(h(Badge, { variant: 'outline', class: 'text-xs font-normal' }, () => '主要'))
      }
      return h(
        'div',
        { class: 'flex flex-wrap gap-1' },
        chips.length ? chips : [h('span', { class: 'text-muted-foreground' }, '—')]
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'userStatus',
    id: 'userStatus',
    header: () => h('div', { class: 'text-foreground' }, '帳號狀態'),
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-sm text-muted-foreground' },
        row.original.userStatus === 'suspended' ? '停用' : '啟用'
      ),
  },
])

const membersTable = useVueTable({
  get data() {
    return membersList.value
  },
  get columns() {
    return membersColumns.value
  },
  getCoreRowModel: getCoreRowModel(),
  manualPagination: true,
  get pageCount() {
    return totalMemberPages.value || 1
  },
  onRowSelectionChange: (updater) => valueUpdater(updater, membersRowSelection),
  state: {
    get pagination() {
      return { pageIndex: membersPage.value - 1, pageSize: membersLimit.value }
    },
    get rowSelection() {
      return membersRowSelection.value
    },
  },
  onPaginationChange: (updater) => {
    const prev = { pageIndex: membersPage.value - 1, pageSize: membersLimit.value }
    const next = typeof updater === 'function' ? updater(prev) : updater
    if (next) {
      membersRowSelection.value = {}
      membersPage.value = next.pageIndex + 1
      membersLimit.value = next.pageSize
      void loadMembers()
    }
  },
  getRowId: (row) => row.assignmentId,
})

const membersEmptyText = computed(() => {
  if (membersError.value) return '無法顯示列表'
  if (membersMeta.value && membersMeta.value.total === 0)
    return '尚無內部成員之組織指派，請先建立部門與職位後，於租戶成員中為內部成員新增指派。'
  return '此頁無資料'
})

watch(tenantIdQuery, () => {
  membersPage.value = 1
  membersRowSelection.value = {}
  void loadChart()
  if (activeTab.value === 'people') void loadMembers()
  if (activeTab.value === 'network') nextTick(() => orgNetworkRef.value?.fitView?.())
})

watch(activeTab, (t, prev) => {
  // 離開組織圖／網路圖時關閉並排部門詳情（進入成員分頁或網路↔組織圖切換時不重複顯示舊選取）
  if (prev === 'network' && t !== 'network') {
    deptDetailSheetOpen.value = false
    selectedDeptDetail.value = null
  }
  if (prev === 'chart' && t === 'people') {
    deptDetailSheetOpen.value = false
    selectedDeptDetail.value = null
  }
  if (t === 'people') void loadMembers()
  if (t === 'network') nextTick(() => orgNetworkRef.value?.fitView?.())
})

watch(membersDeptFilter, () => {
  membersPage.value = 1
  membersRowSelection.value = {}
  if (activeTab.value === 'people') void loadMembers()
})

function onEditDialogOpenChange(open: boolean) {
  if (!open) editingDeptId.value = null
}

function onDeleteDialogOpenChange(open: boolean) {
  if (!open && !deleteSubmitting.value) {
    deleteTarget.value = null
    deleteErrorMessage.value = ''
  }
}

const orgAssignDialogOpen = ref(false)

function onOrgAssignmentCreated() {
  void loadChart()
  if (activeTab.value === 'people') void loadMembers()
}

function onMembersRowClick(row: OrgMemberRow) {
  void router.push({
    name: ROUTE_NAME.ADMIN_ORG_ASSIGNMENT_EDIT,
    params: { assignmentId: row.assignmentId },
  })
}

onMounted(() => {
  void loadChart()
  // route.query.tab 的 immediate watch 可能在 watch(activeTab) 註冊前就設好 tab，
  // 會錯過「chart → people」的變更，故初次進入（含從指派詳情帶 ?tab=people 返回）須補載入。
  if (activeTab.value === 'people') void loadMembers()
  if (activeTab.value === 'network') nextTick(() => orgNetworkRef.value?.fitView?.())
})
</script>

<template>
  <div
    class="flex h-[calc(100dvh-10.75rem)] max-h-[calc(100dvh-10.75rem)] min-h-0 flex-col gap-4 overflow-hidden md:h-[calc(100dvh-9.5rem)] md:max-h-[calc(100dvh-9.5rem)]"
  >
    <div class="shrink-0">
      <h1 class="text-xl font-semibold tracking-tight text-foreground">組織管理</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        以組織圖／網路圖管理部門樹。此處「<strong class="font-medium text-foreground">成員</strong>」僅含
        <strong class="font-medium text-foreground">內部成員</strong>之進行中指派；外部成員為組織外協力，不顯示於組織圖。租戶帳號、內外部類型與權限範本請至
        <RouterLink
          :to="ROUTE_PATH.ADMIN_MEMBERS"
          class="text-primary underline-offset-4 hover:underline"
        >
          租戶成員
        </RouterLink>
        。專案內權限仍於各專案「專案成員」管理。
      </p>
      <p v-if="platformNeedsTenant" class="mt-2 text-sm text-destructive">
        請先於平台後台選擇租戶後再管理組織。
      </p>
    </div>

    <Tabs v-model="activeTab" class="flex min-h-0 w-full flex-1 flex-col gap-2 overflow-hidden">
      <TabsList class="grid w-full max-w-2xl shrink-0 grid-cols-3">
        <TabsTrigger value="chart">組織圖</TabsTrigger>
        <TabsTrigger value="network">網路圖</TabsTrigger>
        <TabsTrigger value="people">成員</TabsTrigger>
      </TabsList>

      <TabsContent value="chart" class="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div class="flex shrink-0 flex-wrap items-center justify-end gap-3">
          <Button variant="outline" size="sm" as-child>
            <RouterLink :to="ROUTE_PATH.ADMIN_POSITIONS">職位管理</RouterLink>
          </Button>
          <Dialog v-model:open="dialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" :disabled="platformNeedsTenant">
                <Plus class="size-4" aria-hidden="true" />
                新增部門
              </Button>
            </DialogTrigger>
            <DialogContent class="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>新增部門</DialogTitle>
                <DialogDescription>建立租戶內部門節點，可稍後再調整排序或上層。</DialogDescription>
              </DialogHeader>
              <div class="grid gap-4 py-2">
                <div class="grid gap-2">
                  <Label for="org-dept-name">名稱</Label>
                  <Input id="org-dept-name" v-model="formName" placeholder="例如：工程部" />
                </div>
                <div class="grid gap-2">
                  <Label>上層部門</Label>
                  <Select v-model="formParentId">
                    <SelectTrigger>
                      <SelectValue placeholder="選擇上層" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="opt in parentOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" @click="dialogOpen = false">取消</Button>
                <Button type="button" :disabled="submitting" @click="submitCreate">
                  {{ submitting ? '建立中…' : '建立' }}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div
          v-if="loading"
          class="flex shrink-0 items-center justify-center py-16 text-muted-foreground"
        >
          <Loader2 class="size-8 animate-spin" aria-hidden="true" />
        </div>
        <p v-else-if="errorMessage" class="shrink-0 text-sm text-destructive">{{ errorMessage }}</p>
        <template v-else-if="tree">
          <div class="grid shrink-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StateCard title="部門數">
              <template #icon>
                <Building2 class="size-6 text-muted-foreground" />
              </template>
              <div class="text-3xl font-bold tabular-nums text-foreground">
                {{ tree.departmentCount }}
              </div>
              <p class="text-xs text-muted-foreground">租戶內有效部門</p>
            </StateCard>
            <StateCard title="組織人員">
              <template #icon>
                <Users class="size-6 text-muted-foreground" />
              </template>
              <div class="text-3xl font-bold tabular-nums text-foreground">
                {{ tree.memberCount }}
              </div>
              <p class="text-xs text-muted-foreground">內部成員之進行中指派</p>
            </StateCard>
            <StateCard title="頂層部門">
              <template #icon>
                <Network class="size-6 text-muted-foreground" />
              </template>
              <div class="text-3xl font-bold tabular-nums text-foreground">
                {{ rootDeptCount }}
              </div>
              <p class="text-xs text-muted-foreground">無上層之父節點數</p>
            </StateCard>
          </div>
          <div
            class="shrink-0 rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
          >
            共 {{ tree.departmentCount }} 個部門、{{ tree.memberCount }} 位內部組織成員
          </div>
          <div
            class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-muted/30 md:flex-row md:items-stretch"
          >
            <div class="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-1">
              <OrgDeptTree v-if="tree.departments.length" :nodes="tree.departments" />
              <p v-else class="p-3 text-sm text-muted-foreground">尚未建立部門，請使用「新增部門」。</p>
            </div>
            <aside
              v-if="deptDetailSheetOpen && selectedDeptDetail"
              class="flex max-h-[min(45vh,320px)] w-full shrink-0 flex-col overflow-y-auto overscroll-contain border-t border-border bg-background md:max-h-none md:w-[17.5rem] md:border-t-0 md:border-l"
            >
              <OrgDeptDetailPanel
                class="min-h-0 flex-1 md:h-full"
                :department="selectedDeptDetail"
                :parent-name="detailParentName"
                compact
                show-close
                @close="onDeptDetailSheetOpenChange(false)"
              />
            </aside>
          </div>
        </template>
      </TabsContent>

      <TabsContent value="network" class="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <div class="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <Switch id="org-network-show-members" v-model="showOrgNetworkMembers" />
            <Label
              for="org-network-show-members"
              class="cursor-pointer text-sm font-normal text-muted-foreground"
            >
              網路圖顯示成員
            </Label>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-3">
          <Button variant="outline" size="sm" as-child>
            <RouterLink :to="ROUTE_PATH.ADMIN_POSITIONS">職位管理</RouterLink>
          </Button>
          <Dialog v-model:open="dialogOpen">
            <DialogTrigger as-child>
              <Button size="sm" :disabled="platformNeedsTenant">
                <Plus class="size-4" aria-hidden="true" />
                新增部門
              </Button>
            </DialogTrigger>
            <DialogContent class="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>新增部門</DialogTitle>
                <DialogDescription>建立租戶內部門節點，可稍後再調整排序或上層。</DialogDescription>
              </DialogHeader>
              <div class="grid gap-4 py-2">
                <div class="grid gap-2">
                  <Label for="org-dept-name-net">名稱</Label>
                  <Input id="org-dept-name-net" v-model="formName" placeholder="例如：工程部" />
                </div>
                <div class="grid gap-2">
                  <Label>上層部門</Label>
                  <Select v-model="formParentId">
                    <SelectTrigger>
                      <SelectValue placeholder="選擇上層" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="opt in parentOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p v-if="formError" class="text-sm text-destructive">{{ formError }}</p>
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" @click="dialogOpen = false">取消</Button>
                <Button type="button" :disabled="submitting" @click="submitCreate">
                  {{ submitting ? '建立中…' : '建立' }}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        <div
          v-if="loading"
          class="flex shrink-0 items-center justify-center py-16 text-muted-foreground"
        >
          <Loader2 class="size-8 animate-spin" aria-hidden="true" />
        </div>
        <p v-else-if="errorMessage" class="shrink-0 text-sm text-destructive">{{ errorMessage }}</p>
        <template v-else-if="tree">
          <div
            class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-muted/30 md:flex-row md:items-stretch"
          >
            <div class="flex min-h-0 min-w-0 flex-1 flex-col">
              <OrgNetworkDiagram
                ref="orgNetworkRef"
                embedded
                :departments="tree.departments"
                :tenant-label="tenantDisplayName"
                :member-count="tree.memberCount"
                :department-count="tree.departmentCount"
                :show-dept-members="showOrgNetworkMembers"
              />
            </div>
            <aside
              v-if="deptDetailSheetOpen && selectedDeptDetail"
              class="flex max-h-[min(45vh,320px)] w-full shrink-0 flex-col overflow-y-auto overscroll-contain border-t border-border bg-background md:max-h-none md:w-[17.5rem] md:border-t-0 md:border-l"
            >
              <OrgDeptDetailPanel
                class="min-h-0 flex-1 md:h-full"
                :department="selectedDeptDetail"
                :parent-name="detailParentName"
                compact
                show-close
                @close="onDeptDetailSheetOpenChange(false)"
              />
            </aside>
          </div>
        </template>
      </TabsContent>

      <TabsContent value="people" class="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <p class="shrink-0 text-xs text-muted-foreground">
          點選列表<strong class="text-foreground">任一資料列</strong>可開啟詳情（編輯／刪除部門與職位指派）。僅列出<strong
            class="text-foreground"
            >內部成員</strong
          >進行中之組織指派（外部成員不列入）。無部門／職位者請至
          <RouterLink
            :to="ROUTE_PATH.ADMIN_MEMBERS"
            class="text-primary underline-offset-4 hover:underline"
          >
            租戶成員
          </RouterLink>
          管理帳號；僅內部成員可在此建立指派。
        </p>
        <div class="flex shrink-0 flex-wrap items-center justify-between gap-4">
          <div class="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <div class="grid gap-1.5">
              <Label class="text-xs text-muted-foreground" for="org-members-dept">部門篩選</Label>
              <Select v-model="membersDeptFilter" :disabled="platformNeedsTenant">
                <SelectTrigger id="org-members-dept" class="h-8 w-[min(100%,280px)]">
                  <SelectValue placeholder="部門" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in deptFilterOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <Button
              size="sm"
              :disabled="platformNeedsTenant"
              class="gap-2"
              @click="orgAssignDialogOpen = true"
            >
              <UserPlus class="size-4" aria-hidden="true" />
              新增組織指派
            </Button>
            <Button variant="outline" size="sm" as-child>
              <RouterLink :to="ROUTE_PATH.ADMIN_POSITIONS">職位管理</RouterLink>
            </Button>
          </div>
        </div>

        <div
          class="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-border bg-card"
        >
          <div
            v-if="membersLoading"
            class="flex items-center justify-center py-12 text-muted-foreground"
          >
            <Loader2 class="size-8 animate-spin" aria-hidden="true" />
          </div>
          <DataTableFeatureSection
            v-else
            :table="membersTable"
            :empty-text="membersEmptyText"
            row-clickable
            @row-click="onMembersRowClick"
          />
        </div>

        <DataTablePagination
          v-if="!membersLoading && membersList.length > 0 && membersMeta"
          class="shrink-0"
          :table="membersTable"
          hide-selection-info
        />
      </TabsContent>
    </Tabs>

    <Dialog v-model:open="editDialogOpen" @update:open="onEditDialogOpenChange">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>編輯部門</DialogTitle>
          <DialogDescription
            >變更名稱、上層部門或狀態。不可將上層設為自己或子部門。</DialogDescription
          >
        </DialogHeader>
        <div class="grid gap-4 py-2">
          <div class="grid gap-2">
            <Label for="org-dept-edit-name">名稱</Label>
            <Input id="org-dept-edit-name" v-model="editFormName" placeholder="例如：工程部" />
          </div>
          <div class="grid gap-2">
            <Label>上層部門</Label>
            <Select v-model="editFormParentId">
              <SelectTrigger>
                <SelectValue placeholder="選擇上層" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in editParentOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid gap-2">
            <Label>狀態</Label>
            <Select v-model="editFormStatus">
              <SelectTrigger>
                <SelectValue placeholder="狀態" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">啟用</SelectItem>
                <SelectItem value="archived">已封存</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p v-if="editFormError" class="text-sm text-destructive">{{ editFormError }}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" @click="editDialogOpen = false">取消</Button>
          <Button type="button" :disabled="editSubmitting" @click="submitEditDept">
            {{ editSubmitting ? '儲存中…' : '儲存' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog :open="!!deleteTarget" @update:open="onDeleteDialogOpenChange">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>刪除部門？</AlertDialogTitle>
          <AlertDialogDescription class="space-y-2">
            <span v-if="deleteTarget">
              即將刪除「{{ deleteTarget.name }}」。需無子部門且無進行中之組織指派才可刪除。
            </span>
            <span v-if="deleteErrorMessage" class="block text-destructive">
              {{ deleteErrorMessage }}
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="deleteSubmitting">取消</AlertDialogCancel>
          <Button
            type="button"
            variant="destructive"
            :disabled="deleteSubmitting"
            @click="confirmDeleteDept"
          >
            {{ deleteSubmitting ? '刪除中…' : '刪除' }}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <AdminOrgAssignmentDialog
      v-model:open="orgAssignDialogOpen"
      :tenant-id="tenantIdQuery"
      :fixed-user="null"
      @created="onOrgAssignmentCreated"
    />

  </div>
</template>
