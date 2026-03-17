<script setup lang="ts">
import type { Ref, ComputedRef } from 'vue'
import { ref, computed, unref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type {
  GanttTask,
  GanttLeftColumnItem,
  GanttMilestoneLine,
  GanttTaskSchedule,
  GanttScaleTick,
  GanttScaleMode,
} from '@/types/gantt'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronRight,
  ChevronDown,
  GripVertical,
  ZoomIn,
  ZoomOut,
  Calendar,
  ChevronLeft,
  Flag,
} from 'lucide-vue-next'

const ROW_HEIGHT = 48
/** 左側表頭與右側（工具列＋里程碑列＋時間軸）總高度一致，下方資料列才能對齊 */
const TOOLBAR_ROW_HEIGHT = 36
/** 時間軸上方一行：預留給里程碑垂直線＋badge/flag 標記 */
const MILESTONE_ROW_HEIGHT = 22
const TIME_RULER_HEIGHT = 32
const HEADER_TOTAL_HEIGHT = TOOLBAR_ROW_HEIGHT + MILESTONE_ROW_HEIGHT + TIME_RULER_HEIGHT
const DEFAULT_leftWidthVal = 280

type MaybeRef<T> = T | Ref<T> | ComputedRef<T>

const props = withDefaults(
  defineProps<{
    tasks: GanttTask[]
    /** 左欄收合／拖移用（有則顯示 chevron + 拖移把手，與 WBS 一致） */
    leftColumnItems?: GanttLeftColumnItem[]
    dateToPx: (dateMs: number) => number
    /** 供日尺度「可見範圍每天標籤」反算用，可選 */
    pxToDate?: (px: number) => number
    chartWidth: MaybeRef<number>
    panX: MaybeRef<number>
    pxPerDay?: MaybeRef<number>
    /** 六、日區段（px）用於灰色背景 */
    weekendRanges?: { leftPx: number; widthPx: number }[]
    /** 左側任務列寬度（可與 resizable 搭配） */
    leftWidth?: number
    criticalPathMap: MaybeRef<Map<string, Pick<GanttTaskSchedule, 'isCritical'>>>
    scaleTicks: MaybeRef<GanttScaleTick[]>
    /** 日/週尺度時用「每天一刀」畫網格，月/年用刻度畫 */
    scaleMode?: MaybeRef<'day' | 'week' | 'month' | 'year'>
    showActualPlan: boolean
    showCriticalPath: boolean
    showTodayLine: boolean
    showMilestoneLines: boolean
    milestoneLines: GanttMilestoneLine[]
    showAssignee: boolean
    showProgress: boolean
  }>(),
  {
    leftColumnItems: () => [],
    pxToDate: () => () => 0,
    pxPerDay: () => 24,
    weekendRanges: () => [],
    scaleMode: () => 'week',
    showActualPlan: true,
    showCriticalPath: false,
    showTodayLine: true,
    showMilestoneLines: true,
    showAssignee: true,
    showProgress: true,
    leftWidth: DEFAULT_leftWidthVal,
  }
)

const leftWidthVal = computed(() => props.leftWidth ?? DEFAULT_leftWidthVal)

const chartWidthVal = computed(() => unref(props.chartWidth))
const pxPerDayVal = computed(() => unref(props.pxPerDay) ?? 24)
const criticalPathMapVal = computed(() => unref(props.criticalPathMap))
const scaleTicksVal = computed(() => unref(props.scaleTicks))
const weekendRangesVal = computed(() => props.weekendRanges ?? [])

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

const SCALE_OPTIONS: { value: GanttScaleMode; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'week', label: '週' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
]
const scrollLeftVal = ref(0)
const viewportWidthVal = ref(400)

/** 日尺度時：依可見範圍產生「每天」刻度（每天上面日期+星期），避免整條軸上萬個 DOM */
const visibleDayTicks = computed((): GanttScaleTick[] | null => {
  if (scaleModeVal.value !== 'day' || !props.pxToDate) return null
  const startMs = props.pxToDate(scrollLeftVal.value)
  const endMs = props.pxToDate(scrollLeftVal.value + viewportWidthVal.value)
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  const ticks: GanttScaleTick[] = []
  const dStart = new Date(startMs)
  dStart.setHours(0, 0, 0, 0)
  let t = dStart.getTime()
  const endDay = new Date(endMs)
  endDay.setHours(23, 59, 59, 999)
  const endDayStart = new Date(endDay)
  endDayStart.setHours(0, 0, 0, 0)
  const endMsStart = endDayStart.getTime()
  while (t <= endMsStart + MS_PER_DAY) {
    const d = new Date(t)
    ticks.push({
      dateMs: t,
      labelYear: `${d.getFullYear()}`,
      labelMonth: `${d.getMonth() + 1}月`,
      labelDay: `${d.getDate()}`,
      labelWeekday: WEEKDAY_LABELS[d.getDay()],
    })
    t += MS_PER_DAY
  }
  return ticks.length > 0 ? ticks : null
})

