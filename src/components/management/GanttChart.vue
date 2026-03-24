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
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  ChevronRight,
  ChevronDown,
  GripVertical,
  ZoomIn,
  ZoomOut,
  Calendar,
  ChevronLeft,
  Flag,
  Pencil,
  Check,
  X,
} from 'lucide-vue-next'
import GanttPredecessorCell from '@/components/management/GanttPredecessorCell.vue'
import { wbsDurationInclusiveDays, wbsEndDateInclusive } from '@/lib/wbs-schedule-dates'
import { addCalendarDays } from '@/lib/wbs-fs-schedule'

const ROW_HEIGHT = 48
/** 左表頭與右側（工具列＋里程碑＋日期尺）總高度一致 */
const TOOLBAR_ROW_HEIGHT = 36
/** 時間軸上方一行：預留給里程碑垂直線＋badge/flag 標記 */
/** 里程碑列（略縮，讓時間尺有雙列填滿） */
const MILESTONE_ROW_HEIGHT = 18
/** 時間尺：上列日＋星期、下列完整日期，避免下方空白 */
const TIME_RULER_HEIGHT = 36
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
  /** 設定某任務的前置任務 id 列表 */
  'update:dependencies': [taskId: string, predecessorIds: string[]]
  /** 從 A 的尾巴拖到 B 的開始，建立 A→B 前置關係（B 的前置含 A） */
  addDependency: [fromTaskId: string, toTaskId: string]
  'update:showCriticalPath': [value: boolean]
  'update:showMilestoneLines': [value: boolean]
  'update:showAssignee': [value: boolean]
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

/** 拖曳／縮放時只改此草稿，mouseup 才 emit，避免父層每格都打 API */
const scheduleDraftTask = ref<GanttTask | null>(null)
const scheduleDragBaseline = ref<{ id: string; start: string; end: string } | null>(null)

/** 實際用於圖表與左欄的任務順序（有 leftColumnItems 時用其 task 列表） */
const displayedTasks = computed(() => {
  const items = props.leftColumnItems
  const base = items?.length ? items.map((x) => x.task) : props.tasks
  const draft = scheduleDraftTask.value
  if (!draft) return base
  return base.map((t) => (t.id === draft.id ? { ...t, ...draft } : t))
})

