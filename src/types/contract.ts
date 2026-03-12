/**
 * 契約相關型別（檔案列表、工期調整、分類）
 */

/** 契約管理列表單筆（檔案名稱、上傳日期、上傳者、分類；可從 API AttachmentItem 轉換） */
export interface ContractFileRow {
  id: string
  fileName: string
  uploadDate: string
  uploader: string
  category: string
  /** 選填，用於下載 URL */
  url?: string
}

/** 工期調整列表單筆（申請日期、類型、申請/核定天數、狀態；applyDate 可為 ISO 或 YYYY-MM-DD） */
export interface ScheduleAdjustmentRow {
  id: string
  applyDate: string
  type: string
  applyDays: number
  approvedDays: number
  status: string
}

/** 與 ScheduleAdjustmentRow 同結構，供操作元件傳回 */
export type ScheduleRowItem = ScheduleAdjustmentRow
