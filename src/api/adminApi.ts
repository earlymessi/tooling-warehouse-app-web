import { getApi } from '@/api/client'

export interface AdminLoginResult {
  username: string
  displayName: string
}

function unwrap<T>(result: { ok: boolean; data?: T; message?: string }): T {
  if (!result.ok) throw new Error(result.message ?? '登录失败')
  return result.data as T
}

export const adminApi = {
  login: async (username: string, password: string) =>
    unwrap<AdminLoginResult>(await getApi().admin.login(username, password)),
}
