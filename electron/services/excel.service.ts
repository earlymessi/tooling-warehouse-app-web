import path from 'node:path'
import { app } from 'electron'
import * as XLSX from 'xlsx'
import type Database from 'better-sqlite3'
import type { ImportResult } from '../../src/types/api'
import type { AdminCreateToolInput, AdminUpdateToolInput, ToolListParams } from '../../src/types/tool'
import type { CreateEmployeeInput, EmployeeListParams } from '../../src/types/employee'
import type { BorrowRecordListParams } from '../../src/types/borrow'
import type { InboundToolItem } from '../../src/types/inbound'
import * as toolService from './tool.service'
import * as employeeService from './employee.service'
import * as employeeRepo from '../db/employee.repository'
import * as toolRepo from '../db/tool.repository'
import * as borrowRepo from '../db/borrow.repository'
import { EXPORT_DIR } from '../paths'
import { formatNow } from './time'
import { displayRecordStatus } from './overdue'

const EMPLOYEE_COLUMN_MAP: Record<string, keyof CreateEmployeeInput> = {
  员工工号: 'employee_no',
  员工姓名: 'employee_name',
  所属部门: 'department',
}

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key]
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val).trim()
    }
  }
  return ''
}

function exportFileName(prefix: string): string {
  const stamp = formatNow().replace(/[:T]/g, '-').slice(0, 19)
  return path.join(EXPORT_DIR, `${prefix}-${stamp}.xlsx`)
}

const INBOUND_SPREADSHEET_COLUMNS = [
  '资产编号',
  '工装ID',
  '名称',
  '工装名称',
  '型号',
  '规格型号',
  '序列号',
  '工作中心',
  '库位',
]

/** 解析自助入库表格，仅返回预填数据，不访问数据库。 */
export function parseInboundSpreadsheet(filePath: string): InboundToolItem[] {
  let workbook: XLSX.WorkBook
  try {
    const preserveCsvText = path.extname(filePath).toLowerCase() === '.csv'
    workbook = XLSX.readFile(filePath, preserveCsvText ? { raw: true } : undefined)
  } catch {
    throw new Error('无法读取表格文件，请确认文件未损坏且格式为 Excel 或 CSV')
  }
  const sheetName = workbook.SheetNames[0]
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined
  if (!sheet) throw new Error('表格中没有可读取的工作表')

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  })
  const headers = (matrix[0] ?? []).map((value) => String(value ?? '').trim())
  if (!headers.some((header) => INBOUND_SPREADSHEET_COLUMNS.includes(header))) {
    throw new Error('未识别到可导入的工装列，请使用自助入库模板')
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
    blankrows: false,
  })
  const items = rows
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).map(([columnName, value]) => [columnName.trim(), value]),
      ),
    )
    .map((row) => ({
      tool_code: cell(row, '资产编号', '工装ID'),
      tool_name: cell(row, '名称', '工装名称'),
      specification: cell(row, '型号', '规格型号'),
      serial_no: cell(row, '序列号'),
      work_center: cell(row, '工作中心'),
      location_code: cell(row, '库位'),
    }))
    .filter((item) => Object.values(item).some(Boolean))

  if (items.length === 0) throw new Error('表格中没有可导入的工装数据')
  return items
}

/**
 * 工装导入列：
 * 资产编号、名称、型号、序列号、工作中心（归属）、库位、
 * 归还时间、借用时间、预计归还时间、使用人、借用工作中心
 * 新建时会经 adminCreate 自动写入「管理员导入」入库记录
 */
export function importToolAccountFromExcel(db: Database.Database, filePath: string): ImportResult {
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  let successCount = 0
  let failCount = 0
  const errors: ImportResult['errors'] = []

  rows.forEach((row, index) => {
    const rowNum = index + 2
    try {
      const tool_code = cell(row, '资产编号', '工装ID')
      const tool_name = cell(row, '名称', '工装名称')
      const specification = cell(row, '型号', '规格型号')
      const serial_no = cell(row, '序列号')
      const location_code = cell(row, '库位')
      const work_center = cell(row, '工作中心') || 'LG-FT'
      const borrowWorkCenter = cell(row, '借用工作中心', '使用部门')
      const borrower = cell(row, '使用人', '借用人')
      const borrow_time = cell(row, '借用时间')
      const expected_return_time = cell(row, '预计归还时间', '预计归还')
      const isBorrowed = Boolean(borrower)

      if (!tool_code) throw new Error('资产编号不能为空')
      if (!tool_name) throw new Error('名称不能为空')

      const existing = toolRepo.findByCode(db, tool_code)
      if (existing) {
        const update: AdminUpdateToolInput = {
          tool_name,
          specification: specification || undefined,
          serial_no: serial_no || undefined,
          work_center,
          location_code: location_code || undefined,
          status: isBorrowed ? '借出' : '在库',
          quantity: isBorrowed ? 0 : 1,
          current_borrower: isBorrowed ? borrower : null,
          current_borrow_department: isBorrowed ? borrowWorkCenter || work_center || null : null,
          current_borrow_time: isBorrowed ? borrow_time || null : null,
          expected_return_time: isBorrowed ? expected_return_time || null : null,
        }
        toolService.adminUpdateTool(db, existing.id, update)
      } else {
        const create: AdminCreateToolInput = {
          tool_code,
          tool_name,
          specification: specification || undefined,
          serial_no: serial_no || undefined,
          work_center,
          location_code: location_code || undefined,
          status: isBorrowed ? '借出' : '在库',
          quantity: isBorrowed ? 0 : 1,
          current_borrower: isBorrowed ? borrower : null,
          current_borrow_department: isBorrowed ? borrowWorkCenter || work_center || null : null,
          current_borrow_time: isBorrowed ? borrow_time || null : null,
          expected_return_time: isBorrowed ? expected_return_time || null : null,
        }
        toolService.adminCreateToolFromImport(db, create)
      }
      successCount++
    } catch (e) {
      failCount++
      errors.push({
        row: rowNum,
        reason: e instanceof Error ? e.message.replace(/^[^:]+:\s*/, '') : String(e),
      })
    }
  })

  return { successCount, failCount, errors }
}

