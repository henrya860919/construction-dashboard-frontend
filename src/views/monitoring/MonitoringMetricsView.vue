<script setup lang="ts">
import type { ColumnDef } from '@tanstack/vue-table'
import { ref, computed, h } from 'vue'
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

/** 當月天數 */
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

/** 每日一筆：日期 + 當日最高、最低、平均 */
interface MonitoringDailyRow {
  date: string
  min: number
  max: number
  avg: number
}

/** 依選定年/月產生每日 mock 資料（含最高、最低、平均） */
function buildDailyMock(metricKey: string, year: number, month: number): MonitoringDailyRow[] {
  const days = getDaysInMonth(year, month)
  const base =
    metricKey === 'temperature'
      ? 28
      : metricKey === 'humidity'
        ? 65
        : metricKey === 'waterLevel'
          ? 5.5
          : 40
  const spread = metricKey === 'waterLevel' ? 0.8 : metricKey === 'temperature' ? 6 : 15
  const list: MonitoringDailyRow[] = []
  for (let d = 1; d <= days; d++) {
    const seed = year * 10000 + month * 100 + d
    const center = base + (Math.sin(seed * 0.1) * 0.5 + (seed % 7) / 7) * spread
    const daySpread = spread * 0.4
    const min = center - daySpread * (0.3 + (seed % 5) / 10)
    const max = center + daySpread * (0.3 + (seed % 7) / 10)
    const avg = (min + max) / 2
    list.push({
      date: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      min: Number(min.toFixed(1)),
      max: Number(max.toFixed(1)),
      avg: Number(avg.toFixed(1)),
    })
  }
  return list
}

/** 圖表用資料（選中年/月，以當日平均為趨勢線） */
const chartData = computed(() => {
  const y = Number(selectedYear.value) || new Date().getFullYear()
  const m = Number(selectedMonth.value) || 1
  const list = buildDailyMock(selectedKey.value, y, m)
  return {
    metricLabel: currentMetric.value.label,
    unit: currentMetric.value.unit,
    series: list.map((p) => ({ time: p.date.slice(8), value: p.avg })),
  }
})

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

/** 列表用資料（每日一筆） */
const tableRows = computed(() => {
  const y = Number(selectedYear.value) || new Date().getFullYear()
  const m = Number(selectedMonth.value) || 1
  return buildDailyMock(selectedKey.value, y, m)
})

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
        h('div', { class: 'text-right text-foreground' }, String(row.getValue('max'))),
    },
    {
      accessorKey: 'min',
      header: ({ column }) =>
        h(DataTableColumnHeader, {
          column: column as Column<unknown, unknown>,
          title: `最低${label}（${unit}）`,
        }),
      cell: ({ row }) =>
        h('div', { class: 'text-right text-foreground' }, String(row.getValue('min'))),
    },
    {
      accessorKey: 'avg',
      header: ({ column }) =>
        h(DataTableColumnHeader, {
          column: column as Column<unknown, unknown>,
          title: `平均${label}（${unit}）`,
        }),
      cell: ({ row }) =>
        h('div', { class: 'text-right text-foreground' }, String(row.getValue('avg'))),
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
    <div class="flex flex-wrap items-center justify-between gap-4">
      <h1 class="text-xl font-semibold text-foreground">歷史數據</h1>
      <Button
        variant="outline"
        size="sm"
        class="gap-2"
        as-child
      >
        <RouterLink :to="buildProjectPath((route.params.projectId as string) ?? '', '/monitoring/upload')">
          <Upload class="size-4" />
          上傳數據
        </RouterLink>
      </Button>
    </div>

    <!-- 第一層：切換層 - 監測項目 -->
    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="text-base">選擇監測項目</CardTitle>
      </CardHeader>
      <CardContent class="flex flex-wrap gap-2">
        <Button
          v-for="m in METRICS"
          :key="m.key"
          :variant="selectedKey === m.key ? 'secondary' : 'outline'"
          size="sm"
          class="gap-2"
          @click="selectedKey = m.key"
        >
          <component :is="m.icon" class="size-4 shrink-0" />
          {{ m.label }}
        </Button>
      </CardContent>
    </Card>

    <!-- 第二層：圖表層 - 年/月 + 趨勢圖 -->
    <Card>
      <CardHeader class="flex flex-row flex-wrap items-center justify-between gap-4 pb-2">
        <CardTitle class="text-base">趨勢圖表</CardTitle>
        <div class="flex flex-wrap items-center gap-3">
          <div class="flex items-center gap-2">
            <span class="text-sm text-muted-foreground">年份</span>
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
            <span class="text-sm text-muted-foreground">月份</span>
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
