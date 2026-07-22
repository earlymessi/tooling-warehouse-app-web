import type Database from 'better-sqlite3'
import type { ToolInboundRecord } from '../../src/types/inbound'

export function insert(
  db: Database.Database,
  data: Omit<ToolInboundRecord, 'id'>,
): ToolInboundRecord {
  const result = db
    .prepare(
      `INSERT INTO tool_inbound_record (
        inbound_no, tool_id, tool_code, tool_name, specification, serial_no,
        work_center, location_code, operator_name, inbound_time, remark, created_at
      ) VALUES (
        @inbound_no, @tool_id, @tool_code, @tool_name, @specification, @serial_no,
        @work_center, @location_code, @operator_name, @inbound_time, @remark, @created_at
      )`,
    )
    .run({
      inbound_no: data.inbound_no,
      tool_id: data.tool_id,
      tool_code: data.tool_code,
      tool_name: data.tool_name,
      specification: data.specification ?? null,
      serial_no: data.serial_no ?? null,
      work_center: data.work_center,
      location_code: data.location_code ?? null,
      operator_name: data.operator_name,
      inbound_time: data.inbound_time,
      remark: data.remark ?? null,
      created_at: data.created_at,
    })
  return findById(db, Number(result.lastInsertRowid))!
}

export function findById(db: Database.Database, id: number): ToolInboundRecord | null {
  const row = db.prepare('SELECT * FROM tool_inbound_record WHERE id = ?').get(id)
  return (row as ToolInboundRecord | undefined) ?? null
}

export function generateInboundNo(db: Database.Database, now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const prefix = `IN${y}${m}${d}`
  const row = db
    .prepare(
      `SELECT inbound_no FROM tool_inbound_record WHERE inbound_no LIKE ? ORDER BY inbound_no DESC LIMIT 1`,
    )
    .get(`${prefix}%`) as { inbound_no: string } | undefined
  let maxSeq = 0
  if (row?.inbound_no) {
    maxSeq = Number(row.inbound_no.slice(-4)) || 0
  }
  // 同一批次多行共用一个单号，由调用方生成一次后传入；此处给单号本身用
  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`
}
