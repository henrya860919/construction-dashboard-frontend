<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Loader2, Eye } from 'lucide-vue-next'
import { fetchAlertHistory, type AlertHistoryItem } from '@/api/alerts'

const route = useRoute()
const projectId = route.params.projectId as string

const list = ref<AlertHistoryItem[]>([])
const loading = ref(true)
const detailOpen = ref(false)
const selectedAlert = ref<AlertHistoryItem | null>(null)

const startDate = ref('')
const endDate = ref('')

function setDefaultDateRange() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 7)
  endDate.value = end.toISOString().slice(0, 10)
  startDate.value = start.toISOString().slice(0, 10)
}

async function load() {
  if (!startDate.value || !endDate.value) return
  loading.value = true
  try {
    list.value = await fetchAlertHistory({
      projectId,
      startDate: startDate.value,
      endDate: endDate.value,
      limit: 200,
    })
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

function openDetail(row: AlertHistoryItem) {
  selectedAlert.value = row
  detailOpen.value = true
}

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

const levelLabel = (level: string) => {
  if (level === 'alarm') return '警報'
  if (level === 'attention') return '注意'
  return '正常'
}

const levelVariant = (level: string): 'destructive' | 'secondary' | 'outline' => {
  if (level === 'alarm') return 'destructive'
  if (level === 'attention') return 'secondary'
  return 'outline'
}

onMounted(() => {
  setDefaultDateRange()
  load()
})
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-semibold text-foreground">歷史警報</h1>
    <p class="text-sm text-muted-foreground">
      目前顯示政府（氣象署等）警特報紀錄；之後可支援手動新增。
    </p>

    <Card>
      <CardHeader class="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>警報紀錄</CardTitle>
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="startDate"
            type="date"
            class="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <span class="text-muted-foreground">～</span>
          <input
            v-model="endDate"
            type="date"
            class="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Button variant="outline" size="sm" :disabled="loading" @click="load">
            <Loader2 v-if="loading" class="mr-2 size-4 animate-spin" />
            查詢
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div v-if="loading" class="flex justify-center py-12 text-sm text-muted-foreground">
          載入中…
        </div>
        <div
          v-else-if="list.length === 0"
          class="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center"
        >
          <p class="text-sm text-muted-foreground">此區間無警報紀錄</p>
        </div>
        <div v-else class="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>類型</TableHead>
                <TableHead>等級</TableHead>
                <TableHead>摘要</TableHead>
                <TableHead>時間</TableHead>
                <TableHead class="w-[80px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="row in list" :key="row.id">
                <TableCell class="font-medium">{{ row.title }}</TableCell>
                <TableCell>
                  <Badge :variant="levelVariant(row.level)">{{ levelLabel(row.level) }}</Badge>
                </TableCell>
                <TableCell class="max-w-[240px] truncate text-muted-foreground">
                  {{ row.value }}
                </TableCell>
                <TableCell class="tabular-nums text-muted-foreground">
                  {{ formatDateTime(row.createdAt) }}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" @click="openDetail(row)">
                    <Eye class="size-4" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <Dialog v-model:open="detailOpen">
      <DialogContent class="max-w-md">
        <DialogHeader>
          <DialogTitle>警報詳情</DialogTitle>
        </DialogHeader>
        <div v-if="selectedAlert" class="space-y-3 text-sm">
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">類型</span>
            <span class="font-medium">{{ selectedAlert.title }}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">等級</span>
            <Badge :variant="levelVariant(selectedAlert.level)">
              {{ levelLabel(selectedAlert.level) }}
            </Badge>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">摘要</span>
            <span class="text-right">{{ selectedAlert.value }}</span>
          </div>
          <div v-if="selectedAlert.description" class="flex flex-col gap-1">
            <span class="text-muted-foreground">說明</span>
            <p class="rounded border border-border bg-muted/30 p-2 text-foreground">
              {{ selectedAlert.description }}
            </p>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">時間</span>
            <span class="tabular-nums">{{ formatDateTime(selectedAlert.createdAt) }}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
