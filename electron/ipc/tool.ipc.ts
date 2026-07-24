import type { IpcMain } from 'electron'
import { getDb } from '../db'
import * as toolService from '../services/tool.service'
import type { CreateToolInput, ToolListParams, UpdateToolInput, AdminUpdateToolInput, AdminCreateToolInput } from '../../src/types/tool'
import { wrap } from './response'

export function registerToolIpc(ipcMain: IpcMain): void {
  ipcMain.handle('tool:list', (_e, params: ToolListParams) =>
    wrap(() => toolService.getToolList(getDb(), params ?? {})),
  )
  ipcMain.handle('tool:getByCode', (_e, toolCode: string) =>
    wrap(() => toolService.getToolByCode(getDb(), toolCode)),
  )
  ipcMain.handle('tool:getById', (_e, id: number) =>
    wrap(() => toolService.getToolById(getDb(), id)),
  )
  ipcMain.handle('tool:create', (_e, data: CreateToolInput) =>
    wrap(() => toolService.createTool(getDb(), data)),
  )
  ipcMain.handle('tool:adminCreate', (_e, data: AdminCreateToolInput) =>
    wrap(() => toolService.adminCreateTool(getDb(), data)),
  )
  ipcMain.handle('tool:update', (_e, id: number, data: UpdateToolInput) =>
    wrap(() => toolService.updateTool(getDb(), id, data)),
  )
  ipcMain.handle('tool:adminDelete', (_e, id: number) =>
    wrap(() => {
      toolService.adminDeleteTool(getDb(), id)
      return true
    }),
  )
  ipcMain.handle('tool:adminUpdate', (_e, id: number, data: AdminUpdateToolInput) =>
    wrap(() => toolService.adminUpdateTool(getDb(), id, data)),
  )
  ipcMain.handle(
    'tool:nextCodes',
    (_e, payload?: { count?: number; reserved?: string[] }) =>
      wrap(() =>
        toolService.getNextToolCodes(
          getDb(),
          payload?.count ?? 1,
          payload?.reserved ?? [],
        ),
      ),
  )
}
