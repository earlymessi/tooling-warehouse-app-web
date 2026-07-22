export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  code: string
  message: string
}

export type ApiResult<T> = ApiSuccess<T> | ApiError

export interface ImportResult {
  successCount: number
  failCount: number
  errors: Array<{ row: number; reason: string }>
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
}
