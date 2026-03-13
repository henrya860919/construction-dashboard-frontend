<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Loader2, FileText, Eye } from 'lucide-vue-next'
import { fetchAuditLogs, type AuditLogItem } from '@/api/platform'
import {
  AUDIT_ACTION_LABELS,
  AUDIT_RESOURCE_TYPE_LABELS,
  getAuditActionLabel,
  getAuditResourceTypeLabel,
} from '@/constants/audit'

const ALL_VALUE = '__all__'
const list = ref<AuditLogItem[]>([])
const meta = ref<{ page: number; limit: number; total: number } | null>(null)
const loading = ref(true)
const page = ref(1)
const limit = 20
const actionFilter = ref(ALL_VALUE)
const resourceTypeFilter = ref(ALL_VALUE)
const fromDate = ref('')
const toDate = ref('')
const detailDialogOpen = ref(false)
const selectedDetailRow = ref<AuditLogItem | null>(null)

/** 篩選選項：由對照表產生，新增動作/類型時只需更新 constants/audit.ts */
const ACTION_OPTIONS = [
  { value: ALL_VALUE, label: '全部動作' },
  ...Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => ({ value, label })),
]
const RESOURCE_OPTIONS = [
  { value: ALL_VALUE, label: '全部類型' },
  ...Object.entries(AUDIT_RESOURCE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
]

const totalPages = computed(() => (meta.value ? Math.ceil(meta.value.total / limit) : 0))
const hasFilters = computed(
  () =>
    actionFilter.value !== ALL_VALUE ||
    resourceTypeFilter.value !== ALL_VALUE ||
    fromDate.value !== '' ||
    toDate.value !== ''
)

function actionLabel(action: string): string {
  return getAuditActionLabel(action)
}

function resourceTypeLabel(resourceType: string): string {
  return getAuditResourceTypeLabel(resourceType)
}

async function load() {
  loading.value = true
  try {
    const params: {
      page: number
      limit: number
      action?: string
      resourceType?: string
      from?: string
      to?: string
    } = { page: page.value, limit }
    if (actionFilter.value && actionFilter.value !== ALL_VALUE) params.action = actionFilter.value
    if (resourceTypeFilter.value && resourceTypeFilter.value !== ALL_VALUE) params.resourceType = resourceTypeFilter.value
    if (fromDate.value) params.from = fromDate.value
    if (toDate.value) params.to = toDate.value
    const res = await fetchAuditLogs(params)
    list.value = res.list
    meta.value = res.meta ?? null
  } catch {
    list.value = []
    meta.value = null
  } finally {
    loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  load()
}

function clearFilters() {
  actionFilter.value = ALL_VALUE
  resourceTypeFilter.value = ALL_VALUE
  fromDate.value = ''
  toDate.value = ''
  page.value = 1
  load()
}

function formatDateTime(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function detailsSummary(details: unknown): string {
  if (details == null) return '—'
  if (typeof details === 'object' && details !== null) {
    const d = details as Record<string, unknown>
    if ('before' in d && 'after' in d) return '修改前 / 修改後（點擊查看）'
    try {
      return JSON.stringify(details).slice(0, 60) + (JSON.stringify(details).length > 60 ? '…' : '')
    } catch {
      return '—'
    }
  }
  return String(details)
}

function openDetail(row: AuditLogItem) {
  selectedDetailRow.value = row
  detailDialogOpen.value = true
}

function hasBeforeAfter(details: unknown): details is { before: unknown; after: unknown } {
  return (
    details != null &&
    typeof details === 'object' &&
    'before' in (details as object) &&
    'after' in (details as object)
  )
}

function formatDetailJson(val: unknown): string {
  if (val == null) return '—'
  try {
    return JSON.stringify(val, null, 2)
  } catch {
    return String(val)
  }
}

function detailBefore(details: unknown): unknown {
  return hasBeforeAfter(details) ? details.before : null
}

function detailAfter(details: unknown): unknown {
  return hasBeforeAfter(details) ? details.after : null
}

onMounted(load)
watch(page, load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">稽核日誌</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        檢視平台關鍵操作紀錄（租戶、使用者、專案等），可依動作、資源類型、日期篩選。
      </p>
    </div>

    <Card class="border-border bg-card">
      <CardContent class="p-4">
        <!-- 篩選列 -->
        <div class="mb-6 flex flex-wrap items-end gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <Select v-model="actionFilter">
              <SelectTrigger class="w-[140px] bg-background">
                <SelectValue placeholder="動作" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in ACTION_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select v-model="resourceTypeFilter">
              <SelectTrigger class="w-[120px] bg-background">
                <SelectValue placeholder="資源類型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="opt in RESOURCE_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input v-model="fromDate" type="date" class="w-40 bg-background" />
            <span class="text-muted-foreground">～</span>
            <Input v-model="toDate" type="date" class="w-40 bg-background" />
            <Button variant="secondary" size="sm" @click="applyFilters">查詢</Button>
            <Button v-if="hasFilters" variant="ghost" size="sm" @click="clearFilters">清除</Button>
          </div>
        </div>

        <div v-if="loading" class="flex items-center justify-center py-16">
          <Loader2 class="size-8 animate-spin text-muted-foreground" />
        </div>
        <template v-else>
          <div v-if="!list.length" class="py-16 text-center text-sm text-muted-foreground">
            <FileText class="mx-auto mb-2 size-10 opacity-50" />
            <p>尚無稽核紀錄或目前篩選無結果。</p>
          </div>
          <div v-else class="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow class="border-border hover:bg-transparent">
                  <TableHead class="text-muted-foreground">時間</TableHead>
                  <TableHead class="text-muted-foreground">操作者</TableHead>
                  <TableHead class="text-muted-foreground">動作</TableHead>
                  <TableHead class="text-muted-foreground">資源類型</TableHead>
                  <TableHead class="text-muted-foreground">資源 ID</TableHead>
                  <TableHead class="max-w-[200px] text-muted-foreground">詳情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in list" :key="row.id" class="border-border">
                  <TableCell class="tabular-nums text-foreground">{{ formatDateTime(row.createdAt) }}</TableCell>
                  <TableCell class="text-foreground">
                    {{ row.user ? (row.user.name || row.user.email) : '—' }}
                  </TableCell>
                  <TableCell class="font-medium text-foreground">{{ actionLabel(row.action) }}</TableCell>
                  <TableCell class="text-muted-foreground">{{ resourceTypeLabel(row.resourceType) }}</TableCell>
                  <TableCell class="font-mono text-xs text-muted-foreground">
                    {{ row.resourceId ? row.resourceId.slice(0, 12) + '…' : '—' }}
                  </TableCell>
                  <TableCell class="max-w-[200px] text-xs text-muted-foreground">
                    <Button
                      v-if="row.details != null"
                      variant="ghost"
                      size="sm"
                      class="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                      :title="detailsSummary(row.details)"
                      @click="openDetail(row)"
                    >
                      <Eye class="size-3.5" />
                      查看詳情
                    </Button>
                    <span v-else>—</span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div v-if="meta && totalPages > 1" class="mt-4 flex items-center justify-between">
            <p class="text-sm text-muted-foreground">
              共 {{ meta.total }} 筆，第 {{ meta.page }} / {{ totalPages }} 頁
            </p>
            <div class="flex gap-2">
              <Button variant="outline" size="sm" :disabled="page <= 1" @click="page = page - 1">
                上一頁
              </Button>
              <Button variant="outline" size="sm" :disabled="page >= totalPages" @click="page = page + 1">
                下一頁
              </Button>
            </div>
          </div>
        </template>
      </CardContent>
    </Card>

    <!-- 詳情 Dialog：修改前 / 修改後或完整 JSON -->
    <Dialog v-model:open="detailDialogOpen">
      <DialogContent class="max-h-[85vh] max-w-2xl overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>稽核詳情</DialogTitle>
        </DialogHeader>
        <div v-if="selectedDetailRow" class="flex flex-1 flex-col gap-4 overflow-y-auto">
          <div v-if="selectedDetailRow.user" class="text-sm text-muted-foreground">
            {{ selectedDetailRow.user.name || selectedDetailRow.user.email }}
            · {{ actionLabel(selectedDetailRow.action) }} · {{ formatDateTime(selectedDetailRow.createdAt) }}
          </div>
          <template v-if="hasBeforeAfter(selectedDetailRow.details)">
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <p class="text-sm font-medium text-foreground">修改前</p>
                <pre class="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground whitespace-pre-wrap break-words">{{ formatDetailJson(detailBefore(selectedDetailRow.details)) }}</pre>
              </div>
              <div class="space-y-2">
                <p class="text-sm font-medium text-foreground">修改後</p>
                <pre class="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground whitespace-pre-wrap break-words">{{ formatDetailJson(detailAfter(selectedDetailRow.details)) }}</pre>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="space-y-2">
              <p class="text-sm font-medium text-foreground">詳情</p>
              <pre class="max-h-64 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground whitespace-pre-wrap break-words">{{ formatDetailJson(selectedDetailRow.details) }}</pre>
            </div>
          </template>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
