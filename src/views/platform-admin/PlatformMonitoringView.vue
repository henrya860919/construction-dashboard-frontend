<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Activity,
  LogIn,
  FileText,
  Users,
  Loader2,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from 'lucide-vue-next'
import { fetchMonitoringStats } from '@/api/platform'
import type { MonitoringStats } from '@/api/platform'
import { ROUTE_PATH } from '@/constants/routes'

const loading = ref(true)
const error = ref<string | null>(null)
const stats = ref<MonitoringStats | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    stats.value = await fetchMonitoringStats()
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : '無法載入統計'
    error.value = msg
    stats.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">監控儀表板</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        平台登入、稽核與活躍使用者概覽；可前往登入紀錄與稽核日誌查看明細。
      </p>
    </div>

    <p v-if="error" class="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error }}
    </p>

    <template v-else-if="loading">
      <div class="flex items-center justify-center py-20">
        <Loader2 class="size-8 animate-spin text-muted-foreground" />
      </div>
    </template>

    <template v-else-if="stats">
      <!-- 登入統計 -->
      <div>
        <h2 class="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          <LogIn class="size-4" />
          登入
        </h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card class="overflow-hidden border-border bg-card transition-shadow hover:shadow-md">
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium text-muted-foreground">今日登入總數</CardTitle>
              <Activity class="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p class="text-3xl font-bold tabular-nums text-foreground">{{ stats.login.todayTotal }}</p>
              <p class="mt-1 text-xs text-muted-foreground">成功 + 失敗</p>
            </CardContent>
          </Card>
          <Card class="overflow-hidden border-border bg-card transition-shadow hover:shadow-md">
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium text-muted-foreground">今日成功</CardTitle>
              <CheckCircle2 class="size-4 text-green-600 dark:text-green-400" />
            </CardHeader>
            <CardContent>
              <p class="text-3xl font-bold tabular-nums text-foreground">{{ stats.login.todaySuccess }}</p>
            </CardContent>
          </Card>
          <Card class="overflow-hidden border-border bg-card transition-shadow hover:shadow-md">
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium text-muted-foreground">今日失敗</CardTitle>
              <AlertCircle class="size-4 text-amber-600 dark:text-amber-400" />
            </CardHeader>
            <CardContent>
              <p class="text-3xl font-bold tabular-nums text-foreground">{{ stats.login.todayFailed }}</p>
            </CardContent>
          </Card>
          <Card class="overflow-hidden border-border bg-card transition-shadow hover:shadow-md">
            <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle class="text-sm font-medium text-muted-foreground">近 7 日失敗</CardTitle>
            </CardHeader>
            <CardContent>
              <p class="text-3xl font-bold tabular-nums text-foreground">{{ stats.login.last7DaysFailed }}</p>
              <p class="mt-1 text-xs text-muted-foreground">共 {{ stats.login.last7DaysTotal }} 次嘗試</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <!-- 稽核與活躍 -->
      <div class="grid gap-6 lg:grid-cols-2">
        <Card class="border-border bg-card">
          <CardHeader class="flex flex-row items-center justify-between space-y-0">
            <CardTitle class="text-base font-medium text-foreground">稽核日誌</CardTitle>
            <FileText class="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="flex items-baseline gap-4">
              <div>
                <p class="text-2xl font-bold tabular-nums text-foreground">{{ stats.audit.todayCount }}</p>
                <p class="text-xs text-muted-foreground">今日</p>
              </div>
              <div class="h-8 w-px bg-border" />
              <div>
                <p class="text-2xl font-bold tabular-nums text-foreground">{{ stats.audit.last7DaysCount }}</p>
                <p class="text-xs text-muted-foreground">近 7 日</p>
              </div>
            </div>
            <Button as-child variant="ghost" class="mt-4 -ml-2">
              <RouterLink :to="ROUTE_PATH.PLATFORM_ADMIN_AUDIT_LOGS" class="flex items-center gap-1">
                查看稽核日誌 <ChevronRight class="size-4" />
              </RouterLink>
            </Button>
          </CardContent>
        </Card>

        <Card class="border-border bg-card">
          <CardHeader class="flex flex-row items-center justify-between space-y-0">
            <CardTitle class="text-base font-medium text-foreground">活躍使用者</CardTitle>
            <Users class="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="flex items-baseline gap-4">
              <div>
                <p class="text-2xl font-bold tabular-nums text-foreground">{{ stats.activeUsers.last24h }}</p>
                <p class="text-xs text-muted-foreground">過去 24 小時</p>
              </div>
              <div class="h-8 w-px bg-border" />
              <div>
                <p class="text-2xl font-bold tabular-nums text-foreground">{{ stats.activeUsers.last7d }}</p>
                <p class="text-xs text-muted-foreground">過去 7 天</p>
              </div>
            </div>
            <Button as-child variant="ghost" class="mt-4 -ml-2">
              <RouterLink :to="ROUTE_PATH.PLATFORM_ADMIN_LOGIN_LOGS" class="flex items-center gap-1">
                查看登入紀錄 <ChevronRight class="size-4" />
              </RouterLink>
            </Button>
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>
