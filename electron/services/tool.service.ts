import type Database from 'better-sqlite3'
import * as toolRepo from '../db/tool.repository'
import type {
  CreateToolInput,
  ToolAccount,
  ToolListParams,
  UpdateToolInput,
  AdminUpdateToolInput,
  AdminCreateToolInput,
  ToolStatus,
} from '../../src/types/tool'
import { formatNow } from './time'
import * as borrowRepo from '../db/borrow.repository'
import { generateRecordNo } from './recordNo'
import { insertAdminImportInbound } from './inbound.service'

function assertToolCode(code: string): void {
  if (!code.trim()) {
    throw new Error('TOOL_CODE_INVALID: 资产编号不能为空')
  }
}

export function getToolByCode(db: Database.Database, toolCode: string): ToolAccount | null {
  return toolRepo.findByCode(db, toolCode.trim())
}

export function getToolById(db: Database.Database, id: number): ToolAccount | null {
  return toolRepo.findById(db, id)
}

export function getToolList(db: Database.Database, params: ToolListParams) {
  return toolRepo.list(db, params)
}

export function createTool(db: Database.Database, input: CreateToolInput): ToolAccount {
  assertToolCode(input.tool_code)
  const existing = toolRepo.findByCode(db, input.tool_code.trim())
  if (existing) throw new Error('TOOL_CODE_EXISTS: 资产编号已存在')

  const now = formatNow()
  return toolRepo.insert(db, {
    ...input,
    tool_code: input.tool_code.trim(),
    quantity: input.quantity ?? 1,
    unit: input.unit ?? '件',
    status: '在库',
    qr_content: input.tool_code.trim(),
    created_at: now,
    updated_at: now,
  })
}

export function adminCreateTool(db: Database.Database, input: AdminCreateToolInput): ToolAccount {
  assertToolCode(input.tool_code)
  const existing = toolRepo.findByCode(db, input.tool_code.trim())
  if (existing) throw new Error('TOOL_CODE_EXISTS: 资产编号已存在')

  const status: ToolStatus = input.status ?? '在库'
  if (status !== '在库' && status !== '借出') {
    throw new Error('STATUS_INVALID: 库存状态仅支持在库或借出')
  }

  const now = formatNow()
  const toolCode = input.tool_code.trim()
  const isBorrowed = status === '借出'

  const tx = db.transaction(() => {
    const tool = toolRepo.insert(db, {
      ...input,
      tool_code: toolCode,
      quantity: isBorrowed ? 0 : (input.quantity ?? 1),
      unit: input.unit ?? '件',
      status,
      qr_content: input.qr_content?.trim() || toolCode,
      work_center: input.work_center?.trim() || 'LG-FT',
      current_borrower: isBorrowed ? input.current_borrower?.trim() || '管理员录入' : null,
      current_borrow_department: isBorrowed ? input.current_borrow_department?.trim() || '管理员' : null,
      current_borrow_time: isBorrowed ? input.current_borrow_time?.trim() || now : null,
      expected_return_time: isBorrowed
        ? input.expected_return_time?.trim() || daysLaterIso(7)
        : null,
      created_at: now,
      updated_at: now,
    })

    insertAdminImportInbound(
      db,
      {
        id: tool.id,
        tool_code: tool.tool_code,
        tool_name: tool.tool_name,
        specification: tool.specification,
        serial_no: tool.serial_no,
        work_center: tool.work_center,
        location_code: tool.location_code,
      },
      { now, operator_name: '管理员录入', remark: '管理员录入' },
    )

    if (isBorrowed) {
      borrowRepo.insert(db, {
        record_no: generateRecordNo(db, new Date()),
        tool_id: tool.id,
        tool_code: tool.tool_code,
        tool_name: tool.tool_name,
        record_status: '未归还',
        borrower: tool.current_borrower,
        borrower_employee_no: null,
        borrow_department: tool.current_borrow_department,
        borrow_time: tool.current_borrow_time,
        expected_return_time: tool.expected_return_time,
        operator_name: tool.current_borrower,
        remark: '管理员录入',
        created_at: now,
        updated_at: now,
      })
    }

    return tool
  })

  return tx()
}

