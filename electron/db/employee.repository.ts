import type Database from 'better-sqlite3'
import type { Employee, EmployeeListParams } from '../../src/types/employee'

export function listAll(db: Database.Database): Employee[] {
  return db
    .prepare('SELECT * FROM employee ORDER BY department ASC, employee_no ASC')
    .all() as Employee[]
}

export function list(
  db: Database.Database,
  params: EmployeeListParams = {},
): { items: Employee[]; total: number } {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 20
  const offset = (page - 1) * pageSize
  const conditions: string[] = []
  const values: unknown[] = []

  if (params.keyword?.trim()) {
    conditions.push('(employee_no LIKE ? OR employee_name LIKE ? OR department LIKE ?)')
    const kw = `%${params.keyword.trim()}%`
    values.push(kw, kw, kw)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const totalRow = db
    .prepare(`SELECT COUNT(*) as count FROM employee ${where}`)
    .get(...values) as { count: number }
  const items = db
    .prepare(`SELECT * FROM employee ${where} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .all(...values, pageSize, offset) as Employee[]

  return { items, total: totalRow.count }
}

export function listDepartments(db: Database.Database): string[] {
  const rows = db
    .prepare('SELECT DISTINCT department FROM employee ORDER BY department ASC')
    .all() as { department: string }[]
  return rows.map((r) => r.department)
}

export function count(db: Database.Database): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM employee').get() as { count: number }
  return row.count
}

export function findById(db: Database.Database, id: number): Employee | null {
  const row = db.prepare('SELECT * FROM employee WHERE id = ?').get(id)
  return (row as Employee | undefined) ?? null
}

export function findByNo(db: Database.Database, employeeNo: string): Employee | null {
  const row = db.prepare('SELECT * FROM employee WHERE employee_no = ?').get(employeeNo.trim())
  return (row as Employee | undefined) ?? null
}

export function insert(
  db: Database.Database,
  data: Pick<Employee, 'employee_no' | 'employee_name' | 'department' | 'created_at' | 'updated_at'>,
): Employee {
  const result = db
    .prepare(
      `INSERT INTO employee (employee_no, employee_name, department, created_at, updated_at)
       VALUES (@employee_no, @employee_name, @department, @created_at, @updated_at)`,
    )
    .run(data)
  return findById(db, Number(result.lastInsertRowid))!
}

export function update(
  db: Database.Database,
  id: number,
  data: Partial<Pick<Employee, 'employee_no' | 'employee_name' | 'department' | 'updated_at'>>,
): Employee {
  const existing = findById(db, id)
  if (!existing) throw new Error('EMPLOYEE_NOT_FOUND: 员工不存在')

  db.prepare(`
    UPDATE employee SET
      employee_no = @employee_no,
      employee_name = @employee_name,
      department = @department,
      updated_at = @updated_at
    WHERE id = @id
  `).run({
    id,
    employee_no: data.employee_no ?? existing.employee_no,
    employee_name: data.employee_name ?? existing.employee_name,
    department: data.department ?? existing.department,
    updated_at: data.updated_at ?? existing.updated_at,
  })
  return findById(db, id)!
}

export function remove(db: Database.Database, id: number): void {
  const result = db.prepare('DELETE FROM employee WHERE id = ?').run(id)
  if (result.changes === 0) throw new Error('EMPLOYEE_NOT_FOUND: 员工不存在')
}
