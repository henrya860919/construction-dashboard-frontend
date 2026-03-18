<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ResourceScheduleChart from '@/components/management/ResourceScheduleChart.vue'
import { listProjectWbs } from '@/api/wbs'
import { getProjectResources } from '@/api/resources'
import type { WbsNode } from '@/types/wbs'
import type { ProjectResourceItem, ProjectResourceType } from '@/types/resource'
import type { GanttScaleMode, GanttScaleTick } from '@/types/gantt'
import {
  aggregateResourceUsageByDay,
  getScheduleUnitLabel,
} from '@/lib/resource-schedule'
import { User, Truck, Package } from 'lucide-vue-next'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
/** 排班表顯示天數上限，避免一次渲染上萬格導致卡頓 */
const MAX_SCHEDULE_DAYS = 500

const route = useRoute()
const projectId = computed(() => route.params.projectId as string)

const activeTab = ref<ProjectResourceType>('labor')
const TAB_OPTIONS: { value: ProjectResourceType; label: string; icon: typeof User }[] = [
  { value: 'labor', label: '人', icon: User },
  { value: 'equipment', label: '機', icon: Truck },
  { value: 'material', label: '料', icon: Package },
]

const wbsTree = ref<WbsNode[]>([])
const resourcesByType = ref<Record<ProjectResourceType, ProjectResourceItem[]>>({
  labor: [],
  equipment: [],
  material: [],
})
const loading = ref(false)
const loadError = ref<string | null>(null)

function collectLeaves(nodes: WbsNode[]): WbsNode[] {
  const out: WbsNode[] = []
  for (const n of nodes) {
    if (!n.children?.length) out.push(n)
    else out.push(...collectLeaves(n.children))
  }
  return out
}

