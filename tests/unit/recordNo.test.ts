import { describe, it, expect } from 'vitest'
import { initTestDatabase } from '../../electron/db'
import { generateRecordNo } from '../../electron/services/recordNo'
import { formatNow } from '../../electron/services/time'

describe('recordNo', () => {
  it('generates BR + date + 4 digit sequence', () => {
    const db = initTestDatabase()
    const now = formatNow(new Date(2026, 5, 26, 10, 0, 0))

    db.prepare(
      `INSERT INTO tool_account (tool_code, tool_name, quantity, unit, status, created_at, updated_at)
       VALUES ('10001', '测试', 1, '件', '在库', ?, ?)`,
    ).run(now, now)

    const no1 = generateRecordNo(db, new Date(2026, 5, 26, 10, 0, 0))
    db.prepare(
      `INSERT INTO borrow_return_record (
        record_no, tool_id, tool_code, tool_name, record_status, created_at, updated_at
      ) VALUES (?, 1, '10001', '测试', '未归还', ?, ?)`,
    ).run(no1, now, now)

    const no2 = generateRecordNo(db, new Date(2026, 5, 26, 10, 1, 0))
    expect(no1).toBe('BR202606260001')
    expect(no2).toBe('BR202606260002')
    db.close()
  })
})
