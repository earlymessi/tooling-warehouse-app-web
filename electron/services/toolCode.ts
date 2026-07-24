import type Database from 'better-sqlite3'

const DEFAULT_START_CODE = 'LG-GZQ-001'

export function parseToolCodeSequence(
  code: string,
): { prefix: string; num: number; width: number } | null {
  const trimmed = code.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(.*?)(\d+)$/)
  if (!match) return null
  return {
    prefix: match[1],
    num: Number(match[2]),
    width: match[2].length,
  }
}

export function formatToolCode(prefix: string, num: number, width: number): string {
  return `${prefix}${String(num).padStart(Math.max(width, String(num).length), '0')}`
}

export function incrementToolCode(code: string): string {
  const parsed = parseToolCodeSequence(code)
  if (!parsed) return `${code.trim() || 'LG-GZQ'}-001`
  return formatToolCode(parsed.prefix, parsed.num + 1, parsed.width)
}

/** 取台账中最新一条资产编号，推算下一号起点（不保证未被占用） */
export function peekNextToolCodeSeed(db: Database.Database): string {
  const row = db
    .prepare('SELECT tool_code FROM tool_account ORDER BY id DESC LIMIT 1')
    .get() as { tool_code: string } | undefined
  if (!row?.tool_code?.trim()) return DEFAULT_START_CODE
  return incrementToolCode(row.tool_code)
}

function codeExists(
  db: Database.Database | null,
  code: string,
  reserved: Set<string>,
): boolean {
  if (reserved.has(code)) return true
  if (!db) return false
  const row = db.prepare('SELECT 1 AS ok FROM tool_account WHERE tool_code = ? LIMIT 1').get(code) as
    | { ok: number }
    | undefined
  return Boolean(row)
}

/**
 * 连续生成 count 个可用资产编号。
 * reserved：页面已占用或本批已分配的编号，避免冲突。
 */
export function generateNextToolCodes(
  db: Database.Database | null,
  count: number,
  reserved: string[] = [],
): string[] {
  if (count <= 0) return []
  const taken = new Set(
    reserved
      .map((c) => c.trim())
      .filter(Boolean)
      .map((c) => c),
  )
  let cursor = db ? peekNextToolCodeSeed(db) : DEFAULT_START_CODE
  // 若 seed 已被占用，继续往后找
  while (codeExists(db, cursor, taken)) {
    cursor = incrementToolCode(cursor)
  }

  const result: string[] = []
  while (result.length < count) {
    if (!codeExists(db, cursor, taken)) {
      result.push(cursor)
      taken.add(cursor)
    }
    cursor = incrementToolCode(cursor)
  }
  return result
}
