export type ToolStatus = '在库' | '借出'

export interface ToolAccount {
  id: number
  tool_code: string
  tool_name: string
  specification: string | null
  serial_no: string | null
  /** 归属工作中心（入库时填入） */
  work_center: string | null
  location_code: string | null
  quantity: number
  unit: string
  status: ToolStatus
  current_borrower: string | null
  /** 借用工作中心 */
  current_borrow_department: string | null
  current_borrow_time: string | null
  expected_return_time: string | null
  qr_content: string | null
  remark: string | null
  created_at: string
  updated_at: string
}

export interface ToolListParams {
  keyword?: string
  status?: ToolStatus | ''
  page?: number
  pageSize?: number
}

export interface CreateToolInput {
  tool_code: string
  tool_name: string
  specification?: string
  serial_no?: string
  work_center?: string
  location_code?: string
  quantity?: number
  unit?: string
  remark?: string
}

export type UpdateToolInput = Partial<Omit<CreateToolInput, 'tool_code'>>

export interface AdminCreateToolInput extends CreateToolInput {
  status?: ToolStatus
  qr_content?: string
  current_borrower?: string | null
  current_borrow_department?: string | null
  current_borrow_time?: string | null
  expected_return_time?: string | null
}

/** 管理员编辑：可改全部字段，并同步借还记录 */
export interface AdminUpdateToolInput extends UpdateToolInput {
  status?: ToolStatus
  quantity?: number
  qr_content?: string | null
  current_borrower?: string | null
  current_borrow_department?: string | null
  current_borrow_time?: string | null
  expected_return_time?: string | null
}