export function updateTool(db: Database.Database, id: number, input: UpdateToolInput): ToolAccount {
  const existing = toolRepo.findById(db, id)
  if (!existing) throw new Error('TOOL_NOT_FOUND: 工装不存在')
  if (existing.status === '借出') throw new Error('TOOL_BORROWED: 工装借出中不可编辑')

  return toolRepo.update(db, id, {
    ...input,
    updated_at: formatNow(),
  })
}

export function upsertToolFromImport(db: Database.Database, input: CreateToolInput): ToolAccount {
  assertToolCode(input.tool_code)
  return toolRepo.upsertByCode(db, { ...input, tool_code: input.tool_code.trim() }, formatNow())
}

export function deleteTool(db: Database.Database, id: number): void {
  const existing = toolRepo.findById(db, id)
  if (!existing) throw new Error('TOOL_NOT_FOUND: 工装不存在')
  if (existing.status === '借出') throw new Error('TOOL_BORROWED: 工装借出中不可删除')
  toolRepo.remove(db, id)
}

export function adminDeleteTool(db: Database.Database, id: number): void {
  const existing = toolRepo.findById(db, id)
  if (!existing) throw new Error('TOOL_NOT_FOUND: 工装不存在')
  if (existing.status === '借出' || borrowRepo.findOpenByToolId(db, id)) {
    throw new Error('TOOL_BORROWED: 工装借出中不可删除')
  }
  toolRepo.remove(db, id)
}

function syncOpenBorrowRecord(
  db: Database.Database,
  toolId: number,
  tool: ToolAccount,
  now: string,
): void {
  const openRecord = borrowRepo.findOpenByToolId(db, toolId)
  if (!openRecord) return
  borrowRepo.adminUpdate(db, openRecord.id, {
    tool_name: tool.tool_name,
    borrower: tool.current_borrower,
    borrow_department: tool.current_borrow_department,
    borrow_time: tool.current_borrow_time,
    expected_return_time: tool.expected_return_time,
    operator_name: tool.current_borrower,
    updated_at: now,
  })
}

/** 管理员更新：允许修改全部字段，并同步借还记录 */
export function adminUpdateTool(db: Database.Database, id: number, input: AdminUpdateToolInput): ToolAccount {
  const existing = toolRepo.findById(db, id)
  if (!existing) throw new Error('TOOL_NOT_FOUND: 工装不存在')

  const newStatus: ToolStatus = input.status ?? existing.status
  if (newStatus !== '在库' && newStatus !== '借出') {
    throw new Error('STATUS_INVALID: 库存状态仅支持在库或借出')
  }

  const now = formatNow()
  const statusChanged = newStatus !== existing.status
  const isInStock = newStatus === '在库'

  const resolved = {
    tool_name: input.tool_name ?? existing.tool_name,
    specification: input.specification !== undefined ? input.specification : existing.specification ?? undefined,
    serial_no: input.serial_no !== undefined ? input.serial_no : existing.serial_no ?? undefined,
    work_center: input.work_center !== undefined ? input.work_center : existing.work_center ?? undefined,
    location_code: input.location_code !== undefined ? input.location_code : existing.location_code ?? undefined,
    unit: input.unit ?? existing.unit,
    remark: input.remark !== undefined ? input.remark : existing.remark ?? undefined,
    qr_content:
      input.qr_content !== undefined ? input.qr_content : existing.qr_content ?? existing.tool_code,
    quantity: isInStock ? (input.quantity ?? 1) : 0,
    status: newStatus,
    current_borrower: isInStock
      ? null
      : input.current_borrower !== undefined
        ? input.current_borrower
        : existing.current_borrower,
    current_borrow_department: isInStock
      ? null
      : input.current_borrow_department !== undefined
        ? input.current_borrow_department
        : existing.current_borrow_department,
    current_borrow_time: isInStock
      ? null
      : input.current_borrow_time !== undefined
        ? input.current_borrow_time
        : existing.current_borrow_time,
    expected_return_time: isInStock
      ? null
      : input.expected_return_time !== undefined
        ? input.expected_return_time
        : existing.expected_return_time,
  }

  const tx = db.transaction(() => {
    const openRecord = borrowRepo.findOpenByToolId(db, id)

    if (isInStock) {
      if (openRecord) {
        borrowRepo.updateRecord(db, openRecord.id, {
          record_status: '已归还',
          return_time: now,
          return_result: statusChanged ? '管理员调整归还' : '管理员数据修正',
          remark: openRecord.remark
            ? `${openRecord.remark}；管理员将状态改为在库`
            : '管理员将状态改为在库',
          updated_at: now,
        })
      }
      return toolRepo.update(db, id, { ...resolved, updated_at: now })
    }

    // 借出
    const borrower = resolved.current_borrower?.trim() || '管理员调整'
    const department = resolved.current_borrow_department?.trim() || '管理员'
    const borrowTime = resolved.current_borrow_time?.trim() || now
    const expectedReturn = resolved.expected_return_time?.trim() || daysLaterIso(7)

    resolved.current_borrower = borrower
    resolved.current_borrow_department = department
    resolved.current_borrow_time = borrowTime
    resolved.expected_return_time = expectedReturn

    if (!openRecord) {
      borrowRepo.insert(db, {
        record_no: generateRecordNo(db, new Date()),
        tool_id: id,
        tool_code: existing.tool_code,
        tool_name: resolved.tool_name,
        record_status: '未归还',
        borrower,
        borrower_employee_no: null,
        borrow_department: department,
        borrow_time: borrowTime,
        expected_return_time: expectedReturn,
        operator_name: borrower,
        remark: statusChanged ? '管理员将状态改为借出' : '管理员数据修正',
        created_at: now,
        updated_at: now,
      })
    } else {
      syncOpenBorrowRecord(db, id, { ...existing, ...resolved } as ToolAccount, now)
    }

    return toolRepo.update(db, id, { ...resolved, updated_at: now })
  })

  return tx()
}

