const fs = require('node:fs')
const path = require('node:path')
const Database = require('better-sqlite3')
const XLSX = require('xlsx')

const DATA_ROOT = 'C:\\tooling-warehouse-db'
const DB_FILE = path.join(DATA_ROOT, 'data', 'tooling.db')
const EXPORT_DIR = path.join(DATA_ROOT, 'export')
const OUT_FILE = process.argv[2]

if (!fs.existsSync(DB_FILE)) {
  console.error('数据库不存在: ' + DB_FILE)
  process.exit(1)
}
fs.mkdirSync(EXPORT_DIR, { recursive: true })

const db = new Database(DB_FILE, { readonly: true })

const tools = db.prepare(`SELECT
  tool_code AS 工装ID,
  tool_name AS 工装名称,
  tool_category AS 工装种类,
  specification AS 规格型号,
  location_code AS 库位,
  quantity AS 数量,
  unit AS 单位,
  status AS 状态,
  remark AS 备注
FROM tool_account
ORDER BY id ASC`).all()

const records = db.prepare(`SELECT
  record_no AS 记录号,
  tool_code AS 工装ID,
  tool_name AS 工装名称,
  borrower AS 借用人,
  borrow_department AS 使用部门,
  borrow_time AS 借用时间,
  expected_return_time AS 预计归还,
  return_time AS 归还时间,
  record_status AS 状态,
  return_result AS 归还结果,
  remark AS 备注
FROM borrow_return_record
ORDER BY id ASC`).all()

const wb = XLSX.utils.book_new()
const wsTools = XLSX.utils.json_to_sheet(tools)
const wsRecords = XLSX.utils.json_to_sheet(records)
XLSX.utils.book_append_sheet(wb, wsTools, '工装台账')
XLSX.utils.book_append_sheet(wb, wsRecords, '借还记录')
XLSX.writeFile(wb, OUT_FILE)

console.log(OUT_FILE)
console.log(`tools=${tools.length}, records=${records.length}`)
db.close()