/** 排班表只用 WBS 涵蓋區間並設上限，避免 50 年範圍造成十幾萬格、載入過久 */
function getScheduleDateRange(nodes: WbsNode[]): { start: number; end: number } {
  const leaves = collectLeaves(nodes)
  let minStart: number | null = null
  let maxEnd: number | null = null
  for (const n of leaves) {
    const start = n.startDate ? new Date(n.startDate + 'T12:00:00').getTime() : null
    const end = n.endDate
      ? new Date(n.endDate + 'T12:00:00').getTime()
      : n.startDate && n.durationDays != null && n.durationDays >= 1
        ? new Date(n.startDate + 'T12:00:00').getTime() + (n.durationDays - 1) * MS_PER_DAY
        : null
    if (start != null) {
      if (minStart == null || start < minStart) minStart = start
      const e = end ?? start
      if (maxEnd == null || e > maxEnd) maxEnd = e
    }
  }
  const paddingDays = 14
  if (minStart != null && maxEnd != null) {
    const days = Math.ceil((maxEnd - minStart) / MS_PER_DAY) + 2 * paddingDays
    const capped = Math.min(MAX_SCHEDULE_DAYS, Math.max(60, days))
    const half = (capped * MS_PER_DAY) / 2
    const mid = (minStart + maxEnd) / 2
    return {
      start: Math.floor((mid - half) / MS_PER_DAY) * MS_PER_DAY,
      end: Math.ceil((mid + half) / MS_PER_DAY) * MS_PER_DAY,
    }
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const t = today.getTime()
  return { start: t, end: t + 90 * MS_PER_DAY }
}

const scheduleDateRange = computed(() => getScheduleDateRange(wbsTree.value))

/** 尺度／縮放與甘特圖一致，但日期範圍用排班專用區間以利效能 */
const scaleMode = ref<GanttScaleMode>('week')
const zoom = ref(1)

const dateRangeStart = computed(() => scheduleDateRange.value.start)
const dateRangeEnd = computed(() => scheduleDateRange.value.end)
const totalDays = computed(() =>
  Math.max(1, Math.ceil((dateRangeEnd.value - dateRangeStart.value) / MS_PER_DAY))
)
/** 依尺度切換每日格子寬度：日最寬、週/月/年遞減；與甘特圖一樣再乘 zoom 倍率 */
const pxPerDayByScale: Record<GanttScaleMode, number> = {
  day: 40,
  week: 24,
  month: 12,
  year: 4,
}
const pxPerDay = computed(() => pxPerDayByScale[scaleMode.value] * zoom.value)
const chartWidth = computed(() => Math.max(totalDays.value * pxPerDay.value, 600))

function dateToPx(dateMs: number): number {
  const days = (dateMs - dateRangeStart.value) / MS_PER_DAY
  return days * pxPerDay.value
}

function pxToDate(px: number): number {
  const days = px / pxPerDay.value
  return dateRangeStart.value + days * MS_PER_DAY
}

const scaleTicks = computed((): GanttScaleTick[] => {
  const start = dateRangeStart.value
  const end = dateRangeEnd.value
  const ticks: GanttScaleTick[] = []
  const w = (dateMs: number) => WEEKDAY_LABELS[new Date(dateMs).getDay()]

  const pushTick = (dateMs: number) => {
    const d = new Date(dateMs)
    ticks.push({
      dateMs,
      labelYear: `${d.getFullYear()}`,
      labelMonth: `${d.getMonth() + 1}月`,
      labelDay: `${d.getDate()}`,
      labelWeekday: w(dateMs),
    })
  }

  if (scaleMode.value === 'year') {
    const y0 = new Date(start).getFullYear()
    const y1 = new Date(end).getFullYear()
    for (let y = y0; y <= y1 + 1; y++) pushTick(new Date(y, 0, 1).getTime())
  } else if (scaleMode.value === 'month') {
    let d = new Date(new Date(start).getFullYear(), new Date(start).getMonth(), 1)
    while (d.getTime() <= end + 31 * MS_PER_DAY) {
      pushTick(d.getTime())
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
  } else if (scaleMode.value === 'week') {
    const weekStart = (t: number) => {
      const copy = new Date(t)
      copy.setDate(copy.getDate() - copy.getDay())
      copy.setHours(0, 0, 0, 0)
      return copy.getTime()
    }
    let t = weekStart(start)
    while (t <= end + 7 * MS_PER_DAY) {
      pushTick(t)
      t += 7 * MS_PER_DAY
    }
  } else {
    let d = new Date(start)
    const step = totalDays.value <= 90 ? 1 : totalDays.value <= 365 ? 7 : Math.max(1, Math.floor(totalDays.value / 60))
    let count = 0
    while (d.getTime() <= end + MS_PER_DAY) {
      if (count % step === 0) pushTick(d.getTime())
      d.setDate(d.getDate() + 1)
      count++
    }
  }
  return ticks
})

const currentResources = computed(() => resourcesByType.value[activeTab.value])
const usageMap = computed(() =>
  aggregateResourceUsageByDay(wbsTree.value, activeTab.value)
)
const unitLabel = computed(() => getScheduleUnitLabel(activeTab.value))

const scheduleChartRef = ref<InstanceType<typeof ResourceScheduleChart> | null>(null)

function goToToday() {
  scheduleChartRef.value?.scrollToToday?.()
}

function goToPrevPeriod() {
  const w = scheduleChartRef.value?.getViewportWidth?.() ?? 400
  scheduleChartRef.value?.scrollBy?.(-w)
}

function goToNextPeriod() {
  const w = scheduleChartRef.value?.getViewportWidth?.() ?? 400
  scheduleChartRef.value?.scrollBy?.(w)
}

/** 以當前可見範圍中心為基準縮放，與甘特圖一致 */
function zoomInAroundCenter() {
  const chart = scheduleChartRef.value
  const scrollLeft = chart?.getScrollLeft?.() ?? 0
  const viewportW = chart?.getViewportWidth?.() ?? 400
  const centerMs = pxToDate(scrollLeft + viewportW / 2)
  zoom.value = Math.min(4, zoom.value * 1.2)
  nextTick(() => {
    const newScrollLeft = dateToPx(centerMs) - viewportW / 2
    chart?.setScrollLeft?.(newScrollLeft)
  })
}

function zoomOutAroundCenter() {
  const chart = scheduleChartRef.value
  const scrollLeft = chart?.getScrollLeft?.() ?? 0
  const viewportW = chart?.getViewportWidth?.() ?? 400
  const centerMs = pxToDate(scrollLeft + viewportW / 2)
  zoom.value = Math.max(0.3, zoom.value / 1.2)
  nextTick(() => {
    const newScrollLeft = dateToPx(centerMs) - viewportW / 2
    chart?.setScrollLeft?.(newScrollLeft)
  })
}

async function loadWbs() {
  if (!projectId.value) return
  try {
    const tree = await listProjectWbs(projectId.value)
    wbsTree.value = tree ?? []
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '載入 WBS 失敗'
    wbsTree.value = []
  }
}

async function loadResources() {
  if (!projectId.value) return
  try {
    const [labor, equipment, material] = await Promise.all([
      getProjectResources(projectId.value, 'labor'),
      getProjectResources(projectId.value, 'equipment'),
      getProjectResources(projectId.value, 'material'),
    ])
    resourcesByType.value = { labor, equipment, material }
  } catch {
    resourcesByType.value = { labor: [], equipment: [], material: [] }
  }
}

async function fetchAll() {
  loading.value = true
  loadError.value = null
  try {
    await Promise.all([loadWbs(), loadResources()])
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchAll()
})
watch(projectId, () => {
  fetchAll()
})
</script>

<template>
  <div
    class="flex h-[calc(100dvh-12rem)] min-h-[24rem] flex-col gap-4 max-md:h-[calc(100dvh-10rem)]"
  >
    <div class="shrink-0 flex flex-col gap-2">
      <h1 class="text-xl font-semibold text-foreground">排班表</h1>
      <p class="text-sm text-muted-foreground">
        依資源類型檢視人／機／料在時間軸上的每日用量（人：時數；機、料：數量）。資料來自 WBS 工項的排程與資源指派。
      </p>
    </div>

    <Tabs v-model="activeTab" class="flex min-h-0 w-full flex-1 flex-col">
      <TabsList class="grid w-full max-w-md shrink-0 grid-cols-3">
        <TabsTrigger
          v-for="opt in TAB_OPTIONS"
          :key="opt.value"
          :value="opt.value"
          class="flex items-center gap-2"
        >
          <component :is="opt.icon" class="size-4" />
          {{ opt.label }}
        </TabsTrigger>
      </TabsList>

      <TabsContent
        v-for="opt in TAB_OPTIONS"
        :key="opt.value"
        :value="opt.value"
        class="mt-4 flex min-h-0 flex-1 flex-col data-[state=inactive]:hidden"
      >
        <div v-if="loading" class="flex flex-1 items-center justify-center rounded-lg border border-border bg-card py-16 text-muted-foreground">
          載入中…
        </div>
        <div v-else-if="loadError" class="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {{ loadError }}
        </div>
        <template v-else>
          <div class="flex min-h-0 flex-1 flex-col">
          <ResourceScheduleChart
            ref="scheduleChartRef"
            :resources="currentResources"
            :usage-map="usageMap"
            :unit-label="unitLabel"
            :date-range-start="dateRangeStart"
            :date-range-end="dateRangeEnd"
            :scale-ticks="scaleTicks"
            :scale-mode="scaleMode"
            :px-per-day="pxPerDay"
            :chart-width="chartWidth"
            :date-to-px="dateToPx"
            @update:scale-mode="(v) => (scaleMode = v)"
            @zoom-in="zoomInAroundCenter"
            @zoom-out="zoomOutAroundCenter"
            @go-to-today="goToToday"
            @go-to-prev-period="goToPrevPeriod"
            @go-to-next-period="goToNextPeriod"
          />
          </div>
          <p v-if="wbsTree.length === 0" class="mt-2 shrink-0 text-xs text-muted-foreground">
            尚無 WBS 或工項排程時，時間軸仍與甘特圖一致；請在 WBS 清單建立工項並設定開始日期／工期與資源後，排班格會顯示用量。
          </p>
        </template>
        <p v-if="currentResources.length === 0 && !loading" class="mt-2 shrink-0 text-xs text-muted-foreground">
          此分類尚無資源，請至「資源庫」新增後再指派至 WBS 工項。
        </p>
      </TabsContent>
    </Tabs>
  </div>
</template>
