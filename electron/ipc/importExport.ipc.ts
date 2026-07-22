import type { IpcMain } from 'electron'
import { dialog } from 'electron'
import { getDb } from '../db'
import * as excelService from '../services/excel.service'
import type { ToolListParams } from '../../src/types/tool'
import type { BorrowRecordListParams } from '../../src/types/borrow'
import type { EmployeeListParams } from '../../src/types/employee'
import { wrap } from './response'

async function pickExcelFile() {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
  })
  if (result.canceled || !result.filePaths[0]) {
    return { ok: false as const, code: 'CANCELLED', message: '已取消' }
  }
  return { ok: true as const, filePath: result.filePaths[0] }
}

async function pickInboundSpreadsheet() {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: '工装清单', extensions: ['xlsx', 'xls', 'csv'] }],
  })
  if (result.canceled || !result.filePaths[0]) {
    return { ok: false as const, code: 'CANCELLED', message: '已取消' }
  }
  return { ok: true as const, filePath: result.filePaths[0] }
}

export function registerImportExportIpc(ipcMain: IpcMain): void {
  ipcMain.handle('importExport:importTools', async () => {
    const picked = await pickExcelFile()
    if (!picked.ok) return picked
    return wrap(() => excelService.importToolAccountFromExcel(getDb(), picked.filePath))
  })

  ipcMain.handle('importExport:importEmployees', async () => {
    const picked = await pickExcelFile()
    if (!picked.ok) return picked
    return wrap(() => excelService.importEmployeeFromExcel(getDb(), picked.filePath))
  })

  ipcMain.handle('importExport:parseInboundSpreadsheet', async () => {
    const picked = await pickInboundSpreadsheet()
    if (!picked.ok) return picked
    return wrap(() => excelService.parseInboundSpreadsheet(picked.filePath))
  })

  ipcMain.handle('importExport:exportTools', (_e, params: ToolListParams) =>
    wrap(() => excelService.exportToolAccountToExcel(getDb(), params ?? {})),
  )

  ipcMain.handle('importExport:exportRecords', (_e, params: BorrowRecordListParams) =>
    wrap(() => excelService.exportBorrowRecordsToExcel(getDb(), params ?? {})),
  )

  ipcMain.handle('importExport:exportEmployees', (_e, params: EmployeeListParams) =>
    wrap(() => excelService.exportEmployeesToExcel(getDb(), params ?? {})),
  )

  ipcMain.handle('importExport:downloadToolTemplate', () =>
    wrap(() => excelService.writeToolImportTemplate()),
  )

  ipcMain.handle('importExport:downloadEmployeeTemplate', () =>
    wrap(() => excelService.writeEmployeeImportTemplate()),
  )

  ipcMain.handle('importExport:downloadInboundTemplate', () =>
    wrap(() => excelService.writeInboundImportTemplate()),
  )
}
