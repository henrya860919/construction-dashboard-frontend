<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, BarChart3 } from 'lucide-vue-next'
import { fetchUsage, type TenantUsageItem } from '@/api/platform'

const list = ref<TenantUsageItem[]>([])
const loading = ref(true)

function storageDisplay(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function quotaDisplay(quotaMb: number | null): string {
  if (quotaMb == null) return '無限制'
  if (quotaMb >= 1024) return `${(quotaMb / 1024).toFixed(1)} GB`
  return `${quotaMb} MB`
}

const storagePercent = (row: TenantUsageItem): number | null => {
  if (row.storageQuotaMb == null || row.storageQuotaMb <= 0) return null
  const usedMb = row.storageUsageBytes / 1024 / 1024
  return Math.min(100, (usedMb / row.storageQuotaMb) * 100)
}

const isOverQuota = (row: TenantUsageItem): boolean => {
  if (row.storageQuotaMb == null) return false
  const usedMb = row.storageUsageBytes / 1024 / 1024
  return usedMb > row.storageQuotaMb
}

const isExpiringSoon = (row: TenantUsageItem): boolean => {
  if (!row.expiresAt) return false
  const exp = new Date(row.expiresAt).getTime()
  const in30Days = Date.now() + 30 * 24 * 60 * 60 * 1000
  return exp <= in30Days && exp > Date.now()
}

const isExpired = (row: TenantUsageItem): boolean => {
  if (!row.expiresAt) return false
  return new Date(row.expiresAt).getTime() < Date.now()
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

async function load() {
  loading.value = true
  try {
    list.value = await fetchUsage()
  } catch {
    list.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">用量總覽</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        各租戶的使用者數、專案數與儲存用量；可檢視是否接近或超過配額、到期日。
      </p>
    </div>

    <Card class="border-border bg-card">
      <CardContent class="p-4">
        <div v-if="loading" class="flex items-center justify-center py-16">
          <Loader2 class="size-8 animate-spin text-muted-foreground" />
        </div>
        <template v-else>
          <div v-if="!list.length" class="py-16 text-center text-sm text-muted-foreground">
            <BarChart3 class="mx-auto mb-2 size-10 opacity-50" />
            <p>尚無租戶或用量資料。</p>
          </div>
          <div v-else class="overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow class="border-border hover:bg-transparent">
                  <TableHead class="text-muted-foreground">租戶</TableHead>
                  <TableHead class="text-muted-foreground">狀態</TableHead>
                  <TableHead class="text-muted-foreground">使用者</TableHead>
                  <TableHead class="text-muted-foreground">專案</TableHead>
                  <TableHead class="min-w-[200px] text-muted-foreground">儲存用量</TableHead>
                  <TableHead class="text-muted-foreground">到期日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in list" :key="row.id" class="border-border">
                  <TableCell>
                    <div class="font-medium text-foreground">{{ row.name }}</div>
                    <div v-if="row.slug" class="text-xs text-muted-foreground">{{ row.slug }}</div>
                  </TableCell>
                  <TableCell>
                    <Badge :variant="row.status === 'active' ? 'default' : 'secondary'">
                      {{ row.status === 'active' ? '啟用' : '停用' }}
                    </Badge>
                    <Badge v-if="isExpired(row)" variant="destructive" class="ml-1">已到期</Badge>
                    <Badge v-else-if="isExpiringSoon(row)" variant="outline" class="ml-1 border-amber-500 text-amber-600 dark:text-amber-400">
                      即將到期
                    </Badge>
                  </TableCell>
                  <TableCell class="tabular-nums text-foreground">
                    {{ row.userCount }}
                    <span v-if="row.userLimit != null" class="text-muted-foreground">/ {{ row.userLimit }}</span>
                  </TableCell>
                  <TableCell class="tabular-nums text-foreground">{{ row.projectCount }}</TableCell>
                  <TableCell class="min-w-[200px]">
                    <div class="flex flex-col gap-1">
                      <span class="text-foreground">{{ storageDisplay(row.storageUsageBytes) }}</span>
                      <span class="text-xs text-muted-foreground">{{ quotaDisplay(row.storageQuotaMb) }}</span>
                      <Progress
                        v-if="storagePercent(row) != null"
                        :model-value="storagePercent(row)!"
                        class="h-2 w-32"
                        :class="isOverQuota(row) ? '[&>div]:bg-destructive' : ''"
                      />
                      <span v-if="isOverQuota(row)" class="text-xs text-destructive">已超用</span>
                    </div>
                  </TableCell>
                  <TableCell class="tabular-nums text-muted-foreground">{{ formatDate(row.expiresAt) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
