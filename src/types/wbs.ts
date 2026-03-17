/**
 * WBS（工作分解結構）節點，支援 N 層樹狀結構
 */
export interface WbsNode {
  id: string
  /** 編號，如 1, 1.1, 1.1.1 */
  code: string
  /** 項目名稱 */
  name: string
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
