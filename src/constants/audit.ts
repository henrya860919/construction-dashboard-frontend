/**
 * 稽核日誌：動作與資源類型的中文對照表
 *
 * 後端新增 recordAudit 時請在此補上對應的 action 或 resourceType，
 * 稽核日誌列表與篩選會自動顯示中文。
 */

/** 動作代碼 → 中文標籤（新增稽核動作時請在此補一筆） */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'tenant.create': '新增租戶',
  'tenant.update': '更新租戶',
  'user.password_reset': '重設密碼',
  'project.create': '新增專案',
  'project.update': '更新專案',
}

/** 資源類型代碼 → 中文標籤（新增 resourceType 時請在此補一筆） */
export const AUDIT_RESOURCE_TYPE_LABELS: Record<string, string> = {
  tenant: '租戶',
  user: '使用者',
  project: '專案',
}

/** 取得動作中文標籤，無對照時回傳原碼 */
export function getAuditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action
}

/** 取得資源類型中文標籤，無對照時回傳原碼 */
export function getAuditResourceTypeLabel(resourceType: string): string {
  return AUDIT_RESOURCE_TYPE_LABELS[resourceType] ?? resourceType
}
