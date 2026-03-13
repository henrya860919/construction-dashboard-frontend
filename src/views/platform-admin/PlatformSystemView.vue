<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Database, HardDrive } from 'lucide-vue-next'
import { fetchSystemStatus, type SystemStatus } from '@/api/platform'

const loading = ref(true)
const error = ref<string | null>(null)
const status = ref<SystemStatus | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    status.value = await fetchSystemStatus()
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '無法取得系統狀態'
    error.value = msg
    status.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">系統狀態</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        資料庫與儲存服務健康狀態，供營運排查參考。
      </p>
    </div>

    <p v-if="error" class="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error }}
    </p>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <Loader2 class="size-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else-if="status">
      <div class="grid gap-4 sm:grid-cols-2">
        <Card class="border-border bg-card">
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">資料庫</CardTitle>
            <Database class="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="flex items-center justify-between">
              <span class="text-2xl font-bold tabular-nums text-foreground">{{ status.database.latencyMs }} ms</span>
              <Badge :variant="status.database.status === 'ok' ? 'default' : 'destructive'">
                {{ status.database.status === 'ok' ? '正常' : '異常' }}
              </Badge>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">查詢延遲</p>
          </CardContent>
        </Card>

        <Card class="border-border bg-card">
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium text-muted-foreground">儲存</CardTitle>
            <HardDrive class="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="flex items-center justify-between">
              <span class="text-2xl font-bold tabular-nums text-foreground">
                {{ status.storage.latencyMs != null ? `${status.storage.latencyMs} ms` : '—' }}
              </span>
              <Badge :variant="status.storage.status === 'ok' ? 'default' : 'destructive'">
                {{ status.storage.status === 'ok' ? '正常' : '異常' }}
              </Badge>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">讀寫檢查（上傳／刪除測試檔耗時）</p>
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>
