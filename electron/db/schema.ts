export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tool_account (
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

CREATE INDEX IF NOT EXISTS idx_tool_account_code ON tool_account(tool_code);
CREATE INDEX IF NOT EXISTS idx_tool_account_status ON tool_account(status);
CREATE INDEX IF NOT EXISTS idx_tool_account_name ON tool_account(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_account_spec ON tool_account(specification);

CREATE TABLE IF NOT EXISTS borrow_return_record (
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

CREATE INDEX IF NOT EXISTS idx_borrow_record_tool_code ON borrow_return_record(tool_code);
CREATE INDEX IF NOT EXISTS idx_borrow_record_status ON borrow_return_record(record_status);
CREATE INDEX IF NOT EXISTS idx_borrow_record_borrower ON borrow_return_record(borrower);
CREATE INDEX IF NOT EXISTS idx_borrow_record_borrow_time ON borrow_return_record(borrow_time);

CREATE TABLE IF NOT EXISTS tool_inbound_record (
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

CREATE INDEX IF NOT EXISTS idx_inbound_no ON tool_inbound_record(inbound_no);
CREATE INDEX IF NOT EXISTS idx_inbound_tool_code ON tool_inbound_record(tool_code);
CREATE INDEX IF NOT EXISTS idx_inbound_time ON tool_inbound_record(inbound_time);

CREATE TABLE IF NOT EXISTS admin_user (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS employee (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_no TEXT NOT NULL UNIQUE,
  employee_name TEXT NOT NULL,
  department TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_employee_name ON employee(employee_name);
CREATE INDEX IF NOT EXISTS idx_employee_department ON employee(department);
`
