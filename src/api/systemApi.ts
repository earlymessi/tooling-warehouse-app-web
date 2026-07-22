import { getApi } from '@/api/client'
import type { ImportResult } from '@/types/api'
import type { InboundToolItem } from '@/types/inbound'

function unwrap<T>(result: { ok: boolean; data?: T; message?: string }): T {
  if (!result.ok) throw new Error(result.message ?? '操作失败')
  return result.data as T
}

export const systemApi = {
  backupDatabase: async () => unwrap<string>(await getApi().system.backupDatabase()),
  getPaths: async () =>
    unwrap<{
      dataRoot: string
      dbFile: string
      backupDir: string
      exportDir: string
      logsDir: string
    }>(await getApi().system.getPaths()),
  openPath: async (filePath: string) => unwrap<boolean>(await getApi().system.openPath(filePath)),
  showItemInFolder: async (filePath: string) =>
    unwrap<boolean>(await getApi().system.showItemInFolder(filePath)),
}

export const importExportApi = {
  importTools: async () => unwrap<ImportResult>(await getApi().importExport.importTools()),
  importEmployees: async () => unwrap<ImportResult>(await getApi().importExport.importEmployees()),
  parseInboundSpreadsheet: async () =>
    unwrap<InboundToolItem[]>(await getApi().importExport.parseInboundSpreadsheet()),
  exportTools: async (params = {}) => unwrap<string>(await getApi().importExport.exportTools(params)),
  exportRecords: async (params = {}) =>
    unwrap<string>(await getApi().importExport.exportRecords(params)),
  exportEmployees: async (params = {}) =>
    unwrap<string>(await getApi().importExport.exportEmployees(params)),
  downloadToolTemplate: async () => unwrap<string>(await getApi().importExport.downloadToolTemplate()),
  downloadEmployeeTemplate: async () =>
    unwrap<string>(await getApi().importExport.downloadEmployeeTemplate()),
  downloadInboundTemplate: async () =>
    unwrap<string>(await getApi().importExport.downloadInboundTemplate()),
}
