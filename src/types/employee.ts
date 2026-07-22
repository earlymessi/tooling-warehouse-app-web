export interface Employee {
  id: number
  employee_no: string
  employee_name: string
  department: string
  created_at: string
  updated_at: string
}

export interface EmployeeListParams {
  keyword?: string
  page?: number
  pageSize?: number
}

export interface CreateEmployeeInput {
  employee_no: string
  employee_name: string
  department: string
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>