/** Excel 导入新建：入库人记为「管理员导入」 */
export function adminCreateToolFromImport(db: Database.Database, input: AdminCreateToolInput): ToolAccount {
  assertToolCode(input.tool_code)
  const existing = toolRepo.findByCode(db, input.tool_code.trim())
  if (existing) throw new Error('TOOL_CODE_EXISTS: 资产编号已存在')

  const status: ToolStatus = input.status ?? '在库'
  if (status !== '在库' && status !== '借出') {
    throw new Error('STATUS_INVALID: 库存状态仅支持在库或借出')
  }

  const now = formatNow()
  const toolCode = input.tool_code.trim()
  const isBorrowed = status === '借出'

  const tx = db.transaction(() => {
    const tool = toolRepo.insert(db, {
      ...input,
      tool_code: toolCode,
      quantity: isBorrowed ? 0 : (input.quantity ?? 1),
      unit: input.unit ?? '件',
      status,
      qr_content: input.qr_content?.trim() || toolCode,
      work_center: input.work_center?.trim() || 'LG-FT',
      current_borrower: isBorrowed ? input.current_borrower?.trim() || '管理员导入' : null,
      current_borrow_department: isBorrowed
        ? input.current_borrow_department?.trim() || '管理员'
        : null,
      current_borrow_time: isBorrowed ? input.current_borrow_time?.trim() || now : null,
      expected_return_time: isBorrowed
        ? input.expected_return_time?.trim() || daysLaterIso(7)
        : null,
      created_at: now,
      updated_at: now,
    })

    insertAdminImportInbound(
      db,
      {
        id: tool.id,
        tool_code: tool.tool_code,
        tool_name: tool.tool_name,
        specification: tool.specification,
        serial_no: tool.serial_no,
        work_center: tool.work_center,
        location_code: tool.location_code,
      },
      { now, operator_name: '管理员导入', remark: '管理员导入' },
    )

    if (isBorrowed) {
      borrowRepo.insert(db, {
        record_no: generateRecordNo(db, new Date()),
        tool_id: tool.id,
        tool_code: tool.tool_code,
        tool_name: tool.tool_name,
        record_status: '未归还',
        borrower: tool.current_borrower,
        borrower_employee_no: null,
        borrow_department: tool.current_borrow_department,
        borrow_time: tool.current_borrow_time,
        expected_return_time: tool.expected_return_time,
        operator_name: tool.current_borrower,
        remark: '管理员导入',
        created_at: now,
        updated_at: now,
      })
    }

    return tool
  })

  return tx()
}

function daysLaterIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return formatNow(d)
}
