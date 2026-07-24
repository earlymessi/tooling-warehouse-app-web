import path from 'node:path'
import { app } from 'electron'
import * as XLSX from 'xlsx'
import XLSXStyle from 'xlsx-js-style'
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
import { generateNextToolCodes } from './toolCode'

const EMPLOYEE_COLUMN_MAP: Record<string, keyof CreateEmployeeInput> = {
  员工工号: 'employee_no',
  员工姓名: 'employee_name',
  所属部门: 'department',
}

function isBlankPlaceholder(value: string): boolean {
  const s = value.trim()
  if (!s) return true
  return s === '（无需填写）' || s === '无需填写' || s === '(无需填写)'
}

function cell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key]
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      const text = String(val).trim()
      if (isBlankPlaceholder(text)) return ''
      return text
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
  '资产编号（无需填写）',
  '工装ID',
  '名称',
  '工装名称',
  '型号',
  '规格型号',
  '序列号',
  '工作中心',
  '库位',
]

const TOOL_CODE_KEYS = ['资产编号（无需填写）', '资产编号', '工装ID'] as const

function fillMissingToolCodes(
  items: InboundToolItem[],
  db?: Database.Database | null,
): InboundToolItem[] {
  const missingIndexes = items
    .map((item, index) => (!item.tool_code.trim() ? index : -1))
    .filter((index) => index >= 0)
  if (missingIndexes.length === 0) return items

  const reserved = items.map((item) => item.tool_code).filter((code) => code.trim())
  const autoCodes = generateNextToolCodes(db ?? null, missingIndexes.length, reserved)
  const next = items.map((item) => ({ ...item }))
  missingIndexes.forEach((index, i) => {
    next[index].tool_code = autoCodes[i]
  })
  return next
}

