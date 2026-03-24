<script setup lang="ts">
import * as d3 from 'd3'
import { computed, onMounted, ref, watch } from 'vue'
import { Input } from '@/components/ui/input'
import type { ProgressPeriodDto, ProgressPlanCurveDto } from '@/types/project-progress'
import {
  CHART_H,
  DATE_H,
  LEGEND_H,
  ROW_H,
  TABLE_ROWS,
  dateRowTopY,
  legendRowBaselineY,
  chartBottomY,
  chartPlotBottomY,
  chartPlotTopY,
  chartTopY,
  cellWFromHostWidth,
  curveOriginX,
  curvePeriodEndX,
  lineX,
  localTodayYmd,
  ptX,
  tableRowY,
  todayColumnIndex,
  totalSvgHeight,
  totalSvgWidth,
} from '@/lib/progress-scurve-layout'

/** 與底表 SVG 數字字級一致（12px），並留垂直置中間距 */
const TABLE_INPUT_PX = 12
const TABLE_INPUT_BOX_H = 32

export interface ChangeMarker {
  index: number
  label: string
}

const props = defineProps<{
  hostWidth: number
  periods: ProgressPeriodDto[]
  planCurves: ProgressPlanCurveDto[]
  /** 與 planCurves 同序，每列對應一期之累計 % 字串（已含 active 草稿預覽） */
  curveYValues: string[][]
  activePlanId: string
  comparePlanId: string
  displayCumulativeActual: string[]
  changeMarkers: ChangeMarker[]
  /** 與 planCurves 同序：線色 */
  curveStrokes: string[]
  grid: string
  axis: string
  headerBg: string
  tableLabelBg: string
  border: string
  extendedColumnBg: string
  todayColumnBg: string
  foreground: string
  mutedForeground: string
  actualStroke: string
  /** 變更時間點垂直線色 */
  markerStroke: string
  todayLine: string
  pointRing: string
  primaryIsBaseline: boolean
  permCanUpdatePlanned: boolean
  permCanUpdateActual: boolean
  plannedDraft: Record<string, string>
  actualDraft: Record<string, string>
  cumulativeActualDraft: Record<string, string>
}>()

const emit = defineEmits<{
  'update:plannedDraft': [periodDate: string, value: string]
  'update:actualDraft': [periodDate: string, value: string]
  'update:cumulativeActualDraft': [periodDate: string, value: string]
}>()

const d3RootRef = ref<SVGGElement | null>(null)
/** 置於 foreignObject 之上，避免 hover 提示被 HTML 輸入欄蓋住 */
const tipOverlayRef = ref<SVGGElement | null>(null)

/** 今日欄底色、垂直「今日」線、日期高亮；暫關，之後再決定呈現方式再設為 true */
const SHOW_TODAY_INDICATORS = false

const n = computed(() => props.periods.length)
const cellW = computed(() => cellWFromHostWidth(props.hostWidth, n.value))
const totalW = computed(() => totalSvgWidth(n.value, cellW.value))
const totalH = computed(() => totalSvgHeight())
const periodDates = computed(() => props.periods.map((p) => p.periodDate))
const todayIdx = computed(() =>
  SHOW_TODAY_INDICATORS ? todayColumnIndex(periodDates.value, localTodayYmd()) : null
)

function shortDate(iso: string) {
  const p = iso.split('-')
  if (p.length < 3) return iso
  return `${p[1]}-${p[2]}`
}

function lineOpacity(planId: string): number {
  if (planId === props.activePlanId) return 1
  if (props.comparePlanId && props.comparePlanId !== props.activePlanId && planId === props.comparePlanId)
    return 0.65
  return 0.35
}

function strokeWidthFor(planId: string): number {
  return planId === props.activePlanId ? 2.5 : 1.5
}

function pointRFor(planId: string): number {
  return planId === props.activePlanId ? 3.5 : 2
}

function parseY(s: string): number {
  const v = Number(String(s).replace(/,/g, ''))
  return Number.isFinite(v) ? v : NaN
}

