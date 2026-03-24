/**
 * 進度 S 曲線單一 SVG 版面（與 .cursor/rules/progress-scurve-unified-svg.mdc 一致）
 * 格線左緣 lineX(i)、日期與底表數字置中 ptX(i)；曲線點用 curveOriginX／curvePeriodEndX
 */
/** 頂部圖例列高度（在日期列之上） */
export const LEGEND_H = 34
export const DATE_H = 28
export const CHART_H = 260
/** 圖表繪圖區上下內距（避免曲線貼邊遮擋 Y 軸刻度與日期列） */
export const CHART_PAD_TOP = 14
export const CHART_PAD_BOTTOM = 14
/** 底表四列高度（含本期輸入欄，需高於 input 避免 foreignObject 裁切） */
export const ROW_H = 40
export const TABLE_ROWS = 4
export const LABEL_W = 56
export const SUB_W = 52
export const MIN_CELL_W = 48
/** 資料區右側不再留白：總寬止於最後欄右緣 lineX(n)，避免表格外觀多一條窄欄 */
export const RIGHT_PAD = 0

export function padL(cellW: number): number {
  return cellW / 2
}

/** 垂直格線 x（欄左緣） */
export function lineX(i: number, cellW: number): number {
  return LABEL_W + SUB_W + i * cellW
}

/** 欄中心：日期、底表置中文字 */
export function ptX(i: number, cellW: number): number {
  return LABEL_W + SUB_W + padL(cellW) + i * cellW
}

/**
 * S 曲線折線／面積用的 x：
 * - 起點（累計 0%）在第一欄左緣 lineX(0)
 * - 第 i 期（0-based）期末累計在兩欄之間的格線 lineX(i+1)
 */
export function curveOriginX(cellW: number): number {
  return lineX(0, cellW)
}

export function curvePeriodEndX(periodIndex: number, cellW: number): number {
  return lineX(periodIndex + 1, cellW)
}

export function totalSvgWidth(n: number, cellW: number): number {
  if (n <= 0) return LABEL_W + SUB_W + RIGHT_PAD
  return ptX(n - 1, cellW) + padL(cellW) + RIGHT_PAD
}

export function totalSvgHeight(): number {
  return LEGEND_H + DATE_H + CHART_H + TABLE_ROWS * ROW_H
}

/** 日期列頂緣 y（緊接在圖例列下方） */
export function dateRowTopY(): number {
  return LEGEND_H
}

export function chartTopY(): number {
  return LEGEND_H + DATE_H
}

export function chartBottomY(): number {
  return LEGEND_H + DATE_H + CHART_H
}

/** S 曲線實際繪圖上緣（含內距，低於日期列底） */
export function chartPlotTopY(): number {
  return chartTopY() + CHART_PAD_TOP
}

/** S 曲線實際繪圖下緣（含內距，高於圖表區底線） */
export function chartPlotBottomY(): number {
  return chartBottomY() - CHART_PAD_BOTTOM
}

export function tableRowY(rowIndex: number): number {
  return LEGEND_H + DATE_H + CHART_H + rowIndex * ROW_H
}

/** 圖例單行垂直基線（約在圖例列中央） */
export function legendRowBaselineY(): number {
  return Math.round(LEGEND_H / 2) + 3
}

/** 依容器寬度分配 CELL_W（與原進度表邏輯對齊） */
export function cellWFromHostWidth(hostWidth: number, n: number): number {
  if (n <= 0) return MIN_CELL_W
  const left = LABEL_W + SUB_W
  const rawAvail = Math.max(0, hostWidth - left - RIGHT_PAD)
  const minPlot = n * MIN_CELL_W
  const avail = Math.max(minPlot, rawAvail)
  return Math.max(MIN_CELL_W, Math.floor(avail / n))
}

export function localTodayYmd(): string {
  const t = new Date()
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const d = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 今日所在欄：最後一個 periodDate <= 今日 的索引 */
export function todayColumnIndex(periodDates: string[], todayYmd = localTodayYmd()): number | null {
  let best = -1
  for (let i = 0; i < periodDates.length; i++) {
    if (periodDates[i]! <= todayYmd) best = i
  }
  return best >= 0 ? best : null
}
