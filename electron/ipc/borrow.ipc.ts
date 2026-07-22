import type { IpcMain } from 'electron'
import { getDb } from '../db'
import * as borrowService from '../services/borrow.service'
import type { BorrowRecordListParams, BorrowToolInput, ReturnToolInput, AdminCreateBorrowRecordInput, AdminUpdateBorrowRecordInput } from '../../src/types/borrow'
import { wrap } from './response'

export function registerBorrowIpc(ipcMain: IpcMain): void {
  ipcMain.handle('borrow:borrow', (_e, data: BorrowToolInput) =>
    wrap(() => borrowService.borrowTool(getDb(), data)),
  )
  ipcMain.handle('borrow:return', (_e, data: ReturnToolInput) =>
    wrap(() => borrowService.returnTool(getDb(), data)),
  )
  ipcMain.handle('borrow:listRecords', (_e, params: BorrowRecordListParams) =>
    wrap(() => borrowService.getBorrowReturnRecords(getDb(), params ?? {})),
  )
  ipcMain.handle('borrow:getOpenRecord', (_e, toolCode: string) =>
    wrap(() => borrowService.getOpenRecordByToolCode(getDb(), toolCode)),
  )
  ipcMain.handle('borrow:getById', (_e, id: number) =>
    wrap(() => borrowService.getBorrowRecordById(getDb(), id)),
  )
  ipcMain.handle('borrow:adminCreate', (_e, data: AdminCreateBorrowRecordInput) =>
    wrap(() => borrowService.adminCreateBorrowRecord(getDb(), data)),
  )
  ipcMain.handle('borrow:adminUpdate', (_e, id: number, data: AdminUpdateBorrowRecordInput) =>
    wrap(() => borrowService.adminUpdateBorrowRecord(getDb(), id, data)),
  )
  ipcMain.handle('borrow:adminDelete', (_e, id: number) =>
    wrap(() => {
      borrowService.adminDeleteBorrowRecord(getDb(), id)
      return true
    }),
  )
}
