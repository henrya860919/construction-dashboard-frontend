/**
 * 甘特圖資料與設定型別（自訂實作，參考常見甘特邏輯）
 */

/** 時間尺度：日 / 週 / 月 / 年 */
export type GanttScaleMode = 'day' | 'week' | 'month' | 'year'

/** 相依類型：完成→開始 (FS) */
export type GanttDependencyType = 'FS'

/** 單一任務 */
export interface GanttTask {
  id: string
  name: string
  /** WBS 編號（如 1, 1.1, 1.1.1），左欄顯示用 */
  wbsCode?: string
  /** 計劃開始 (ISO date string) */
  plannedStart: string
  /** 計劃結束 (ISO date string) */
  plannedEnd: string
  /** 實際開始 (可選，用於實際 vs 計劃) */
  actualStart?: string
  /** 實際結束 (可選) */
  actualEnd?: string
  /** 完成百分比 0–100 */
  progress: number
  /** 是否為里程碑（開始=結束） */
  isMilestone?: boolean
  /** 負責人（可選） */
  assignee?: string
  /** 前置任務 id 列表（FS：前置完成後才開始） */
  dependencies?: string[]
  /** 樹狀深度（用於 WBS 階層縮排，0=根） */
  depth?: number
  /** 父層彙總列：不可拖曳／編輯排程，時間為子項包絡 */
  isRollup?: boolean
  /** 專案根（專案名稱層），不可拖移排序 */
  isProjectRoot?: boolean
}

/** 相依關係（用於繪製連線） */
export interface GanttDependency {
  fromTaskId: string
  toTaskId: string
  type: GanttDependencyType
}

/** 使用者新增的垂直里程碑線（指定日期） */
export interface GanttMilestoneLine {
  id: string
  label: string
  date: string
  color?: string
}

/** 要徑計算結果（由 composable 計算） */
export interface GanttTaskSchedule {
  taskId: string
  earliestStart: number
  earliestFinish: number
  latestStart: number
  latestFinish: number
  slack: number
  isCritical: boolean
}

/** 時間軸刻度（四層：年、月、日、星期） */
export interface GanttScaleTick {
  dateMs: number
  labelYear: string
  labelMonth: string
  labelDay: string
  labelWeekday: string
}

/** 甘特圖左欄一列（任務 + 收合／拖移用，與 WBS 樹一致） */
export interface GanttLeftColumnItem {
  task: GanttTask
  hasChildren: boolean
  isExpanded: boolean
  parentId: string | null
}