/** 左欄列數與圖表列高一致，與外層 sharedScrollRef 一起垂直捲（左表不可再包一层 overflow-auto） */
const ganttBodyHeightPx = computed(() => displayedTasks.value.length * ROW_HEIGHT)

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
function onDocMouseup(e: MouseEvent) {
  onDocMouseUp(e)
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
const sharedScrollRef = ref<HTMLElement | null>(null)

/** 筆電觸控板：橫捲圖表；垂直捲動轉給左欄同層的 sharedScrollRef，才能與任務列一起上下捲 */
function onWheel(e: WheelEvent) {
  const el = scrollContainerRef.value
  const shared = sharedScrollRef.value
  if (!el) return
  if (e.deltaX !== 0) {
    e.preventDefault()
    el.scrollLeft += e.deltaX
  }
  if (e.deltaY !== 0 && shared) {
    e.preventDefault()
    shared.scrollTop += e.deltaY
  }
}

const isPanning = ref(false)
const panStartClientX = ref(0)
const panStartScrollLeft = ref(0)

function parseDate(d: string): number {
  return new Date(d).setHours(0, 0, 0, 0)
}

/** 工期（天）：含開始、結束日在內之日數 */
function durationDays(task: GanttTask): number {
  return wbsDurationInclusiveDays(task.plannedStart, task.plannedEnd)
}
/** 左欄顯示用：YYYY/M/D */
function formatDateShort(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

/** 工具提示：3月18日星期三（對齊 MS Project 風格） */
function formatDateLongZh(iso: string): string {
  const d = new Date(iso)
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()] ?? ''
  return `${d.getMonth() + 1}月${d.getDate()}日星期${w}`
}

function ganttBarTooltipLines(task: GanttTask): string[] {
  const start = task.actualStart ?? task.plannedStart
  const end = task.actualEnd ?? task.plannedEnd
  const lines = [
    task.isMilestone ? '里程碑' : '任務',
    `任務：${task.name}`,
    `開始：${formatDateLongZh(start)}`,
    `完成：${formatDateLongZh(end)}`,
  ]
  if (!task.isMilestone) {
    lines.push(`工期：${durationDays(task)}d`)
  }
  return lines
}

/** 表格內編輯：正在編輯的任務 id，非空時該列顯示輸入框 */
const editingTaskId = ref<string | null>(null)
const editPlannedStart = ref('')
const editDurationDays = ref<number | ''>('')

const editEndDate = computed(() => {
  if (
    !editPlannedStart.value ||
    editDurationDays.value === '' ||
    Number(editDurationDays.value) < 1
  )
    return ''
  return wbsEndDateInclusive(editPlannedStart.value, Number(editDurationDays.value))
})

function openEditSchedule(task: GanttTask) {
  if (task.isRollup) return
  editingTaskId.value = task.id
  editPlannedStart.value = task.plannedStart
  editDurationDays.value = durationDays(task)
}

function submitEditSchedule() {
  const task = displayedTasks.value.find((t) => t.id === editingTaskId.value)
  if (
    !task ||
    !editPlannedStart.value ||
    editDurationDays.value === '' ||
    Number(editDurationDays.value) < 1
  )
    return
  const end = editEndDate.value
  if (!end) return
  emit('update:task', {
    ...task,
    plannedStart: editPlannedStart.value,
    plannedEnd: end,
  })
  editingTaskId.value = null
}

function cancelEditSchedule() {
  editingTaskId.value = null
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

const DEP_LANE_MARGIN = 18

/** 列上長條佔用的 x 區間（依賴線垂直段不可穿過） */
function dependencyBarXRange(task: GanttTask): { L: number; R: number } {
  if (task.isMilestone) {
    const x = toPx(parseDate(task.actualStart ?? task.plannedStart))
    return { L: x - 4, R: x + 4 }
  }
  const L = toPx(parseDate(task.actualStart ?? task.plannedStart))
  const R = inclusiveBarRightPx(task.actualEnd ?? task.plannedEnd)
  if (R - L < 4) return { L: L - 2, R: R + 2 }
  return { L, R }
}

/**
 * 垂直通道 x：列 rowLo～rowHi 之間的垂直母線不可穿過中間列長條
 */
function computeDependencyLaneXBetweenRows(
  list: GanttTask[],
  rowLo: number,
  rowHi: number,
  fromEndX: number,
  chartW: number
): number {
  const lo = Math.min(rowLo, rowHi)
  const hi = Math.max(rowLo, rowHi)
  const base = fromEndX + 26
  if (hi - lo <= 1) return Math.max(base, fromEndX + 10)

  function blocked(lane: number): boolean {
    for (let k = lo + 1; k < hi; k++) {
      const { L, R } = dependencyBarXRange(list[k])
      if (lane >= L - 0.5 && lane <= R + 0.5) return true
    }
    return false
  }

  let lane = base
  for (let g = 0; g < 120 && blocked(lane); g++) {
    let next = lane
    for (let k = lo + 1; k < hi; k++) {
      const { L, R } = dependencyBarXRange(list[k])
      if (lane >= L - 0.5 && lane <= R + 0.5) {
        next = Math.max(next, R + DEP_LANE_MARGIN)
      }
    }
    lane = next
  }

  if (lane < fromEndX + 8) lane = fromEndX + 8
  if (lane > chartW + 380) {
    lane = Math.min(chartW - 12, fromEndX + 120)
    for (let g = 0; g < 80 && blocked(lane); g++) {
      lane = Math.min(lane + DEP_LANE_MARGIN, chartW + 240)
    }
  }

  return Math.max(lane, fromEndX + 10)
}

function computeDependencyLaneX(
  list: GanttTask[],
  fromIdx: number,
  toIdx: number,
  fromEndX: number,
  chartW: number
): number {
  return computeDependencyLaneXBetweenRows(list, fromIdx, toIdx, fromEndX, chartW)
}

/** 後續開始日是否為前置「結束日（含）」的日曆隔天 → 依賴線改為沿前置右緣垂直落下 */
function isSuccessorStartNextCalendarDayAfterPredecessorEnd(
  predPlannedEnd: string,
  succPlannedStart: string
): boolean {
  const endKey = predPlannedEnd.slice(0, 10)
  const startKey = succPlannedStart.slice(0, 10)
  return startKey === addCalendarDays(endKey, 1)
}

/** 僅在「線在任務尾端右外」時繞路，且繞任務條上方；其餘一律水平＋垂直直接接頭，不繞。 */
const DETOUR_ABOVE_PX = 16

/**
 * 接進後續任務「頭」：
 * - 平常不繞：垂直下來後直接水平接到頭（L headX rowY）。
 * - 僅當線在任務「尾端右外」時才繞，且繞任務條上方。
 */
function pathFinishIntoTaskHead(
  fromXAtRow: number,
  rowY: number,
  succBarLeftX: number,
  succBarRightX: number
): string {
  const headX = succBarLeftX + 5
  const stubLeft = succBarLeftX - 14
  const xTailOut = succBarRightX + 4
  const yAbove = rowY - DETOUR_ABOVE_PX

  if (fromXAtRow > xTailOut - 0.5) {
    return `L ${xTailOut} ${rowY} L ${xTailOut} ${yAbove} L ${stubLeft} ${yAbove} L ${stubLeft} ${rowY} L ${headX} ${rowY}`
  }
  if (fromXAtRow <= stubLeft) {
    return `L ${stubLeft} ${rowY} L ${headX} ${rowY}`
  }
  return `L ${headX} ${rowY}`
}

function pathSameRowIntoTaskHead(
  fromX: number,
  y: number,
  succBarLeftX: number,
  succBarRightX: number
): string {
  const headX = succBarLeftX + 5
  const stubLeft = succBarLeftX - 14
  const xTailOut = succBarRightX + 4
  const yAbove = y - DETOUR_ABOVE_PX

  if (fromX > xTailOut - 0.5) {
    return `M ${fromX} ${y} L ${xTailOut} ${y} L ${xTailOut} ${yAbove} L ${stubLeft} ${yAbove} L ${stubLeft} ${y} L ${headX} ${y}`
  }
  if (fromX <= stubLeft) {
    return `M ${fromX} ${y} L ${stubLeft} ${y} L ${headX} ${y}`
  }
  return `M ${fromX} ${y} L ${headX} ${y}`
}

/**
 * FS 依賴線：
 * - 未來時間（toX >= fromX）：水平走到「要接的任務的開始時間」再往下，垂直在任務左側，線從左邊來。
 * - 過去時間（toX < fromX）：用右側通道 legX 垂直到列，再接頭（必要時繞上方）。
 */
function buildDependencyPathD(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  laneX: number,
  succBarRightX: number,
  straightVerticalNextDay?: boolean
): string {
  const dy = toY - fromY
  const ady = Math.abs(dy)

  if (ady < 3) {
    return pathSameRowIntoTaskHead(fromX, fromY, toX, succBarRightX)
  }

  if (straightVerticalNextDay) {
    return (
      `M ${fromX} ${fromY} L ${fromX} ${toY}` +
      pathFinishIntoTaskHead(fromX, toY, toX, succBarRightX)
    )
  }

  const isFuture = toX >= fromX
  if (isFuture) {
    return (
      `M ${fromX} ${fromY} L ${toX} ${fromY} L ${toX} ${toY}` +
      pathFinishIntoTaskHead(toX, toY, toX, succBarRightX)
    )
  }

  const legX = Math.max(laneX, fromX + 8)
  return (
    `M ${fromX} ${fromY} L ${legX} ${fromY} L ${legX} ${toY}` +
    pathFinishIntoTaskHead(legX, toY, toX, succBarRightX)
  )
}

/** 單條依賴 path；arrow=false 為共用主幹（無箭頭）；isCritical 表示此邊在要徑上 */
type DependencyPathSeg = { pathD: string; arrow: boolean; key: string; isCritical: boolean }

const dependencyPaths = computed((): DependencyPathSeg[] => {
  const list = displayedTasks.value
  const cw = chartWidthVal.value
  const cpMap = criticalPathMapVal.value
  const taskIndex = new Map(list.map((t, i) => [t.id, i]))

  function isEdgeCritical(predId: string, succId: string): boolean {
    return !!(cpMap.get(predId)?.isCritical && cpMap.get(succId)?.isCritical)
  }

  type SuccEdge = {
    toTask: GanttTask
    toIdx: number
    toStart: number
    toY: number
    succRight: number
    nextDay: boolean
  }
  const byPred = new Map<string, SuccEdge[]>()

  for (const task of list) {
    for (const depId of task.dependencies ?? []) {
      if (taskIndex.get(depId) === undefined) continue
      const toIdx = taskIndex.get(task.id) ?? 0
      const fromTask = list[taskIndex.get(depId)!]
      if (!byPred.has(depId)) byPred.set(depId, [])
      byPred.get(depId)!.push({
        toTask: task,
        toIdx,
        toStart: toPx(parseDate(task.plannedStart)),
        toY: toIdx * ROW_HEIGHT + ROW_HEIGHT / 2,
        succRight: inclusiveBarRightPx(task.plannedEnd),
        nextDay: isSuccessorStartNextCalendarDayAfterPredecessorEnd(
          fromTask.plannedEnd,
          task.plannedStart
        ),
      })
    }
  }

  const out: DependencyPathSeg[] = []
  const predIds = [...byPred.keys()].sort()

  for (const predId of predIds) {
    const group = byPred.get(predId)!
    const fromIdx = taskIndex.get(predId)!
    const fromTask = list[fromIdx]
    const fromEnd = inclusiveBarRightPx(fromTask.plannedEnd)
    const fromY = fromIdx * ROW_HEIGHT + ROW_HEIGHT / 2

    if (group.length === 1) {
      const g = group[0]!
      const laneX = computeDependencyLaneX(list, fromIdx, g.toIdx, fromEnd, cw)
      out.push({
        key: `e-${predId}-${g.toTask.id}`,
        pathD: buildDependencyPathD(
          fromEnd,
          fromY,
          g.toStart,
          g.toY,
          laneX,
          g.succRight,
          g.nextDay
        ),
        arrow: true,
        isCritical: isEdgeCritical(predId, g.toTask.id),
      })
      continue
    }

    const toIdxs = group.map((g) => g.toIdx)
    const allBelow = toIdxs.every((t) => t > fromIdx)
    const allAbove = toIdxs.every((t) => t < fromIdx)
    const allPast = group.every((g) => g.toStart < fromEnd)
    const allNextDay = group.every((g) => g.nextDay)
    const tMin = Math.min(...toIdxs)
    const tMax = Math.max(...toIdxs)

    if (!allBelow && !allAbove) {
      for (const g of group) {
        const laneX = computeDependencyLaneX(list, fromIdx, g.toIdx, fromEnd, cw)
        out.push({
          key: `e-${predId}-${g.toTask.id}`,
          pathD: buildDependencyPathD(
            fromEnd,
            fromY,
            g.toStart,
            g.toY,
            laneX,
            g.succRight,
            g.nextDay
          ),
          arrow: true,
          isCritical: isEdgeCritical(predId, g.toTask.id),
        })
      }
      continue
    }

    if (!allPast) {
      for (const g of group) {
        const laneX = computeDependencyLaneX(list, fromIdx, g.toIdx, fromEnd, cw)
        out.push({
          key: `e-${predId}-${g.toTask.id}`,
          pathD: buildDependencyPathD(
            fromEnd,
            fromY,
            g.toStart,
            g.toY,
            laneX,
            g.succRight,
            g.nextDay
          ),
          arrow: true,
          isCritical: isEdgeCritical(predId, g.toTask.id),
        })
      }
      continue
    }

    const rowSpanLo = Math.min(fromIdx, tMin)
    const rowSpanHi = Math.max(fromIdx, tMax)
    const laneBase = allNextDay
      ? fromEnd
      : computeDependencyLaneXBetweenRows(list, rowSpanLo, rowSpanHi, fromEnd, cw)
    const legX = allNextDay ? fromEnd : Math.max(laneBase, fromEnd + 8)
    const yBusEnd = allBelow
      ? Math.max(...group.map((g) => g.toY))
      : Math.min(...group.map((g) => g.toY))

    const trunk =
      allNextDay && legX === fromEnd
        ? `M ${fromEnd} ${fromY} L ${fromEnd} ${yBusEnd}`
        : `M ${fromEnd} ${fromY} L ${legX} ${fromY} L ${legX} ${yBusEnd}`
    const trunkCritical = group.some((g) => isEdgeCritical(predId, g.toTask.id))
    out.push({ key: `t-${predId}`, pathD: trunk, arrow: false, isCritical: trunkCritical })

    const sorted = [...group].sort((a, b) => a.toIdx - b.toIdx)
    for (const g of sorted) {
      const spurD =
        `M ${legX} ${g.toY}` + pathFinishIntoTaskHead(legX, g.toY, g.toStart, g.succRight)
      out.push({
        key: `s-${predId}-${g.toTask.id}`,
        pathD: spurD,
        arrow: true,
        isCritical: isEdgeCritical(predId, g.toTask.id),
      })
    }
  }

  return out
})

/** 拖曳依賴時預覽線 path */
const dependencyPreviewPathD = computed(() => {
  const from = dependencyDragFrom.value
  const to = dependencyDropChartPos.value
  if (!from || !to) return ''
  const list = displayedTasks.value
  const idx = list.findIndex((t) => t.id === from.id)
  if (idx < 0) return ''
  const fromEnd = inclusiveBarRightPx(from.plannedEnd)
  const fromY = idx * ROW_HEIGHT + ROW_HEIGHT / 2
  const toIdx = Math.min(list.length - 1, Math.max(0, Math.floor(to.y / ROW_HEIGHT)))
  const laneX = computeDependencyLaneX(list, idx, toIdx, fromEnd, chartWidthVal.value)
  const targetTask = list[toIdx]
  const nextDay =
    targetTask &&
    isSuccessorStartNextCalendarDayAfterPredecessorEnd(from.plannedEnd, targetTask.plannedStart)
  const succLeft = targetTask ? toPx(parseDate(targetTask.plannedStart)) : Math.max(4, to.x - 6)
  const succRight = targetTask ? inclusiveBarRightPx(targetTask.plannedEnd) : succLeft + 120
  return buildDependencyPathD(fromEnd, fromY, succLeft, to.y, laneX, succRight, !!nextDay)
})

function toPx(dateMs: number): number {
  return props.dateToPx(dateMs)
}

/** 結束日為「最後工作當日（含）」時，長條右緣對齊至隔日 0 點（涵蓋最後一日欄位） */
function inclusiveBarRightPx(plannedEndYmd: string): number {
  const key = plannedEndYmd.slice(0, 10)
  return toPx(parseDate(addCalendarDays(key, 1)))
}

function inclusiveBarWidthPx(startYmd: string, endYmd: string): number {
  return Math.max(4, inclusiveBarRightPx(endYmd) - toPx(parseDate(startYmd)))
}

/** 左／右緣「調整時程」拖曳區（px）；最右緣為結束日，其內側為拉關聯線（參考 MS Project） */
const BAR_RESIZE_EDGE_PX = 14
const BAR_DEPENDENCY_HANDLE_PX = 24

// 拖曳任務條：移動 / 左緣改開始 / 右緣改工期 / 尾巴拉依賴線
const draggingTask = ref<GanttTask | null>(null)
const dragStartX = ref(0)
const dragStartPlannedStart = ref('')
const resizingLeftTask = ref<GanttTask | null>(null)
const resizingRightTask = ref<GanttTask | null>(null)
const resizeStartPlannedStart = ref('')
const resizeStartPlannedEnd = ref('')
const dependencyDragFrom = ref<GanttTask | null>(null)
const dependencyDragEnd = ref<{ x: number; y: number } | null>(null)
const dependencyDropTargetId = ref<string | null>(null)
/** 拖曳預覽線終點（圖表區 px） */
const dependencyDropChartPos = ref<{ x: number; y: number } | null>(null)

function barHitZone(barEl: HTMLElement, clientX: number): 'left' | 'move' | 'right' | 'dependency' {
  const rect = barEl.getBoundingClientRect()
  const x = clientX - rect.left
  const w = Math.max(rect.width, 1)
  const edge = BAR_RESIZE_EDGE_PX
  const dep = BAR_DEPENDENCY_HANDLE_PX
  const minFull = edge * 2 + dep
  let leftW = edge
  let rightW = edge
  let depW = dep
  if (w < minFull) {
    leftW = Math.max(5, Math.floor((edge / minFull) * w))
    rightW = Math.max(5, Math.floor((edge / minFull) * w))
    depW = Math.max(8, w - leftW - rightW - 2)
    if (leftW + rightW + depW > w) {
      const s = w / (leftW + rightW + depW)
      leftW = Math.max(4, Math.floor(leftW * s))
      rightW = Math.max(4, Math.floor(rightW * s))
      depW = Math.max(6, w - leftW - rightW)
    }
  }
  if (x >= w - rightW) return 'right'
  if (x >= w - rightW - depW) return 'dependency'
  if (x < leftW) return 'left'
  return 'move'
}

function setScheduleDragBaseline(task: GanttTask) {
  scheduleDraftTask.value = null
  scheduleDragBaseline.value = {
    id: task.id,
    start: task.plannedStart,
    end: task.plannedEnd,
  }
}

function onBarPointerDown(e: MouseEvent, task: GanttTask, barEl?: HTMLElement) {
  if (task.isRollup) return
  e.stopPropagation()
  const zone = barEl ? barHitZone(barEl, e.clientX) : 'move'
  if (task.isMilestone) {
    setScheduleDragBaseline(task)
    draggingTask.value = task
    dragStartX.value = e.clientX
    dragStartPlannedStart.value = task.plannedStart
    return
  }
  if (zone === 'left') {
    setScheduleDragBaseline(task)
    resizingLeftTask.value = task
    resizeStartPlannedStart.value = task.plannedStart
    resizeStartPlannedEnd.value = task.plannedEnd
    dragStartX.value = e.clientX
    return
  }
  if (zone === 'right') {
    setScheduleDragBaseline(task)
    resizingRightTask.value = task
    resizeStartPlannedStart.value = task.plannedStart
    resizeStartPlannedEnd.value = task.plannedEnd
    dragStartX.value = e.clientX
    return
  }
  if (zone === 'dependency') {
    scheduleDraftTask.value = null
    scheduleDragBaseline.value = null
    dependencyDragFrom.value = task
    dependencyDragEnd.value = { x: e.clientX, y: e.clientY }
    const list = displayedTasks.value
    const idx = list.findIndex((t) => t.id === task.id)
    const fromEnd = inclusiveBarRightPx(task.plannedEnd)
    const fromY = idx >= 0 ? idx * ROW_HEIGHT + ROW_HEIGHT / 2 : 0
    dependencyDropChartPos.value = { x: fromEnd, y: fromY }
    dependencyDropTargetId.value = null
    return
  }
  setScheduleDragBaseline(task)
  draggingTask.value = task
  dragStartX.value = e.clientX
  dragStartPlannedStart.value = task.plannedStart
}

function onBarPointerMove(e: MouseEvent) {
  const pxPerDay = pxPerDayVal.value

  if (resizingLeftTask.value) {
    const dx = e.clientX - dragStartX.value
    const days = Math.round(dx / pxPerDay) // 以 1 天為單位
    if (days === 0) return
    const start = new Date(resizeStartPlannedStart.value)
    start.setDate(start.getDate() + days)
    const endMs = new Date(resizeStartPlannedEnd.value).getTime()
    const startMs = start.getTime()
    if (startMs >= endMs) return
    const updated: GanttTask = {
      ...resizingLeftTask.value,
      plannedStart: start.toISOString().slice(0, 10),
      plannedEnd: resizeStartPlannedEnd.value,
    }
    scheduleDraftTask.value = updated
    dragStartX.value = e.clientX
    resizeStartPlannedStart.value = updated.plannedStart
    return
  }

  if (resizingRightTask.value) {
    const dx = e.clientX - dragStartX.value
    const days = Math.round(dx / pxPerDay) // 以 1 天為單位
    if (days === 0) return
    const end = new Date(resizeStartPlannedEnd.value)
    end.setDate(end.getDate() + days)
    const startMs = new Date(resizeStartPlannedStart.value).getTime()
    const endMs = end.getTime()
    if (endMs <= startMs) return
    const updated: GanttTask = {
      ...resizingRightTask.value,
      plannedStart: resizeStartPlannedStart.value,
      plannedEnd: end.toISOString().slice(0, 10),
    }
    scheduleDraftTask.value = updated
    dragStartX.value = e.clientX
    resizeStartPlannedEnd.value = updated.plannedEnd
    return
  }

  if (dependencyDragFrom.value) {
    dependencyDragEnd.value = { x: e.clientX, y: e.clientY }
    const list = displayedTasks.value
    const rowHeight = ROW_HEIGHT
    const scrollEl = scrollContainerRef.value
    const chartEl = scrollEl?.querySelector('[data-gantt-chart-area]') as HTMLElement | null
    if (chartEl && scrollEl) {
      const chartRect = chartEl.getBoundingClientRect()
      const scrollTop = chartEl.scrollTop ?? 0
      const scrollLeft = scrollEl.scrollLeft ?? 0
      const relY = e.clientY - chartRect.top + scrollTop
      const idx = Math.floor(relY / rowHeight)
      dependencyDropChartPos.value = {
        x: e.clientX - chartRect.left + scrollLeft,
        y: e.clientY - chartRect.top + scrollTop,
      }
      if (idx >= 0 && idx < list.length) {
        const target = list[idx]
        if (target.id !== dependencyDragFrom.value.id) dependencyDropTargetId.value = target.id
        else dependencyDropTargetId.value = null
      } else dependencyDropTargetId.value = null
    }
    return
  }

  if (!draggingTask.value) return
  const dx = e.clientX - dragStartX.value
  const days = Math.round(dx / pxPerDay) // 整條移動以 1 天為單位
  if (days === 0) return
  const start = new Date(dragStartPlannedStart.value)
  start.setDate(start.getDate() + days)
  const dur = wbsDurationInclusiveDays(
    draggingTask.value.plannedStart,
    draggingTask.value.plannedEnd
  )
  const end = new Date(start)
  end.setDate(end.getDate() + dur - 1)
  const updated: GanttTask = {
    ...draggingTask.value,
    plannedStart: start.toISOString().slice(0, 10),
    plannedEnd: end.toISOString().slice(0, 10),
  }
  scheduleDraftTask.value = updated
  dragStartX.value = e.clientX
  dragStartPlannedStart.value = updated.plannedStart
}

function resolveDropTargetFromClientY(clientY: number): string | null {
  const list = displayedTasks.value
  const rects = getLeftColumnRowRects()
  for (let i = 0; i < rects.length && i < list.length; i++) {
    const { top, height } = rects[i]
    if (clientY >= top && clientY < top + height) {
      const target = list[i]
      if (target && dependencyDragFrom.value && target.id !== dependencyDragFrom.value.id)
        return target.id
      return null
    }
  }
  return null
}

function onDocMouseUp(e?: MouseEvent) {
  if (dependencyDragFrom.value) {
    let targetId = dependencyDropTargetId.value
    if (!targetId && e) targetId = resolveDropTargetFromClientY(e.clientY) ?? null
    const fromT = dependencyDragFrom.value
    const targetT = targetId ? displayedTasks.value.find((t) => t.id === targetId) : null
    if (targetId && targetT && !targetT.isRollup && !fromT.isRollup) {
      emit('addDependency', fromT.id, targetId)
    }
  }
  const draft = scheduleDraftTask.value
  const base = scheduleDragBaseline.value
  if (
    draft &&
    base &&
    draft.id === base.id &&
    (draft.plannedStart !== base.start || draft.plannedEnd !== base.end)
  ) {
    emit('update:task', draft)
  }
  scheduleDraftTask.value = null
  scheduleDragBaseline.value = null
  draggingTask.value = null
  resizingLeftTask.value = null
  resizingRightTask.value = null
  dependencyDragFrom.value = null
  dependencyDragEnd.value = null
  dependencyDropTargetId.value = null
  dependencyDropChartPos.value = null
  isPanning.value = false
}

// ----- 左欄 WBS 收合／拖移（與 WBS 頁面一致） -----
const leftColumnBodyRef = ref<HTMLElement | null>(null)
/** 左表水平捲動僅在 body 容器；表頭用 translateX 同步，避免表頭獨立捲軸 */
const leftTableHScrollRef = ref<HTMLElement | null>(null)
const leftTableHScrollPx = ref(0)

function onLeftTableBodyHScroll(e: Event) {
  const el = e.target as HTMLElement
  leftTableHScrollPx.value = el.scrollLeft
}

function onLeftTableHeaderWheel(e: WheelEvent) {
  const dx = e.deltaX + (e.shiftKey ? e.deltaY : 0)
  if (dx === 0) return
  const b = leftTableHScrollRef.value
  if (!b) return
  b.scrollLeft = Math.max(0, Math.min(b.scrollWidth - b.clientWidth, b.scrollLeft + dx))
  leftTableHScrollPx.value = b.scrollLeft
  e.preventDefault()
}

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
  <TooltipProvider :delay-duration="350">
    <!-- 固定寬度容器：表頭固定，僅下方資料列＋圖表區一起垂直捲動 -->
    <div class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div class="flex min-h-0 flex-1 flex-col">
        <!-- 固定表頭列：左表頭 ＋ 圖表工具列＋里程碑＋時間軸 -->
        <div class="flex shrink-0 flex-row border-b border-border">
          <!-- 左表頭：總高與右側一致，欄位標題佔滿整格垂直空間 -->
          <div
            class="relative z-0 flex shrink-0 flex-col overflow-x-hidden border-r-2 border-border bg-card"
            :style="{ width: leftWidthVal + 'px', minHeight: HEADER_TOTAL_HEIGHT + 'px' }"
            @wheel="onLeftTableHeaderWheel"
          >
            <div
              class="will-change-transform min-w-max"
              :style="{ transform: `translateX(${-leftTableHScrollPx}px)` }"
            >
              <Table :scroll-container="false" class="[&_thead_tr]:border-0">
                <TableHeader>
                  <TableRow
                    class="hover:bg-transparent border-0 bg-card"
                    :style="{ height: HEADER_TOTAL_HEIGHT + 'px' }"
                  >
                    <TableHead
                      class="text-muted-foreground w-[4.5rem] shrink-0 align-middle px-2 text-center text-xs font-semibold tabular-nums leading-snug"
                      >WBS</TableHead
                    >
                    <TableHead
                      class="text-muted-foreground min-w-[8rem] align-middle px-3 text-xs font-semibold leading-snug"
                      >任務名稱</TableHead
                    >
                    <TableHead
                      class="text-muted-foreground w-[3.75rem] shrink-0 align-middle px-2 text-right text-xs font-semibold tabular-nums"
                      >工期</TableHead
                    >
                    <TableHead
                      class="text-muted-foreground w-[5.25rem] shrink-0 align-middle px-2 text-right text-xs font-semibold tabular-nums leading-tight"
                      >開始時間</TableHead
                    >
                    <TableHead
                      class="text-muted-foreground w-[5.25rem] shrink-0 align-middle px-2 text-right text-xs font-semibold tabular-nums leading-tight"
                      >完成時間</TableHead
                    >
                    <TableHead
                      class="text-muted-foreground w-[5.5rem] shrink-0 align-middle px-2 text-center text-xs font-semibold"
                      >前置</TableHead
                    >
                    <TableHead class="w-10 shrink-0 align-middle px-1" aria-label="編輯排程" />
                  </TableRow>
                </TableHeader>
              </Table>
            </div>
          </div>
          <div
            class="relative z-0 w-2 shrink-0 border-r border-border bg-muted/50"
            aria-hidden="true"
          />
          <!-- 圖表固定表頭：層級高於左欄，拖曳寬度時時間軸區塊視覺在上 -->
          <div
            class="relative z-10 flex min-w-0 flex-1 flex-col border-border bg-card/80 shadow-sm"
            :style="{ minWidth: 0 }"
          >
            <div
              class="flex shrink-0 items-center justify-between gap-3 border-b border-border px-2 text-sm"
              :style="{ height: TOOLBAR_ROW_HEIGHT + 'px', minHeight: TOOLBAR_ROW_HEIGHT + 'px' }"
            >
              <span
                v-if="visibleYearMonth"
                class="shrink-0 font-medium tabular-nums text-foreground"
              >
                {{ visibleYearMonth.year }}年 {{ visibleYearMonth.month }}月
              </span>
              <div class="flex items-center gap-3">
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
            <!-- 里程碑＋時間軸：不獨立捲動（無水平捲軸），以 translate 與下方圖表 scrollLeft 對齊 -->
            <div
              class="flex min-w-0 flex-1 shrink-0 flex-col overflow-hidden border-b border-border"
              :style="{ height: MILESTONE_ROW_HEIGHT + TIME_RULER_HEIGHT + 'px' }"
            >
              <div
                class="flex shrink-0 flex-col will-change-transform"
                :style="{
                  width: chartWidthVal + 'px',
                  minWidth: chartWidthVal + 'px',
                  transform: `translate3d(${-scrollLeftVal}px, 0, 0)`,
                }"
              >
                <div
                  class="relative z-10 flex shrink-0 items-end justify-center overflow-visible border-b border-border bg-background/50"
                  :style="{ height: MILESTONE_ROW_HEIGHT + 'px' }"
                >
                  <template v-if="showMilestoneLines">
                    <template v-for="ml in milestoneLines" :key="'mh-' + ml.id">
                      <div
                        class="pointer-events-none absolute top-0 bottom-0 w-px"
                        :style="{
                          left: toPx(new Date(ml.date).setHours(0, 0, 0, 0)) + 'px',
                          backgroundColor: ml.color ?? 'var(--chart-3)',
                        }"
                      />
                      <div
                        class="absolute z-[1] flex items-center gap-0.5 rounded-md border border-border bg-card px-1.5 py-0.5 shadow-md"
                        :style="{
                          left: toPx(new Date(ml.date).setHours(0, 0, 0, 0)) + 'px',
                          transform: 'translateX(-50%)',
                          top: '2px',
                        }"
                        :title="ml.label"
                      >
                        <Flag class="size-3 text-muted-foreground" />
                        <span
                          class="max-w-[4rem] truncate text-[10px] font-medium text-foreground"
                          >{{ ml.label }}</span
                        >
                      </div>
                    </template>
                  </template>
                </div>
                <div
                  class="relative flex shrink-0 flex-col overflow-hidden bg-background"
                  :style="{ height: TIME_RULER_HEIGHT + 'px' }"
                >
                  <template v-for="tick in timeRulerTicks" :key="'th-' + tick.dateMs">
                    <div
                      class="absolute top-0 bottom-0 border-r border-border"
                      :style="{ left: toPx(tick.dateMs) + 'px', width: '1px' }"
                    />
                  </template>
                  <div
                    v-if="showTodayLine && todayInRange"
                    class="pointer-events-none absolute top-0 bottom-0 w-px bg-primary"
                    :style="{ left: Math.floor(toPx(todayMs)) + 'px' }"
                    title="今日"
                  />
                  <template v-if="showMilestoneLines">
                    <div
                      v-for="ml in milestoneLines"
                      :key="'ruler-h-' + ml.id"
                      class="pointer-events-none absolute top-0 bottom-0 w-px"
                      :style="{
                        left: toPx(new Date(ml.date).setHours(0, 0, 0, 0)) + 'px',
                        backgroundColor: ml.color ?? 'var(--chart-3)',
                      }"
                    />
                  </template>
                  <div
                    v-for="tick in timeRulerTicks"
                    :key="'tl-' + tick.dateMs"
                    class="absolute inset-y-0 flex items-center justify-center overflow-hidden border-r border-border/70"
                    :style="{ left: toPx(tick.dateMs) + 'px', width: pxPerDayVal + 'px' }"
                    :class="
                      tick.dateMs === todayMs
                        ? 'bg-primary text-primary-foreground'
                        : [0, 6].includes(new Date(tick.dateMs).getDay())
                          ? 'bg-muted/60'
                          : 'bg-background'
                    "
                  >
                    <div
                      class="flex flex-col items-center justify-center gap-0.5 px-1 text-center leading-tight"
                    >
                      <span class="text-xs font-semibold tabular-nums">{{ tick.labelDay }}</span>
                      <span
                        class="text-[10px] font-medium tabular-nums"
                        :class="
                          tick.dateMs === todayMs
                            ? 'text-primary-foreground/90'
                            : 'text-muted-foreground'
                        "
                        >{{ tick.labelWeekday }}</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 可垂直捲動區：唯一垂直捲軸；左表不可內層捲動（Table scrollContainer=false） -->
        <div
          ref="sharedScrollRef"
          class="flex flex-1 min-h-0 min-w-0 flex-row items-start overflow-y-auto overflow-x-hidden"
        >
          <!-- 左表 body -->
          <div
            ref="leftColumnBodyRef"
            class="shrink-0 self-start overflow-x-hidden border-r-2 border-border bg-card"
            :style="{ width: leftWidthVal + 'px' }"
          >
            <div
              ref="leftTableHScrollRef"
              class="max-w-full overflow-x-auto overflow-y-visible"
              @scroll.passive="onLeftTableBodyHScroll"
            >
              <div class="min-w-max">
                <Table :scroll-container="false">
                  <TableBody>
                    <!-- 有 leftColumnItems：收合結構 + 拖移（與 WBS 一致） -->
                    <template v-if="leftColumnItems?.length">
                      <template v-for="(item, flatIndex) in leftColumnItems" :key="item.task.id">
                        <tr
                          v-if="dropInsertBeforeIndex === flatIndex"
                          class="pointer-events-none"
                          aria-hidden="true"
                        >
                          <td colspan="7" class="h-0 p-0 align-top">
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
                            class="whitespace-nowrap py-1 pr-1 text-xs tabular-nums text-muted-foreground"
                          >
                            {{ item.task.wbsCode ?? '—' }}
                          </TableCell>
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
                                v-if="!item.task.isProjectRoot"
                                role="button"
                                tabindex="0"
                                class="flex shrink-0 cursor-grab touch-none items-center justify-center rounded p-0.5 text-muted-foreground/60 hover:bg-muted/80 hover:text-foreground active:cursor-grabbing"
                                aria-label="拖移排序"
                                @pointerdown="onDragHandlePointerDown($event, item)"
                              >
                                <GripVertical class="size-4" />
                              </div>
                              <span v-else class="size-5 shrink-0" aria-hidden="true" />
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
                            class="whitespace-nowrap py-1 pr-2 text-right text-xs tabular-nums"
                          >
                            <template v-if="editingTaskId === item.task.id">
                              <Input
                                v-model.number="editDurationDays"
                                type="number"
                                min="1"
                                class="h-7 w-16 text-right text-xs"
                                @keydown.enter="submitEditSchedule"
                                @keydown.escape="cancelEditSchedule"
                              />
                              <span class="ml-0.5 text-muted-foreground">天</span>
                            </template>
                            <template v-else>
                              <span
                                v-if="item.task.isRollup"
                                class="text-muted-foreground text-xs"
                                title="由子項彙總"
                                >彙總</span
                              >
                              <span v-else class="text-muted-foreground"
                                >{{ durationDays(item.task) }} 天</span
                              >
                            </template>
                          </TableCell>
                          <TableCell
                            class="whitespace-nowrap py-1 pr-2 text-right text-xs tabular-nums"
                          >
                            <template v-if="editingTaskId === item.task.id">
                              <Input
                                v-model="editPlannedStart"
                                type="date"
                                class="h-7 w-[7.5rem] text-xs"
                                @keydown.enter="submitEditSchedule"
                                @keydown.escape="cancelEditSchedule"
                              />
                            </template>
                            <template v-else>
                              <span class="text-muted-foreground">{{
                                formatDateShort(item.task.plannedStart)
                              }}</span>
                            </template>
                          </TableCell>
                          <TableCell
                            class="whitespace-nowrap py-1 pr-2 text-right text-xs tabular-nums text-muted-foreground"
                          >
                            <template v-if="editingTaskId === item.task.id">
                              {{ editEndDate || '—' }}
                            </template>
                            <template v-else>
                              {{ formatDateShort(item.task.plannedEnd) }}
                            </template>
                          </TableCell>
                          <TableCell class="py-1 pr-1 align-middle">
                            <GanttPredecessorCell
                              v-if="editingTaskId !== item.task.id && !item.task.isRollup"
                              :task="item.task"
                              :all-tasks="displayedTasks"
                              @update:dependencies="
                                (ids: string[]) => emit('update:dependencies', item.task.id, ids)
                              "
                            />
                            <span
                              v-else-if="item.task.isRollup"
                              class="text-muted-foreground text-xs"
                              title="前置僅適用於葉節點"
                              >—</span
                            >
                            <span v-else class="text-muted-foreground text-xs">—</span>
                          </TableCell>
                          <TableCell class="w-9 py-1 px-0 align-middle text-center">
                            <template v-if="editingTaskId === item.task.id">
                              <div class="flex items-center justify-center gap-0.5">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  class="size-7 text-primary hover:text-primary"
                                  aria-label="儲存"
                                  :disabled="
                                    !editPlannedStart ||
                                    editDurationDays === '' ||
                                    Number(editDurationDays) < 1
                                  "
                                  @click="submitEditSchedule"
                                >
                                  <Check class="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  class="size-7 text-muted-foreground hover:text-destructive"
                                  aria-label="取消"
                                  @click="cancelEditSchedule"
                                >
                                  <X class="size-3.5" />
                                </Button>
                              </div>
                            </template>
                            <Button
                              v-else-if="!item.task.isRollup"
                              variant="ghost"
                              size="icon"
                              class="size-7 text-muted-foreground hover:text-foreground"
                              aria-label="編輯開始時間與工期"
                              @click="openEditSchedule(item.task)"
                            >
                              <Pencil class="size-3.5" />
                            </Button>
                            <span v-else class="inline-block size-7" aria-hidden="true" />
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
                          class="whitespace-nowrap py-1 pr-1 text-xs tabular-nums text-muted-foreground"
                        >
                          {{ task.wbsCode ?? '—' }}
                        </TableCell>
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
                                  showAssignee &&
                                  task.assignee &&
                                  showProgress &&
                                  task.progress != null
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
                          class="whitespace-nowrap py-1 pr-2 text-right text-xs tabular-nums"
                        >
                          <template v-if="editingTaskId === task.id">
                            <Input
                              v-model.number="editDurationDays"
                              type="number"
                              min="1"
                              class="h-7 w-16 text-right text-xs"
                              @keydown.enter="submitEditSchedule"
                              @keydown.escape="cancelEditSchedule"
                            />
                            <span class="ml-0.5 text-muted-foreground">天</span>
                          </template>
                          <template v-else>
                            <span
                              v-if="task.isRollup"
                              class="text-muted-foreground text-xs"
                              title="由子項彙總"
                              >彙總</span
                            >
                            <span v-else class="text-muted-foreground"
                              >{{ durationDays(task) }} 天</span
                            >
                          </template>
                        </TableCell>
                        <TableCell
                          class="whitespace-nowrap py-1 pr-2 text-right text-xs tabular-nums"
                        >
                          <template v-if="editingTaskId === task.id">
                            <Input
                              v-model="editPlannedStart"
                              type="date"
                              class="h-7 w-[7.5rem] text-xs"
                              @keydown.enter="submitEditSchedule"
                              @keydown.escape="cancelEditSchedule"
                            />
                          </template>
                          <template v-else>
                            <span class="text-muted-foreground">{{
                              formatDateShort(task.plannedStart)
                            }}</span>
                          </template>
                        </TableCell>
                        <TableCell
                          class="whitespace-nowrap py-1 pr-2 text-right text-xs tabular-nums text-muted-foreground"
                        >
                          <template v-if="editingTaskId === task.id">
                            {{ editEndDate || '—' }}
                          </template>
                          <template v-else>
                            {{ formatDateShort(task.plannedEnd) }}
                          </template>
                        </TableCell>
                        <TableCell class="py-1 pr-1 align-middle">
                          <GanttPredecessorCell
                            v-if="editingTaskId !== task.id && !task.isRollup"
                            :task="task"
                            :all-tasks="displayedTasks"
                            @update:dependencies="
                              (ids: string[]) => emit('update:dependencies', task.id, ids)
                            "
                          />
                          <span v-else-if="task.isRollup" class="text-muted-foreground text-xs"
                            >—</span
                          >
                          <span v-else class="text-muted-foreground text-xs">—</span>
                        </TableCell>
                        <TableCell class="w-9 py-1 px-0 align-middle text-center">
                          <template v-if="editingTaskId === task.id">
                            <div class="flex items-center justify-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                class="size-7 text-primary hover:text-primary"
                                aria-label="儲存"
                                :disabled="
                                  !editPlannedStart ||
                                  editDurationDays === '' ||
                                  Number(editDurationDays) < 1
                                "
                                @click="submitEditSchedule"
                              >
                                <Check class="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                class="size-7 text-muted-foreground hover:text-destructive"
                                aria-label="取消"
                                @click="cancelEditSchedule"
                              >
                                <X class="size-3.5" />
                              </Button>
                            </div>
                          </template>
                          <Button
                            v-else-if="!task.isRollup"
                            variant="ghost"
                            size="icon"
                            class="size-7 text-muted-foreground hover:text-foreground"
                            aria-label="編輯開始時間與工期"
                            @click="openEditSchedule(task)"
                          >
                            <Pencil class="size-3.5" />
                          </Button>
                          <span v-else class="inline-block size-7" aria-hidden="true" />
                        </TableCell>
                      </TableRow>
                    </template>
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>

          <!-- 可拖曳分隔線 -->
          <div
            class="flex w-2 shrink-0 cursor-col-resize flex-col border-r border-border bg-muted/80 hover:bg-primary/30 transition-colors items-center justify-center self-stretch"
            :class="{ 'bg-primary/40 border-primary/60': resizing }"
            :style="{ minHeight: ganttBodyHeightPx + 'px' }"
            aria-label="拖曳調整左側寬度"
            @mousedown="onResizePointerDown"
          >
            <div class="w-1 shrink-0 rounded-full bg-muted-foreground/40" style="height: 2rem" />
          </div>

          <!-- 圖表區：高度與左欄資料列總高一致，僅橫向捲 -->
          <div
            ref="scrollContainerRef"
            class="relative min-w-0 flex-1 shrink-0 overflow-x-auto overflow-y-hidden bg-muted/40 [scrollbar-width:thin]"
            :style="{ height: ganttBodyHeightPx + 'px', minHeight: ganttBodyHeightPx + 'px' }"
            :class="{
              'cursor-grab': !isPanning && !draggingTask && !dependencyDragFrom,
              'cursor-grabbing': isPanning,
              'cursor-crosshair': !!dependencyDragFrom,
            }"
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
              <div
                data-gantt-chart-area
                class="relative overflow-x-hidden overflow-y-hidden"
                :style="{
                  width: chartWidthVal + 'px',
                  minWidth: chartWidthVal + 'px',
                  height: displayedTasks.length * ROW_HEIGHT + 'px',
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

                <!-- 任務條（依賴線畫在上方，箭頭與線段才不會被擋） -->
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
                    :class="[
                      task.isRollup
                        ? 'border-dashed bg-muted/40'
                        : showCriticalPath && criticalPathMapVal.get(task.id)?.isCritical
                          ? 'bg-destructive/20'
                          : 'bg-muted',
                    ]"
                    :style="{
                      left: toPx(parseDate(task.plannedStart)) + 'px',
                      width: inclusiveBarWidthPx(task.plannedStart, task.plannedEnd) + 'px',
                    }"
                    @mousedown.stop
                  />
                  <!-- 實際／計劃條（主條）：左／右緣調整時程；右側內緣拉關聯線（MS Project 式） -->
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <div
                        data-gantt-bar
                        class="group absolute h-6 rounded-md border border-border select-none outline-none"
                        :class="[
                          task.isRollup
                            ? 'cursor-default border-dashed bg-muted/50'
                            : showCriticalPath && criticalPathMapVal.get(task.id)?.isCritical
                              ? 'bg-destructive'
                              : 'bg-primary',
                          !task.isRollup &&
                            (task.isMilestone
                              ? 'cursor-grab active:cursor-grabbing'
                              : 'cursor-grab active:cursor-grabbing'),
                        ]"
                        :style="{
                          left: toPx(parseDate(task.actualStart ?? task.plannedStart)) + 'px',
                          width:
                            (task.isMilestone
                              ? 0
                              : inclusiveBarWidthPx(
                                  task.actualStart ?? task.plannedStart,
                                  task.actualEnd ?? task.plannedEnd
                                )) + 'px',
                          minWidth: task.isMilestone ? '14px' : undefined,
                        }"
                        @mousedown="
                          (e: MouseEvent) =>
                            onBarPointerDown(e, task, e.currentTarget as HTMLElement)
                        "
                      >
                        <!-- 左緣：調整開始日 -->
                        <span
                          v-if="!task.isMilestone && !task.isRollup"
                          class="absolute left-0 top-0 bottom-0 z-[1] w-[14px] min-w-[14px] cursor-ew-resize rounded-l-md ring-inset hover:bg-primary-foreground/25"
                          title="拖曳左緣調整開始日"
                          aria-label="調整開始日"
                        />
                        <!-- 右側內緣：由此拖出關聯線至其他任務 -->
                        <span
                          v-if="!task.isMilestone && !task.isRollup"
                          class="absolute top-0 bottom-0 z-[1] w-6 min-w-[24px] cursor-crosshair hover:bg-primary-foreground/20"
                          style="right: 14px"
                          title="由此拖曳至其他任務列以建立前置關係"
                          aria-label="建立前置連線"
                        />
                        <!-- 最右緣：調整完成日 -->
                        <span
                          v-if="!task.isMilestone && !task.isRollup"
                          class="absolute right-0 top-0 bottom-0 z-[1] w-[14px] min-w-[14px] cursor-ew-resize rounded-r-md ring-inset hover:bg-primary-foreground/25"
                          title="拖曳右緣調整完成日"
                          aria-label="調整完成日"
                        />
                        <!-- Hover 時顯示連接線箭頭（參考 MS Project） -->
                        <div
                          v-if="!task.isMilestone && !task.isRollup"
                          class="pointer-events-none absolute top-1/2 z-0 flex -translate-y-1/2 items-center opacity-0 transition-opacity group-hover:opacity-100"
                          style="right: 26px"
                          aria-hidden="true"
                        >
                          <svg
                            width="20"
                            height="10"
                            class="text-foreground drop-shadow-sm"
                            viewBox="0 0 20 10"
                          >
                            <line
                              x1="0"
                              y1="5"
                              x2="11"
                              y2="5"
                              stroke="currentColor"
                              stroke-width="2"
                              stroke-linecap="round"
                            />
                            <path d="M11 1.5 L18 5 L11 8.5 Z" fill="currentColor" />
                          </svg>
                        </div>
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
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      class="max-w-xs border-border bg-popover px-3 py-2 text-popover-foreground shadow-md"
                      :side-offset="6"
                    >
                      <div class="space-y-0.5 text-left text-xs">
                        <p
                          v-for="(line, li) in ganttBarTooltipLines(task)"
                          :key="li"
                          :class="li === 0 ? 'text-[10px] font-medium text-muted-foreground' : ''"
                        >
                          {{ line }}
                        </p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                  <!-- 負責人：顯示在任務條後方（圖表區） -->
                  <div
                    v-if="showAssignee && task.assignee"
                    class="pointer-events-none absolute top-0 flex h-6 items-center overflow-hidden"
                    :style="{
                      left: inclusiveBarRightPx(task.actualEnd ?? task.plannedEnd) + 6 + 'px',
                      maxWidth:
                        Math.max(
                          0,
                          chartWidthVal -
                            inclusiveBarRightPx(task.actualEnd ?? task.plannedEnd) -
                            12
                        ) + 'px',
                    }"
                  >
                    <span class="truncate pl-1 text-xs text-muted-foreground">{{
                      task.assignee
                    }}</span>
                  </div>
                </div>

                <svg
                  class="pointer-events-none absolute left-0 top-0 z-20 overflow-visible"
                  :width="chartWidthVal"
                  :height="displayedTasks.length * ROW_HEIGHT"
                >
                  <defs>
                    <marker
                      id="gantt-arrow"
                      markerWidth="8"
                      markerHeight="8"
                      refX="6"
                      refY="4"
                      orient="auto"
                      markerUnits="userSpaceOnUse"
                    >
                      <path d="M0,0 L8,4 L0,8 Z" fill="var(--muted-foreground)" />
                    </marker>
                    <marker
                      id="gantt-arrow-critical"
                      markerWidth="8"
                      markerHeight="8"
                      refX="6"
                      refY="4"
                      orient="auto"
                      markerUnits="userSpaceOnUse"
                    >
                      <path d="M0,0 L8,4 L0,8 Z" fill="var(--destructive)" />
                    </marker>
                    <marker
                      id="gantt-arrow-preview"
                      markerWidth="8"
                      markerHeight="8"
                      refX="6"
                      refY="4"
                      orient="auto"
                      markerUnits="userSpaceOnUse"
                    >
                      <path d="M0,0 L8,4 L0,8 Z" fill="var(--primary)" />
                    </marker>
                  </defs>
                  <path
                    v-for="seg in dependencyPaths"
                    :key="seg.key"
                    :d="seg.pathD"
                    fill="none"
                    :stroke="
                      showCriticalPath && seg.isCritical
                        ? 'var(--destructive)'
                        : 'var(--muted-foreground)'
                    "
                    stroke-width="showCriticalPath && seg.isCritical ? 2 : 1.75"
                    :stroke-dasharray="showCriticalPath && seg.isCritical ? 'none' : '5 3'"
                    stroke-linecap="square"
                    stroke-linejoin="miter"
                    :marker-end="
                      seg.arrow
                        ? showCriticalPath && seg.isCritical
                          ? 'url(#gantt-arrow-critical)'
                          : 'url(#gantt-arrow)'
                        : 'none'
                    "
                  />
                  <path
                    v-if="dependencyPreviewPathD"
                    :d="dependencyPreviewPathD"
                    fill="none"
                    stroke="var(--primary)"
                    stroke-width="2"
                    stroke-dasharray="6 3"
                    stroke-linecap="square"
                    marker-end="url(#gantt-arrow-preview)"
                  />
                </svg>
                <!-- 使用者里程碑線＋標籤：最上層，不被任務條／依賴線蓋住 -->
                <template v-if="showMilestoneLines">
                  <div
                    v-for="ml in milestoneLines"
                    :key="'chart-ml-' + ml.id"
                    class="pointer-events-none absolute inset-y-0 z-30 w-px"
                    :style="{
                      left: toPx(new Date(ml.date).setHours(0, 0, 0, 0)) + 'px',
                      backgroundColor: ml.color ?? 'var(--chart-3)',
                    }"
                    :title="ml.label"
                  />
                </template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </TooltipProvider>
</template>
