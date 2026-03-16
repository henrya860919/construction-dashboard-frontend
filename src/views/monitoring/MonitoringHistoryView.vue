<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import MonitoringMetricsView from '@/views/monitoring/MonitoringMetricsView.vue'
import MonitoringAlertsView from '@/views/monitoring/MonitoringAlertsView.vue'
import MonitoringMediaView from '@/views/monitoring/MonitoringMediaView.vue'

const TAB_VALUES = ['metrics', 'alerts', 'media'] as const
type TabValue = (typeof TAB_VALUES)[number]

const route = useRoute()
const router = useRouter()

const tabFromQuery = (): TabValue => {
  const q = route.query.tab as string | undefined
  if (q && TAB_VALUES.includes(q as TabValue)) return q as TabValue
  return 'metrics'
}

const activeTab = ref<TabValue>(tabFromQuery())

watch(
  () => route.query.tab,
  (q) => {
    if (q && TAB_VALUES.includes(q as TabValue)) activeTab.value = q as TabValue
  }
)

function onTabChange(value: string | number) {
  const s = String(value)
  if (TAB_VALUES.includes(s as TabValue)) {
    activeTab.value = s as TabValue
    router.replace({
      path: route.path,
      query: { ...route.query, tab: s },
    })
  }
}
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold text-foreground">歷史數據</h1>
    <p class="text-sm text-muted-foreground">
      查詢監測歷史數據、警報紀錄與影像；依分頁切換並使用各分頁的篩選條件。
    </p>

    <Tabs :model-value="activeTab" class="w-full" @update:model-value="onTabChange">
      <TabsList class="grid w-full max-w-md grid-cols-3">
        <TabsTrigger value="metrics">歷史數據</TabsTrigger>
        <TabsTrigger value="alerts">歷史警報</TabsTrigger>
        <TabsTrigger value="media">影像</TabsTrigger>
      </TabsList>
      <TabsContent value="metrics" class="mt-4">
        <MonitoringMetricsView embedded />
      </TabsContent>
      <TabsContent value="alerts" class="mt-4">
        <MonitoringAlertsView embedded />
      </TabsContent>
      <TabsContent value="media" class="mt-4">
        <MonitoringMediaView embedded />
      </TabsContent>
    </Tabs>
  </div>
</template>
