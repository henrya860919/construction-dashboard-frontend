<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Calendar, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-vue-next'
import type { ProjectResourceItem } from '@/types/resource'
import type { GanttScaleTick, GanttScaleMode } from '@/types/gantt'
import type { ResourceUsageMap } from '@/lib/resource-schedule'

const ROW_HEIGHT = 44
const TIME_RULER_HEIGHT = 36
const TOOLBAR_ROW_HEIGHT = 36
const LEFT_WIDTH = 260

const MS_PER_DAY = 24 * 60 * 60 * 1000
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

const SCALE_OPTIONS: { value: GanttScaleMode; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '週' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
]

const props = withDefaults(
  defineProps<{
    resources: ProjectResourceItem[]
    usageMap: ResourceUsageMap
    unitLabel: string
    dateRangeStart: number
    dateRangeEnd: number
    scaleTicks: GanttScaleTick[]
    scaleMode: GanttScaleMode
    pxPerDay: number
    chartWidth: number
    dateToPx: (dateMs: number) => number
  }>(),
  {}
)

const emit = defineEmits<{
  'update:scaleMode': [value: GanttScaleMode]
  zoomIn: []
  zoomOut: []
  goToToday: []
  goToPrevPeriod: []
  goToNextPeriod: []
}>()

const scrollContainerRef = ref<HTMLElement | null>(null)
const scrollLeftVal = ref(0)

const dayColumns = computed(() => {
  const list: { dateMs: number; dateKey: string }[] = []
  let t = props.dateRangeStart
  const end = props.dateRangeEnd
  while (t <= end) {
    list.push({
      dateMs: t,
      dateKey: new Date(t).toISOString().slice(0, 10),
    })
    t += MS_PER_DAY
  }
  return list
})

/** 與下方表格一致：時間軸與格子都用「每天一欄」，寬度相同才對齊 */
const rulerContentWidth = computed(() => dayColumns.value.length * props.pxPerDay)

const todayMs = computed(() => new Date().setHours(0, 0, 0, 0))
/** 今日對應的欄位 index（以本地日期比對，與格子對齊） */
const todayColIdx = computed(() => {
  const t = new Date()
  return dayColumns.value.findIndex((col) => {
    const c = new Date(col.dateMs)
    return c.getFullYear() === t.getFullYear() && c.getMonth() === t.getMonth() && c.getDate() === t.getDate()
  })
})
const todayInRange = computed(() => todayColIdx.value >= 0)
/** 今日線 left 位置（與格子欄位對齊） */
const todayLineLeftPx = computed(() =>
  todayColIdx.value >= 0 ? todayColIdx.value * props.pxPerDay : 0
)

const visibleYearMonth = computed(() => {
  const centerMs = scrollLeftVal.value + (scrollContainerRef.value?.clientWidth ?? 0) / 2
  const pxToDate = (px: number) =>
    props.dateRangeStart + (px / props.pxPerDay) * MS_PER_DAY
  const d = new Date(pxToDate(centerMs))
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
})

function formatCellValue(value: number): string {
  if (value === 0) return '—'
  if (Number.isInteger(value)) return String(value)
  return value.toFixed(1)
}

/** 當日用量超過該資源每日容量時回傳 true（有設定 dailyCapacity 才比較） */
function isOverCapacity(res: ProjectResourceItem, dateKey: string): boolean {
  if (res.dailyCapacity == null || res.dailyCapacity <= 0) return false
  const usage = props.usageMap.get(res.id)?.get(dateKey) ?? 0
  return usage > res.dailyCapacity
}

function updateScroll() {
  const el = scrollContainerRef.value
  if (el) scrollLeftVal.value = el.scrollLeft
}

onMounted(() => {
  nextTick(() => {
    const el = scrollContainerRef.value
    if (el) {
      el.addEventListener('scroll', updateScroll)
    }
    // 進入排班表時直接捲到「今天」並置中（延遲一幀讓 Tab 內容寬度就緒）
    requestAnimationFrame(() => {
      scrollToToday()
    })
  })
})

function scrollToToday() {
  nextTick(() => {
    const el = scrollContainerRef.value
    if (!el) return
    const todayPx = props.dateToPx(todayMs.value)
    const viewportW = el.clientWidth
    const maxScroll = Math.max(0, rulerContentWidth.value - viewportW)
    el.scrollLeft = Math.max(0, Math.min(maxScroll, todayPx - viewportW / 2))
  })
}

function scrollBy(dx: number) {
  const el = scrollContainerRef.value
  if (!el) return
  el.scrollLeft = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, el.scrollLeft + dx))
}

