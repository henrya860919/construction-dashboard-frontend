<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table'
import { ref, computed, watch, onMounted, h } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { valueUpdater } from '@/lib/utils'
import { ROUTE_PATH, ROUTE_NAME } from '@/constants'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import {
  adminListOrgAssignments,
  adminListOrgDepartments,
  type OrgDepartmentDto,
  type OrgMemberRow,
} from '@/api/organization'
import { Button } from '@/components/ui/button'
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
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import AdminOrgAssignmentDialog from '@/components/org/AdminOrgAssignmentDialog.vue'
import { Loader2, UserPlus } from 'lucide-vue-next'

const authStore = useAuthStore()
const adminStore = useAdminStore()
const router = useRouter()

const tenantIdQuery = computed(() => {
  if (authStore.isPlatformAdmin) return adminStore.selectedTenantId ?? undefined
  return authStore.user?.tenantId ?? undefined
})

const platformNeedsTenant = computed(
  () => authStore.isPlatformAdmin && !adminStore.selectedTenantId
)

const flatDepts = ref<OrgDepartmentDto[]>([])

const ALL_DEPTS = '__all__'
const membersList = ref<OrgMemberRow[]>([])
const membersMeta = ref<{ page: number; limit: number; total: number } | null>(null)
const membersLoading = ref(false)
const membersError = ref('')
const membersPage = ref(1)
const membersLimit = ref(20)
const membersDeptFilter = ref(ALL_DEPTS)
const membersRowSelection = ref<Record<string, boolean>>({})

const orgAssignDialogOpen = ref(false)

const totalMemberPages = computed(() =>
  membersMeta.value ? Math.ceil(membersMeta.value.total / membersLimit.value) : 0
)

async function loadDeptOptions() {
  if (platformNeedsTenant.value) {
    flatDepts.value = []
    return
  }
  try {
    flatDepts.value = await adminListOrgDepartments(tenantIdQuery.value)
  } catch {
    flatDepts.value = []
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
  void loadDeptOptions()
  void loadMembers()
})

watch(membersDeptFilter, () => {
  membersPage.value = 1
  membersRowSelection.value = {}
  void loadMembers()
})

function onOrgAssignmentCreated() {
  void loadMembers()
}

function onMembersRowClick(row: OrgMemberRow) {
  void router.push({
    name: ROUTE_NAME.HR_ORG_ASSIGNMENT_EDIT,
    params: { assignmentId: row.assignmentId },
  })
}

onMounted(() => {
  void loadDeptOptions()
  void loadMembers()
})
</script>

<template>
  <div
    class="flex h-[calc(100dvh-10.75rem)] max-h-[calc(100dvh-10.75rem)] min-h-0 flex-col gap-4 overflow-hidden md:h-[calc(100dvh-9.5rem)] md:max-h-[calc(100dvh-9.5rem)]"
  >
    <div class="shrink-0">
      <h1 class="text-xl font-semibold tracking-tight text-foreground">組織成員</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        僅列出<strong class="font-medium text-foreground">內部成員</strong>進行中之組織指派（外部成員不列入）。帳號與內外部類型請至
        <RouterLink
          :to="ROUTE_PATH.ADMIN_MEMBERS"
          class="text-primary underline-offset-4 hover:underline"
        >
          租戶成員
        </RouterLink>
        ；部門樹與網路圖請至
        <RouterLink
          :to="ROUTE_PATH.HR_ORG"
          class="text-primary underline-offset-4 hover:underline"
        >
          組織管理
        </RouterLink>
        。專案內權限仍於各專案「專案成員」管理。
      </p>
      <p v-if="platformNeedsTenant" class="mt-2 text-sm text-destructive">
        請先於平台後台選擇租戶後再檢視組織成員。
      </p>
    </div>

    <p class="shrink-0 text-xs text-muted-foreground">
      點選列表<strong class="text-foreground">任一資料列</strong>可開啟詳情（編輯／刪除部門與職位指派）。無部門／職位者請至
      <RouterLink
        :to="ROUTE_PATH.ADMIN_MEMBERS"
        class="text-primary underline-offset-4 hover:underline"
      >
        租戶成員
      </RouterLink>
      管理帳號；僅內部成員可建立組織指派。
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
          <RouterLink :to="ROUTE_PATH.HR_POSITIONS">職位管理</RouterLink>
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

    <AdminOrgAssignmentDialog
      v-model:open="orgAssignDialogOpen"
      :tenant-id="tenantIdQuery"
      :fixed-user="null"
      @created="onOrgAssignmentCreated"
    />
  </div>
</template>
