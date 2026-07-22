import type Database from 'better-sqlite3'
import type {
  CreateToolInput,
  ToolAccount,
  ToolListParams,
  ToolStatus,
  UpdateToolInput,
} from '../../src/types/tool'

export function findByCode(db: Database.Database, toolCode: string): ToolAccount | null {
  const row = db.prepare('SELECT * FROM tool_account WHERE tool_code = ?').get(toolCode)
  return (row as ToolAccount | undefined) ?? null
}

export function findById(db: Database.Database, id: number): ToolAccount | null {
  const row = db.prepare('SELECT * FROM tool_account WHERE id = ?').get(id)
  return (row as ToolAccount | undefined) ?? null
}

export function list(
  db: Database.Database,
  params: ToolListParams,
): { items: ToolAccount[]; total: number } {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const offset = (page - 1) * pageSize
  const conditions: string[] = []
  const values: unknown[] = []

  if (params.keyword?.trim()) {
    conditions.push(
      '(tool_code LIKE ? OR tool_name LIKE ? OR specification LIKE ? OR serial_no LIKE ? OR work_center LIKE ?)',
    )
    const kw = `%${params.keyword.trim()}%`
    values.push(kw, kw, kw, kw, kw)
  }
  if (params.status) {
    conditions.push('status = ?')
    values.push(params.status)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = db
    .prepare(`SELECT COUNT(*) as count FROM tool_account ${where}`)
    .get(...values) as { count: number }
  const items = db
    .prepare(`SELECT * FROM tool_account ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...values, pageSize, offset) as ToolAccount[]

  return { items, total: totalRow.count }
}

export function insert(
  db: Database.Database,
  data: CreateToolInput & {
    quantity: number
    unit: string
    status: ToolStatus
    qr_content: string
    current_borrower?: string | null
    current_borrow_department?: string | null
    current_borrow_time?: string | null
    expected_return_time?: string | null
    created_at: string
    updated_at: string
  },
): ToolAccount {
  const stmt = db.prepare(`
    INSERT INTO tool_account (
      tool_code, tool_name, specification, serial_no, work_center, location_code,
      quantity, unit, status, qr_content, remark,
      current_borrower, current_borrow_department, current_borrow_time, expected_return_time,
      created_at, updated_at
    ) VALUES (
      @tool_code, @tool_name, @specification, @serial_no, @work_center, @location_code,
      @quantity, @unit, @status, @qr_content, @remark,
      @current_borrower, @current_borrow_department, @current_borrow_time, @expected_return_time,
      @created_at, @updated_at
    )
  `)
  const result = stmt.run({
    tool_code: data.tool_code,
    tool_name: data.tool_name,
    specification: data.specification ?? null,
    serial_no: data.serial_no ?? null,
    work_center: data.work_center ?? null,
    location_code: data.location_code ?? null,
    quantity: data.quantity,
    unit: data.unit,
    status: data.status,
    qr_content: data.qr_content,
    remark: data.remark ?? null,
    current_borrower: data.current_borrower ?? null,
    current_borrow_department: data.current_borrow_department ?? null,
    current_borrow_time: data.current_borrow_time ?? null,
    expected_return_time: data.expected_return_time ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  })
  return findById(db, Number(result.lastInsertRowid))!
}

export function update(
  db: Database.Database,
  id: number,
  data: UpdateToolInput & {
    status?: ToolStatus
    quantity?: number
    qr_content?: string | null
    current_borrower?: string | null
    current_borrow_department?: string | null
    current_borrow_time?: string | null
    expected_return_time?: string | null
    updated_at: string
  },
): ToolAccount {
  const existing = findById(db, id)
  if (!existing) throw new Error('TOOL_NOT_FOUND: 工装不存在')

  db.prepare(`
    UPDATE tool_account SET
      tool_name = @tool_name,
      specification = @specification,
      serial_no = @serial_no,
      work_center = @work_center,
      location_code = @location_code,
      quantity = @quantity,
      unit = @unit,
      status = @status,
      qr_content = @qr_content,
      current_borrower = @current_borrower,
      current_borrow_department = @current_borrow_department,
      current_borrow_time = @current_borrow_time,
      expected_return_time = @expected_return_time,
      remark = @remark,
      updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    tool_name: data.tool_name ?? existing.tool_name,
    specification: data.specification !== undefined ? data.specification ?? null : existing.specification,
    serial_no: data.serial_no !== undefined ? data.serial_no ?? null : existing.serial_no,
    work_center: data.work_center !== undefined ? data.work_center ?? null : existing.work_center,
    location_code: data.location_code !== undefined ? data.location_code ?? null : existing.location_code,
    quantity: data.quantity ?? existing.quantity,
    unit: data.unit ?? existing.unit,
    status: data.status ?? existing.status,
    qr_content: data.qr_content !== undefined ? data.qr_content : existing.qr_content,
    current_borrower: data.current_borrower !== undefined ? data.current_borrower : existing.current_borrower,
    current_borrow_department:
      data.current_borrow_department !== undefined
        ? data.current_borrow_department
        : existing.current_borrow_department,
    current_borrow_time:
      data.current_borrow_time !== undefined ? data.current_borrow_time : existing.current_borrow_time,
    expected_return_time:
      data.expected_return_time !== undefined ? data.expected_return_time : existing.expected_return_time,
    remark: data.remark !== undefined ? data.remark ?? null : existing.remark,
    updated_at: data.updated_at,
  })
  return findById(db, id)!
}

export function upsertByCode(
  db: Database.Database,
  input: CreateToolInput,
  now: string,
): ToolAccount {
  const existing = findByCode(db, input.tool_code)
  if (existing) {
    if (existing.status === '借出') {
      throw new Error('TOOL_BORROWED: 工装借出中不可更新')
    }
    return update(db, existing.id, {
      tool_name: input.tool_name,
      specification: input.specification,
      serial_no: input.serial_no,
      work_center: input.work_center,
      location_code: input.location_code,
      quantity: input.quantity ?? existing.quantity,
      unit: input.unit ?? existing.unit,
      remark: input.remark,
      updated_at: now,
    })
  }
  return insert(db, {
    ...input,
    quantity: input.quantity ?? 1,
    unit: input.unit ?? '件',
    status: '在库',
    qr_content: input.tool_code,
    created_at: now,
    updated_at: now,
  })
}

export function remove(db: Database.Database, id: number): void {
  const tx = db.transaction(() => {
    // 入库、借还记录保留为历史，仅断开与台账的关联
    db.prepare('UPDATE tool_inbound_record SET tool_id = NULL WHERE tool_id = ?').run(id)
    db.prepare('UPDATE borrow_return_record SET tool_id = NULL WHERE tool_id = ?').run(id)
    const result = db.prepare('DELETE FROM tool_account WHERE id = ?').run(id)
    if (result.changes === 0) throw new Error('TOOL_NOT_FOUND: 工装不存在')
  })
  tx()
}