/** 時間軸標籤用：日尺度且有 pxToDate 時用「可見範圍每天」，否則用傳入的 scaleTicks */
const timeRulerTicks = computed(() => visibleDayTicks.value ?? scaleTicksVal.value)

const scaleModeVal = computed(() => unref(props.scaleMode))
/** 日/週尺度：每天一刀（網格線每 pxPerDay 畫一條）；月/年用刻度線 */
const useDailyGrid = computed(() => scaleModeVal.value === 'day' || scaleModeVal.value === 'week')

/** 每天一刀的垂直線 SVG path d（圖表區網格，加深線條） */
const dailyGridPathD = computed(() => {
  if (!useDailyGrid.value) return ''
  const px = pxPerDayVal.value
  const w = chartWidthVal.value
  const h = displayedTasks.value.length * ROW_HEIGHT
  const parts: string[] = []
  for (let x = 0; x <= w; x += px) {
    parts.push(`M ${x} 0 V ${h}`)
  }
  return parts.join(' ')
})

/** 圖表區水平網格線（每列底邊，加深以利辨識） */
const chartHorizontalGridPathD = computed(() => {
  const w = chartWidthVal.value
  const n = displayedTasks.value.length
  const parts: string[] = []
  for (let i = 0; i <= n; i++) {
    const y = i * ROW_HEIGHT
    parts.push(`M 0 ${y} H ${w}`)
  }
  return parts.join(' ')
})

const emit = defineEmits<{
  pan: [dx: number]
  zoomIn: []
  zoomOut: []
  goToToday: []
  goToPrevPeriod: []
  goToNextPeriod: []
  'update:scaleMode': [value: 'day' | 'week' | 'month' | 'year']
  toggleExpand: [id: string]
  moveNode: [nodeId: string, insertBeforeIndex: number]
  'update:task': [task: GanttTask]
  'update:leftWidth': [newWidth: number]
  'update:visibleYearMonth': [value: { year: number; month: number } | null]
}>()

/** 可見區域中心對應的年月，供工具列顯示；捲動時自動更新 */
const visibleYearMonth = computed((): { year: number; month: number } | null => {
  const pxToDate = props.pxToDate
  if (!pxToDate) return null
  const centerPx = scrollLeftVal.value + viewportWidthVal.value / 2
  const ms = pxToDate(centerPx)
  const d = new Date(ms)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
})
watch(visibleYearMonth, (v) => emit('update:visibleYearMonth', v), { immediate: true })

/** 實際用於圖表與左欄的任務順序（有 leftColumnItems 時用其 task 列表） */
const displayedTasks = computed(() => {
  const items = props.leftColumnItems
  if (items?.length) return items.map((x) => x.task)
  return props.tasks
})

const resizing = ref(false)
const resizeStartX = ref(0)
const resizeStartWidth = ref(0)

function onResizePointerDown(e: MouseEvent) {
  e.preventDefault()
  resizing.value = true
  resizeStartX.value = e.clientX
  resizeStartWidth.value = leftWidthVal.value
}

function onResizePointerMove(e: MouseEvent) {
  if (!resizing.value) return
  const dx = e.clientX - resizeStartX.value
  const newWidth = Math.max(200, Math.min(520, resizeStartWidth.value + dx))
  emit('update:leftWidth', newWidth)
}

function onResizePointerUp() {
  resizing.value = false
}

function onDocMousemove(e: MouseEvent) {
  onBarPointerMove(e)
  onResizePointerMove(e)
}
function onDocMouseup() {
  onDocMouseUp()
  onResizePointerUp()
}
function updateScrollAndViewport() {
  const el = scrollContainerRef.value
  if (el) {
    scrollLeftVal.value = el.scrollLeft
    viewportWidthVal.value = el.clientWidth
  }
}

let scrollResizeCleanup: (() => void) | null = null
onMounted(() => {
  document.addEventListener('mousemove', onDocMousemove)
  document.addEventListener('mouseup', onDocMouseup)
  nextTick(() => {
    const el = scrollContainerRef.value
    if (el) {
      updateScrollAndViewport()
      el.addEventListener('scroll', updateScrollAndViewport)
      const ro = new ResizeObserver(updateScrollAndViewport)
      ro.observe(el)
      scrollResizeCleanup = () => {
        el.removeEventListener('scroll', updateScrollAndViewport)
        ro.disconnect()
      }
    }
  })
})
onUnmounted(() => {
  document.removeEventListener('mousemove', onDocMousemove)
  document.removeEventListener('mouseup', onDocMouseup)
  scrollResizeCleanup?.()
})

const scrollContainerRef = ref<HTMLElement | null>(null)

