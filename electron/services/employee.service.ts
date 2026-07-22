import type Database from 'better-sqlite3'
import * as employeeRepo from '../db/employee.repository'
import type {
  CreateEmployeeInput,
  Employee,
  EmployeeListParams,
  UpdateEmployeeInput,
} from '../../src/types/employee'
import { formatNow } from './time'

const DEFAULT_EMPLOYEES: Pick<Employee, 'employee_no' | 'employee_name' | 'department'>[] = [
  { employee_no: 'E001', employee_name: '陈浩', department: '总装一课' },
  { employee_no: 'E002', employee_name: '王磊', department: '总装一课' },
  { employee_no: 'E003', employee_name: '李娜', department: '品质部' },
  { employee_no: 'E004', employee_name: '刘洋', department: '设备保障部' },
  { employee_no: 'E005', employee_name: '赵敏', department: '品质部' },
  { employee_no: 'E006', employee_name: '张伟', department: '机加工' },
  { employee_no: 'E007', employee_name: '孙婷', department: '总装二课' },
  { employee_no: 'E008', employee_name: '周强', department: '总装二课' },
  { employee_no: 'E009', employee_name: '吴芳', department: '设备保障部' },
  { employee_no: 'E010', employee_name: '郑凯', department: '机加工' },
  { employee_no: 'E011', employee_name: '黄丽', department: '总装一课' },
  { employee_no: 'E012', employee_name: '林峰', department: '品质部' },
]

export function ensureDefaultEmployees(db: Database.Database): void {
  if (employeeRepo.count(db) > 0) return
  const now = formatNow()
  const tx = db.transaction(() => {
    for (const emp of DEFAULT_EMPLOYEES) {
      employeeRepo.insert(db, { ...emp, created_at: now, updated_at: now })
    }
  })
  tx()
}

export function getEmployeeList(db: Database.Database, params?: EmployeeListParams) {
  if (!params || (!params.keyword && !params.page && !params.pageSize)) {
    const items = employeeRepo.listAll(db)
    return { items, total: items.length }
  }
  return employeeRepo.list(db, params)
}

export function getEmployeeById(db: Database.Database, id: number): Employee | null {
  return employeeRepo.findById(db, id)
}

export function getDepartmentList(db: Database.Database): string[] {
  return employeeRepo.listDepartments(db)
}

export function createEmployee(db: Database.Database, input: CreateEmployeeInput): Employee {
  const employeeNo = input.employee_no.trim()
  const employeeName = input.employee_name.trim()
  const department = input.department.trim()
  if (!employeeNo) throw new Error('EMPLOYEE_NO_REQUIRED: 员工工号不能为空')
  if (!employeeName) throw new Error('EMPLOYEE_NAME_REQUIRED: 员工姓名不能为空')
  if (!department) throw new Error('DEPARTMENT_REQUIRED: 所属部门不能为空')
  if (employeeRepo.findByNo(db, employeeNo)) {
    throw new Error('EMPLOYEE_NO_EXISTS: 员工工号已存在')
  }

  const now = formatNow()
  return employeeRepo.insert(db, {
    employee_no: employeeNo,
    employee_name: employeeName,
    department,
    created_at: now,
    updated_at: now,
  })
}

export function updateEmployee(db: Database.Database, id: number, input: UpdateEmployeeInput): Employee {
  const existing = employeeRepo.findById(db, id)
  if (!existing) throw new Error('EMPLOYEE_NOT_FOUND: 员工不存在')

  if (input.employee_no?.trim() && input.employee_no.trim() !== existing.employee_no) {
    const dup = employeeRepo.findByNo(db, input.employee_no.trim())
    if (dup && dup.id !== id) throw new Error('EMPLOYEE_NO_EXISTS: 员工工号已存在')
  }

  return employeeRepo.update(db, id, {
    employee_no: input.employee_no?.trim(),
    employee_name: input.employee_name?.trim(),
    department: input.department?.trim(),
    updated_at: formatNow(),
  })
}

export function deleteEmployee(db: Database.Database, id: number): void {
  employeeRepo.remove(db, id)
}

export function upsertEmployeeFromImport(db: Database.Database, input: CreateEmployeeInput): Employee {
  const employeeNo = input.employee_no.trim()
  const existing = employeeRepo.findByNo(db, employeeNo)
  if (existing) {
    return updateEmployee(db, existing.id, {
      employee_name: input.employee_name.trim(),
      department: input.department.trim(),
    })
  }
  return createEmployee(db, input)
}
