import type { Ref } from 'vue'
import { ref, computed } from 'vue'
import type { GanttTask, GanttScaleMode, GanttTaskSchedule, GanttScaleTick } from '@/types/gantt'
import { wbsDurationInclusiveDays } from '@/lib/wbs-schedule-dates'

const MS_PER_DAY = 24 * 60 * 60 * 1000

function parseDate(d: string): number {
  return new Date(d).setHours(0, 0, 0, 0)
}

/** 要徑：前向計算 ES/EF，後向計算 LS/LF（以「天」為單位），slack = LS - ES，critical = slack <= 0 */
function computeCriticalPath(
  tasks: GanttTask[],
  projectStartDay: number
): Map<string, GanttTaskSchedule> {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const schedule = new Map<string, GanttTaskSchedule>()

  const getDurationDays = (t: GanttTask) =>
    wbsDurationInclusiveDays(t.plannedStart, t.plannedEnd)

  const toDay = (dateMs: number) => Math.round((dateMs - projectStartDay) / MS_PER_DAY)

  // 前向：ES, EF（天數，從 projectStartDay 起算）
  const sorted = topologicalSort(tasks)
  for (const t of sorted) {
    const deps = t.dependencies ?? []
    const es =
      deps.length > 0
        ? Math.max(...deps.map((id) => schedule.get(id)?.earliestFinish ?? 0))
        : Math.max(0, toDay(parseDate(t.plannedStart)))
    const dur = getDurationDays(t)
    const ef = es + dur
    schedule.set(t.id, {
      taskId: t.id,
      earliestStart: es,
      earliestFinish: ef,
      latestStart: 0,
      latestFinish: 0,
      slack: 0,
      isCritical: false,
    })
  }

  const projectEndDays = Math.max(...Array.from(schedule.values()).map((s) => s.earliestFinish))
  const taskIds = Array.from(schedule.keys())

  // 後向：LF, LS（天）
  for (let i = taskIds.length - 1; i >= 0; i--) {
    const id = taskIds[i]
    const t = byId.get(id)!
    const s = schedule.get(id)!
    const successors = tasks.filter((x) => (x.dependencies ?? []).includes(id))
    const lf =
      successors.length > 0
        ? Math.min(...successors.map((x) => schedule.get(x.id)!.latestStart))
        : projectEndDays
    const dur = getDurationDays(t)
    const ls = lf - dur
    s.latestFinish = lf
    s.latestStart = ls
    s.slack = s.latestStart - s.earliestStart
    s.isCritical = s.slack <= 0
  }

  return schedule
}

function topologicalSort(tasks: GanttTask[]): GanttTask[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const visited = new Set<string>()
  const result: GanttTask[] = []

  function visit(id: string) {
    if (visited.has(id)) return
    visited.add(id)
    const t = byId.get(id)
    if (!t) return
    for (const depId of t.dependencies ?? []) {
      visit(depId)
    }
    result.push(t)
  }

  for (const t of tasks) {
    visit(t.id)
  }
  return result
}

