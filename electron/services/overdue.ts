import { parseIso } from './time'

export function isOverdue(expectedReturnTime: string | null, now = new Date()): boolean {
  if (!expectedReturnTime) return false
  return parseIso(expectedReturnTime) < now
}

export function displayRecordStatus(
  recordStatus: string,
  expectedReturnTime: string | null,
  now = new Date(),
): '未归还' | '已归还' | '已超期' {
  if (recordStatus === '已归还') return '已归还'
  if (recordStatus === '未归还' && isOverdue(expectedReturnTime, now)) return '已超期'
  return '未归还'
}
