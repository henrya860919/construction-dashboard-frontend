<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table'
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import { useFeatureDefinitionsStore } from '@/stores/featureDefinitions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import AdminTenantFeatureDefinitionsRowActions from '@/views/admin/AdminTenantFeatureDefinitionsRowActions.vue'
import DataTableToolbarShell from '@/components/common/data-table/DataTableToolbarShell.vue'
import {
  listAdminTenantFeatureDefinitions,
  deleteAdminTenantFeatureDefinition,
  type TenantFeatureDefinitionAdminRow,
} from '@/api/tenant-feature-definitions'
import { ROUTE_NAME } from '@/constants/routes'
import { SYSTEM_MODULES } from '@/constants/modules'
import { Loader2, Plus } from 'lucide-vue-next'

const router = useRouter()
const authStore = useAuthStore()
const adminStore = useAdminStore()
const featureDefinitionsStore = useFeatureDefinitionsStore()

const tenantIdQuery = computed(() => {
  if (authStore.isPlatformAdmin) return adminStore.selectedTenantId ?? undefined
  return authStore.user?.tenantId ?? undefined
})

const list = ref<TenantFeatureDefinitionAdminRow[]>([])
const loading = ref(true)

const deleteTarget = ref<TenantFeatureDefinitionAdminRow | null>(null)

const systemModuleLabel = computed(() => {
  const map: Record<string, string> = {}
  for (const m of SYSTEM_MODULES) map[m.key] = m.name
  return map
})

function formStatusLabel(status: string): string {
  if (status === 'draft') return '草稿'
  if (status === 'published') return '已發布'
  if (status === 'archived') return '已封存'
  return status
}

function featureStatusLabel(status: string): string {
  if (status === 'active') return '啟用'
  if (status === 'inactive') return '停用'
  return status
}

async function refreshFeatureCaches() {
  await Promise.all(
    (['engineering', 'procurement', 'hr', 'finance'] as const).map((m) =>
      featureDefinitionsStore.refresh(m)
    )
  )
}

async function loadList() {
  const tid = tenantIdQuery.value
  if (authStore.isPlatformAdmin && !tid) {
    list.value = []
    loading.value = false
    return
  }
  loading.value = true
  try {
    list.value = await listAdminTenantFeatureDefinitions(tid)
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

watch(tenantIdQuery, () => {
  void loadList()
})

onMounted(() => {
  void loadList()
})

function goCreate() {
  router.push({ name: ROUTE_NAME.ADMIN_TENANT_FEATURE_DEFINITION_NEW })
}

function goEdit(row: TenantFeatureDefinitionAdminRow) {
  router.push({
    name: ROUTE_NAME.ADMIN_TENANT_FEATURE_DEFINITION_EDIT,
    params: { featureId: row.id },
  })
}

async function confirmDelete() {
  const row = deleteTarget.value
  const tid = tenantIdQuery.value
  if (!row || !tid) return
  try {
    await deleteAdminTenantFeatureDefinition(tid, row.id)
    deleteTarget.value = null
    await loadList()
    await refreshFeatureCaches()
  } catch {
    // keep dialog open; optional toast
  }
}

const emptyText = computed(() => {
  if (authStore.isPlatformAdmin && !adminStore.selectedTenantId) {
    return '請先於平台後台選擇租戶後再管理自訂功能。'
  }
  return '尚無租戶自建功能，請按「新增功能」建立並綁定電子表單。'
})

const columns = computed<ColumnDef<TenantFeatureDefinitionAdminRow, unknown>[]>(() => [
  {
    accessorKey: 'name',
    id: 'name',
    header: () => h('div', { class: 'text-foreground' }, '功能名稱'),
    cell: ({ row }) => h('div', { class: 'text-sm font-medium text-foreground' }, row.original.name),
  },
  {
    accessorKey: 'systemModule',
    id: 'systemModule',
    header: () => h('div', { class: 'text-foreground' }, '系統模組'),
    cell: ({ row }) =>
      h(
        'span',
        { class: 'text-sm text-muted-foreground' },
        systemModuleLabel.value[row.original.systemModule] ?? row.original.systemModule
      ),
  },
  {
    id: 'form',
    header: () => h('div', { class: 'text-foreground' }, '電子表單'),
    cell: ({ row }) => {
      const f = row.original.form
      if (!f) {
        return h('span', { class: 'text-sm text-muted-foreground' }, '—')
      }
      return h('div', { class: 'min-w-0 space-y-0.5' }, [
        h('div', { class: 'truncate text-sm text-foreground' }, f.name),
        h(Badge, { variant: 'secondary', class: 'font-normal' }, () => formStatusLabel(f.status)),
      ])
    },
  },
  {
    accessorKey: 'status',
    id: 'status',
    header: () => h('div', { class: 'text-foreground' }, '功能狀態'),
    cell: ({ row }) =>
      h(
        Badge,
        { variant: 'outline', class: 'font-normal' },
        () => featureStatusLabel(row.original.status)
      ),
  },
  {
    accessorKey: 'tenantSortOrder',
    id: 'tenantSortOrder',
    header: () => h('div', { class: 'text-foreground' }, '排序'),
    cell: ({ row }) =>
      h('span', { class: 'tabular-nums text-sm text-muted-foreground' }, String(row.original.tenantSortOrder)),
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'text-right text-foreground' }, '操作'),
    cell: ({ row }) =>
      h('div', { class: 'flex justify-end' }, [
        h(AdminTenantFeatureDefinitionsRowActions, {
          row: row.original,
          onEdit: (r: TenantFeatureDefinitionAdminRow) => goEdit(r),
          onDelete: (r: TenantFeatureDefinitionAdminRow) => {
            deleteTarget.value = r
          },
        }),
      ]),
    enableSorting: false,
    enableHiding: false,
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
  getRowId: (row) => row.id,
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">自訂系統功能</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        建立租戶專用功能並<strong class="font-medium text-foreground">綁定電子表單</strong>；列表與填報畫面將依表單設定呈現。停用後不會出現在工程管理側欄。
      </p>
    </div>

    <DataTableToolbarShell
      :table="table"
      :column-labels="{}"
      :has-active-filters="false"
      :show-multi-sort="false"
      :show-column-visibility="false"
    >
      <template #filters />
      <template #actions>
        <Button
          size="sm"
          class="h-8 gap-2"
          :disabled="loading || (authStore.isPlatformAdmin && !adminStore.selectedTenantId)"
          @click="goCreate"
        >
          <Plus class="size-4" />
          新增功能
        </Button>
      </template>
    </DataTableToolbarShell>

    <div class="rounded-lg border border-border bg-card">
      <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 class="size-8 animate-spin" />
      </div>
      <DataTableFeatureSection v-else :table="table" :empty-text="emptyText" />
    </div>

    <AlertDialog :open="!!deleteTarget" @update:open="(v: boolean) => !v && (deleteTarget = null)">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>刪除此自訂功能？</AlertDialogTitle>
          <AlertDialogDescription>
            {{ deleteTarget?.name }} 將自側欄移除（軟刪除）。若需復原請聯繫技術支援。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="confirmDelete"
          >
            刪除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