export function importEmployeeFromExcel(db: Database.Database, filePath: string): ImportResult {
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

  let successCount = 0
  let failCount = 0
  const errors: ImportResult['errors'] = []

  rows.forEach((row, index) => {
    const rowNum = index + 2
    try {
      const input: CreateEmployeeInput = { employee_no: '', employee_name: '', department: '' }
      for (const [col, field] of Object.entries(EMPLOYEE_COLUMN_MAP)) {
        const val = row[col]
        if (val === undefined || val === '') continue
        input[field] = String(val).trim()
      }
      if (!input.employee_no) throw new Error('员工工号不能为空')
      if (!input.employee_name) throw new Error('员工姓名不能为空')
      if (!input.department) throw new Error('所属部门不能为空')
      employeeService.upsertEmployeeFromImport(db, input)
      successCount++
    } catch (e) {
      failCount++
      errors.push({
        row: rowNum,
        reason: e instanceof Error ? e.message.replace(/^[^:]+:\s*/, '') : String(e),
      })
    }
  })

  return { successCount, failCount, errors }
}

export function exportToolAccountToExcel(db: Database.Database, params: ToolListParams): string {
  const { items } = toolRepo.list(db, { ...params, page: 1, pageSize: 100000 })
  const data = items.map((t) => ({
    资产编号: t.tool_code,
    名称: t.tool_name,
    型号: t.specification ?? '',
    序列号: t.serial_no ?? '',
    工作中心: t.work_center ?? '',
    库位: t.location_code ?? '',
    归还时间: '',
    借用时间: t.current_borrow_time ?? '',
    预计归还时间: t.expected_return_time ?? '',
    使用人: t.current_borrower ?? '',
    借用工作中心: t.current_borrow_department ?? '',
    状态: t.status,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '工装台账')
  const out = exportFileName('tool-account')
  XLSX.writeFile(wb, out)
  return out
}

export function exportBorrowRecordsToExcel(db: Database.Database, params: BorrowRecordListParams): string {
  const items = borrowRepo.listAllForExport(db, params)
  const now = new Date()
  const data = items.map((r) => {
    const status = displayRecordStatus(r.record_status, r.expected_return_time, now)
    return {
      记录号: r.record_no,
      资产编号: r.tool_code,
      名称: r.tool_name,
      借用人: r.borrower ?? '',
      员工工号: r.borrower_employee_no ?? '',
      借用工作中心: r.borrow_department ?? '',
      借用时间: r.borrow_time ?? '',
      预计归还: r.expected_return_time ?? '',
      归还时间: r.return_time ?? '',
      状态: status,
      归还结果: r.return_result ?? '',
      备注: r.remark ?? '',
    }
  })
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '借还记录')
  const out = exportFileName('borrow-records')
  XLSX.writeFile(wb, out)
  return out
}

export function exportEmployeesToExcel(db: Database.Database, params: EmployeeListParams): string {
  const { items } = employeeRepo.list(db, { ...params, page: 1, pageSize: 100000 })
  const data = items.map((e) => ({
    员工工号: e.employee_no,
    员工姓名: e.employee_name,
    所属部门: e.department,
  }))
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '员工表')
  const out = exportFileName('employees')
  XLSX.writeFile(wb, out)
  return out
}

/** 生成自助入库专用模板，不包含管理员台账导入字段。 */
export function writeInboundImportTemplate(
  outputPath?: string,
): string {
  const stamp = formatNow().replace(/[:T]/g, '-').slice(0, 19)
  const out = outputPath ?? path.join(app.getPath('desktop'), `自助入库模板-${stamp}.xlsx`)
  const ws = XLSX.utils.aoa_to_sheet([
    ['资产编号', '名称', '型号', '序列号', '工作中心', '库位'],
    ['AM-10001', '示例夹具', 'A-100', 'SN-001', 'LG-FT', 'A-01'],
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '自助入库模板')
  XLSX.writeFile(wb, out)
  return out
}

export function writeToolImportTemplate(): string {
  const template = [
    {
      资产编号: 'AM-10001',
      名称: '示例夹具',
      型号: 'A-100',
      序列号: 'SN-001',
      工作中心: 'LG-FT',
      库位: 'A-01',
      归还时间: '',
      借用时间: '',
      预计归还时间: '',
      使用人: '',
      借用工作中心: '',
    },
  ]
  const ws = XLSX.utils.json_to_sheet(template)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '工装导入模板')
  const out = exportFileName('tool-import-template')
  XLSX.writeFile(wb, out)
  return out
}

export function writeEmployeeImportTemplate(): string {
  const template = [
    {
      员工工号: 'E100',
      员工姓名: '张三',
      所属部门: '总装一课',
    },
  ]
  const ws = XLSX.utils.json_to_sheet(template)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '员工导入模板')
  const out = exportFileName('employee-import-template')
  XLSX.writeFile(wb, out)
  return out
}

/** @deprecated 使用 writeToolImportTemplate */
export function writeImportTemplate(): string {
  return writeToolImportTemplate()
}