export function useGantt(
  tasks: { value: GanttTask[] },
  options?: { scaleMode?: Ref<GanttScaleMode> }
) {
  const scaleMode = options?.scaleMode ?? ref<GanttScaleMode>('week')
  const zoom = ref(1)
  const panX = ref(0)

  /** 時間軸：往前 20 年、往後 30 年（固定範圍） */
  const dateRange = computed(() => {
    const today = new Date()
    const start = new Date(today.getFullYear() - 20, today.getMonth(), today.getDate(), 0, 0, 0, 0)
    const end = new Date(today.getFullYear() + 30, today.getMonth(), today.getDate(), 0, 0, 0, 0)
    return { start: start.getTime(), end: end.getTime() }
  })

  const projectStartMs = computed(() => dateRange.value.start)
  const criticalPathMap = computed(() =>
    computeCriticalPath(
      tasks.value.filter((t) => !t.isRollup),
      projectStartMs.value
    )
  )

  const totalDays = computed(() => {
    const { start, end } = dateRange.value
    return Math.ceil((end - start) / MS_PER_DAY)
  })

  /** 一日的格子寬度（px），兩倍寬以利閱讀日期與星期 */
  const basePxPerDay = 72
  const pxPerDay = computed(() => basePxPerDay * zoom.value)
  const chartWidth = computed(() => Math.max(totalDays.value * pxPerDay.value, 800))

  function dateToPx(dateMs: number): number {
    const { start } = dateRange.value
    const days = (dateMs - start) / MS_PER_DAY
    return days * pxPerDay.value
  }

  function pxToDate(px: number): number {
    const { start } = dateRange.value
    const days = px / pxPerDay.value
    return start + days * MS_PER_DAY
  }

  function zoomIn() {
    zoom.value = Math.min(4, zoom.value * 1.2)
  }

  function zoomOut() {
    zoom.value = Math.max(0.3, zoom.value / 1.2)
  }

  function pan(dx: number) {
    panX.value += dx
  }

  /** 星期對照：日 一 二 三 四 五 六 */
  const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

  /** 依 scaleMode 產生時間軸刻度（四層：年、月、日、星期） */
  const scaleTicks = computed(() => {
    const { start, end } = dateRange.value
    const ticks: GanttScaleTick[] = []
    const mode = scaleMode.value
    const dStart = new Date(start)
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

    if (mode === 'year') {
      const y0 = dStart.getFullYear()
      const y1 = new Date(end).getFullYear()
      for (let y = y0; y <= y1 + 1; y++) {
        pushTick(new Date(y, 0, 1).getTime())
      }
    } else if (mode === 'month') {
      let d = new Date(dStart.getFullYear(), dStart.getMonth(), 1)
      while (d.getTime() <= end + 31 * MS_PER_DAY) {
        pushTick(d.getTime())
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
      }
    } else if (mode === 'week') {
      const weekStartSunday = (d: Date) => {
        const copy = new Date(d)
        copy.setDate(copy.getDate() - copy.getDay())
        copy.setHours(0, 0, 0, 0)
        return copy.getTime()
      }
      let t = weekStartSunday(dStart)
      while (t <= end + 7 * MS_PER_DAY) {
        pushTick(t)
        t += 7 * MS_PER_DAY
      }
    } else {
      // 日尺度：每天一刀，顯示 16 17 18 19 20 21… 與星期（範圍過大時取樣避免標籤過密）
      let d = new Date(start)
      const total = totalDays.value
      const step =
        total <= 90 ? 1 : total <= 365 ? 7 : Math.max(1, Math.floor(total / 60))
      let count = 0
      while (d.getTime() <= end + MS_PER_DAY) {
        if (count % step === 0) pushTick(d.getTime())
        d.setDate(d.getDate() + 1)
        count++
      }
    }
    return ticks
  })

  /** 六、日區段（px）供圖表繪製灰色背景 */
  const weekendRanges = computed(() => {
    const { start, end } = dateRange.value
    const ranges: { leftPx: number; widthPx: number }[] = []
    const pxPerDayVal = pxPerDay.value
    const dateToPxVal = (dateMs: number) => {
      const days = (dateMs - start) / MS_PER_DAY
      return days * pxPerDayVal
    }
    let t = start
    while (t < end) {
      const d = new Date(t).getDay()
      if (d === 0 || d === 6) {
        ranges.push({
          leftPx: dateToPxVal(t),
          widthPx: pxPerDayVal,
        })
      }
      t += MS_PER_DAY
    }
    return ranges
  })

  return {
    scaleMode,
    zoom,
    panX,
    dateRange,
    totalDays,
    pxPerDay,
    chartWidth,
    criticalPathMap,
    dateToPx,
    pxToDate,
    zoomIn,
    zoomOut,
    pan,
    parseDate,
    MS_PER_DAY,
    scaleTicks,
    weekendRanges,
  }
}
