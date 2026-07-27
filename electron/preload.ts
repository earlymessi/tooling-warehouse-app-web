import { contextBridge, ipcRenderer } from 'electron'
import type { CreateToolInput, ToolListParams, UpdateToolInput, AdminUpdateToolInput, AdminCreateToolInput } from '../src/types/tool'
import type { BorrowRecordListParams, BorrowToolInput, ReturnToolInput, AdminCreateBorrowRecordInput, AdminUpdateBorrowRecordInput } from '../src/types/borrow'
import type { CreateEmployeeInput, EmployeeListParams, UpdateEmployeeInput } from '../src/types/employee'
import type { BatchInboundInput } from '../src/types/inbound'

const api = {
  tool: {
    list: (params: ToolListParams) => ipcRenderer.invoke('tool:list', params),
    getByCode: (toolCode: string) => ipcRenderer.invoke('tool:getByCode', toolCode),
    getById: (id: number) => ipcRenderer.invoke('tool:getById', id),
    create: (data: CreateToolInput) => ipcRenderer.invoke('tool:create', data),
    adminCreate: (data: AdminCreateToolInput) => ipcRenderer.invoke('tool:adminCreate', data),
    update: (id: number, data: UpdateToolInput) => ipcRenderer.invoke('tool:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('tool:adminDelete', id),
    adminUpdate: (id: number, data: AdminUpdateToolInput) =>
      ipcRenderer.invoke('tool:adminUpdate', id, data),
    nextCodes: (payload?: { count?: number; reserved?: string[] }) =>
      ipcRenderer.invoke('tool:nextCodes', payload),
  },
  borrow: {
    borrow: (data: BorrowToolInput) => ipcRenderer.invoke('borrow:borrow', data),
    return: (data: ReturnToolInput) => ipcRenderer.invoke('borrow:return', data),
    listRecords: (params: BorrowRecordListParams) => ipcRenderer.invoke('borrow:listRecords', params),
    getOpenRecord: (toolCode: string) => ipcRenderer.invoke('borrow:getOpenRecord', toolCode),
    getById: (id: number) => ipcRenderer.invoke('borrow:getById', id),
    adminCreate: (data: AdminCreateBorrowRecordInput) => ipcRenderer.invoke('borrow:adminCreate', data),
    adminUpdate: (id: number, data: AdminUpdateBorrowRecordInput) =>
      ipcRenderer.invoke('borrow:adminUpdate', id, data),
    adminDelete: (id: number) => ipcRenderer.invoke('borrow:adminDelete', id),
  },
  importExport: {
    importTools: () => ipcRenderer.invoke('importExport:importTools'),
    importEmployees: () => ipcRenderer.invoke('importExport:importEmployees'),
    parseInboundSpreadsheet: () => ipcRenderer.invoke('importExport:parseInboundSpreadsheet'),
    exportTools: (params: ToolListParams) => ipcRenderer.invoke('importExport:exportTools', params),
    exportRecords: (params: BorrowRecordListParams) =>
      ipcRenderer.invoke('importExport:exportRecords', params),
    exportEmployees: (params?: EmployeeListParams) =>
      ipcRenderer.invoke('importExport:exportEmployees', params),
    downloadToolTemplate: () => ipcRenderer.invoke('importExport:downloadToolTemplate'),
    downloadEmployeeTemplate: () => ipcRenderer.invoke('importExport:downloadEmployeeTemplate'),
    downloadInboundTemplate: () => ipcRenderer.invoke('importExport:downloadInboundTemplate'),
  },
  system: {
    backupDatabase: () => ipcRenderer.invoke('system:backupDatabase'),
    getPaths: () => ipcRenderer.invoke('system:getPaths'),
    openPath: (filePath: string) => ipcRenderer.invoke('system:openPath', filePath),
    showItemInFolder: (filePath: string) => ipcRenderer.invoke('system:showItemInFolder', filePath),
    setCodeInputMode: (english: boolean) => ipcRenderer.invoke('system:setCodeInputMode', english),
  },
  admin: {
    login: (username: string, password: string) =>
      ipcRenderer.invoke('admin:login', username, password),
  },
  employee: {
    list: (params?: EmployeeListParams) => ipcRenderer.invoke('employee:list', params),
    listDepartments: () => ipcRenderer.invoke('employee:listDepartments'),
    getById: (id: number) => ipcRenderer.invoke('employee:getById', id),
    create: (data: CreateEmployeeInput) => ipcRenderer.invoke('employee:create', data),
    update: (id: number, data: UpdateEmployeeInput) => ipcRenderer.invoke('employee:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('employee:delete', id),
  },
  inbound: {
    batch: (data: BatchInboundInput) => ipcRenderer.invoke('inbound:batch', data),
  },
}

contextBridge.exposeInMainWorld('api', api)

export type AppApi = typeof api
