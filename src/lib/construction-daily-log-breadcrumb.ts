/** `router.push` / `RouterLink` 的 `state` 鍵，供麵包屑進頁當下即顯示填表日 */
export const CONSTRUCTION_DAILY_LOG_BREADCRUMB_STATE_KEY = 'constructionDailyLogBreadcrumbDate'

function sessionStorageKey(projectId: string, logId: string): string {
  return `cdl-breadcrumb-date:${projectId}:${logId}`
}

/** 自 `history.state` 讀取導航時帶入的 YYYY-MM-DD */
export function readDailyLogBreadcrumbDateFromHistory(): string | null {
  try {
    const raw = (history.state as Record<string, unknown> | null)?.[
      CONSTRUCTION_DAILY_LOG_BREADCRUMB_STATE_KEY
    ]
    if (typeof raw !== 'string') return null
    const t = raw.trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
  } catch {
    return null
  }
}

export function readDailyLogBreadcrumbDateFromSession(
  projectId: string,
  logId: string
): string | null {
  try {
    const raw = sessionStorage.getItem(sessionStorageKey(projectId, logId))
    if (!raw) return null
    const t = raw.trim()
    return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null
  } catch {
    return null
  }
}

export function persistDailyLogBreadcrumbDateToSession(
  projectId: string,
  logId: string,
  ymd: string
): void {
  const t = ymd.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return
  try {
    sessionStorage.setItem(sessionStorageKey(projectId, logId), t)
  } catch {
    /* ignore quota / private mode */
  }
}

export function formatLogDateForBreadcrumb(ymd: string): string {
  const t = ymd.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (m) return `${m[1]}/${m[2]}/${m[3]}`
  return t
}

/** `/p/:projectId/construction/diary/:logId`（排除 new / valuations / pcces） */
export function parseConstructionDailyLogDetailFromPath(path: string): {
  projectId: string
  logId: string
} | null {
  const segments = path.split('/').filter(Boolean)
  if (segments.length !== 5) return null
  if (segments[0] !== 'p') return null
  const projectId = segments[1]
  if (segments[2] !== 'construction' || segments[3] !== 'diary') return null
  const logId = segments[4]
  const reserved = new Set(['new', 'valuations', 'pcces', 'logs'])
  if (!logId || reserved.has(logId)) return null
  return { projectId, logId }
}
