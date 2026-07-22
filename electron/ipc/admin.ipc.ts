import type { IpcMain } from 'electron'
import { getDb } from '../db'
import * as authService from '../services/auth.service'
import { wrap } from './response'

export function registerAdminIpc(ipcMain: IpcMain): void {
  ipcMain.handle('admin:login', (_e, username: string, password: string) =>
    wrap(() => authService.login(getDb(), username, password)),
  )
}