function formatPctDisplay(y: number): string {
  const rounded = Math.round(y * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

function yDomainMax(): number {
  let m = 100
  for (const row of props.curveYValues) {
    for (const s of row) {
      const y = parseY(s)
      if (Number.isFinite(y)) m = Math.max(m, y)
    }
  }
  for (const s of props.displayCumulativeActual) {
    const y = parseY(s)
    if (Number.isFinite(y)) m = Math.max(m, y)
  }
  return m * 1.02
}

function render() {
  const gRoot = d3RootRef.value
  const tipHost = tipOverlayRef.value
  if (!gRoot || !tipHost || n.value <= 0) return

  const cw = cellW.value
  const W = totalW.value
  const H = totalH.value
  const top = chartTopY()
  const bottom = chartBottomY()
  const plotTop = chartPlotTopY()
  const plotBottom = chartPlotBottomY()
  const plotH = CHART_H
  const yMax = yDomainMax()
  const yScale = d3.scaleLinear().domain([0, yMax]).range([plotBottom, plotTop])

  const sel = d3.select(gRoot)
  sel.selectAll('*').remove()

  const tipLayer = d3.select(tipHost)
  tipLayer.selectAll('*').remove()

  const guideRoot = tipLayer
    .append('g')
    .attr('class', 'progress-scurve-hover-guide')
    .attr('pointer-events', 'none')
    .style('visibility', 'hidden')

  const tipRoot = tipLayer
    .append('g')
    .attr('class', 'progress-scurve-tooltip')
    .attr('pointer-events', 'none')
    .style('display', 'none')

  const guideLine = guideRoot
    .append('line')
    .attr('x1', curveOriginX(cw))
    .attr('x2', curveOriginX(cw))
    .attr('y1', plotTop)
    .attr('y2', plotBottom)
    .attr('stroke', props.foreground)
    .attr('stroke-width', 1.25)
    .attr('stroke-dasharray', '6 4')
    .attr('opacity', 0.45)

  let tipBox = { w: 220, h: 100 }

  function hideTip() {
    tipRoot.style('display', 'none')
    tipRoot.selectAll('*').remove()
    guideRoot.style('visibility', 'hidden')
  }

  function setHoverGuideColumn(idx: number) {
    const x = curvePeriodEndX(idx, cw)
    guideLine.attr('x1', x).attr('x2', x)
    guideRoot.style('visibility', 'visible')
  }

  function positionTip(event: MouseEvent) {
    const { w, h } = tipBox
    const [px, py] = d3.pointer(event, gRoot)
    let tx = px + 12
    let ty = py + 8
    const margin = 4
    if (tx + w > W - margin) tx = Math.max(margin, px - w - 8)
    if (ty + h > H - margin) ty = Math.max(margin, py - h - 8)
    if (tx < margin) tx = margin
    if (ty < margin) ty = margin
    tipRoot.attr('transform', `translate(${tx}, ${ty})`)
  }

  /** 依游標 x 落在哪一個時間欄 [lineX(i), lineX(i+1)) → 期別 i（與期末累計點對齊） */
  function periodIndexFromCursorX(px: number): number {
    if (n.value <= 0) return 0
    const x0 = lineX(0, cw)
    if (px < x0) return 0
    for (let i = 0; i < n.value; i++) {
      if (px < lineX(i + 1, cw)) return i
    }
    return n.value - 1
  }

  function buildPlanTipLinesAtIndex(p: ProgressPlanCurveDto, yRow: string[], idx: number): string[] {
    if (idx < 0 || idx >= n.value) return []
    const period = props.periods[idx]
    if (!period) return []
    const yv = parseY(yRow[idx] ?? '')
    const cumDisp = Number.isFinite(yv) ? `${formatPctDisplay(yv)}%` : '—'
    const lines = [
      `時間區間：${period.periodDate}`,
      `${p.label}（v${p.version}）`,
      `累計預定：${cumDisp}`,
    ]
    if (p.planId === props.activePlanId) {
      const pp =
        props.plannedDraft[period.periodDate]?.trim() || period.periodPlanned?.trim() || '—'
      const ppDisp = pp === '—' ? pp : /%$/.test(pp) ? pp : `${pp}%`
      lines.push(`本期預定：${ppDisp}`)
    }
    return lines
  }

  function buildActualTipLinesAtIndex(idx: number): string[] {
    if (idx < 0 || idx >= n.value) return []
    const period = props.periods[idx]
    if (!period) return []
    const yv = parseY(props.displayCumulativeActual[idx] ?? '')
    const cumDisp = Number.isFinite(yv) ? `${formatPctDisplay(yv)}%` : '—'
    const paRaw =
      props.actualDraft[period.periodDate]?.trim() || period.periodActual?.trim() || '—'
    const paDisp = paRaw === '—' ? paRaw : /%$/.test(paRaw) ? paRaw : `${paRaw}%`
    return [
      `時間區間：${period.periodDate}`,
      '實際進度',
      `累計實際：${cumDisp}`,
      `本期實際：${paDisp}`,
    ]
  }

  /** SVG text 不換行：依字元粗估寬度（CJK／全形約 1em，英數約 0.56em）避免底過窄 */
  const TIP_FONT_PX = 13
  function estimateTipLineWidthPx(line: string): number {
    let px = 0
    for (const ch of line) {
      const c = ch.codePointAt(0) ?? 0
      const cjkOrFull =
        (c >= 0x4e00 && c <= 0x9fff) ||
        (c >= 0x3400 && c <= 0x4dbf) ||
        (c >= 0xf900 && c <= 0xfaff) ||
        (c >= 0xff00 && c <= 0xffef)
      px += cjkOrFull ? TIP_FONT_PX : TIP_FONT_PX * 0.56
    }
    return Math.ceil(px)
  }

  function showPeriodTip(event: MouseEvent, lines: string[]) {
    if (lines.length === 0) return
    const lineHeight = 18
    const pad = 10
    const maxW = 340
    const minW = 148
    const extraPad = 6
    const contentW = Math.max(...lines.map((l) => estimateTipLineWidthPx(l)), minW - pad * 2)
    const approxW = Math.min(maxW, contentW + pad * 2 + extraPad)
    const h = pad * 2 + lines.length * lineHeight
    tipBox = { w: approxW, h }

    tipRoot.selectAll('*').remove()
    tipRoot
      .append('rect')
      .attr('rx', 6)
      .attr('ry', 6)
      .attr('stroke-width', 1)
      .attr('width', approxW)
      .attr('height', h)
      .attr('fill', props.tableLabelBg)
      .attr('stroke', props.border)
    lines.forEach((line, li) => {
      tipRoot
        .append('text')
        .attr('class', 'tip-line')
        .attr('x', pad)
        .attr('y', pad + (li + 1) * lineHeight - 3)
        .attr('fill', props.foreground)
        .attr('font-size', TIP_FONT_PX)
        .text(line)
    })
    tipRoot.style('display', null)
    positionTip(event)
  }

  function updatePlanLineHover(event: MouseEvent, p: ProgressPlanCurveDto, yRow: string[]) {
    const [px] = d3.pointer(event, gRoot)
    const idx = periodIndexFromCursorX(px)
    setHoverGuideColumn(idx)
    showPeriodTip(event, buildPlanTipLinesAtIndex(p, yRow, idx))
  }

  function updateActualLineHover(event: MouseEvent) {
    const [px] = d3.pointer(event, gRoot)
    const idx = periodIndexFromCursorX(px)
    setHoverGuideColumn(idx)
    showPeriodTip(event, buildActualTipLinesAtIndex(idx))
  }

  const plansOrdered = [...props.planCurves]
    .map((p, orderIdx) => ({ p, orderIdx, yRow: props.curveYValues[orderIdx] ?? [] }))
    .sort((a, b) => {
      const aA = a.p.planId === props.activePlanId ? 1 : 0
      const bA = b.p.planId === props.activePlanId ? 1 : 0
      if (aA !== bA) return aA - bA
      return a.p.version - b.p.version
    })

  // --- Layer 0: 外框、今日欄、追加欄 ---
  sel
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', W)
    .attr('height', H)
    .attr('fill', 'none')
    .attr('stroke', props.border)
    .attr('rx', 6)

  const tIdx = todayIdx.value
  if (tIdx != null && tIdx < n.value) {
    sel
      .append('rect')
      .attr('x', lineX(tIdx, cw))
      .attr('y', 0)
      .attr('width', cw)
      .attr('height', H)
      .attr('fill', props.todayColumnBg)
      .attr('pointer-events', 'none')
  }
  for (let i = 0; i < n.value; i++) {
    if (props.periods[i]?.isExtended) {
      sel
        .append('rect')
        .attr('x', lineX(i, cw))
        .attr('y', 0)
        .attr('width', cw)
        .attr('height', H)
        .attr('fill', props.extendedColumnBg)
        .attr('pointer-events', 'none')
    }
  }

  // --- 圖例列 + 日期列（圖例在日期上方） ---
  const headerH = LEGEND_H + DATE_H
  const dTop = dateRowTopY()
  sel
    .append('rect')
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', W)
    .attr('height', headerH)
    .attr('fill', props.headerBg)
    .attr('stroke', 'none')

  const legY = legendRowBaselineY()
  let lx = lineX(0, cw) + 8
  const plansForLegend = [...props.planCurves].sort((a, b) => a.version - b.version)
  for (const p of plansForLegend) {
    const oi = props.planCurves.findIndex((c) => c.planId === p.planId)
    const stroke = props.curveStrokes[oi] ?? props.mutedForeground
    const op = lineOpacity(p.planId)
    sel
      .append('line')
      .attr('x1', lx)
      .attr('x2', lx + 18)
      .attr('y1', legY)
      .attr('y2', legY)
      .attr('stroke', stroke)
      .attr('stroke-width', p.planId === props.activePlanId ? 2.5 : 1.5)
      .attr('opacity', op)
      .attr('stroke-dasharray', p.isBaseline ? '4 3' : null)
    sel
      .append('circle')
      .attr('cx', lx + 9)
      .attr('cy', legY)
      .attr('r', 3)
      .attr('fill', stroke)
      .attr('opacity', op)
    sel
      .append('text')
      .attr('x', lx + 24)
      .attr('y', legY + 3)
      .attr('fill', props.mutedForeground)
      .attr('font-size', 11)
      .text(`${p.label} v${p.version}`)
    lx += Math.min(140, 24 + (p.label.length + 6) * 7)
  }
  lx += 12
  sel
    .append('line')
    .attr('x1', lx)
    .attr('x2', lx + 18)
    .attr('y1', legY)
    .attr('y2', legY)
    .attr('stroke', props.actualStroke)
    .attr('stroke-width', 2.5)
  sel
    .append('path')
    .attr(
      'd',
      `M ${lx + 9} ${legY - 4} L ${lx + 14} ${legY + 3} L ${lx + 4} ${legY + 3} Z`
    )
    .attr('fill', props.actualStroke)
  sel
    .append('text')
    .attr('x', lx + 24)
    .attr('y', legY + 3)
    .attr('fill', props.mutedForeground)
    .attr('font-size', 11)
    .text('實際')

  sel
    .append('line')
    .attr('x1', 0)
    .attr('x2', W)
    .attr('y1', LEGEND_H)
    .attr('y2', LEGEND_H)
    .attr('stroke', props.grid)
    .attr('stroke-width', 1)
    .attr('opacity', 0.65)

  for (let i = 0; i <= n.value; i++) {
    const x = lineX(i, cw)
    sel
      .append('line')
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', dTop)
      .attr('y2', H)
      .attr('stroke', props.grid)
      .attr('stroke-width', 1)
  }

  sel
    .append('line')
    .attr('x1', lineX(0, cw))
    .attr('x2', lineX(0, cw))
    .attr('y1', dTop)
    .attr('y2', H)
    .attr('stroke', props.border)
    .attr('stroke-width', 1.2)

  const dateTextY = dTop + DATE_H / 2 + 4
  sel
    .append('text')
    .attr('x', lineX(0, cw) - 6)
    .attr('y', dateTextY)
    .attr('text-anchor', 'end')
    .attr('fill', props.mutedForeground)
    .attr('font-size', 13)
    .text('日期')

  for (let i = 0; i < n.value; i++) {
    const isToday = tIdx === i
    sel
      .append('text')
      .attr('x', ptX(i, cw))
      .attr('y', dateTextY)
      .attr('text-anchor', 'middle')
      .attr('fill', isToday ? props.actualStroke : props.foreground)
      .attr('font-size', 12)
      .attr('class', 'tabular-nums')
      .text(shortDate(periodDates.value[i]!))
  }

  // --- Layer 2: Y 軸水平格線 + 刻度 ---
  const yTicks = [0, 25, 50, 75, 100].filter((t) => t <= yMax)
  for (const tick of yTicks) {
    const y = yScale(tick)
    sel
      .append('line')
      .attr('x1', lineX(0, cw))
      .attr('x2', W)
      .attr('y1', y)
      .attr('y2', y)
      .attr('stroke', props.grid)
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4 4')
      .attr('opacity', 0.6)
    sel
      .append('text')
      .attr('x', lineX(0, cw) - 6)
      .attr('y', y + 3)
      .attr('text-anchor', 'end')
      .attr('fill', props.axis)
      .attr('font-size', 11)
      .text(`${tick}%`)
  }

  sel
    .append('text')
    .attr('x', 12)
    .attr('y', top + plotH / 2)
    .attr('text-anchor', 'middle')
    .attr('fill', props.mutedForeground)
    .attr('font-size', 12)
    .attr('transform', `rotate(-90, 12, ${top + plotH / 2})`)
    .text('累計 %')

  function curveDatumX(d: { i: number }): number {
    if (d.i === -1) return curveOriginX(cw)
    return curvePeriodEndX(d.i, cw)
  }

  const lineGen = d3
    .line<{ i: number; y: number }>()
    .x((d) => curveDatumX(d))
    .y((d) => yScale(d.y))
    .defined((d) => Number.isFinite(d.y))

  const areaGen = d3
    .area<{ i: number; y: number }>()
    .x((d) => curveDatumX(d))
    .y0(plotBottom)
    .y1((d) => yScale(d.y))
    .defined((d) => Number.isFinite(d.y))

  /** 折線起點為 (curveOriginX, 0)，各期期末為 lineX(i+1) */
  function pointsFromRow(row: string[]): { i: number; y: number }[] {
    const pts: { i: number; y: number }[] = [{ i: -1, y: 0 }]
    for (let i = 0; i < row.length; i++) {
      const y = parseY(row[i] ?? '')
      if (Number.isFinite(y)) pts.push({ i, y })
    }
    return pts
  }

  // --- Layer 3–4: 面積（非 active 先）---
  for (const { p, orderIdx, yRow } of plansOrdered) {
    if (p.planId === props.activePlanId) continue
    const pts = pointsFromRow(yRow)
    if (pts.length < 2) continue
    const stroke = props.curveStrokes[orderIdx] ?? props.mutedForeground
    sel
      .append('path')
      .datum(pts)
      .attr('fill', stroke)
      .attr('fill-opacity', 0.04)
      .attr('opacity', 0.9)
      .attr('pointer-events', 'none')
      .attr('d', areaGen)
  }
  for (const { p, orderIdx, yRow } of plansOrdered) {
    if (p.planId !== props.activePlanId) continue
    const pts = pointsFromRow(yRow)
    if (pts.length < 2) continue
    const stroke = props.curveStrokes[orderIdx] ?? props.mutedForeground
    sel
      .append('path')
      .datum(pts)
      .attr('fill', stroke)
      .attr('fill-opacity', 0.08)
      .attr('opacity', 0.95)
      .attr('pointer-events', 'none')
      .attr('d', areaGen)
  }

  // --- Layer 5–6: 計畫線與點 ---
  for (const { p, orderIdx, yRow } of plansOrdered) {
    const pts = pointsFromRow(yRow)
    if (pts.length < 2) continue
    const stroke = props.curveStrokes[orderIdx] ?? props.foreground
    const op = lineOpacity(p.planId)
    const sw = strokeWidthFor(p.planId)
    const dash = p.isBaseline ? '5,3' : 'none'
    sel
      .append('path')
      .datum(pts)
      .attr('fill', 'none')
      .attr('stroke', stroke)
      .attr('stroke-width', sw)
      .attr('opacity', op)
      .attr('stroke-dasharray', dash === 'none' ? null : dash)
      .attr('pointer-events', 'none')
      .attr('d', lineGen)
  }

  for (const { p, orderIdx, yRow } of plansOrdered) {
    const stroke = props.curveStrokes[orderIdx] ?? props.foreground
    const op = lineOpacity(p.planId)
    const pr = pointRFor(p.planId)
    const rowPts = pointsFromRow(yRow)
    for (let i = 0; i < yRow.length; i++) {
      const yv = parseY(yRow[i] ?? '')
      if (!Number.isFinite(yv)) continue
      const cxEnd = curvePeriodEndX(i, cw)
      sel
        .append('circle')
        .attr('pointer-events', 'none')
        .attr('cx', Math.min(cxEnd, W - pr - 0.5))
        .attr('cy', yScale(yv))
        .attr('r', pr)
        .attr('fill', stroke)
        .attr('stroke', props.pointRing)
        .attr('stroke-width', 1.5)
        .attr('opacity', op)
    }
    if (rowPts.length >= 2) {
      sel
        .append('circle')
        .attr('pointer-events', 'none')
        .attr('cx', curveOriginX(cw))
        .attr('cy', yScale(0))
        .attr('r', Math.max(Math.min(pr, 2.5), 2))
        .attr('fill', stroke)
        .attr('stroke', props.pointRing)
        .attr('stroke-width', 1.5)
        .attr('opacity', op)
    }
  }

  // --- Layer 7: 變更標記 ---
  const markerByIdx = new Map<number, string[]>()
  for (const m of props.changeMarkers) {
    if (m.index < 0 || m.index >= n.value) continue
    const arr = markerByIdx.get(m.index) ?? []
    arr.push(m.label)
    markerByIdx.set(m.index, arr)
  }
  for (const [idx, labels] of markerByIdx) {
    const x = curvePeriodEndX(idx, cw)
    const stroke = props.markerStroke
    sel
      .append('line')
      .attr('x1', x)
      .attr('x2', x)
        .attr('y1', plotTop)
        .attr('y2', plotBottom)
        .attr('stroke', stroke)
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 3')
        .attr('opacity', 0.5)
        .attr('pointer-events', 'none')
    const text = labels.join('、')
    sel
      .append('text')
      .attr('x', x)
      .attr('y', plotTop - 4)
      .attr('text-anchor', 'middle')
      .attr('fill', stroke)
      .attr('font-size', 11)
      .text(text.length > 18 ? `${text.slice(0, 16)}…` : text)
  }

  // --- Layer 8: 實際 ---
  const actFinite = props.displayCumulativeActual
    .map((s, i) => ({ i, y: parseY(s) }))
    .filter((d) => Number.isFinite(d.y))
  const actPts: { i: number; y: number }[] = [{ i: -1, y: 0 }, ...actFinite]
  if (actPts.length >= 2) {
    sel
      .append('path')
      .datum(actPts)
      .attr('fill', props.actualStroke)
      .attr('fill-opacity', 0.08)
      .attr('opacity', 0.9)
      .attr('pointer-events', 'none')
      .attr('d', areaGen)
    sel
      .append('path')
      .datum(actPts)
      .attr('fill', 'none')
      .attr('stroke', props.actualStroke)
      .attr('stroke-width', 2.5)
      .attr('pointer-events', 'none')
      .attr('d', lineGen)
    sel
      .append('circle')
      .attr('pointer-events', 'none')
      .attr('cx', curveOriginX(cw))
      .attr('cy', yScale(0))
      .attr('r', 2.5)
      .attr('fill', props.actualStroke)
      .attr('stroke', props.pointRing)
      .attr('stroke-width', 1.2)
    for (const d of actPts) {
      if (d.i < 0) continue
      const ax = curvePeriodEndX(d.i, cw)
      const ay = yScale(d.y)
      const triRight = Math.min(ax + 5, W - 0.5)
      sel
        .append('path')
        .attr('pointer-events', 'none')
        .attr(
          'd',
          `M ${ax} ${ay - 5} L ${triRight} ${ay + 3} L ${ax - 5} ${ay + 3} Z`
        )
        .attr('fill', props.actualStroke)
        .attr('stroke', props.pointRing)
        .attr('stroke-width', 1.2)
    }
  }

  // --- Layer 9: 今日線 ---
  if (tIdx != null && tIdx < n.value) {
    const x = ptX(tIdx, cw)
    sel
      .append('line')
      .attr('x1', x)
      .attr('x2', x)
      .attr('y1', plotTop)
      .attr('y2', plotBottom)
      .attr('stroke', props.todayLine)
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '3 3')
      .attr('pointer-events', 'none')
    sel
      .append('text')
      .attr('x', x)
      .attr('y', plotTop + 12)
      .attr('text-anchor', 'middle')
      .attr('fill', props.todayLine)
      .attr('font-size', 11)
      .text('今日')
  }

  // --- Layer 10: 圖表底邊 ---
  sel
    .append('line')
    .attr('x1', 0)
    .attr('x2', W)
    .attr('y1', bottom)
    .attr('y2', bottom)
    .attr('stroke', props.border)
    .attr('stroke-width', 1.2)

  // --- Layer 11: 底表背景與格線、文字 ---
  const rowLabels = ['本期預定（%）', '累計預定（%）', '本期實際（%）', '累計實際（%）']
  for (let r = 0; r < TABLE_ROWS; r++) {
    const y0 = tableRowY(r)
    sel
      .append('rect')
      .attr('x', 0)
      .attr('y', y0)
      .attr('width', lineX(0, cw))
      .attr('height', ROW_H)
      .attr('fill', props.tableLabelBg)
    sel
      .append('line')
      .attr('x1', 0)
      .attr('x2', W)
      .attr('y1', y0 + ROW_H)
      .attr('y2', y0 + ROW_H)
      .attr('stroke', props.grid)
      .attr('stroke-width', 1)
    sel
      .append('text')
      .attr('x', lineX(0, cw) - 6)
      .attr('y', y0 + ROW_H / 2 + 4)
      .attr('text-anchor', 'end')
      .attr('fill', props.mutedForeground)
      .attr('font-size', TABLE_INPUT_PX)
      .attr('font-weight', '400')
      .text(rowLabels[r] ?? '')
  }

  const activeOrder = props.planCurves.findIndex((c) => c.planId === props.activePlanId)
  const activeRow = activeOrder >= 0 ? (props.curveYValues[activeOrder] ?? []) : []

  for (let i = 0; i < n.value; i++) {
    const cp = activeRow[i] ?? ''
    const yCumP = tableRowY(1) + ROW_H / 2 + 4
    sel
      .append('text')
      .attr('x', ptX(i, cw))
      .attr('y', yCumP)
      .attr('text-anchor', 'middle')
      .attr('fill', props.foreground)
      .attr('font-size', TABLE_INPUT_PX)
      .attr('font-weight', '400')
      .attr('class', 'tabular-nums')
      .attr('opacity', props.periods[i]?.isLocked ? 0.45 : 1)
      .text(cp || '0')
  }

  for (let i = 0; i < n.value; i++) {
    if (props.permCanUpdateActual) continue
    const ca = (props.displayCumulativeActual[i] ?? '').trim()
    const yCumA = tableRowY(3) + ROW_H / 2 + 4
    sel
      .append('text')
      .attr('x', ptX(i, cw))
      .attr('y', yCumA)
      .attr('text-anchor', 'middle')
      .attr('fill', props.foreground)
      .attr('font-size', TABLE_INPUT_PX)
      .attr('font-weight', '400')
      .attr('class', 'tabular-nums')
      .text(ca ? ca : '—')
  }

  // 本期預定（僅文字，非 input）：baseline 或無權限
  for (let i = 0; i < n.value; i++) {
    if (props.permCanUpdatePlanned && !props.primaryIsBaseline) continue
    const v = props.plannedDraft[periodDates.value[i]!]?.trim()
    const y0 = tableRowY(0) + ROW_H / 2 + 4
    sel
      .append('text')
      .attr('x', ptX(i, cw))
      .attr('y', y0)
      .attr('text-anchor', 'middle')
      .attr('fill', props.foreground)
      .attr('font-size', TABLE_INPUT_PX)
      .attr('font-weight', '400')
      .attr('class', 'tabular-nums')
      .attr('opacity', props.periods[i]?.isLocked ? 0.45 : 1)
      .text(v ? v : '—')
  }

  for (let i = 0; i < n.value; i++) {
    if (props.permCanUpdateActual) continue
    const v = props.actualDraft[periodDates.value[i]!]?.trim()
    const y0 = tableRowY(2) + ROW_H / 2 + 4
    sel
      .append('text')
      .attr('x', ptX(i, cw))
      .attr('y', y0)
      .attr('text-anchor', 'middle')
      .attr('fill', props.foreground)
      .attr('font-size', TABLE_INPUT_PX)
      .attr('font-weight', '400')
      .attr('class', 'tabular-nums')
      .text(v ? v : '—')
  }

  // --- 曲線 hover：寬透明 stroke 命中整條線；依游標 x 取最近一期，只顯示該期進度 ---
  const HIT_STROKE = 18
  const plansHitOrder = [...plansOrdered].reverse()
  for (const { p, yRow } of plansHitOrder) {
    const pts = pointsFromRow(yRow)
    const dash = p.isBaseline ? '5,3' : 'none'
    if (pts.length >= 2) {
      sel
        .append('path')
        .datum(pts)
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', HIT_STROKE)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round')
        .attr('pointer-events', 'stroke')
        .style('cursor', 'pointer')
        .attr('stroke-dasharray', dash === 'none' ? null : dash)
        .attr('d', lineGen)
        .on('mouseenter', (e) => updatePlanLineHover(e as MouseEvent, p, yRow))
        .on('mousemove', (e) => updatePlanLineHover(e as MouseEvent, p, yRow))
        .on('mouseleave', hideTip)
    }
  }

  if (actPts.length >= 2) {
    sel
      .append('path')
      .datum(actPts)
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', HIT_STROKE)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round')
      .attr('pointer-events', 'stroke')
      .style('cursor', 'pointer')
      .attr('d', lineGen)
      .on('mouseenter', (e) => updateActualLineHover(e as MouseEvent))
      .on('mousemove', (e) => updateActualLineHover(e as MouseEvent))
      .on('mouseleave', hideTip)
  }

}

