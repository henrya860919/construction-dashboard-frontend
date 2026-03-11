<script setup lang="ts">
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import StateCard from '@/components/dashboard/StateCard.vue'
import TimeDisplay from '@/components/dashboard/TimeDisplay.vue'
import AlertCard from '@/components/dashboard/AlertCard.vue'
import AnimatedNumber from '@/components/common/AnimatedNumber.vue'
import { useDashboardKpi } from '@/composables/useDashboardKpi'
import { useDashboardAlerts } from '@/composables/useDashboardAlerts'
import { Calendar, TrendingUp, Wallet, Flame, Wind, Droplets } from 'lucide-vue-next'

const { projectInfo, progress, budget } = useDashboardKpi()
const { alerts } = useDashboardAlerts()
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
            <span class="text-xs text-muted-foreground">更新時間: 即時監測</span>
          </CardHeader>
          <CardContent>
            <div class="grid gap-4 sm:grid-cols-3">
              <AlertCard
                v-for="alert in alerts"
                :key="alert.id"
                :level="alert.level"
                :title="alert.title"
                :value="alert.value"
              >
                <template #icon>
                  <component
                    :is="alert.title === '熱危害' ? Flame : alert.title === '空污' ? Wind : Droplets"
                    class="size-5"
                  />
                </template>
              </AlertCard>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader class="flex flex-row items-center justify-between">
            <CardTitle>環境監測數據</CardTitle>
            <span class="text-xs text-muted-foreground">更新時間: —</span>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground">（溫度、濕度、PM2.5 等佔位）</p>
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
