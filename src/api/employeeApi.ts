import { getApi } from '@/api/client'
import type { ApiResult, PaginatedResult } from '@/types/api'
import type {
  CreateEmployeeInput,
  Employee,
  EmployeeListParams,
  UpdateEmployeeInput,
} from '@/types/employee'

function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new Error(result.message)
  return result.data
}

export const employeeApi = {
  list: async (params?: EmployeeListParams) =>
    unwrap<PaginatedResult<Employee>>(await getApi().employee.list(params)),
  listDepartments: async () => unwrap<string[]>(await getApi().employee.listDepartments()),
  getById: async (id: number) => unwrap<Employee | null>(await getApi().employee.getById(id)),
  create: async (data: CreateEmployeeInput) => unwrap<Employee>(await getApi().employee.create(data)),
  update: async (id: number, data: UpdateEmployeeInput) =>
    unwrap<Employee>(await getApi().employee.update(id, data)),
  delete: async (id: number) => unwrap<boolean>(await getApi().employee.delete(id)),
}
