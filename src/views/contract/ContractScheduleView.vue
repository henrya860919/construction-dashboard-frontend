<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { ref, computed, h, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/common/data-table'
import DataTableColumnHeader from '@/components/common/data-table/DataTableColumnHeader.vue'
import ScheduleRowActions from '@/views/contract/ScheduleRowActions.vue'
import type { Column } from '@tanstack/vue-table'
import type { ScheduleAdjustmentRow } from '@/types'
import { CalendarRange, Plus, Calendar, Hash, CheckCircle, Loader2 } from 'lucide-vue-next'
import { getProject, getScheduleAdjustments, createScheduleAdjustment, updateScheduleAdjustment, deleteScheduleAdjustment } from '@/api/project'

const route = useRoute()

function getProjectId(): string {
  return (route.params.projectId as string) ?? ''
}

/** 類型選項 */
const TYPE_OPTIONS = [
  { value: 'extension', label: '展延' },
  { value: 'suspension', label: '停工' },
  { value: 'other', label: '其他' },
] as const

/** 申請狀態選項 */
const STATUS_OPTIONS = [
  { value: 'pending', label: '待審' },
  { value: 'approved', label: '已核定' },
  { value: 'rejected', label: '駁回' },
] as const

const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')

/** 專案資訊（開工、工期、預定完工=開工+工期、預定竣工=開工+工期+調整天數） */
const projectInfo = ref<{
  startDate: string | null
  plannedDurationDays: number | null
  plannedEndDate: string | null
  revisedEndDate: string | null
} | null>(null)

/** 工期調整列表 */
const list = ref<ScheduleAdjustmentRow[]>([])

/** 上方摘要：預定完工=開工+工期，預定竣工=開工+工期+核定調整天數（API 已計算 revisedEndDate） */
const summary = computed(() => {
  const totalApplyDays = list.value.reduce((s, r) => s + r.applyDays, 0)
  const totalApprovedDays = list.value.reduce((s, r) => s + r.approvedDays, 0)
  const startDate = projectInfo.value?.startDate ? projectInfo.value.startDate.slice(0, 10) : '—'
  const plannedEndDate = projectInfo.value?.revisedEndDate
    ? projectInfo.value.revisedEndDate.slice(0, 10)
    : projectInfo.value?.plannedEndDate
      ? projectInfo.value.plannedEndDate.slice(0, 10)
      : '—'
  return { totalApplyDays, totalApprovedDays, startDate, plannedEndDate }
})

/** 新增 Modal */
const dialogOpen = ref(false)
const form = ref({
  applyDate: '',
  type: 'extension',
  applyDays: 0,
  approvedDays: 0,
  status: 'pending',
})

/** 編輯 Modal */
const editDialogOpen = ref(false)
const editingId = ref('')
const editForm = ref({
  applyDate: '',
  type: 'extension',
  applyDays: 0,
  approvedDays: 0,
  status: 'pending',
})

/** 刪除確認 */
const deleteDialogOpen = ref(false)
const deletingRow = ref<ScheduleAdjustmentRow | null>(null)

function typeLabel(value: string): string {
  return TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value
}

function statusLabel(value: string): string {
  return STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value
}

/** API 回傳的 applyDate 可能為 ISO，顯示用 YYYY-MM-DD */
function formatApplyDate(applyDate: string): string {
  if (!applyDate) return '—'
  return applyDate.slice(0, 10)
}

async function loadData() {
  const projectId = getProjectId()
  if (!projectId) return
  loading.value = true
  errorMessage.value = ''
  try {
    const [project, adjustments] = await Promise.all([
      getProject(projectId),
      getScheduleAdjustments(projectId),
    ])
    if (project) {
      projectInfo.value = {
        startDate: project.startDate,
        plannedDurationDays: project.plannedDurationDays ?? null,
        plannedEndDate: project.plannedEndDate,
        revisedEndDate: project.revisedEndDate,
      }
    } else {
      projectInfo.value = null
    }
    list.value = adjustments ?? []
  } catch {
    errorMessage.value = '無法載入工期調整資料'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
watch(() => route.params.projectId, loadData)

function closeDialog() {
  dialogOpen.value = false
}

async function submitAdd() {
  if (!form.value.applyDate.trim()) return
  const projectId = getProjectId()
  if (!projectId) return
  saving.value = true
  errorMessage.value = ''
  try {
    await createScheduleAdjustment(projectId, {
      applyDate: form.value.applyDate,
      type: form.value.type,
      applyDays: form.value.applyDays,
      approvedDays: form.value.approvedDays,
      status: form.value.status,
    })
    form.value = { applyDate: '', type: 'extension', applyDays: 0, approvedDays: 0, status: 'pending' }
    dialogOpen.value = false
    await loadData()
  } catch {
    errorMessage.value = '新增失敗'
  } finally {
    saving.value = false
  }
}

function openEdit(row: ScheduleAdjustmentRow) {
  editingId.value = row.id
  editForm.value = {
    applyDate: formatApplyDate(row.applyDate),
    type: row.type,
    applyDays: row.applyDays,
    approvedDays: row.approvedDays,
    status: row.status,
  }
  editDialogOpen.value = true
}

function closeEditDialog() {
  editDialogOpen.value = false
  editingId.value = ''
}

async function submitEdit() {
  const projectId = getProjectId()
  if (!projectId || !editingId.value) return
  saving.value = true
  errorMessage.value = ''
  try {
    await updateScheduleAdjustment(projectId, editingId.value, {
      applyDate: editForm.value.applyDate,
      type: editForm.value.type,
      applyDays: editForm.value.applyDays,
      approvedDays: editForm.value.approvedDays,
      status: editForm.value.status,
    })
    closeEditDialog()
    await loadData()
  } catch {
    errorMessage.value = '更新失敗'
  } finally {
    saving.value = false
  }
}

function openDelete(row: ScheduleAdjustmentRow) {
  deletingRow.value = row
  deleteDialogOpen.value = true
}

function closeDeleteDialog() {
  deleteDialogOpen.value = false
  deletingRow.value = null
}

async function confirmDelete() {
  const projectId = getProjectId()
  const row = deletingRow.value
  if (!projectId || !row) return
  saving.value = true
  errorMessage.value = ''
  try {
    await deleteScheduleAdjustment(projectId, row.id)
    closeDeleteDialog()
    await loadData()
  } catch {
    errorMessage.value = '刪除失敗'
  } finally {
    saving.value = false
  }
}

/** DataTable 欄位定義 */
const columns = computed<ColumnDef<ScheduleAdjustmentRow, unknown>[]>(() => [
  {
    accessorKey: 'applyDate',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as Column<unknown, unknown>,
        title: '申請日期',
      }),
    cell: ({ row }) =>
      h('div', { class: 'font-medium text-foreground' }, formatApplyDate(row.getValue('applyDate') as string)),
  },
  {
    accessorKey: 'type',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as Column<unknown, unknown>,
        title: '類型',
      }),
    cell: ({ row }) =>
      h('div', { class: 'text-foreground' }, typeLabel(row.getValue('type') as string)),
  },
  {
    accessorKey: 'applyDays',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as Column<unknown, unknown>,
        title: '申請天數',
      }),
    cell: ({ row }) =>
      h('div', { class: 'tabular-nums text-foreground' }, `${row.getValue('applyDays') as number} 天`),
  },
  {
    accessorKey: 'approvedDays',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as Column<unknown, unknown>,
        title: '核定天數',
      }),
    cell: ({ row }) =>
      h('div', { class: 'tabular-nums text-foreground' }, `${row.getValue('approvedDays') as number} 天`),
  },
  {
    accessorKey: 'status',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as Column<unknown, unknown>,
        title: '申請狀態',
      }),
    cell: ({ row }) => {
      const s = row.getValue('status') as string
      const variant = s === 'approved' ? 'default' : s === 'rejected' ? 'destructive' : 'secondary'
      return h(Badge, { variant }, () => statusLabel(s))
    },
  },
  {
    id: 'actions',
    header: () => h('div', { class: 'font-medium' }, '操作'),
    cell: ({ row }) =>
      h('div', { class: 'flex' }, [
        h(ScheduleRowActions, {
          row: row.original,
          onEdit: (r) => openEdit(r),
          onView: (r) => openEdit(r),
          onDelete: (r) => openDelete(r),
        }),
      ]),
    enableSorting: false,
  },
])
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold tracking-tight text-foreground">工期調整</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        展延／停工申請與核定紀錄，預計竣工日期依核定展延天數計算
      </p>
    </div>

    <!-- 上方摘要：申請天數、核定天數、開工時間、預計竣工日期 -->
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card class="border-border">
        <CardContent class="flex items-center gap-4 pt-6">
          <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Hash class="size-6" />
          </div>
          <div>
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">申請天數</p>
            <p class="text-2xl font-semibold tabular-nums text-foreground">{{ summary.totalApplyDays }} 天</p>
          </div>
        </CardContent>
      </Card>
      <Card class="border-border">
        <CardContent class="flex items-center gap-4 pt-6">
          <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CheckCircle class="size-6" />
          </div>
          <div>
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">核定天數</p>
            <p class="text-2xl font-semibold tabular-nums text-foreground">{{ summary.totalApprovedDays }} 天</p>
          </div>
        </CardContent>
      </Card>
      <Card class="border-border">
        <CardContent class="flex items-center gap-4 pt-6">
          <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Calendar class="size-6" />
          </div>
          <div>
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">開工時間</p>
            <p class="text-lg font-semibold tabular-nums text-foreground">{{ summary.startDate }}</p>
          </div>
        </CardContent>
      </Card>
      <Card class="border-border">
        <CardContent class="flex items-center gap-4 pt-6">
          <div class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CalendarRange class="size-6" />
          </div>
          <div>
            <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">預定竣工日期</p>
            <p class="text-lg font-semibold tabular-nums text-foreground">{{ summary.plannedEndDate }}</p>
            <p class="text-xs text-muted-foreground">開工 + 工期 + 核定調整天數</p>
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 列表 + 新增按鈕 -->
    <Card class="border-border">
      <CardHeader class="flex flex-row flex-wrap items-center justify-between gap-4 pb-2">
        <div>
          <CardTitle class="text-base">工期調整紀錄</CardTitle>
          <p class="text-sm text-muted-foreground">申請日期、類型、申請／核定天數與狀態</p>
        </div>
        <Dialog v-model:open="dialogOpen">
          <DialogTrigger as-child>
            <Button class="gap-2">
              <Plus class="size-4" />
              新增
            </Button>
          </DialogTrigger>
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>新增工期調整</DialogTitle>
              <DialogDescription>
                填寫申請日期、類型、申請天數與核定天數，申請狀態可選待審／已核定／駁回。
              </DialogDescription>
            </DialogHeader>
            <div class="grid gap-4 py-4">
              <div class="grid gap-2">
                <label class="text-sm font-medium text-foreground">申請日期</label>
                <Input v-model="form.applyDate" type="date" placeholder="請選擇日期" />
              </div>
              <div class="grid gap-2">
                <label class="text-sm font-medium text-foreground">類型</label>
                <Select v-model="form.type">
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in TYPE_OPTIONS"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="grid gap-2">
                  <label class="text-sm font-medium text-foreground">申請天數</label>
                  <Input v-model.number="form.applyDays" type="number" min="0" placeholder="0" />
                </div>
                <div class="grid gap-2">
                  <label class="text-sm font-medium text-foreground">核定天數</label>
                  <Input v-model.number="form.approvedDays" type="number" min="0" placeholder="0" />
                </div>
              </div>
              <div class="grid gap-2">
                <label class="text-sm font-medium text-foreground">申請狀態</label>
                <Select v-model="form.status">
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in STATUS_OPTIONS"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="closeDialog">
                取消
              </Button>
              <Button :disabled="saving" @click="submitAdd">
                <Loader2 v-if="saving" class="mr-2 size-4 animate-spin" />
                送出
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <!-- 編輯工期調整 -->
        <Dialog v-model:open="editDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>編輯工期調整</DialogTitle>
              <DialogDescription>
                修改申請日期、類型、天數與狀態。
              </DialogDescription>
            </DialogHeader>
            <div class="grid gap-4 py-4">
              <div class="grid gap-2">
                <label class="text-sm font-medium text-foreground">申請日期</label>
                <Input v-model="editForm.applyDate" type="date" />
              </div>
              <div class="grid gap-2">
                <label class="text-sm font-medium text-foreground">類型</label>
                <Select v-model="editForm.type">
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇類型" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in TYPE_OPTIONS"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div class="grid gap-2">
                  <label class="text-sm font-medium text-foreground">申請天數</label>
                  <Input v-model.number="editForm.applyDays" type="number" min="0" />
                </div>
                <div class="grid gap-2">
                  <label class="text-sm font-medium text-foreground">核定天數</label>
                  <Input v-model.number="editForm.approvedDays" type="number" min="0" />
                </div>
              </div>
              <div class="grid gap-2">
                <label class="text-sm font-medium text-foreground">申請狀態</label>
                <Select v-model="editForm.status">
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇狀態" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in STATUS_OPTIONS"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" @click="closeEditDialog">
                取消
              </Button>
              <Button :disabled="saving" @click="submitEdit">
                <Loader2 v-if="saving" class="mr-2 size-4 animate-spin" />
                儲存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <!-- 刪除確認 -->
        <Dialog v-model:open="deleteDialogOpen">
          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>確認刪除</DialogTitle>
              <DialogDescription>
                確定要刪除此筆工期調整紀錄？此操作無法復原。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" @click="closeDeleteDialog">取消</Button>
              <Button variant="destructive" :disabled="saving" @click="confirmDelete">
                <Loader2 v-if="saving" class="mr-2 size-4 animate-spin" />
                {{ saving ? '刪除中…' : '刪除' }}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <p v-if="errorMessage" class="mb-4 text-sm text-destructive">{{ errorMessage }}</p>
        <div v-if="loading" class="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 class="size-8 animate-spin" />
        </div>
        <DataTable
          v-else
          :columns="columns"
          :data="list"
          :show-view-options="false"
          :page-size="10"
        />
      </CardContent>
    </Card>
  </div>
</template>
