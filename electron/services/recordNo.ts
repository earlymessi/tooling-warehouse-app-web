import type Database from 'better-sqlite3'

export function generateRecordNo(db: Database.Database, now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const prefix = `BR${y}${m}${d}`
  const row = db
    .prepare(
      `SELECT record_no FROM borrow_return_record WHERE record_no LIKE ? ORDER BY record_no DESC LIMIT 1`,
    )
    .get(`${prefix}%`) as { record_no: string } | undefined
  const seq = row ? Number(row.record_no.slice(-4)) + 1 : 1
  return `${prefix}${String(seq).padStart(4, '0')}`
}