/** 筆電觸控板只支援水平滑動，不支援垂直縮放（縮放請用工具列按鈕） */
function onWheel(e: WheelEvent) {
  const el = scrollContainerRef.value
  if (!el) return
  if (e.deltaX !== 0) {
    e.preventDefault()
    el.scrollLeft += e.deltaX
  }
  // 不處理 deltaY：觸控板垂直滑動不觸發縮放，避免誤觸
}

const isPanning = ref(false)
const panStartClientX = ref(0)
const panStartScrollLeft = ref(0)

function parseDate(d: string): number {
  return new Date(d).setHours(0, 0, 0, 0)
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
/** 工期（天）：由計劃開始～結束計算 */
function durationDays(task: GanttTask): number {
  const start = parseDate(task.plannedStart)
  const end = parseDate(task.plannedEnd)
  return Math.max(1, Math.round((end - start) / MS_PER_DAY))
}
/** 左欄顯示用：YYYY/M/D */
function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

const todayMs = computed(() => new Date().setHours(0, 0, 0, 0))
const todayInRange = computed(() => {
  const list = displayedTasks.value
  const first = list[0]
  if (!first) return false
  const start = parseDate(first.plannedStart)
  const end = parseDate(list[list.length - 1]?.plannedEnd ?? first.plannedEnd)
  return (
    todayMs.value >= start - 7 * 24 * 60 * 60 * 1000 &&
    todayMs.value <= end + 7 * 24 * 60 * 60 * 1000
  )
})

function onChartPointerDown(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('[data-gantt-bar]')) return
  isPanning.value = true
  panStartClientX.value = e.clientX
  panStartScrollLeft.value = scrollContainerRef.value?.scrollLeft ?? 0
}

function onChartPointerMove(e: MouseEvent) {
  if (!isPanning.value || !scrollContainerRef.value) return
  const dx = e.clientX - panStartClientX.value
  scrollContainerRef.value.scrollLeft = Math.max(0, panStartScrollLeft.value - dx)
}

function onChartPointerUp() {
  isPanning.value = false
}

/** 捲動至「今天」並置中（供工具列「今天」按鈕呼叫） */
function scrollToToday() {
  nextTick(() => {
    const el = scrollContainerRef.value
    if (!el) return
    const todayPx = toPx(todayMs.value)
    const viewportW = el.clientWidth
    const maxScroll = Math.max(0, chartWidthVal.value - viewportW)
    const target = Math.max(0, Math.min(maxScroll, todayPx - viewportW / 2))
    el.scrollLeft = target
  })
}

/** 橫向捲動一段距離（供前/後段按鈕） */
function scrollBy(dx: number) {
  nextTick(() => {
    const el = scrollContainerRef.value
    if (!el) return
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
    el.scrollLeft = Math.max(0, Math.min(maxScroll, el.scrollLeft + dx))
  })
}

function getViewportWidth(): number {
  return scrollContainerRef.value?.clientWidth ?? 400
}

function getScrollLeft(): number {
  return scrollContainerRef.value?.scrollLeft ?? 0
}

function setScrollLeft(value: number) {
  const el = scrollContainerRef.value
  if (el) {
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth)
    el.scrollLeft = Math.max(0, Math.min(maxScroll, value))
  }
}

defineExpose({ scrollToToday, scrollBy, getViewportWidth, getScrollLeft, setScrollLeft })

/** 曲線控制點水平偏移（貝茲曲線），讓關聯線不要死板直線 */
const DEPENDENCY_CURVE_OFFSET = 36

// 依賴線：從前置任務結束到當前任務開始，使用貝茲曲線 path
const dependencyPaths = computed(() => {
  const list = displayedTasks.value
  const paths: { fromX: number; fromY: number; toX: number; toY: number; pathD: string }[] = []
  const taskIndex = new Map(list.map((t, i) => [t.id, i]))
  for (const task of list) {
    const toIdx = taskIndex.get(task.id) ?? 0
    const toStart = toPx(parseDate(task.plannedStart))
    const toY = toIdx * ROW_HEIGHT + ROW_HEIGHT / 2
    for (const depId of task.dependencies ?? []) {
      const fromIdx = taskIndex.get(depId)
      if (fromIdx === undefined) continue
      const fromTask = list[fromIdx]
      const fromEnd = toPx(parseDate(fromTask.plannedEnd))
      const fromY = fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2
      const dx = Math.min(DEPENDENCY_CURVE_OFFSET, Math.max(0, (toStart - fromEnd) / 2))
      const c1x = fromEnd + dx
      const c2x = toStart - dx
      const pathD = `M ${fromEnd} ${fromY} C ${c1x} ${fromY}, ${c2x} ${toY}, ${toStart} ${toY}`
      paths.push({ fromX: fromEnd, fromY, toX: toStart, toY, pathD })
    }
  }
  return paths
})

