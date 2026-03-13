<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Loader2, LogIn, Search } from 'lucide-vue-next'
import { fetchLoginLogs, type LoginLogItem } from '@/api/platform'

const list = ref<LoginLogItem[]>([])
const meta = ref<{ page: number; limit: number; total: number } | null>(null)
const loading = ref(true)
const page = ref(1)
const limit = 20
const emailFilter = ref('')
const successFilter = ref<string>('all')
const fromDate = ref('')
const toDate = ref('')

const totalPages = computed(() => (meta.value ? Math.ceil(meta.value.total / limit) : 0))
const hasFilters = computed(
  () => emailFilter.value.trim() !== '' || successFilter.value !== 'all' || fromDate.value !== '' || toDate.value !== ''
)

async function load() {
  loading.value = true
  try {
    const params: { page: number; limit: number; email?: string; success?: boolean; from?: string; to?: string } = {
      page: page.value,
      limit,
    }
    if (emailFilter.value.trim()) params.email = emailFilter.value.trim()
    if (successFilter.value === 'true') params.success = true
    if (successFilter.value === 'false') params.success = false
    if (fromDate.value) params.from = fromDate.value
    if (toDate.value) params.to = toDate.value
    const res = await fetchLoginLogs(params)
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
  emailFilter.value = ''
  successFilter.value = 'all'
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

onMounted(load)
watch(page, load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">登入紀錄</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        檢視平台登入嘗試（成功與失敗），可依 Email、結果、日期篩選。
      </p>
    </div>

    <Card class="border-border bg-card">
      <CardContent class="p-4">
        <!-- 篩選列 -->
        <div class="mb-6 flex flex-wrap items-end gap-4">
          <div class="flex flex-wrap items-center gap-3">
            <div class="relative w-56">
              <Search class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                v-model="emailFilter"
                placeholder="Email"
                class="pl-9 bg-background"
                @keyup.enter="applyFilters"
              />
            </div>
            <Select v-model="successFilter">
              <SelectTrigger class="w-[120px] bg-background">
                <SelectValue placeholder="結果" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="true">成功</SelectItem>
                <SelectItem value="false">失敗</SelectItem>
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
            <LogIn class="mx-auto mb-2 size-10 opacity-50" />
            <p>尚無登入紀錄或目前篩選無結果。</p>
          </div>
          <div v-else class="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow class="border-border hover:bg-transparent">
                  <TableHead class="text-muted-foreground">時間</TableHead>
                  <TableHead class="text-muted-foreground">Email</TableHead>
                  <TableHead class="w-20 text-muted-foreground">結果</TableHead>
                  <TableHead class="text-muted-foreground">失敗原因</TableHead>
                  <TableHead class="text-muted-foreground">IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="row in list"
                  :key="row.id"
                  class="border-border"
                >
                  <TableCell class="tabular-nums text-foreground">{{ formatDateTime(row.createdAt) }}</TableCell>
                  <TableCell class="font-medium text-foreground">{{ row.email }}</TableCell>
                  <TableCell>
                    <Badge :variant="row.success ? 'default' : 'destructive'" class="font-normal">
                      {{ row.success ? '成功' : '失敗' }}
                    </Badge>
                  </TableCell>
                  <TableCell class="max-w-[180px] truncate text-muted-foreground">
                    {{ row.failureReason ?? '—' }}
                  </TableCell>
                  <TableCell class="font-mono text-sm text-muted-foreground">{{ row.ipAddress ?? '—' }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- 分頁 -->
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
  </div>
</template>
