import type Database from 'better-sqlite3'
import type { BorrowReturnRecord, BorrowRecordListParams } from '../../src/types/borrow'
import { isOverdue } from '../services/overdue'

export function findOpenByToolId(db: Database.Database, toolId: number): BorrowReturnRecord | null {
  const row = db
    .prepare(
      `SELECT * FROM borrow_return_record WHERE tool_id = ? AND record_status = '未归还' ORDER BY id DESC LIMIT 1`,
    )
    .get(toolId)
  return (row as BorrowReturnRecord | undefined) ?? null
}

export function findOpenByToolCode(db: Database.Database, toolCode: string): BorrowReturnRecord | null {
  const row = db
    .prepare(
      `SELECT * FROM borrow_return_record WHERE tool_code = ? AND record_status = '未归还' ORDER BY id DESC LIMIT 1`,
    )
    .get(toolCode)
  return (row as BorrowReturnRecord | undefined) ?? null
}

export function findById(db: Database.Database, id: number): BorrowReturnRecord | null {
  const row = db.prepare('SELECT * FROM borrow_return_record WHERE id = ?').get(id)
  return (row as BorrowReturnRecord | undefined) ?? null
}

export function insert(
  db: Database.Database,
  data: Omit<BorrowReturnRecord, 'id' | 'return_time' | 'return_result' | 'is_overdue'>,
): BorrowReturnRecord {
  const stmt = db.prepare(`
    INSERT INTO borrow_return_record (
      record_no, tool_id, tool_code, tool_name, record_status,
      borrower, borrower_employee_no, borrow_department, borrow_time, expected_return_time,
      operator_name, remark, created_at, updated_at
    ) VALUES (
      @record_no, @tool_id, @tool_code, @tool_name, @record_status,
      @borrower, @borrower_employee_no, @borrow_department, @borrow_time, @expected_return_time,
      @operator_name, @remark, @created_at, @updated_at
    )
  `)
  const result = stmt.run(data)
  const row = db.prepare('SELECT * FROM borrow_return_record WHERE id = ?').get(result.lastInsertRowid)
  return row as BorrowReturnRecord
}

export function updateRecord(
  db: Database.Database,
  id: number,
  data: Partial<BorrowReturnRecord>,
): BorrowReturnRecord {
  const existing = db.prepare('SELECT * FROM borrow_return_record WHERE id = ?').get(id) as
    | BorrowReturnRecord
    | undefined
  if (!existing) throw new Error('RECORD_NOT_FOUND: 记录不存在')

  db.prepare(`
    UPDATE borrow_return_record SET
      record_status = @record_status,
      return_time = @return_time,
      return_result = @return_result,
      remark = @remark,
      updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    record_status: data.record_status ?? existing.record_status,
    return_time: data.return_time !== undefined ? data.return_time : existing.return_time,
    return_result: data.return_result !== undefined ? data.return_result : existing.return_result,
    remark: data.remark !== undefined ? data.remark : existing.remark,
    updated_at: data.updated_at ?? existing.updated_at,
  })
  return db.prepare('SELECT * FROM borrow_return_record WHERE id = ?').get(id) as BorrowReturnRecord
}

export function adminUpdate(
  db: Database.Database,
  id: number,
  data: Partial<BorrowReturnRecord> & { updated_at: string },
): BorrowReturnRecord {
  const existing = findById(db, id)
  if (!existing) throw new Error('RECORD_NOT_FOUND: 记录不存在')

  db.prepare(`
    UPDATE borrow_return_record SET
      tool_id = @tool_id,
      tool_code = @tool_code,
      tool_name = @tool_name,
      record_status = @record_status,
      borrower = @borrower,
      borrower_employee_no = @borrower_employee_no,
      borrow_department = @borrow_department,
      borrow_time = @borrow_time,
      expected_return_time = @expected_return_time,
      return_time = @return_time,
      return_result = @return_result,
      operator_name = @operator_name,
      remark = @remark,
      updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    tool_id: data.tool_id !== undefined ? data.tool_id : existing.tool_id,
    tool_code: data.tool_code ?? existing.tool_code,
    tool_name: data.tool_name ?? existing.tool_name,
    record_status: data.record_status ?? existing.record_status,
    borrower: data.borrower !== undefined ? data.borrower : existing.borrower,
    borrower_employee_no:
      data.borrower_employee_no !== undefined
        ? data.borrower_employee_no
        : existing.borrower_employee_no,
    borrow_department:
      data.borrow_department !== undefined ? data.borrow_department : existing.borrow_department,
    borrow_time: data.borrow_time !== undefined ? data.borrow_time : existing.borrow_time,
    expected_return_time:
      data.expected_return_time !== undefined ? data.expected_return_time : existing.expected_return_time,
    return_time: data.return_time !== undefined ? data.return_time : existing.return_time,
    return_result: data.return_result !== undefined ? data.return_result : existing.return_result,
    operator_name: data.operator_name !== undefined ? data.operator_name : existing.operator_name,
    remark: data.remark !== undefined ? data.remark : existing.remark,
    updated_at: data.updated_at,
  })
  return findById(db, id)!
}

export function remove(db: Database.Database, id: number): void {
  const result = db.prepare('DELETE FROM borrow_return_record WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('RECORD_NOT_FOUND: 记录不存在')
}

export function list(
  db: Database.Database,
  params: BorrowRecordListParams,
): { items: BorrowReturnRecord[]; total: number } {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const offset = (page - 1) * pageSize
  const conditions: string[] = []
  const values: unknown[] = []

  if (params.keyword?.trim()) {
    conditions.push(
      '(tool_code LIKE ? OR tool_name LIKE ? OR borrower LIKE ? OR borrower_employee_no LIKE ?)',
    )
    const kw = `%${params.keyword.trim()}%`
    values.push(kw, kw, kw, kw)
  }
  if (params.borrower?.trim()) {
    conditions.push('borrower LIKE ?')
    values.push(`%${params.borrower.trim()}%`)
  }
  if (params.recordStatus && params.recordStatus !== '已超期') {
    conditions.push('record_status = ?')
    values.push(params.recordStatus)
  }
  if (params.dateFrom) {
    conditions.push('borrow_time >= ?')
    values.push(params.dateFrom)
  }
  if (params.dateTo) {
    conditions.push('borrow_time <= ?')
    values.push(params.dateTo)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  let items = db
    .prepare(`SELECT * FROM borrow_return_record ${where} ORDER BY id DESC`)
    .all(...values) as BorrowReturnRecord[]

  if (params.recordStatus === '已超期') {
    items = items.filter((r) => r.record_status === '未归还' && isOverdue(r.expected_return_time))
  }

  const total = items.length
  const paged = items.slice(offset, offset + pageSize)
  return { items: paged, total }
}

export function listAllForExport(db: Database.Database, params: BorrowRecordListParams): BorrowReturnRecord[] {
  return list(db, { ...params, page: 1, pageSize: 100000 }).items
}