watch(
  () => ({
    hostWidth: props.hostWidth,
    periods: props.periods,
    planCurves: props.planCurves,
    curveYValues: props.curveYValues,
    activePlanId: props.activePlanId,
    comparePlanId: props.comparePlanId,
    displayCumulativeActual: props.displayCumulativeActual,
    changeMarkers: props.changeMarkers,
    curveStrokes: props.curveStrokes,
    grid: props.grid,
    axis: props.axis,
    headerBg: props.headerBg,
    tableLabelBg: props.tableLabelBg,
    border: props.border,
    extendedColumnBg: props.extendedColumnBg,
    todayColumnBg: props.todayColumnBg,
    foreground: props.foreground,
    mutedForeground: props.mutedForeground,
    actualStroke: props.actualStroke,
    markerStroke: props.markerStroke,
    todayLine: props.todayLine,
    pointRing: props.pointRing,
    primaryIsBaseline: props.primaryIsBaseline,
    permCanUpdatePlanned: props.permCanUpdatePlanned,
    permCanUpdateActual: props.permCanUpdateActual,
    plannedDraft: props.plannedDraft,
    actualDraft: props.actualDraft,
    cumulativeActualDraft: props.cumulativeActualDraft,
  }),
  () => render(),
  { deep: true }
)

onMounted(() => render())

