<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { ref, computed, h } from 'vue'
import type { MonitoringDailyRow } from '@/types'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/common/data-table'
import DataTableColumnHeader from '@/components/common/data-table/DataTableColumnHeader.vue'
import type { Column } from '@tanstack/vue-table'
import VChart from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { useRoute, RouterLink } from 'vue-router'
import { buildProjectPath } from '@/constants/routes'
import {
  Thermometer,
  Droplets,
  Gauge,
  Wind,
  CloudRain,
  Waves,
  Download,
  Upload,
} from 'lucide-vue-next'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

/** 監測項目（與儀表板一致） */
const METRICS = [
  { key: 'temperature', label: '溫度', unit: '°C', icon: Thermometer },
  { key: 'humidity', label: '濕度', unit: '%', icon: Droplets },
  { key: 'pm25', label: 'PM2.5', unit: 'µg/m³', icon: Gauge },
  { key: 'wind', label: '風速', unit: 'm/s', icon: Wind },
  { key: 'rainfall', label: '雨量', unit: 'mm', icon: CloudRain },
  { key: 'waterLevel', label: '水位', unit: 'm', icon: Waves },
] as const

defineProps<{ embedded?: boolean }>()

const route = useRoute()
const selectedKey = ref<string>(METRICS[0].key)
const selectedYear = ref<string>('2025')
const selectedMonth = ref<string>('3')

const currentMetric = computed(() =>
  METRICS.find((m) => m.key === selectedKey.value) ?? METRICS[0]
)

/** 可選年份（近三年） */
const yearOptions = computed(() => {
  const y = new Date().getFullYear()
  return [y, y - 1, y - 2]
})

/** 月份 1–12 */
const monthOptions = Array.from({ length: 12 }, (_, i) => i + 1)

/** 圖表用資料（之後改 API 取得） */
const chartData = computed(() => ({
  metricLabel: currentMetric.value.label,
  unit: currentMetric.value.unit,
  series: [] as { time: string; value: number }[],
}))

/** 圖表 ECharts option */
const chartOption = computed(() => {
  const d = chartData.value
  if (!d.series.length) return { title: { text: '無資料' } }
  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : null
        if (!p) return ''
        const idx = p.dataIndex
        const point = d.series[idx]
        return point ? `${d.series[idx].time} 日<br/>${d.metricLabel}: ${point.value} ${d.unit}` : ''
      },
    },
    grid: { left: '3%', right: '4%', bottom: '12%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: d.series.map((p) => p.time),
      axisLabel: { fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      name: d.unit,
      axisLabel: { fontSize: 10 },
      splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } },
    },
    series: [
      {
        name: d.metricLabel,
        type: 'line',
        data: d.series.map((p) => p.value),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2 },
        itemStyle: { borderWidth: 2 },
      },
    ],
  }
})

/** 列表用資料（之後改 API 取得） */
const tableRows = computed<MonitoringDailyRow[]>(() => [])

/** DataTable 欄位定義：日期、最高、最低、平均（標題依當前監測項目與單位） */
const dataTableColumns = computed<ColumnDef<MonitoringDailyRow, unknown>[]>(() => {
  const label = currentMetric.value.label
  const unit = currentMetric.value.unit
  return [
    {
      accessorKey: 'date',
      header: ({ column }) =>
        h(DataTableColumnHeader, {
          column: column as Column<unknown, unknown>,
          title: '日期',
        }),
      cell: ({ row }) =>
        h('div', { class: 'font-medium text-foreground' }, row.getValue('date') as string),
    },
    {
      accessorKey: 'max',
      header: ({ column }) =>
        h(DataTableColumnHeader, {
          column: column as Column<unknown, unknown>,
          title: `最高${label}（${unit}）`,
        }),
      cell: ({ row }) =>
        h('div', { class: 'text-foreground' }, String(row.getValue('max'))),
    },
    {
      accessorKey: 'min',
      header: ({ column }) =>
        h(DataTableColumnHeader, {
          column: column as Column<unknown, unknown>,
          title: `最低${label}（${unit}）`,
        }),
      cell: ({ row }) =>
        h('div', { class: 'text-foreground' }, String(row.getValue('min'))),
    },
    {
      accessorKey: 'avg',
      header: ({ column }) =>
        h(DataTableColumnHeader, {
          column: column as Column<unknown, unknown>,
          title: `平均${label}（${unit}）`,
        }),
      cell: ({ row }) =>
        h('div', { class: 'text-foreground' }, String(row.getValue('avg'))),
    },
  ]
})

/** 下載當月數據（預留，之後可接匯出 API 或 CSV 下載） */
function downloadCurrentData() {
  // TODO: 實作 CSV/Excel 下載或呼叫後端匯出 API
  console.log('下載當月數據', { metric: selectedKey.value, year: selectedYear.value, month: selectedMonth.value, rows: tableRows.value.length })
}
</script>

<template>
  <div class="space-y-6">
    <!-- 工具列：篩選條件（監測項目、年份、月份）+ 上傳數據 -->
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex flex-wrap items-center gap-3">
        <template v-if="!embedded">
          <h1 class="text-xl font-semibold text-foreground shrink-0">歷史數據</h1>
        </template>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground shrink-0">監測項目</span>
          <Select v-model="selectedKey">
            <SelectTrigger class="w-[120px]">
              <SelectValue placeholder="選擇項目" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="m in METRICS"
                :key="m.key"
                :value="m.key"
              >
                <span class="flex items-center gap-2">
                  <component :is="m.icon" class="size-4 shrink-0" />
                  {{ m.label }}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground shrink-0">年份</span>
          <Select v-model="selectedYear">
            <SelectTrigger class="w-[100px]">
              <SelectValue placeholder="年份" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="y in yearOptions"
                :key="y"
                :value="String(y)"
              >
                {{ y }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-sm text-muted-foreground shrink-0">月份</span>
          <Select v-model="selectedMonth">
            <SelectTrigger class="w-[100px]">
              <SelectValue placeholder="月份" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="mo in monthOptions"
                :key="mo"
                :value="String(mo)"
              >
                {{ mo }} 月
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        class="gap-2 shrink-0"
        as-child
      >
        <RouterLink :to="buildProjectPath((route.params.projectId as string) ?? '', '/monitoring/upload')">
          <Upload class="size-4" />
          上傳數據
        </RouterLink>
      </Button>
    </div>

    <!-- 趨勢圖表 -->
    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="text-base">趨勢圖表</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="h-[300px] w-full">
          <VChart
            :option="chartOption"
            autoresize
            class="h-full w-full min-h-[260px]"
          />
        </div>
      </CardContent>
    </Card>

    <!-- 第三層：列表資料 - DataTable，以日為單位，可排序／分頁，預留下載 -->
    <Card>
      <CardHeader class="flex flex-row flex-wrap items-center justify-between gap-4 pb-2">
        <CardTitle class="text-base">
          {{ currentMetric.label }} 每日數據（{{ selectedYear }} 年 {{ selectedMonth }} 月）
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          class="gap-2"
          @click="downloadCurrentData"
        >
          <Download class="size-4" />
          下載當月數據
        </Button>
      </CardHeader>
      <CardContent>
        <DataTable
          :columns="dataTableColumns"
          :data="tableRows"
          :page-size="15"
          :show-view-options="false"
        />
      </CardContent>
    </Card>
  </div>
</template>
