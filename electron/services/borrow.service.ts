import type Database from 'better-sqlite3'
import * as toolRepo from '../db/tool.repository'
import * as borrowRepo from '../db/borrow.repository'
import type {
  BorrowReturnRecord,
  BorrowRecordListParams,
  BorrowToolInput,
  ReturnToolInput,
  AdminCreateBorrowRecordInput,
  AdminUpdateBorrowRecordInput,
} from '../../src/types/borrow'
import { formatNow } from './time'
import { generateRecordNo } from './recordNo'
import { displayRecordStatus } from './overdue'

export function borrowTool(db: Database.Database, input: BorrowToolInput): BorrowReturnRecord {
  const toolCode = input.toolCode.trim()
  const tool = toolRepo.findByCode(db, toolCode)
  if (!tool) throw new Error('TOOL_NOT_FOUND: 工装不存在')
  if (tool.status !== '在库' || tool.quantity !== 1) {
    throw new Error('TOOL_NOT_AVAILABLE: 当前状态不可借用')
  }
  if (borrowRepo.findOpenByToolId(db, tool.id)) {
    throw new Error('BORROW_EXISTS: 存在未归还记录')
  }
  if (!input.borrower?.trim()) throw new Error('BORROWER_REQUIRED: 借用人不能为空')
  if (!input.borrowerEmployeeNo?.trim()) {
    throw new Error('EMPLOYEE_NO_REQUIRED: 员工工号不能为空')
  }
  if (!input.borrowDepartment?.trim()) throw new Error('DEPARTMENT_REQUIRED: 借用工作中心不能为空')
  if (!input.expectedReturnTime?.trim()) throw new Error('RETURN_TIME_REQUIRED: 预计归还时间不能为空')

  const department = input.borrowDepartment.trim()
  const now = formatNow()
  const tx = db.transaction(() => {
    const record = borrowRepo.insert(db, {
      record_no: generateRecordNo(db, new Date()),
      tool_id: tool.id,
      tool_code: tool.tool_code,
      tool_name: tool.tool_name,
      record_status: '未归还',
      borrower: input.borrower.trim(),
      borrower_employee_no: input.borrowerEmployeeNo.trim(),
      borrow_department: department,
      borrow_time: now,
      expected_return_time: input.expectedReturnTime.trim(),
      operator_name: input.borrower.trim(),
      remark: input.remark?.trim() ?? null,
      created_at: now,
      updated_at: now,
    })
    toolRepo.update(db, tool.id, {
      status: '借出',
      quantity: 0,
      current_borrower: input.borrower.trim(),
      current_borrow_department: department,
      current_borrow_time: now,
      expected_return_time: input.expectedReturnTime.trim(),
      updated_at: now,
    })
    return record
  })
  return tx()
}

export function returnTool(db: Database.Database, input: ReturnToolInput): BorrowReturnRecord {
  const toolCode = input.toolCode.trim()
  const tool = toolRepo.findByCode(db, toolCode)
  if (!tool) throw new Error('TOOL_NOT_FOUND: 工装不存在')

  const openRecord = borrowRepo.findOpenByToolCode(db, toolCode)
  if (!openRecord) throw new Error('NO_OPEN_RECORD: 不需要归还或记录异常')

  const now = formatNow()
  const tx = db.transaction(() => {
    const record = borrowRepo.updateRecord(db, openRecord.id, {
      record_status: '已归还',
      return_time: now,
      return_result: '正常归还',
      remark: input.remark?.trim() ?? openRecord.remark,
      updated_at: now,
    })
    toolRepo.update(db, tool.id, {
      status: '在库',
      quantity: 1,
      current_borrower: null,
      current_borrow_department: null,
      current_borrow_time: null,
      expected_return_time: null,
      updated_at: now,
    })
    return record
  })
  return tx()
}

export function getBorrowReturnRecords(db: Database.Database, params: BorrowRecordListParams) {
  const result = borrowRepo.list(db, params)
  const now = new Date()
  const items = result.items.map((r) => ({
    ...r,
    record_status: displayRecordStatus(r.record_status, r.expected_return_time, now),
    is_overdue: displayRecordStatus(r.record_status, r.expected_return_time, now) === '已超期',
  }))
  return { items, total: result.total }
}

