<script setup lang="ts">
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import StateCard from '@/components/dashboard/StateCard.vue'
import TimeDisplay from '@/components/dashboard/TimeDisplay.vue'
import MonitorCard from '@/components/dashboard/MonitorCard.vue'
import MonitoringChart from '@/components/dashboard/MonitoringChart.vue'
import ChartSummaryCards from '@/components/dashboard/ChartSummaryCards.vue'
import AutoRotateSwitch from '@/components/dashboard/AutoRotateSwitch.vue'
import AlertCard from '@/components/dashboard/AlertCard.vue'
import AnimatedNumber from '@/components/common/AnimatedNumber.vue'
import { useDashboardKpi } from '@/composables/useDashboardKpi'
import { useDashboardAlerts } from '@/composables/useDashboardAlerts'
import { useMonitoringMetrics } from '@/composables/useMonitoringMetrics'
import {
  Calendar,
  TrendingUp,
  Wallet,
  Flame,
  Wind,
  Droplets,
  Thermometer,
  CloudRain,
  Waves,
  Gauge,
  Activity,
  CloudRainWind,
} from 'lucide-vue-next'

const route = useRoute()
const projectId = route.params.projectId as string | undefined
const { projectInfo, progress, budget } = useDashboardKpi()
const { alerts, loading: alertsLoading, error: alertsError, reload: reloadAlerts } = useDashboardAlerts(projectId)

/** 依 lastSeenAt 算出「已過 X 分鐘」；逾 30 分鐘由後端過濾不顯示 */
function formatAlertTimeAgo(lastSeenAt?: string | null): string {
  if (!lastSeenAt) return ''
  const min = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 60_000)
  if (min < 1) return '剛剛'
  if (min >= 30) return '逾 30 分鐘'
  return `已過 ${min} 分鐘`
}
const { metrics, selectedKey, chartData, chartSummary, autoRotateEnabled, selectMetric } = useMonitoringMetrics()

/** 警報類型對應圖示：地震、豪雨、高溫、颱風等 */
const alertIconMap: Record<string, typeof Flame> = {
  地震: Activity,
  豪雨: CloudRain,
  高溫: Flame,
  熱危害: Flame,
  颱風: CloudRainWind,
  空污: Wind,
}
const getAlertIcon = (title: string) => alertIconMap[title] ?? Droplets

const monitoringIcons: Record<string, typeof Thermometer> = {
  temperature: Thermometer,
  humidity: Droplets,
  pm25: Gauge,
  wind: Wind,
  rainfall: CloudRain,
  waterLevel: Waves,
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-xl font-semibold text-foreground">儀表板</h1>
      <TimeDisplay />
    </header>

    <!-- KPI 三卡 -->
    <section class="grid gap-4 md:grid-cols-3">
      <StateCard title="累計天數">
        <template #icon>
          <Calendar class="size-6 text-muted-foreground" />
        </template>
        <p class="text-3xl font-bold text-foreground">
          <AnimatedNumber :value="projectInfo.cumulativeDays" suffix=" 天" />
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          開工 {{ projectInfo.startDate }} · 預定完工 {{ projectInfo.plannedCompletionDate }}
        </p>
      </StateCard>

      <StateCard title="整體進度">
        <template #icon>
          <TrendingUp class="size-6 text-muted-foreground" />
        </template>
        <p class="text-3xl font-bold text-foreground">
          <AnimatedNumber :value="progress.actualProgressPercent" suffix="%" />
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          計畫 {{ progress.plannedProgressPercent }}% · 實際 {{ progress.actualProgressPercent }}%
        </p>
      </StateCard>

      <StateCard title="預算執行" :progress="budget.executionRatePercent">
        <template #icon>
          <Wallet class="size-6 text-muted-foreground" />
        </template>
        <p class="text-3xl font-bold text-foreground">
          <AnimatedNumber :value="budget.executedAmount" :decimals="1" suffix=" 億元" />
        </p>
        <p class="mt-1 text-xs text-muted-foreground">
          核定 {{ budget.approvedBudget }} 億元 · 執行率 {{ budget.executionRatePercent }}%
        </p>
      </StateCard>
    </section>

    <!-- Tabs：監測數據 / 施工執行 -->
    <Tabs default-value="monitoring" class="w-full">
      <TabsList class="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="monitoring">監測數據</TabsTrigger>
        <TabsTrigger value="execution">施工執行</TabsTrigger>
      </TabsList>
      <TabsContent value="monitoring" class="space-y-4">
        <Card>
          <CardHeader class="flex flex-row items-center justify-between">
            <CardTitle>警報專區</CardTitle>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">更新時間: 即時監測</span>
              <Button v-if="alertsError" variant="outline" size="sm" @click="reloadAlerts">重試</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div v-if="alertsLoading" class="flex justify-center py-8 text-sm text-muted-foreground">
              載入中…
            </div>
            <p v-else-if="alertsError" class="py-4 text-sm text-destructive break-words">
              {{ alertsError }}
            </p>
            <div
              v-else-if="alerts.length === 0"
              class="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 py-12 text-center"
            >
              <p class="text-sm font-medium text-muted-foreground">目前無任何警報</p>
              <p class="mt-1 text-xs text-muted-foreground">地震、豪雨、高溫、颱風等警特報將顯示於此</p>
            </div>
            <div v-else class="grid gap-4 sm:grid-cols-3">
              <AlertCard
                v-for="alert in alerts"
                :key="alert.id"
                :level="alert.level"
                :title="alert.title"
                :value="alert.value"
                :time-ago="formatAlertTimeAgo(alert.lastSeenAt)"
              >
                <template #icon>
                  <component :is="getAlertIcon(alert.title)" class="size-5" />
                </template>
              </AlertCard>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle>環境監測數據</CardTitle>
            <div class="flex items-center gap-4">
              <span class="text-xs text-muted-foreground">更新時間: 17:56:48</span>
              <AutoRotateSwitch v-model="autoRotateEnabled" />
            </div>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <MonitorCard
                v-for="m in metrics"
                :key="m.id"
                :label="m.label"
                :value="`${m.value} ${m.unit}`"
                :selected="selectedKey === m.key"
                @click="selectMetric(m.key)"
              >
                <template #icon>
                  <component
                    :is="monitoringIcons[m.key] ?? Thermometer"
                    class="size-5"
                  />
                </template>
              </MonitorCard>
            </div>
            <div class="overflow-hidden">
              <Transition name="slide-right" mode="out-in">
                <Card :key="selectedKey" class="overflow-visible">
                  <CardContent class="space-y-4 pt-6">
                    <MonitoringChart :data="chartData" />
                    <ChartSummaryCards :summary="chartSummary" />
                  </CardContent>
                </Card>
              </Transition>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="execution" class="space-y-4">
        <Card>
          <CardHeader class="flex flex-row items-center justify-between">
            <CardTitle>施工進度趨勢</CardTitle>
            <span class="text-xs text-muted-foreground">更新時間: 每日 18:00</span>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground">（折線圖佔位）</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>人力與設備分析</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground">（圖表區塊佔位）</p>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>

<style>
/* 圖表區切換：向右滑入動畫（新內容自右側滑入，舊內容向左滑出） */
.slide-right-enter-active,
.slide-right-leave-active {
  transition: transform 0.35s ease-out;
}
.slide-right-enter-from {
  transform: translateX(100%);
}
.slide-right-enter-to {
  transform: translateX(0);
}
.slide-right-leave-from {
  transform: translateX(0);
}
.slide-right-leave-to {
  transform: translateX(-100%);
}
</style>
