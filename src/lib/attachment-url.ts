/**
 * 從後端檔案 URL（完整或 path）解析 attachment id，供需帶 Authorization 的 fetch 使用。
 * 例：`https://host/api/v1/files/clxxx` 或 `/api/v1/files/clxxx`
 */
export function extractAttachmentIdFromApiFileUrl(url: string): string | null {
  try {
    const pathOnly =
      url.startsWith('http://') || url.startsWith('https://')
        ? new URL(url).pathname
        : (url.split('?')[0] ?? url)
    const m = pathOnly.match(/\/api\/v1\/files\/([^/?#]+)/)
    return m ? decodeURIComponent(m[1]) : null
  } catch {
    return null
  }
}