function getViewportWidth(): number {
  return scrollContainerRef.value?.clientWidth ?? 400
}

function getScrollLeft(): number {
  return scrollContainerRef.value?.scrollLeft ?? 0
}

function setScrollLeft(value: number) {
  const el = scrollContainerRef.value
  if (!el) return
  const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
  el.scrollLeft = Math.max(0, Math.min(maxScroll, value))
}

defineExpose({
  scrollToToday,
  scrollBy,
  getViewportWidth,
  getScrollLeft,
  setScrollLeft,
})
</script>

<template>
  <div class="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
    <div class="flex min-h-0 flex-1 flex-col">
      <!-- 表頭列：左側資源表頭 + 右側工具列與時間尺 -->
      <div class="flex shrink-0 flex-row border-b border-border">
        <!-- 左表頭 -->
        <div
          class="flex shrink-0 flex-col border-r-2 border-border bg-card"
          :style="{ width: LEFT_WIDTH + 'px', minHeight: TOOLBAR_ROW_HEIGHT + TIME_RULER_HEIGHT + 'px' }"
        >
          <div
            class="flex shrink-0 items-center border-b border-border px-3"
            :style="{ height: TOOLBAR_ROW_HEIGHT + 'px' }"
          >
            <span class="text-sm font-medium text-foreground">資源列表</span>
          </div>
          <Table :scroll-container="false">
            <TableHeader>
              <TableRow class="hover:bg-transparent border-0 bg-muted/30">
                <TableHead class="text-muted-foreground text-xs font-semibold">資源名稱</TableHead>
                <TableHead class="text-muted-foreground w-20 text-xs font-semibold">單位</TableHead>
                <TableHead class="text-muted-foreground w-24 text-right text-xs font-semibold">每日容量</TableHead>
              </TableRow>
            </TableHeader>
          </Table>
        </div>
        <div class="w-2 shrink-0 border-r border-border bg-muted/50" aria-hidden="true" />
        <!-- 右側：工具列 + 時間尺 -->
        <div class="relative z-10 flex min-w-0 flex-1 flex-col border-border bg-card/80">
          <div
            class="flex shrink-0 items-center justify-between gap-3 border-b border-border px-2 text-sm"
            :style="{ height: TOOLBAR_ROW_HEIGHT + 'px' }"
          >
            <span class="shrink-0 font-medium tabular-nums text-foreground">
              {{ visibleYearMonth.year }}年 {{ visibleYearMonth.month }}月
            </span>
            <div class="flex items-center gap-3">
              <Label class="text-muted-foreground text-xs">尺度</Label>
              <Select
                size="sm"
                :model-value="scaleMode"
                @update:model-value="(v) => emit('update:scaleMode', v as GanttScaleMode)"
              >
                <SelectTrigger class="h-7 w-[80px]">
                  <SelectValue placeholder="尺度" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="opt in SCALE_OPTIONS" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <div class="flex items-center gap-0.5">
                <Button variant="outline" size="icon" class="h-7 w-7" @click="emit('zoomIn')">
                  <ZoomIn class="size-3.5" />
                </Button>
                <Button variant="outline" size="icon" class="h-7 w-7" @click="emit('zoomOut')">
                  <ZoomOut class="size-3.5" />
                </Button>
              </div>
              <div class="flex items-center rounded-md border border-border">
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7 shrink-0 rounded-r-none"
                  title="上一段"
                  aria-label="上一段"
                  @click="emit('goToPrevPeriod')"
                >
                  <ChevronLeft class="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  class="h-7 shrink-0 rounded-none border-x border-border px-2 text-xs"
                  title="捲動至今天"
                  @click="scrollToToday(); emit('goToToday')"
                >
                  <Calendar class="mr-1 size-3.5" />
                  今天
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7 rounded-l-none"
                  title="下一段"
                  aria-label="下一段"
                  @click="emit('goToNextPeriod')"
                >
                  <ChevronRight class="size-3.5" />
                </Button>
              </div>
            </div>
          </div>
          <!-- 時間軸表頭：與下方表格同為「每天一欄」，週/月尺度也對齊；上列日期、下列星期 -->
          <div
            class="flex shrink-0 flex-col overflow-hidden border-b border-border"
            :style="{ height: TIME_RULER_HEIGHT + 'px' }"
          >
            <div
              class="will-change-transform"
              :style="{
                width: rulerContentWidth + 'px',
                minWidth: rulerContentWidth + 'px',
                transform: `translate3d(${-scrollLeftVal}px, 0, 0)`,
              }"
            >
              <div class="relative flex shrink-0 flex-col overflow-hidden bg-background" :style="{ height: TIME_RULER_HEIGHT + 'px' }">
                <template v-for="(col, colIdx) in dayColumns" :key="'ruler-' + col.dateKey">
                  <div
                    class="absolute inset-y-0 flex flex-col items-center justify-center border-r border-border/70 px-0.5 text-center"
                    :class="
                      colIdx === todayColIdx
                        ? 'bg-primary text-primary-foreground'
                        : [0, 6].includes(new Date(col.dateMs).getDay())
                          ? 'bg-muted/60'
                          : 'bg-background'
                    "
                    :style="{
                      left: colIdx * pxPerDay + 'px',
                      width: pxPerDay + 'px',
                    }"
                  >
                    <span class="text-xs font-semibold tabular-nums">{{ new Date(col.dateMs).getDate() }}</span>
                    <span
                      class="text-[10px] font-medium tabular-nums"
                      :class="colIdx === todayColIdx ? 'text-primary-foreground/90' : 'text-muted-foreground'"
                    >
                      {{ WEEKDAY_LABELS[new Date(col.dateMs).getDay()] }}
                    </span>
                  </div>
                </template>
                <div
                  v-if="todayInRange"
                  class="pointer-events-none absolute inset-y-0 w-px bg-primary"
                  :style="{ left: todayLineLeftPx + 'px' }"
                  title="今日"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 主體：左表 + 右側格子（同一垂直捲動；下方延伸填滿視窗） -->
      <div
        class="flex min-h-0 flex-1 flex-row items-stretch overflow-y-auto overflow-x-hidden"
      >
        <!-- 左表：資源列 + 下方延伸 -->
        <div
          class="flex min-h-full shrink-0 flex-col overflow-x-hidden border-r-2 border-border bg-card"
          :style="{ width: LEFT_WIDTH + 'px' }"
        >
          <Table :scroll-container="false">
            <TableBody>
              <TableRow
                v-for="res in resources"
                :key="res.id"
                :style="{ height: ROW_HEIGHT + 'px' }"
              >
                <TableCell class="text-sm font-medium text-foreground">
                  {{ res.name }}
                </TableCell>
                <TableCell class="text-muted-foreground text-xs">
                  {{ res.unit }}
                </TableCell>
                <TableCell class="text-right text-xs tabular-nums text-muted-foreground">
                  {{ res.dailyCapacity != null ? res.dailyCapacity : '—' }}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div
            class="min-h-0 flex-1 border-t border-border bg-muted/25"
            aria-hidden="true"
          />
        </div>
        <div class="w-2 shrink-0 self-stretch border-r border-border bg-muted/50" aria-hidden="true" />
        <!-- 右側：時間軸格子（橫向捲動），下方同色延伸 -->
        <div
          ref="scrollContainerRef"
          class="relative flex min-h-full min-w-0 flex-1 flex-col overflow-x-auto overflow-y-hidden bg-muted/40 [scrollbar-width:thin]"
        >
          <div
            class="flex min-h-full min-w-0 flex-col bg-muted/40"
            :style="{
              width: rulerContentWidth + 'px',
              minWidth: rulerContentWidth + 'px',
            }"
          >
            <div class="relative shrink-0">
              <div
                class="grid border-0"
                :style="{
                  gridTemplateRows: `repeat(${resources.length}, ${ROW_HEIGHT}px)`,
                  gridTemplateColumns: `repeat(${dayColumns.length}, ${pxPerDay}px)`,
                  width: dayColumns.length * pxPerDay + 'px',
                }"
              >
                <template v-for="(res, rowIdx) in resources" :key="res.id">
                  <template v-for="(col, cIdx) in dayColumns" :key="col.dateKey">
                    <div
                      class="flex items-center justify-center border-b border-r border-border/60 px-0.5 text-center"
                      :class="[
                        isOverCapacity(res, col.dateKey)
                          ? 'bg-destructive/15'
                          : [0, 6].includes(new Date(col.dateMs).getDay())
                            ? 'bg-muted/40'
                            : 'bg-card',
                      ]"
                      :style="{
                        gridRow: rowIdx + 1,
                        gridColumn: cIdx + 1,
                      }"
                    >
                      <span
                        class="text-xs tabular-nums"
                        :class="
                          isOverCapacity(res, col.dateKey)
                            ? 'text-destructive font-medium'
                            : 'text-foreground'
                        "
                      >
                        {{ formatCellValue(usageMap.get(res.id)?.get(col.dateKey) ?? 0) }}
                      </span>
                    </div>
                  </template>
                </template>
              </div>
            </div>
            <div class="min-h-0 min-w-full flex-1 bg-muted/40" aria-hidden="true" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
