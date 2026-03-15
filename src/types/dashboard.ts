/**
 * 儀表板相關型別：KPI、警報、環境數據、圖表等
 */

/** 專案資訊 KPI */
export interface ProjectInfoKpi {
  cumulativeDays: number
  startDate: string
  plannedCompletionDate: string
}

/** 整體進度 KPI */
export interface ProgressKpi {
  overallPercent: number
  plannedProgressPercent: number
  actualProgressPercent: number
}

/** 預算執行 KPI */
export interface BudgetKpi {
  executedAmount: number
  approvedBudget: number
  executionRatePercent: number
}

/** 警報等級 */
export type AlertLevel = 'alarm' | 'attention' | 'normal'

/** 警報項目 */
export interface AlertItem {
  id: string
  level: AlertLevel
  title: string
  value: string
  description?: string
  suggestion?: string
  /** 最後一次發生時間（ISO），用於顯示「已過 X 分鐘」 */
  lastSeenAt?: string
}

/** 環境監測單項 */
export interface EnvironmentMetric {
  key: string
  label: string
  value: number | string
  unit: string
}

/** 圖表 series 單一筆（供 vue-echarts） */
export interface ChartSeriesItem {
  name: string
  type: string
  data: (number | [string, number])[]
}

/** 環境監測項目（上方卡片用，可點選切換圖表） */
export interface MonitorMetric {
  id: string
  key: string
  label: string
  value: number | string
  unit: string
}

/** 圖表門檻線（上限、警戒等） */
export interface ChartThreshold {
  value: number
  label: string
  lineStyle?: { color?: string; type?: 'solid' | 'dashed' }
}

/** 監測項目 24h 趨勢資料點 */
export interface MonitoringTrendPoint {
  time: string
  value: number
}

/** 監測圖表資料（依選中項目提供給下方圖表） */
export interface MonitoringChartData {
  metricKey: string
  metricLabel: string
  unit: string
  series: MonitoringTrendPoint[]
  /** 上限值（可選，圖表畫虛線） */
  upperLimit?: number
  /** 警戒值（可選，圖表畫虛線） */
  warningThreshold?: number
}

/** 圖表下方摘要數值（當前、平均、最高、最低） */
export interface MonitoringChartSummary {
  current: number
  average: number
  max: number
  min: number
  unit: string
}
