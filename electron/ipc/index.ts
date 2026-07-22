import type { IpcMain } from 'electron'
import { registerToolIpc } from './tool.ipc'
import { registerBorrowIpc } from './borrow.ipc'
import { registerImportExportIpc } from './importExport.ipc'
import { registerBackupIpc } from './backup.ipc'
import { registerAdminIpc } from './admin.ipc'
import { registerEmployeeIpc } from './employee.ipc'
import { registerInboundIpc } from './inbound.ipc'

export function registerIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('ping', () => ({ ok: true }))
  registerToolIpc(ipcMain)
  registerBorrowIpc(ipcMain)
  registerEmployeeIpc(ipcMain)
  registerInboundIpc(ipcMain)
  registerImportExportIpc(ipcMain)
  registerBackupIpc(ipcMain)
  registerAdminIpc(ipcMain)
}