function foX(i: number) {
  return lineX(i, cellW.value) + 4
}
function foY(row: number) {
  return tableRowY(row) + (ROW_H - TABLE_INPUT_BOX_H) / 2
}
function foW() {
  return cellW.value - 8
}
function foH() {
  return TABLE_INPUT_BOX_H
}
</script>

<template>
  <svg
    class="block max-w-none text-foreground"
    :width="totalW"
    :height="totalH"
    :viewBox="`0 0 ${totalW} ${totalH}`"
    role="img"
    aria-label="進度 S 曲線與週期表"
  >
    <g ref="d3RootRef" />

    <!-- Layer 11: 可編輯儲存格（foreignObject，在圖例之下由 DOM 順序覆蓋於表列） -->
    <foreignObject
      v-for="(p, i) in periods"
      v-show="permCanUpdatePlanned && !primaryIsBaseline"
      :key="`pp-${p.periodDate}`"
      :x="foX(i)"
      :y="foY(0)"
      :width="foW()"
      :height="foH()"
    >
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        class="flex h-full items-center justify-center"
      >
        <Input
          :model-value="plannedDraft[p.periodDate] ?? ''"
          :disabled="p.isLocked"
          class="h-8 w-full min-h-0 border-border bg-background px-2 py-0 text-center tabular-nums text-[12px] leading-none font-normal md:text-[12px] shadow-none"
          @update:model-value="(v) => emit('update:plannedDraft', p.periodDate, String(v))"
        />
      </div>
    </foreignObject>

    <foreignObject
      v-for="(p, i) in periods"
      v-show="permCanUpdateActual"
      :key="`pa-${p.periodDate}`"
      :x="foX(i)"
      :y="foY(2)"
      :width="foW()"
      :height="foH()"
    >
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        class="flex h-full items-center justify-center"
      >
        <Input
          :model-value="actualDraft[p.periodDate] ?? ''"
          class="h-8 w-full min-h-0 border-border bg-background px-2 py-0 text-center tabular-nums text-[12px] leading-none font-normal md:text-[12px] shadow-none"
          @update:model-value="(v) => emit('update:actualDraft', p.periodDate, String(v))"
        />
      </div>
    </foreignObject>

    <foreignObject
      v-for="(p, i) in periods"
      v-show="permCanUpdateActual"
      :key="`pca-${p.periodDate}`"
      :x="foX(i)"
      :y="foY(3)"
      :width="foW()"
      :height="foH()"
    >
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        class="flex h-full items-center justify-center"
      >
        <Input
          :model-value="cumulativeActualDraft[p.periodDate] ?? ''"
          class="h-8 w-full min-h-0 border-border bg-background px-2 py-0 text-center tabular-nums text-[12px] leading-none font-normal md:text-[12px] shadow-none"
          @update:model-value="(v) => emit('update:cumulativeActualDraft', p.periodDate, String(v))"
        />
      </div>
    </foreignObject>

    <!-- 最上層：hover 提示與垂直參考線（須在 foreignObject 之後才不會被輸入欄遮住） -->
    <g ref="tipOverlayRef" class="pointer-events-none" aria-hidden="true" />
  </svg>
</template>