/** 解析自助入库表格；若传入 db，空资产编号会按台账顺延自动填充。 */
export function parseInboundSpreadsheet(
  filePath: string,
  db?: Database.Database | null,
): InboundToolItem[] {
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
      tool_code: cell(row, ...TOOL_CODE_KEYS),
      tool_name: cell(row, '名称', '工装名称'),
      specification: cell(row, '型号', '规格型号'),
      serial_no: cell(row, '序列号'),
      work_center: cell(row, '工作中心'),
      location_code: cell(row, '库位'),
    }))
    .filter((item) => Object.values(item).some(Boolean))

  if (items.length === 0) throw new Error('表格中没有可导入的工装数据')
  return fillMissingToolCodes(items, db)
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
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' }).map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([columnName, value]) => [columnName.trim(), value]),
    ),
  )

  const parsedRows = rows.map((row) => ({
    tool_code: cell(row, ...TOOL_CODE_KEYS),
    tool_name: cell(row, '名称', '工装名称'),
    specification: cell(row, '型号', '规格型号'),
    serial_no: cell(row, '序列号'),
    location_code: cell(row, '库位'),
    work_center: cell(row, '工作中心') || 'LG-FT',
    borrowWorkCenter: cell(row, '借用工作中心', '使用部门'),
    borrower: cell(row, '使用人', '借用人'),
    borrow_time: cell(row, '借用时间'),
    expected_return_time: cell(row, '预计归还时间', '预计归还'),
  }))

  // 空资产编号且有名称的行视为新建，按台账顺延批量分配编号
  const autoNeeded = parsedRows.filter((r) => !r.tool_code && r.tool_name).length
  const autoCodes = generateNextToolCodes(
    db,
    autoNeeded,
    parsedRows.map((r) => r.tool_code).filter(Boolean),
  )
  let autoIndex = 0

  let successCount = 0
  let failCount = 0
  const errors: ImportResult['errors'] = []

  parsedRows.forEach((row, index) => {
    const rowNum = index + 2
    try {
      let tool_code = row.tool_code
      const tool_name = row.tool_name
      const specification = row.specification
      const serial_no = row.serial_no
      const location_code = row.location_code
      const work_center = row.work_center
      const borrowWorkCenter = row.borrowWorkCenter
      const borrower = row.borrower
      const borrow_time = row.borrow_time
      const expected_return_time = row.expected_return_time
      const isBorrowed = Boolean(borrower)

      if (!tool_name) throw new Error('名称不能为空')
      if (!tool_code) {
        tool_code = autoCodes[autoIndex++]
        if (!tool_code) throw new Error('无法自动生成资产编号')
      }

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

/** 资产编号列：灰底 +「无需填写」提示（导入时按空处理） */
const TOOL_CODE_SKIP_TEXT = '无需填写'
const TOOL_CODE_SKIP_FILL = {
  patternType: 'solid' as const,
  fgColor: { rgb: 'D9D9D9' },
}
const TOOL_CODE_HEADER_STYLE = {
  fill: TOOL_CODE_SKIP_FILL,
  font: { bold: true, color: { rgb: '595959' } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
}
const TOOL_CODE_CELL_STYLE = {
  fill: TOOL_CODE_SKIP_FILL,
  font: { italic: true, color: { rgb: '808080' } },
  alignment: { horizontal: 'center' as const, vertical: 'center' as const },
}

function applyToolCodeSkipColumn(ws: Record<string, unknown>, rowCount: number): void {
  for (let r = 0; r < rowCount; r++) {
    const addr = XLSXStyle.utils.encode_cell({ r, c: 0 })
    const existing = (ws[addr] as { t?: string; v?: unknown; s?: unknown } | undefined) ?? {
      t: 's',
      v: r === 0 ? '资产编号' : TOOL_CODE_SKIP_TEXT,
    }
    if (r === 0) {
      existing.v = '资产编号'
      existing.t = 's'
      existing.s = TOOL_CODE_HEADER_STYLE
    } else {
      existing.v = TOOL_CODE_SKIP_TEXT
      existing.t = 's'
      existing.s = TOOL_CODE_CELL_STYLE
    }
    ws[addr] = existing
  }
}

/** 生成自助入库专用模板，不包含管理员台账导入字段。 */
export function writeInboundImportTemplate(
  outputPath?: string,
): string {
  const stamp = formatNow().replace(/[:T]/g, '-').slice(0, 19)
  const out = outputPath ?? path.join(app.getPath('desktop'), `自助入库模板-${stamp}.xlsx`)
  const rows: (string | number)[][] = [
    ['资产编号', '名称', '型号', '序列号', '工作中心', '库位'],
    [TOOL_CODE_SKIP_TEXT, '示例夹具', 'A-100', 'SN-001', 'LG-FT', 'A-01'],
  ]
  for (let i = 0; i < 8; i++) {
    rows.push([TOOL_CODE_SKIP_TEXT, '', '', '', '', ''])
  }
  const ws = XLSXStyle.utils.aoa_to_sheet(rows)
  applyToolCodeSkipColumn(ws, rows.length)
  ws['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 }]
  const wb = XLSXStyle.utils.book_new()
  XLSXStyle.utils.book_append_sheet(wb, ws, '自助入库模板')
  XLSXStyle.writeFile(wb, out)
  return out
}

export function writeToolImportTemplate(): string {
  const header = [
    '资产编号',
    '名称',
    '型号',
    '序列号',
    '工作中心',
    '库位',
    '归还时间',
    '借用时间',
    '预计归还时间',
    '使用人',
    '借用工作中心',
  ]
  const rows: (string | number)[][] = [
    header,
    [TOOL_CODE_SKIP_TEXT, '示例夹具', 'A-100', 'SN-001', 'LG-FT', 'A-01', '', '', '', '', ''],
  ]
  for (let i = 0; i < 8; i++) {
    rows.push([TOOL_CODE_SKIP_TEXT, '', '', '', '', '', '', '', '', '', ''])
  }
  const ws = XLSXStyle.utils.aoa_to_sheet(rows)
  applyToolCodeSkipColumn(ws, rows.length)
  ws['!cols'] = [
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 14 },
    { wch: 10 },
    { wch: 14 },
  ]
  const wb = XLSXStyle.utils.book_new()
  XLSXStyle.utils.book_append_sheet(wb, ws, '工装导入模板')
  const out = exportFileName('tool-import-template')
  XLSXStyle.writeFile(wb, out)
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
