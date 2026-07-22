import type Database from 'better-sqlite3'

function tableHasColumn(db: Database.Database, table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return cols.some((c) => c.name === column)
}

function tableExists(db: Database.Database, table: string): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
    .get(table) as { name: string } | undefined
  return Boolean(row)
}

/** 结构迁移：字段增删（兼容旧库） */
export function runMigrations(db: Database.Database): void {
  // 历史遗留字段清理（旧「使用工作中心」冗余列）
  if (tableHasColumn(db, 'tool_account', 'current_use_work_center')) {
    db.exec('ALTER TABLE tool_account DROP COLUMN current_use_work_center')
  }
  if (tableHasColumn(db, 'borrow_return_record', 'use_work_center')) {
    db.exec('ALTER TABLE borrow_return_record DROP COLUMN use_work_center')
  }

  // 删除种类字段
  if (tableHasColumn(db, 'tool_account', 'tool_category')) {
    db.exec('ALTER TABLE tool_account DROP COLUMN tool_category')
  }

  // 新增序列号
  if (!tableHasColumn(db, 'tool_account', 'serial_no')) {
    db.exec('ALTER TABLE tool_account ADD COLUMN serial_no TEXT')
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_tool_account_serial ON tool_account(serial_no)')

  // 归属工作中心（入库填入）；旧数据回填 LG-FT
  if (!tableHasColumn(db, 'tool_account', 'work_center')) {
    db.exec('ALTER TABLE tool_account ADD COLUMN work_center TEXT')
  }
  db.exec(`UPDATE tool_account SET work_center = 'LG-FT' WHERE work_center IS NULL OR TRIM(work_center) = ''`)

  // 借还记录是历史快照：删除工装后保留，tool_id 可置空且不再使用外键级联约束
  const borrowToolIdCol = (
    db.prepare(`PRAGMA table_info(borrow_return_record)`).all() as {
      name: string
      notnull: number
    }[]
  ).find((c) => c.name === 'tool_id')
  const borrowFks = db.prepare(`PRAGMA foreign_key_list(borrow_return_record)`).all() as {
    table: string
  }[]
  const hasBorrowerEmployeeNo = tableHasColumn(
    db,
    'borrow_return_record',
    'borrower_employee_no',
  )
  const needsBorrowRebuild =
    borrowToolIdCol?.notnull === 1 || borrowFks.some((f) => f.table === 'tool_account')

  if (needsBorrowRebuild) {
    const employeeNoSelect = hasBorrowerEmployeeNo ? 'borrower_employee_no' : 'NULL'
    const rebuildBorrowHistory = db.transaction(() => {
      db.exec(`
        CREATE TABLE borrow_return_record_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          record_no TEXT NOT NULL UNIQUE,
          tool_id INTEGER,
          tool_code TEXT NOT NULL,
          tool_name TEXT NOT NULL,
          record_status TEXT NOT NULL,
          borrower TEXT,
          borrower_employee_no TEXT,
          borrow_department TEXT,
          borrow_time TEXT,
          expected_return_time TEXT,
          return_time TEXT,
          return_result TEXT,
          operator_name TEXT,
          remark TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        INSERT INTO borrow_return_record_new (
          id, record_no, tool_id, tool_code, tool_name, record_status,
          borrower, borrower_employee_no, borrow_department, borrow_time,
          expected_return_time, return_time, return_result, operator_name,
          remark, created_at, updated_at
        )
        SELECT
          id, record_no, tool_id, tool_code, tool_name, record_status,
          borrower, ${employeeNoSelect}, borrow_department, borrow_time,
          expected_return_time, return_time, return_result, operator_name,
          remark, created_at, updated_at
        FROM borrow_return_record;
        DROP TABLE borrow_return_record;
        ALTER TABLE borrow_return_record_new RENAME TO borrow_return_record;
      `)
    })
    rebuildBorrowHistory()
  } else if (!hasBorrowerEmployeeNo) {
    db.exec('ALTER TABLE borrow_return_record ADD COLUMN borrower_employee_no TEXT')
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_borrow_record_tool_code ON borrow_return_record(tool_code)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_borrow_record_status ON borrow_return_record(record_status)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_borrow_record_borrower ON borrow_return_record(borrower)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_borrow_record_borrow_time ON borrow_return_record(borrow_time)')

  // 入库记录表（快照历史；删除台账时保留，tool_id 可置空）
  if (!tableExists(db, 'tool_inbound_record')) {
    db.exec(`
      CREATE TABLE tool_inbound_record (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inbound_no TEXT NOT NULL,
        tool_id INTEGER,
        tool_code TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        specification TEXT,
        serial_no TEXT,
        work_center TEXT NOT NULL,
        location_code TEXT,
        operator_name TEXT NOT NULL,
        inbound_time TEXT NOT NULL,
        remark TEXT,
        created_at TEXT NOT NULL
      )
    `)
  } else {
    // 旧表：tool_id NOT NULL + FK → 重建为可空、无外键，删除工装时保留入库历史
    const toolIdCol = (
      db.prepare(`PRAGMA table_info(tool_inbound_record)`).all() as {
        name: string
        notnull: number
      }[]
    ).find((c) => c.name === 'tool_id')
    const fks = db.prepare(`PRAGMA foreign_key_list(tool_inbound_record)`).all() as {
      table: string
    }[]
    const needsRebuild =
      (toolIdCol?.notnull === 1) || fks.some((f) => f.table === 'tool_account')
    if (needsRebuild) {
      db.exec(`
        CREATE TABLE tool_inbound_record_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          inbound_no TEXT NOT NULL,
          tool_id INTEGER,
          tool_code TEXT NOT NULL,
          tool_name TEXT NOT NULL,
          specification TEXT,
          serial_no TEXT,
          work_center TEXT NOT NULL,
          location_code TEXT,
          operator_name TEXT NOT NULL,
          inbound_time TEXT NOT NULL,
          remark TEXT,
          created_at TEXT NOT NULL
        );
        INSERT INTO tool_inbound_record_new (
          id, inbound_no, tool_id, tool_code, tool_name, specification, serial_no,
          work_center, location_code, operator_name, inbound_time, remark, created_at
        )
        SELECT
          id, inbound_no, tool_id, tool_code, tool_name, specification, serial_no,
          work_center, location_code, operator_name, inbound_time, remark, created_at
        FROM tool_inbound_record;
        DROP TABLE tool_inbound_record;
        ALTER TABLE tool_inbound_record_new RENAME TO tool_inbound_record;
      `)
    }
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_inbound_no ON tool_inbound_record(inbound_no)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_inbound_tool_code ON tool_inbound_record(tool_code)')
  db.exec('CREATE INDEX IF NOT EXISTS idx_inbound_time ON tool_inbound_record(inbound_time)')
}
