import type { ApiError, ApiResult, ApiSuccess } from '../../src/types/api'

export function success<T>(data: T): ApiSuccess<T> {
  return { ok: true, data }
}

export function failure(code: string, message: string): ApiError {
  return { ok: false, code, message }
}

export function wrap<T>(fn: () => T): ApiResult<T> {
  try {
    return success(fn())
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const code = msg.includes(':') ? msg.split(':')[0] : 'INTERNAL_ERROR'
    return failure(code, msg.includes(':') ? msg.split(':').slice(1).join(':').trim() : msg)
  }
}

export function unwrapError(e: unknown): { code: string; message: string } {
  const msg = e instanceof Error ? e.message : String(e)
  const code = msg.includes(':') ? msg.split(':')[0] : 'INTERNAL_ERROR'
  return {
    code,
    message: msg.includes(':') ? msg.split(':').slice(1).join(':').trim() : msg,
  }
}
