import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { runMigrations } from '../../electron/db/migrations'

describe('database migrations', () => {
  it('rebuilds legacy borrow records as history snapshots without losing data', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(`
      CREATE TABLE tool_account (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_code TEXT NOT NULL UNIQUE,
        tool_name TEXT NOT NULL,
        specification TEXT,
        work_center TEXT,
        location_code TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit TEXT DEFAULT '件',
        status TEXT NOT NULL DEFAULT '在库',
        current_borrower TEXT,
        current_borrow_department TEXT,
        current_borrow_time TEXT,
        expected_return_time TEXT,
        qr_content TEXT,
        remark TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE borrow_return_record (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_no TEXT NOT NULL UNIQUE,
        tool_id INTEGER NOT NULL,
        tool_code TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        record_status TEXT NOT NULL,
        borrower TEXT,
        borrow_department TEXT,
        borrow_time TEXT,
        expected_return_time TEXT,
        return_time TEXT,
        return_result TEXT,
        operator_name TEXT,
        remark TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (tool_id) REFERENCES tool_account(id)
      );
      INSERT INTO tool_account (
        id, tool_code, tool_name, quantity, status, created_at, updated_at
      ) VALUES (1, '20001', '迁移夹具', 1, '在库', '2026-07-01T08:00:00', '2026-07-01T08:00:00');
      INSERT INTO borrow_return_record (
        id, record_no, tool_id, tool_code, tool_name, record_status,
        borrower, borrow_department, borrow_time, expected_return_time,
        return_time, return_result, operator_name, remark, created_at, updated_at
      ) VALUES (
        9, 'BR202607010001', 1, '20001', '迁移夹具', '已归还',
        '王五', '生产部', '2026-07-01T08:00:00', '2026-07-02T08:00:00',
        '2026-07-01T12:00:00', '正常归还', '王五', '历史备注',
        '2026-07-01T08:00:00', '2026-07-01T12:00:00'
      );
    `)

    runMigrations(db)

    const columns = db.prepare('PRAGMA table_info(borrow_return_record)').all() as {
      name: string
      notnull: number
    }[]
    const toolIdColumn = columns.find((column) => column.name === 'tool_id')
    expect(toolIdColumn?.notnull).toBe(0)
    expect(columns.some((column) => column.name === 'borrower_employee_no')).toBe(true)
    expect(db.prepare('PRAGMA foreign_key_list(borrow_return_record)').all()).toHaveLength(0)

    const record = db.prepare('SELECT * FROM borrow_return_record WHERE id = 9').get() as {
      record_no: string
      tool_code: string
      borrower: string
      borrower_employee_no: string | null
      remark: string
    }
    expect(record).toMatchObject({
      record_no: 'BR202607010001',
      tool_code: '20001',
      borrower: '王五',
      borrower_employee_no: null,
      remark: '历史备注',
    })
    db.close()
  })

  it('rolls back a failed legacy borrow table rebuild', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    db.exec(`
      CREATE TABLE tool_account (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_code TEXT NOT NULL UNIQUE,
        tool_name TEXT NOT NULL,
        specification TEXT,
        serial_no TEXT,
        work_center TEXT,
        location_code TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit TEXT DEFAULT '件',
        status TEXT NOT NULL DEFAULT '在库',
        current_borrower TEXT,
        current_borrow_department TEXT,
        current_borrow_time TEXT,
        expected_return_time TEXT,
        qr_content TEXT,
        remark TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE borrow_return_record (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        record_no TEXT NOT NULL UNIQUE,
        tool_id INTEGER NOT NULL,
        tool_code TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        record_status TEXT NOT NULL,
        borrower TEXT,
        borrow_department TEXT,
        borrow_time TEXT,
        expected_return_time TEXT,
        return_time TEXT,
        return_result TEXT,
        operator_name TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (tool_id) REFERENCES tool_account(id)
      );
      INSERT INTO tool_account (
        id, tool_code, tool_name, quantity, status, created_at, updated_at
      ) VALUES (1, '30001', '异常迁移夹具', 1, '在库', '2026-07-01T08:00:00', '2026-07-01T08:00:00');
      INSERT INTO borrow_return_record (
        id, record_no, tool_id, tool_code, tool_name, record_status,
        borrower, created_at, updated_at
      ) VALUES (
        10, 'BR202607010002', 1, '30001', '异常迁移夹具', '已归还',
        '周九', '2026-07-01T08:00:00', '2026-07-01T12:00:00'
      );
    `)

    expect(() => runMigrations(db)).toThrow()
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM borrow_return_record WHERE id = 10").get(),
    ).toMatchObject({ count: 1 })
    expect(
      db.prepare(
        "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'borrow_return_record_new'",
      ).get(),
    ).toMatchObject({ count: 0 })
    db.close()
  })
})