function toPx(dateMs: number): number {
  return props.dateToPx(dateMs)
}

// 拖曳任務條：簡化版只做移動（整條平移）
const draggingTask = ref<GanttTask | null>(null)
const dragStartX = ref(0)
const dragStartPlannedStart = ref('')

function onBarPointerDown(e: MouseEvent, task: GanttTask) {
  e.stopPropagation()
  draggingTask.value = task
  dragStartX.value = e.clientX
  dragStartPlannedStart.value = task.plannedStart
}

function onBarPointerMove(e: MouseEvent) {
  if (!draggingTask.value) return
  const dx = e.clientX - dragStartX.value
  const days = Math.round(dx / pxPerDayVal.value)
  if (days === 0) return
  const start = new Date(dragStartPlannedStart.value)
  start.setDate(start.getDate() + days)
  const dur =
    (new Date(draggingTask.value.plannedEnd).getTime() -
      new Date(draggingTask.value.plannedStart).getTime()) /
    (24 * 60 * 60 * 1000)
  const end = new Date(start)
  end.setDate(end.getDate() + dur)
  const updated: GanttTask = {
    ...draggingTask.value,
    plannedStart: start.toISOString().slice(0, 10),
    plannedEnd: end.toISOString().slice(0, 10),
  }
  emit('update:task', updated)
  dragStartX.value = e.clientX
  dragStartPlannedStart.value = updated.plannedStart
}

function onDocMouseUp() {
  if (draggingTask.value) draggingTask.value = null
  isPanning.value = false
}

// ----- 左欄 WBS 收合／拖移（與 WBS 頁面一致） -----
const leftColumnBodyRef = ref<HTMLElement | null>(null)
const draggingItemId = ref<string | null>(null)
const dropInsertBeforeIndex = ref<number | null>(null)

function getLeftColumnRowRects(): { index: number; top: number; height: number }[] {
  const el = leftColumnBodyRef.value
  if (!el) return []
  const rows = el.querySelectorAll<HTMLElement>('[data-flat-index]')
  return Array.from(rows).map((tr) => ({
    index: Number(tr.dataset.flatIndex),
    top: tr.getBoundingClientRect().top,
    height: tr.getBoundingClientRect().height,
  }))
}

function hitTestInsertIndex(clientY: number): number | null {
  const rects = getLeftColumnRowRects()
  if (!rects.length) return null
  for (let i = 0; i < rects.length; i++) {
    const { top, height } = rects[i]
    const mid = top + height / 2
    if (clientY < mid) return rects[i].index
  }
  return rects[rects.length - 1].index + 1
}

function onDragHandlePointerDown(e: PointerEvent, item: GanttLeftColumnItem) {
  if ((e.target as HTMLElement).closest('button')) return
  e.preventDefault()
  const handleEl = e.currentTarget as HTMLElement
  handleEl.setPointerCapture(e.pointerId)
  draggingItemId.value = item.task.id
  dropInsertBeforeIndex.value = null

  function onMove(ev: PointerEvent) {
    const idx = hitTestInsertIndex(ev.clientY)
    const list = props.leftColumnItems ?? []
    const currentIdx = list.findIndex((it) => it.task.id === item.task.id)
    if (idx !== null && idx !== currentIdx && idx !== currentIdx + 1) {
      dropInsertBeforeIndex.value = idx
    } else {
      dropInsertBeforeIndex.value = null
    }
  }
  function onUp(ev: PointerEvent) {
    const insertIdx = dropInsertBeforeIndex.value
    if (insertIdx !== null) {
      emit('moveNode', item.task.id, insertIdx)
    }
    draggingItemId.value = null
    dropInsertBeforeIndex.value = null
    handleEl.removeEventListener('pointermove', onMove as (e: Event) => void)
    handleEl.removeEventListener('pointerup', onUp as (e: Event) => void)
    handleEl.removeEventListener('pointercancel', onUp as (e: Event) => void)
    try {
      handleEl.releasePointerCapture(ev.pointerId)
    } catch {
      // ignore
    }
  }
  handleEl.addEventListener('pointermove', onMove as (e: Event) => void)
  handleEl.addEventListener('pointerup', onUp as (e: Event) => void)
  handleEl.addEventListener('pointercancel', onUp as (e: Event) => void)
}
</script>

