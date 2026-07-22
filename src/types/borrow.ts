export type RecordStatus = '未归还' | '已归还' | '已超期'

export interface BorrowReturnRecord {
  id: number
  record_no: string
  tool_id: number | null
  tool_code: string
  tool_name: string
  record_status: RecordStatus
  borrower: string | null
  borrower_employee_no: string | null
  borrow_department: string | null
  borrow_time: string | null
  expected_return_time: string | null
  return_time: string | null
  return_result: string | null
  operator_name: string | null
  remark: string | null
  created_at: string
  updated_at: string
  is_overdue?: boolean
}

export interface BorrowToolInput {
  toolCode: string
  borrower: string
  borrowerEmployeeNo: string
  borrowDepartment: string
  expectedReturnTime: string
  remark?: string
}

export interface ReturnToolInput {
  toolCode: string
  remark?: string
}

export interface BorrowRecordListParams {
  keyword?: string
  recordStatus?: RecordStatus | ''
  borrower?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface AdminCreateBorrowRecordInput {
  tool_code: string
  borrower: string
  borrower_employee_no?: string | null
  borrow_department: string
  borrow_time?: string
  expected_return_time: string
  record_status: '未归还' | '已归还'
  return_time?: string | null
  return_result?: string | null
  remark?: string | null
}

export interface AdminUpdateBorrowRecordInput {
  tool_code?: string
  borrower?: string
  borrower_employee_no?: string | null
  borrow_department?: string
  borrow_time?: string | null
  expected_return_time?: string | null
  record_status?: '未归还' | '已归还'
  return_time?: string | null
  return_result?: string | null
  remark?: string | null
}
