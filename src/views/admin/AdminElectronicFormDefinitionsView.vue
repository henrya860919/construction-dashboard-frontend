<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { getCoreRowModel, useVueTable } from '@tanstack/vue-table'
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import AdminElectronicFormDefinitionsRowActions from '@/views/admin/AdminElectronicFormDefinitionsRowActions.vue'
import DataTableFeatureSection from '@/components/common/data-table/DataTableFeatureSection.vue'
import DataTableToolbarShell from '@/components/common/data-table/DataTableToolbarShell.vue'
import DataTablePagination from '@/components/common/data-table/DataTablePagination.vue'
import {
  listElectronicFormDefinitions,
  type ElectronicFormDefinitionListItem,
} from '@/api/electronic-form-definitions'
import { buildAdminElectronicFormBuilderPath } from '@/constants/routes'
import { Loader2, Plus } from 'lucide-vue-next'
const authStore = useAuthStore()
const adminStore = useAdminStore()
const router = useRouter()

const tenantIdQuery = computed(() => {
  if (authStore.isPlatformAdmin) return adminStore.selectedTenantId ?? undefined
  return authStore.user?.tenantId ?? undefined
})

const list = ref<ElectronicFormDefinitionListItem[]>([])
const meta = ref<{ page: number; limit: number; total: number } | null>(null)
const loading = ref(true)
const page = ref(1)
const limit = ref(20)

const totalPages = computed(() => (meta.value ? Math.ceil(meta.value.total / limit.value) : 0))

function statusLabel(status: string): string {
  if (status === 'draft') return '草稿'
  if (status === 'published') return '已發布'
  if (status === 'archived') return '已封存'
  return status
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function load() {
  const tid = tenantIdQuery.value
  if (authStore.isPlatformAdmin && !tid) {
    list.value = []
    meta.value = null
    loading.value = false
    return
  }
  loading.value = true
  try {
    const res = await listElectronicFormDefinitions(tid, {
      page: page.value,
      limit: limit.value,
    })
    list.value = res.items
    meta.value = res.meta
  } catch {
    list.value = []
    meta.value = null
  } finally {
    loading.value = false
  }
}

watch(tenantIdQuery, () => {
  page.value = 1
  void load()
})

onMounted(() => void load())

function goNewBuilder() {
  void router.push(buildAdminElectronicFormBuilderPath('new'))
}

const columns = computed<ColumnDef<ElectronicFormDefinitionListItem, unknown>[]>(() => [
  {
    accessorKey: 'name',
    id: 'name',
    header: () => h('div', { class: 'text-foreground' }, '名稱'),
    cell: ({ row }) => h('div', { class: 'text-sm font-medium text-foreground' }, row.original.name),
  },
  {
    accessorKey: 'status',
    id: 'status',
    header: () => h('div', { class: 'text-foreground' }, '狀態'),
    cell: ({ row }) =>
      h(
        Badge,
        { variant: 'secondary', class: 'font-normal' },
        () => statusLabel(row.original.status)
      ),
  },
  {
    accessorKey: 'version',
    id: 'version',
    header: () => h('div', { class: 'text-foreground' }, '版本'),
    cell: ({ row }) =>
      h('span', { class: 'tabular-nums text-muted-foreground' }, String(row.original.version)),
  },
  {
    accessorKey: 'updatedAt',
    id: 'updatedAt',
    header: () => h('div', { class: 'text-foreground' }, '更新時間'),
    cell: ({ row }) =>
      h('span', { class: 'tabular-nums text-sm text-muted-foreground' }, formatDate(row.original.updatedAt)),
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'text-right text-foreground' }, '操作'),
    cell: ({ row }) =>
      h('div', { class: 'flex justify-end' }, h(AdminElectronicFormDefinitionsRowActions, {
        row: row.original,
        onDuplicated: () => void load(),
      })),
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
  manualPagination: true,
  get pageCount() {
    return totalPages.value || 1
  },
  state: {
    get pagination() {
      return { pageIndex: page.value - 1, pageSize: limit.value }
    },
  },
  onPaginationChange: (updater) => {
    const prev = { pageIndex: page.value - 1, pageSize: limit.value }
    const next = typeof updater === 'function' ? updater(prev) : updater
    if (next) {
      page.value = next.pageIndex + 1
      limit.value = next.pageSize
      void load()
    }
  },
  getRowId: (row) => row.id,
})

const emptyText = computed(() => {
  if (authStore.isPlatformAdmin && !adminStore.selectedTenantId) {
    return '請先選擇租戶後再檢視電子表單。'
  }
  if (!meta.value || meta.value.total === 0) return '尚無表單定義，請按「新增表單」建立。'
  return '此頁無資料'
})
</script>

<template>
  <div class="space-y-4">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">電子表單</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        在 Builder 中設計欄位與版面。已發布表單若要加欄請用「複製為新草稿」升版；發布時須保留同系列既有欄位鍵與類型。專案送單列表可用
        <code class="rounded bg-muted px-1 py-0.5 text-xs">formSeriesId</code>
        彙總跨版紀錄。
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
          @click="goNewBuilder"
        >
          <Plus class="size-4" />
          新增表單
        </Button>
      </template>
    </DataTableToolbarShell>

    <div class="rounded-lg border border-border bg-card">
      <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 class="size-8 animate-spin" />
      </div>
      <DataTableFeatureSection v-else :table="table" :empty-text="emptyText" />
    </div>
    <div v-if="!loading && meta && meta.total > 0" class="mt-4">
      <DataTablePagination :table="table" hide-selection-info />
    </div>
  </div>
</template>
