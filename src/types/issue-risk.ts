/**
 * 議題風險表：議題說明、負責人、緊急程度、影像任務（WBS 葉節點）、狀態
 */

export type IssueRiskUrgency = 'low' | 'medium' | 'high' | 'critical'
export type IssueRiskStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface IssueRiskWbsTask {
  id: string
  code: string
  name: string
}

export interface IssueRiskItem {
  id: string
  projectId: string
  description: string
  assigneeId: string | null
  assignee: { id: string; name: string | null; email: string } | null
  urgency: IssueRiskUrgency
  status: IssueRiskStatus
  wbsTasks: IssueRiskWbsTask[]
  createdAt: string
  updatedAt: string
}

export interface CreateIssueRiskPayload {
  description: string
  assigneeId?: string | null
  urgency?: IssueRiskUrgency
  status?: IssueRiskStatus
  wbsNodeIds?: string[]
}

export interface UpdateIssueRiskPayload {
  description?: string
  assigneeId?: string | null
  urgency?: IssueRiskUrgency
  status?: IssueRiskStatus
  wbsNodeIds?: string[]
}
