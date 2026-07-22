import type { IpcMain } from 'electron'
import { getDb } from '../db'
import * as employeeService from '../services/employee.service'
import type { CreateEmployeeInput, EmployeeListParams, UpdateEmployeeInput } from '../../src/types/employee'
import { wrap } from './response'

export function registerEmployeeIpc(ipcMain: IpcMain): void {
  ipcMain.handle('employee:list', (_e, params?: EmployeeListParams) =>
    wrap(() => employeeService.getEmployeeList(getDb(), params)),
  )
  ipcMain.handle('employee:listDepartments', () =>
    wrap(() => employeeService.getDepartmentList(getDb())),
  )
  ipcMain.handle('employee:getById', (_e, id: number) =>
    wrap(() => employeeService.getEmployeeById(getDb(), id)),
  )
  ipcMain.handle('employee:create', (_e, data: CreateEmployeeInput) =>
    wrap(() => employeeService.createEmployee(getDb(), data)),
  )
  ipcMain.handle('employee:update', (_e, id: number, data: UpdateEmployeeInput) =>
    wrap(() => employeeService.updateEmployee(getDb(), id, data)),
  )
  ipcMain.handle('employee:delete', (_e, id: number) =>
    wrap(() => {
      employeeService.deleteEmployee(getDb(), id)
      return true
    }),
  )
}