export function getOpenRecordByToolCode(db: Database.Database, toolCode: string) {
  const record = borrowRepo.findOpenByToolCode(db, toolCode.trim())
  if (!record) return null
  const now = new Date()
  return {
    ...record,
    record_status: displayRecordStatus(record.record_status, record.expected_return_time, now),
    is_overdue: displayRecordStatus(record.record_status, record.expected_return_time, now) === '已超期',
  }
}

export function getBorrowRecordById(db: Database.Database, id: number): BorrowReturnRecord | null {
  const record = borrowRepo.findById(db, id)
  if (!record) return null
  const now = new Date()
  return {
    ...record,
    record_status: displayRecordStatus(record.record_status, record.expected_return_time, now),
    is_overdue: displayRecordStatus(record.record_status, record.expected_return_time, now) === '已超期',
  }
}

function syncToolBorrowState(db: Database.Database, toolId: number, now: string): void {
  const openRecord = borrowRepo.findOpenByToolId(db, toolId)
  if (openRecord) {
    toolRepo.update(db, toolId, {
      status: '借出',
      quantity: 0,
      current_borrower: openRecord.borrower,
      current_borrow_department: openRecord.borrow_department,
      current_borrow_time: openRecord.borrow_time,
      expected_return_time: openRecord.expected_return_time,
      updated_at: now,
    })
  } else {
    toolRepo.update(db, toolId, {
      status: '在库',
      quantity: 1,
      current_borrower: null,
      current_borrow_department: null,
      current_borrow_time: null,
      expected_return_time: null,
      updated_at: now,
    })
  }
}

function assertRecordFields(input: {
  borrower?: string
  borrow_department?: string
  expected_return_time?: string | null
}): void {
  if (!input.borrower?.trim()) throw new Error('BORROWER_REQUIRED: 借用人不能为空')
  if (!input.borrow_department?.trim()) throw new Error('DEPARTMENT_REQUIRED: 借用工作中心不能为空')
  if (!input.expected_return_time?.trim()) throw new Error('RETURN_TIME_REQUIRED: 预计归还时间不能为空')
}

export function adminCreateBorrowRecord(
  db: Database.Database,
  input: AdminCreateBorrowRecordInput,
): BorrowReturnRecord {
  const toolCode = input.tool_code.trim()
  const tool = toolRepo.findByCode(db, toolCode)
  if (!tool) throw new Error('TOOL_NOT_FOUND: 工装不存在')

  assertRecordFields(input)

  if (input.record_status === '未归还' && borrowRepo.findOpenByToolId(db, tool.id)) {
    throw new Error('BORROW_EXISTS: 该工装已有未归还记录')
  }

  const now = formatNow()
  const borrowTime = input.borrow_time?.trim() || now
  const borrower = input.borrower.trim()
  const borrowerEmployeeNo = input.borrower_employee_no?.trim() || null
  const department = input.borrow_department.trim()
  const isOpen = input.record_status === '未归还'

  const tx = db.transaction(() => {
    const record = borrowRepo.insert(db, {
      record_no: generateRecordNo(db, new Date()),
      tool_id: tool.id,
      tool_code: tool.tool_code,
      tool_name: tool.tool_name,
      record_status: input.record_status,
      borrower,
      borrower_employee_no: borrowerEmployeeNo,
      borrow_department: department,
      borrow_time: borrowTime,
      expected_return_time: input.expected_return_time.trim(),
      operator_name: borrower,
      remark: input.remark?.trim() ?? null,
      created_at: now,
      updated_at: now,
    })

    if (isOpen) {
      syncToolBorrowState(db, tool.id, now)
      return record
    }

    const returnTime = input.return_time?.trim() || now
    const returned = borrowRepo.adminUpdate(db, record.id, {
      return_time: returnTime,
      return_result: input.return_result?.trim() || '管理员录入',
      updated_at: now,
    })
    syncToolBorrowState(db, tool.id, now)
    return returned
  })

  return tx()
}