<template>
  <!-- 固定寬度容器：不讓甘特圖撐開整頁，橫向捲動僅發生在圖表區內 -->
  <div class="flex flex-col rounded-lg border border-border bg-card min-w-0 overflow-hidden">
    <div class="flex min-h-0 max-h-[536px]">
      <!-- 左欄：與 WBS 同款 Table 元件（任務名稱｜工期｜開始時間｜完成時間） -->
      <div
        class="flex shrink-0 flex-col border-r-2 border-border bg-card"
        :style="{ width: leftWidthVal + 'px' }"
      >
        <div
          ref="leftColumnBodyRef"
          class="min-h-0 overflow-y-auto overflow-x-hidden pb-0"
          style="max-height: 480px"
        >
          <Table>
            <TableHeader>
              <TableRow
                class="hover:bg-transparent"
                :style="{ height: HEADER_TOTAL_HEIGHT + 'px' }"
              >
                <TableHead class="text-muted-foreground text-xs font-medium align-middle"
                  >任務名稱</TableHead
                >
                <TableHead
                  class="text-muted-foreground w-[3.5rem] text-right text-xs font-medium tabular-nums align-middle"
                  >工期</TableHead
                >
                <TableHead
                  class="text-muted-foreground w-[4.5rem] text-right text-xs font-medium tabular-nums align-middle"
                  >開始時間</TableHead
                >
                <TableHead
                  class="text-muted-foreground w-[4.5rem] text-right text-xs font-medium tabular-nums align-middle"
                  >完成時間</TableHead
                >
              </TableRow>
            </TableHeader>
            <TableBody>
              <!-- 有 leftColumnItems：收合結構 + 拖移（與 WBS 一致） -->
              <template v-if="leftColumnItems?.length">
                <template v-for="(item, flatIndex) in leftColumnItems" :key="item.task.id">
                  <tr
                    v-if="dropInsertBeforeIndex === flatIndex"
                    class="pointer-events-none"
                    aria-hidden="true"
                  >
                    <td colspan="4" class="h-0 p-0 align-top">
                      <div
                        class="mx-2 rounded-full bg-primary/90 h-0.5 min-h-[2px] shadow-sm"
                        style="margin-top: -1px"
                      />
                    </td>
                  </tr>
                  <TableRow
                    :data-flat-index="flatIndex"
                    :class="{ 'opacity-40': draggingItemId === item.task.id }"
                    :style="{ height: ROW_HEIGHT + 'px' }"
                  >
                    <TableCell
                      class="py-1 pr-2 align-middle"
                      :style="{ paddingLeft: 8 + (item.task.depth ?? 0) * 28 + 'px' }"
                    >
                      <div class="flex min-w-0 items-center gap-0.5 truncate">
                        <div
                          v-if="item.hasChildren"
                          role="button"
                          tabindex="0"
                          class="flex shrink-0 cursor-pointer items-center justify-center rounded p-0.5 text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                          aria-label="展開或收合"
                          @click="emit('toggleExpand', item.task.id)"
                        >
                          <ChevronDown v-if="item.isExpanded" class="size-4" />
                          <ChevronRight v-else class="size-4" />
                        </div>
                        <span v-else class="size-5 shrink-0" aria-hidden="true" />
                        <div
                          role="button"
                          tabindex="0"
                          class="flex shrink-0 cursor-grab touch-none items-center justify-center rounded p-0.5 text-muted-foreground/60 hover:bg-muted/80 hover:text-foreground active:cursor-grabbing"
                          aria-label="拖移排序"
                          @pointerdown="onDragHandlePointerDown($event, item)"
                        >
                          <GripVertical class="size-4" />
                        </div>
                        <div class="min-w-0 flex-1 truncate">
                          <span class="truncate text-sm font-medium text-foreground">{{
                            item.task.name
                          }}</span>
                          <template v-if="showAssignee || showProgress">
                            <span class="text-muted-foreground ml-1 truncate text-xs">
                              <template v-if="showAssignee && item.task.assignee">{{
                                item.task.assignee
                              }}</template>
                              <template
                                v-if="
                                  showAssignee &&
                                  item.task.assignee &&
                                  showProgress &&
                                  item.task.progress != null
                                "
                              >
                                ·
                              </template>
                              <template v-if="showProgress && item.task.progress != null"
                                >{{ item.task.progress }}%</template
                              >
                            </span>
                          </template>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell
                      class="whitespace-nowrap py-1 pr-2 text-right text-xs tabular-nums text-muted-foreground"
                    >
                      {{ durationDays(item.task) }} 天
                    </TableCell>
                    <TableCell
                      class="whitespace-nowrap py-1 pr-2 text-right text-xs tabular-nums text-muted-foreground"
                    >
                      {{ formatDateShort(item.task.plannedStart) }}
                    </TableCell>
                    <TableCell
                      class="whitespace-nowrap py-1 pr-2 text-right text-xs tabular-nums text-muted-foreground"
                    >
                      {{ formatDateShort(item.task.plannedEnd) }}
                    </TableCell>
                  </TableRow>
                </template>
              </template>
              <!-- 無 leftColumnItems：僅任務列 -->
              <template v-else>
                <TableRow
                  v-for="task in displayedTasks"
                  :key="task.id"
                  :style="{ height: ROW_HEIGHT + 'px' }"
                >
                  <TableCell
                    class="py-1 pr-2"
                    :style="{ paddingLeft: 12 + (task.depth ?? 0) * 28 + 'px' }"
                  >
                    <span class="truncate text-sm font-medium text-foreground">{{
                      task.name
                    }}</span>
                    <template v-if="showAssignee || showProgress">
                      <span class="text-muted-foreground ml-1 truncate text-xs">
                        <template v-if="showAssignee && task.assignee">{{
                          task.assignee
                        }}</template>
                        <template
                          v-if="
                            showAssignee && task.assignee && showProgress && task.progress != null
                          "
                        >
                          ·
                        </template>
                        <template v-if="showProgress && task.progress != null"
                          >{{ task.progress }}%</template
                        >
                      </span>
                    </template>
                  </TableCell>
                  <TableCell
                    class="whitespace-nowrap py-1 pr-2 text-right text-xs tabular-nums text-muted-foreground"
                  >
                    {{ durationDays(task) }} 天
                  </TableCell>
                  <TableCell
                    class="whitespace-nowrap py-1 pr-2 text-right text-xs tabular-nums text-muted-foreground"
                  >
                    {{ formatDateShort(task.plannedStart) }}
                  </TableCell>
                  <TableCell
                    class="whitespace-nowrap py-1 pr-2 text-right text-xs tabular-nums text-muted-foreground"
                  >
                    {{ formatDateShort(task.plannedEnd) }}
                  </TableCell>
                </TableRow>
              </template>
            </TableBody>
          </Table>
        </div>
      </div>

      <!-- 可拖曳分隔線（加粗、加深以利辨識） -->
      <div
        class="w-2 shrink-0 cursor-col-resize border-l-2 border-border bg-muted/80 hover:bg-primary/30 transition-colors flex items-center justify-center"
        :class="{ 'bg-primary/40 border-primary/60': resizing }"
        aria-label="拖曳調整左側寬度"
        @mousedown="onResizePointerDown"
      >
        <div class="w-1 h-8 rounded-full bg-muted-foreground/40" />
      </div>

      <!-- 圖表區：上方釘選工具列（不隨時間軸捲動），下方橫向捲動 -->
      <div class="relative flex max-h-[536px] flex-1 min-w-0 flex-col">
        <!-- 釘選列：年月在左、其餘靠右，不隨時間軸水平移動；高度與左側表頭總和一致 -->
        <div
          class="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/80 px-2 text-sm"
          :style="{ height: TOOLBAR_ROW_HEIGHT + 'px', minHeight: TOOLBAR_ROW_HEIGHT + 'px' }"
        >
          <span v-if="visibleYearMonth" class="shrink-0 font-medium tabular-nums text-foreground">
            {{ visibleYearMonth.year }}年 {{ visibleYearMonth.month }}月
          </span>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <Label class="text-muted-foreground shrink-0 text-xs">尺度</Label>
              <Select
                size="sm"
                :model-value="scaleModeVal"
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
            </div>
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
                @click="emit('goToToday')"
              >
                <Calendar class="mr-1 size-3.5" />
                今天
              </Button>
              <Button
                variant="ghost"
                size="icon"
                class="h-7 w-7 shrink-0 rounded-l-none"
                title="下一段"
                aria-label="下一段"
                @click="emit('goToNextPeriod')"
              >
                <ChevronRight class="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
        <!-- 可橫向捲動區：時間軸＋甘特條 -->
        <div
          ref="scrollContainerRef"
          class="relative flex min-h-0 flex-1 min-w-0 flex-col overflow-x-auto overflow-y-hidden bg-muted/40"
          :class="{ 'cursor-grab': !isPanning && !draggingTask, 'cursor-grabbing': isPanning }"
          @wheel="onWheel"
          @mousedown="onChartPointerDown"
          @mousemove="onChartPointerMove"
          @mouseup="onChartPointerUp"
          @mouseleave="onChartPointerUp"
        >
          <div
            class="shrink-0"
            :style="{ width: chartWidthVal + 'px', minWidth: chartWidthVal + 'px' }"
          >
            <!-- 里程碑列：垂直線＋badge/flag 標記，預留空間 -->
            <div
              class="relative flex shrink-0 items-end justify-center overflow-hidden border-b border-border bg-background/50"
              :style="{ height: MILESTONE_ROW_HEIGHT + 'px', minHeight: MILESTONE_ROW_HEIGHT + 'px' }"
            >
              <template v-if="showMilestoneLines">
                <template v-for="ml in milestoneLines" :key="'mr-' + ml.id">
                  <!-- 垂直線（與下方時間軸、圖表區的里程碑線對齊） -->
                  <div
                    class="pointer-events-none absolute top-0 bottom-0 w-px"
                    :style="{
                      left: toPx(new Date(ml.date).setHours(0, 0, 0, 0)) + 'px',
                      backgroundColor: ml.color ?? 'var(--chart-3)',
                    }"
                  />
                  <!-- 小 badge／flag 標記 -->
                  <div
                    class="absolute flex items-center gap-0.5 rounded-md border border-border bg-card px-1.5 py-0.5 shadow-sm"
                    :style="{
                      left: toPx(new Date(ml.date).setHours(0, 0, 0, 0)) + 'px',
                      transform: 'translateX(-50%)',
                      top: '2px',
                    }"
                    :title="ml.label"
                  >
                    <Flag class="size-3 text-muted-foreground" />
                    <span class="max-w-[4rem] truncate text-[10px] font-medium text-foreground">{{ ml.label }}</span>
                  </div>
                </template>
              </template>
            </div>
            <!-- 時間線尺規：日＋星期；今日線＋今日刻度圓形高亮；無背景、高度固定以與左側表頭對齊 -->
            <div
              class="relative flex shrink-0 items-center overflow-hidden border-b border-border bg-background py-0.5"
              :style="{ height: TIME_RULER_HEIGHT + 'px', minHeight: TIME_RULER_HEIGHT + 'px' }"
            >
              <!-- 六、日灰色背景（表頭段） -->
              <div
                v-for="(range, wi) in weekendRangesVal"
                :key="'wr-' + wi"
                class="pointer-events-none absolute top-0 bottom-0 bg-muted/65"
                :style="{
                  left: range.leftPx + 'px',
                  width: range.widthPx + 'px',
                }"
              />
              <template v-for="tick in timeRulerTicks" :key="'th-' + tick.dateMs">
                <div
                  class="absolute top-0 bottom-0 border-r border-border"
                  :style="{ left: toPx(tick.dateMs) + 'px', width: '1px' }"
                />
              </template>
            <!-- 今日線：畫在「今天」格子（例如 18）的左邊界，即該格左側那條線 -->
            <div
              v-if="showTodayLine && todayInRange"
              class="pointer-events-none absolute top-0 bottom-0 w-px bg-primary"
              :style="{ left: Math.floor(toPx(todayMs)) + 'px' }"
              title="今日"
            />
              <!-- 里程碑線（表頭段：垂直線） -->
              <template v-if="showMilestoneLines">
                <div
                  v-for="ml in milestoneLines"
                  :key="'ruler-' + ml.id"
                  class="pointer-events-none absolute top-0 bottom-0 w-px"
                  :style="{
                    left: toPx(new Date(ml.date).setHours(0, 0, 0, 0)) + 'px',
                    backgroundColor: ml.color ?? 'var(--chart-3)',
                  }"
                />
              </template>
              <!-- 時間軸刻度：日＋星期置中於每日格子內 -->
              <div
                v-for="tick in timeRulerTicks"
                :key="'tl-' + tick.dateMs"
                class="absolute top-0 flex h-full w-full items-center justify-center text-[10px] font-medium tabular-nums text-muted-foreground"
                :style="{ left: toPx(tick.dateMs) + 'px', width: pxPerDayVal + 'px' }"
              >
                <span
                  class="inline-flex min-w-[2rem] items-center justify-center leading-tight px-1"
                  :class="
                    tick.dateMs === todayMs
                      ? 'rounded-full bg-primary text-primary-foreground text-[9px] font-semibold'
                      : ''
                  "
                >
                  {{ tick.labelDay }} {{ tick.labelWeekday }}
                </span>
              </div>
            </div>

            <!-- 甘特條區域（同寬、可縱向捲動） -->
            <div
              class="relative overflow-y-auto overflow-x-hidden"
              :style="{
                width: chartWidthVal + 'px',
                minWidth: chartWidthVal + 'px',
                height: displayedTasks.length * ROW_HEIGHT + 'px',
                maxHeight: '480px',
              }"
            >
              <!-- 六、日灰色背景 -->
              <div
                v-for="(range, wi) in weekendRangesVal"
                :key="'w-' + wi"
                class="pointer-events-none absolute top-0 bottom-0 bg-muted/65"
                :style="{
                  left: range.leftPx + 'px',
                  width: range.widthPx + 'px',
                }"
              />
              <!-- 圖表區網格線（垂直＋水平皆加深） -->
              <!-- 水平線：每列底邊 -->
              <svg
                class="pointer-events-none absolute left-0 top-0 border-0"
                :width="chartWidthVal"
                :height="displayedTasks.length * ROW_HEIGHT"
                aria-hidden="true"
              >
                <path
                  :d="chartHorizontalGridPathD"
                  fill="none"
                  stroke="var(--muted-foreground)"
                  stroke-opacity="0.25"
                  stroke-width="1"
                />
              </svg>
              <!-- 垂直線：日/週＝每天一刀；月/年＝刻度線 -->
              <svg
                v-if="useDailyGrid"
                class="pointer-events-none absolute left-0 top-0 border-0"
                :width="chartWidthVal"
                :height="displayedTasks.length * ROW_HEIGHT"
                aria-hidden="true"
              >
                <path
                  :d="dailyGridPathD"
                  fill="none"
                  stroke="var(--muted-foreground)"
                  stroke-opacity="0.25"
                  stroke-width="1"
                />
              </svg>
              <div v-else class="absolute inset-0 flex gap-0">
                <template v-for="(tick, i) in scaleTicksVal" :key="'g' + i">
                  <div
                    v-if="i > 0"
                    class="absolute top-0 bottom-0 border-r-2 border-border"
                    :style="{ left: toPx(tick.dateMs) + 'px', width: '2px' }"
                  />
                </template>
              </div>

            <!-- 今日線：與表頭一致，在「今天」格子左邊界 -->
            <div
              v-if="showTodayLine && todayInRange"
              class="pointer-events-none absolute top-0 bottom-0 w-px bg-primary"
              :style="{ left: Math.floor(toPx(todayMs)) + 'px' }"
              title="今日"
            />

              <!-- 使用者里程碑線（圖表區段：整條垂直線貫穿） -->
              <template v-if="showMilestoneLines">
                <div
                  v-for="ml in milestoneLines"
                  :key="ml.id"
                  class="pointer-events-none absolute top-0 bottom-0 w-px"
                  :style="{
                    left: toPx(new Date(ml.date).setHours(0, 0, 0, 0)) + 'px',
                    backgroundColor: ml.color ?? 'var(--chart-3)',
                  }"
                  :title="ml.label"
                />
              </template>

              <!-- 相依線 -->
              <svg
                class="pointer-events-none absolute left-0 top-0"
                :width="chartWidthVal"
                :height="displayedTasks.length * ROW_HEIGHT"
              >
                <defs>
                  <marker
                    id="gantt-arrow"
                    markerWidth="6"
                    markerHeight="6"
                    refX="5"
                    refY="3"
                    orient="auto"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" fill="var(--muted-foreground)" />
                  </marker>
                </defs>
                <path
                  v-for="(path, i) in dependencyPaths"
                  :key="i"
                  :d="path.pathD"
                  fill="none"
                  stroke="var(--muted-foreground)"
                  stroke-width="1"
                  stroke-dasharray="4 2"
                  marker-end="url(#gantt-arrow)"
                />
              </svg>

              <!-- 任務條 -->
              <div
                v-for="(task, idx) in displayedTasks"
                :key="task.id"
                class="absolute left-0 flex items-center"
                :style="{
                  top: idx * ROW_HEIGHT + 'px',
                  height: ROW_HEIGHT + 'px',
                  width: chartWidthVal + 'px',
                }"
              >
                <!-- 計劃條（底色） -->
                <div
                  v-if="showActualPlan"
                  data-gantt-bar
                  class="absolute h-6 rounded-md border border-border opacity-60"
                  :class="
                    showCriticalPath && criticalPathMapVal.get(task.id)?.isCritical
                      ? 'bg-destructive/20'
                      : 'bg-muted'
                  "
                  :style="{
                    left: toPx(parseDate(task.plannedStart)) + 'px',
                    width:
                      Math.max(
                        4,
                        toPx(parseDate(task.plannedEnd)) - toPx(parseDate(task.plannedStart))
                      ) + 'px',
                  }"
                  @mousedown="onBarPointerDown($event, task)"
                />
                <!-- 實際／計劃條（主條） -->
                <div
                  data-gantt-bar
                  class="absolute h-6 cursor-grab rounded-md border border-border active:cursor-grabbing"
                  :class="
                    showCriticalPath && criticalPathMapVal.get(task.id)?.isCritical
                      ? 'bg-destructive'
                      : 'bg-primary'
                  "
                  :style="{
                    left: toPx(parseDate(task.actualStart ?? task.plannedStart)) + 'px',
                    width:
                      (task.isMilestone
                        ? 0
                        : Math.max(
                            4,
                            toPx(parseDate(task.actualEnd ?? task.plannedEnd)) -
                              toPx(parseDate(task.actualStart ?? task.plannedStart))
                          )) + 'px',
                  }"
                  @mousedown="onBarPointerDown($event, task)"
                >
                  <!-- 里程碑：菱形點 -->
                  <template v-if="task.isMilestone">
                    <div
                      class="absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-primary-foreground bg-primary"
                      :class="
                        showCriticalPath && criticalPathMapVal.get(task.id)?.isCritical
                          ? 'border-destructive-foreground bg-destructive'
                          : ''
                      "
                    />
                  </template>
                  <!-- 進度％ 顯示在條內 -->
                  <template v-else-if="showProgress && task.progress > 0">
                    <div
                      class="absolute inset-y-0 left-0 rounded-l-md bg-primary-foreground/30"
                      :style="{ width: task.progress + '%' }"
                    />
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
