import type { IpcMain } from 'electron'
import { getDb } from '../db'
import * as inboundService from '../services/inbound.service'
import type { BatchInboundInput } from '../../src/types/inbound'
import { success, failure } from './response'

export function registerInboundIpc(ipcMain: IpcMain): void {
  ipcMain.handle('inbound:batch', (_e, data: BatchInboundInput) => {
    try {
      return success(inboundService.batchInbound(getDb(), data))
    } catch (e) {
      if (e instanceof inboundService.BatchInboundValidationError) {
        return failure('BATCH_INBOUND_INVALID', JSON.stringify(e.errors))
      }
      const msg = e instanceof Error ? e.message : String(e)
      const code = msg.includes(':') ? msg.split(':')[0] : 'INTERNAL_ERROR'
      return failure(code, msg.includes(':') ? msg.split(':').slice(1).join(':').trim() : msg)
    }
  })
}