export function adminUpdateBorrowRecord(
  db: Database.Database,
  id: number,
  input: AdminUpdateBorrowRecordInput,
): BorrowReturnRecord {
  const existing = borrowRepo.findById(db, id)
  if (!existing) throw new Error('RECORD_NOT_FOUND: 记录不存在')

  const borrower = (input.borrower ?? existing.borrower ?? '').trim()
  const borrowerEmployeeNo =
    input.borrower_employee_no !== undefined
      ? input.borrower_employee_no?.trim() || null
      : existing.borrower_employee_no
  const department = (input.borrow_department ?? existing.borrow_department ?? '').trim()
  const expectedReturn = (input.expected_return_time ?? existing.expected_return_time ?? '').trim()
  assertRecordFields({ borrower, borrow_department: department, expected_return_time: expectedReturn })

  const newStatus = input.record_status ?? existing.record_status
  if (newStatus !== '未归还' && newStatus !== '已归还') {
    throw new Error('STATUS_INVALID: 记录状态仅支持未归还或已归还')
  }

  const toolCode = (input.tool_code ?? existing.tool_code).trim()
  const staysDetached =
    existing.tool_id === null && toolCode === existing.tool_code && newStatus === '已归还'
  const tool = staysDetached ? null : toolRepo.findByCode(db, toolCode)
  if (!staysDetached && !tool) throw new Error('TOOL_NOT_FOUND: 工装不存在')

  const now = formatNow()
  const wasOpen = existing.record_status === '未归还'
  const willOpen = newStatus === '未归还'

  if (willOpen && tool && tool.id !== existing.tool_id) {
    const otherOpen = borrowRepo.findOpenByToolId(db, tool.id)
    if (otherOpen && otherOpen.id !== id) {
      throw new Error('BORROW_EXISTS: 目标工装已有未归还记录')
    }
  }

  if (willOpen && !wasOpen && tool && tool.id === existing.tool_id) {
    const otherOpen = borrowRepo.findOpenByToolId(db, tool.id)
    if (otherOpen && otherOpen.id !== id) {
      throw new Error('BORROW_EXISTS: 该工装已有未归还记录')
    }
  }

  const tx = db.transaction(() => {
    let returnTime = input.return_time !== undefined ? input.return_time : existing.return_time
    let returnResult = input.return_result !== undefined ? input.return_result : existing.return_result

    if (willOpen) {
      returnTime = null
      returnResult = null
    } else if (!returnTime) {
      returnTime = now
      if (!returnResult) returnResult = '管理员调整归还'
    }

    const record = borrowRepo.adminUpdate(db, id, {
      tool_id: tool?.id ?? null,
      tool_code: tool?.tool_code ?? existing.tool_code,
      tool_name: tool?.tool_name ?? existing.tool_name,
      record_status: newStatus,
      borrower,
      borrower_employee_no: borrowerEmployeeNo,
      borrow_department: department,
      borrow_time: input.borrow_time !== undefined ? input.borrow_time : existing.borrow_time,
      expected_return_time: expectedReturn,
      return_time: returnTime,
      return_result: returnResult,
      operator_name: borrower,
      remark: input.remark !== undefined ? input.remark : existing.remark,
      updated_at: now,
    })

    if (existing.tool_id !== null) {
      syncToolBorrowState(db, existing.tool_id, now)
    }
    if (tool && tool.id !== existing.tool_id) {
      syncToolBorrowState(db, tool.id, now)
    }

    return record
  })

  return tx()
}

export function adminDeleteBorrowRecord(db: Database.Database, id: number): void {
  const existing = borrowRepo.findById(db, id)
  if (!existing) throw new Error('RECORD_NOT_FOUND: 记录不存在')

  const now = formatNow()
  const toolId = existing.tool_id
  const tx = db.transaction(() => {
    borrowRepo.remove(db, id)
    if (toolId !== null) {
      syncToolBorrowState(db, toolId, now)
    }
  })
  tx()
}
