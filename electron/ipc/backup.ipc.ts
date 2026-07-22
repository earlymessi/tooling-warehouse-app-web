import type { IpcMain } from 'electron'
import { shell } from 'electron'
import * as backupService from '../services/backup.service'
import { getPathsInfo } from '../paths'
import { wrap, success, failure } from './response'

export function registerBackupIpc(ipcMain: IpcMain): void {
  ipcMain.handle('system:backupDatabase', () => wrap(() => backupService.backupDatabase()))
  ipcMain.handle('system:getPaths', () => wrap(() => getPathsInfo()))
  ipcMain.handle('system:openPath', async (_e, filePath: string) => {
    try {
      const path = String(filePath ?? '').trim()
      if (!path) return failure('PATH_REQUIRED', '路径为空')
      const err = await shell.openPath(path)
      if (err) return failure('OPEN_PATH_FAILED', err)
      return success(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return failure('OPEN_PATH_FAILED', msg)
    }
  })
  ipcMain.handle('system:showItemInFolder', (_e, filePath: string) =>
    wrap(() => {
      const path = String(filePath ?? '').trim()
      if (!path) throw new Error('PATH_REQUIRED: 路径为空')
      shell.showItemInFolder(path)
      return true
    }),
  )
}
