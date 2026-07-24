import { getApi } from '@/api/client'
import type { ApiResult } from '@/types/api'
import type { CreateToolInput, ToolAccount, ToolListParams, UpdateToolInput, AdminUpdateToolInput, AdminCreateToolInput } from '@/types/tool'
import type { PaginatedResult } from '@/types/api'

function unwrap<T>(result: ApiResult<T>): T {
  if (!result.ok) throw new Error(result.message)
  return result.data
}

export const toolApi = {
  list: async (params: ToolListParams) =>
    unwrap<PaginatedResult<ToolAccount>>(await getApi().tool.list(params)),
  getByCode: async (toolCode: string) =>
    unwrap<ToolAccount | null>(await getApi().tool.getByCode(toolCode)),
  getById: async (id: number) => unwrap<ToolAccount | null>(await getApi().tool.getById(id)),
  create: async (data: CreateToolInput) => unwrap<ToolAccount>(await getApi().tool.create(data)),
  adminCreate: async (data: AdminCreateToolInput) =>
    unwrap<ToolAccount>(await getApi().tool.adminCreate(data)),
  update: async (id: number, data: UpdateToolInput) =>
    unwrap<ToolAccount>(await getApi().tool.update(id, data)),
  delete: async (id: number) => unwrap<boolean>(await getApi().tool.delete(id)),
  adminUpdate: async (id: number, data: AdminUpdateToolInput) =>
    unwrap<ToolAccount>(await getApi().tool.adminUpdate(id, data)),
  nextCodes: async (count = 1, reserved: string[] = []) =>
    unwrap<string[]>(await getApi().tool.nextCodes({ count, reserved })),
}
