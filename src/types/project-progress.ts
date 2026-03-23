export interface ProgressPlanSummaryDto {
  id: string
  version: number
  label: string
  isBaseline: boolean
  effectiveFromDate: string
  effectiveFromIdx: number
  reason: string | null
  extraWeeks: number
}

export interface ProgressPeriodDto {
  periodDate: string
  periodIndex: number
  periodPlanned: string | null
  cumulativePlanned: string
  periodPlannedCompare: string | null
  cumulativePlannedCompare: string | null
  periodActual: string | null
  cumulativeActual: string
  isLocked: boolean
  isExtended: boolean
}

/** 對齊 primary 時間軸之各版累計預定 %（缺該週期則為 null） */
export interface ProgressPlanCurveDto {
  planId: string
  version: number
  label: string
  isBaseline: boolean
  cumulativePlanned: (string | null)[]
}

export interface ProgressDashboardDto {
  plans: ProgressPlanSummaryDto[]
  primaryPlanId: string | null
  comparePlanId: string | null
  periods: ProgressPeriodDto[]
  planCurves: ProgressPlanCurveDto[]
}
