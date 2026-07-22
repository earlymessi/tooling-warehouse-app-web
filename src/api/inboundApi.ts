import { getApi } from '@/api/client'
import type { BatchInboundInput, BatchInboundResult, BatchInboundError } from '@/types/inbound'

function unwrap<T>(result: { ok: boolean; data?: T; message?: string; code?: string }): T {
  if (!result.ok) {
    const err = new Error(result.message ?? '操作失败') as Error & {
      code?: string
      inboundErrors?: BatchInboundError[]
    }
    err.code = result.code
    if (result.code === 'BATCH_INBOUND_INVALID' && result.message) {
      try {
        err.inboundErrors = JSON.parse(result.message) as BatchInboundError[]
      } catch {
        /* ignore */
      }
    }
    throw err
  }
  return result.data as T
}

export const inboundApi = {
  batch: async (data: BatchInboundInput) =>
    unwrap<BatchInboundResult>(await getApi().inbound.batch(data)),
}
