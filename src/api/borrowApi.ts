import { getApi } from '@/api/client'
import type { ApiResult, PaginatedResult } from '@/types/api'
import type {
  BorrowReturnRecord,
  BorrowRecordListParams,
  BorrowToolInput,
  ReturnToolInput,
  AdminCreateBorrowRecordInput,
  AdminUpdateBorrowRecordInput,
} from '@/types/borrow'

function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new Error(result.message)
  return result.data
}

export const borrowApi = {
  borrow: async (data: BorrowToolInput) =>
    unwrap<BorrowReturnRecord>(await getApi().borrow.borrow(data)),
  return: async (data: ReturnToolInput) =>
    unwrap<BorrowReturnRecord>(await getApi().borrow.return(data)),
  listRecords: async (params: BorrowRecordListParams) =>
    unwrap<PaginatedResult<BorrowReturnRecord>>(await getApi().borrow.listRecords(params)),
  getOpenRecord: async (toolCode: string) =>
    unwrap<BorrowReturnRecord | null>(await getApi().borrow.getOpenRecord(toolCode)),
  getById: async (id: number) => unwrap<BorrowReturnRecord | null>(await getApi().borrow.getById(id)),
  adminCreate: async (data: AdminCreateBorrowRecordInput) =>
    unwrap<BorrowReturnRecord>(await getApi().borrow.adminCreate(data)),
  adminUpdate: async (id: number, data: AdminUpdateBorrowRecordInput) =>
    unwrap<BorrowReturnRecord>(await getApi().borrow.adminUpdate(id, data)),
  adminDelete: async (id: number) => unwrap<boolean>(await getApi().borrow.adminDelete(id)),
}
