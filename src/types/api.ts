/**
 * 通用 API 型別，與後端契約一致
 */
export interface ApiResponse<T> {
  data: T
  meta?: {
    page?: number
    limit?: number
    total?: number
  }
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export type PaginatedResponse<T> = ApiResponse<T[]> & {
  meta: { page: number; limit: number; total: number }
}
