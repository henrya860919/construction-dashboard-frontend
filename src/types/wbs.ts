/** WBS 節點關聯的資源（用於顯示、人機料分組、變動成本） */
export interface WbsNodeResource {
  id: string
  name: string
  /** 人機料：labor | equipment | material */
  type?: string
  /** 單位（人天、台、噸等） */
  unit?: string
  /** 單位成本 */
  unitCost?: number
  /** 該節點使用該資源的用量（預設 1） */
  quantity?: number
}

/**
 * WBS（工作分解結構）節點，支援 N 層樹狀結構
 */
export interface WbsNode {
  id: string
  /** 編號，如 1, 1.1, 1.1.1 */
  code: string
  /** 項目名稱 */
  name: string
  /** 專案根（專案名稱層），不可編輯／刪除／拖移 */
  isProjectRoot?: boolean
  /** 開始日期 YYYY-MM-DD */
  startDate?: string | null
  /** 工期（天） */
  durationDays?: number | null
  /** 結束日期（由開始+工期推算） */
  endDate?: string | null
  /** 變動成本（資源×用量加總，由後端計算） */
  variableCost?: number | null
  /** 指派的資源（含 type 供人機料分組、quantity 供成本） */
  resources?: WbsNodeResource[]
  children?: WbsNode[]
}

/** 扁平化後的列項目（含深度，用於表格渲染與拖移 API） */
export interface WbsFlatItem {
  node: WbsNode
  depth: number
  hasChildren: boolean
  /** 父節點 id，根層為 null（拖移時送 API） */
  parentId: string | null
}
