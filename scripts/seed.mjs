/**
 * 造演示数据：npm run seed
 * 数据库路径：C:\tooling-warehouse-db\data\tooling.db
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_ROOT = 'C:\\tooling-warehouse-db'
const DB_FILE = path.join(DATA_ROOT, 'data', 'tooling.db')

const SCHEMA_SQL = fs.readFileSync(
  path.join(__dirname, '../electron/db/schema.ts'),
  'utf8',
).match(/export const SCHEMA_SQL = `([\s\S]*?)`/)?.[1]

if (!SCHEMA_SQL) {
  console.error('无法读取 schema')
  process.exit(1)
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function formatNow(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return formatNow(d)
}

function daysLater(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return formatNow(d)
}

// 工装台账：同型号多件，一物一码
const tools = [
  { code: '10001', name: '定位夹具-A', category: '夹具', spec: 'DJ-A100', wc: 'WC01', loc: 'A-01-01' },
  { code: '10002', name: '定位夹具-A', category: '夹具', spec: 'DJ-A100', wc: 'WC01', loc: 'A-01-02' },
  { code: '10003', name: '定位夹具-A', category: '夹具', spec: 'DJ-A100', wc: 'WC01', loc: 'A-01-03' },
  { code: '10004', name: '铣刀组套', category: '刀具', spec: 'XD-6MM', wc: 'WC02', loc: 'B-02-01' },
  { code: '10005', name: '铣刀组套', category: '刀具', spec: 'XD-6MM', wc: 'WC02', loc: 'B-02-02' },
  { code: '10006', name: '检测规', category: '量具', spec: 'JC-50', wc: 'WC03', loc: 'C-01-01' },
  { code: '10007', name: '检测规', category: '量具', spec: 'JC-50', wc: 'WC03', loc: 'C-01-02' },
  { code: '10008', name: '焊接工装', category: '工装', spec: 'HJ-200', wc: 'WC01', loc: 'A-03-01' },
  { code: '10009', name: '焊接工装', category: '工装', spec: 'HJ-200', wc: 'WC01', loc: 'A-03-02' },
  { code: '10010', name: '拧紧枪头', category: '工具', spec: 'NJ-T20', wc: 'WC04', loc: 'D-01-01' },
  { code: '10011', name: '拧紧枪头', category: '工具', spec: 'NJ-T20', wc: 'WC04', loc: 'D-01-02' },
  { code: '10012', name: '打磨砂轮', category: '耗材', spec: 'DM-80', wc: 'WC02', loc: 'B-03-01' },
  { code: '10013', name: '打磨砂轮', category: '耗材', spec: 'DM-80', wc: 'WC02', loc: 'B-03-02' },
  { code: '10014', name: '装配托盘', category: '工装', spec: 'TP-01', wc: 'WC05', loc: 'E-01-01' },
  { code: '10015', name: '装配托盘', category: '工装', spec: 'TP-01', wc: 'WC05', loc: 'E-01-02' },
]

// 借出中的工装 ID
const borrowedCodes = ['10002', '10005', '10008']
// 已归还历史（仅记录）
const returnedHistory = [
  { code: '10001', borrower: '王磊', dept: '生产一部', wc: 'WC01', borrowDaysAgo: 10, returnDaysAgo: 3 },
  { code: '10006', borrower: '李娜', dept: '质检部', wc: 'WC03', borrowDaysAgo: 7, returnDaysAgo: 5 },
]

fs.mkdirSync(path.join(DATA_ROOT, 'data'), { recursive: true })

const db = new Database(DB_FILE)
db.pragma('foreign_keys = ON')
db.exec(SCHEMA_SQL)

const clear = db.transaction(() => {
  db.exec('DELETE FROM borrow_return_record')
  db.exec('DELETE FROM tool_account')
})
clear()

const now = formatNow()
const insertTool = db.prepare(`
  INSERT INTO tool_account (
    tool_code, tool_name, tool_category, specification, work_center, location_code,
    quantity, unit, status, qr_content, remark, created_at, updated_at,
    current_borrower, current_borrow_department, current_use_work_center,
    current_borrow_time, expected_return_time
  ) VALUES (
    @tool_code, @tool_name, @tool_category, @specification, @work_center, @location_code,
    @quantity, @unit, @status, @qr_content, @remark, @created_at, @updated_at,
    @current_borrower, @current_borrow_department, @current_use_work_center,
    @current_borrow_time, @expected_return_time
  )
`)

let seq = 0
function nextRecordNo() {
  seq += 1
  const d = new Date()
  const prefix = `BR${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  return `${prefix}${String(seq).padStart(4, '0')}`
}

const insertRecord = db.prepare(`
  INSERT INTO borrow_return_record (
    record_no, tool_id, tool_code, tool_name, record_status,
    borrower, borrow_department, use_work_center, borrow_time, expected_return_time,
    return_time, return_result, operator_name, remark, created_at, updated_at
  ) VALUES (
    @record_no, @tool_id, @tool_code, @tool_name, @record_status,
    @borrower, @borrow_department, @use_work_center, @borrow_time, @expected_return_time,
    @return_time, @return_result, @operator_name, @remark, @created_at, @updated_at
  )
`)

const seed = db.transaction(() => {
  const toolIds = {}

  for (const t of tools) {
    const isBorrowed = borrowedCodes.includes(t.code)
    const r = insertTool.run({
      tool_code: t.code,
      tool_name: t.name,
      tool_category: t.category,
      specification: t.spec,
      work_center: t.wc,
      location_code: t.loc,
      quantity: isBorrowed ? 0 : 1,
      unit: '件',
      status: isBorrowed ? '借出' : '在库',
      qr_content: t.code,
      remark: '演示数据',
      created_at: now,
      updated_at: now,
      current_borrower: isBorrowed ? '张三' : null,
      current_borrow_department: isBorrowed ? '生产一部' : null,
      current_use_work_center: isBorrowed ? t.wc : null,
      current_borrow_time: isBorrowed ? daysAgo(2) : null,
      expected_return_time: isBorrowed
        ? t.code === '10008'
          ? daysAgo(1)
          : daysLater(3)
        : null,
    })
    toolIds[t.code] = Number(r.lastInsertRowid)
  }

  // 当前借出记录（10008 预计归还已过期 → 超期展示）
  for (const code of borrowedCodes) {
    const t = tools.find((x) => x.code === code)
    const borrowTime = daysAgo(2)
    const expected = code === '10008' ? daysAgo(1) : daysLater(3)
    insertRecord.run({
      record_no: nextRecordNo(),
      tool_id: toolIds[code],
      tool_code: code,
      tool_name: t.name,
      record_status: '未归还',
      borrower: '张三',
      borrow_department: '生产一部',
      use_work_center: t.wc,
      borrow_time: borrowTime,
      expected_return_time: expected,
      return_time: null,
      return_result: null,
      operator_name: '张三',
      remark: code === '10008' ? '演示超期' : null,
      created_at: borrowTime,
      updated_at: borrowTime,
    })
  }

  // 已归还历史
  for (const h of returnedHistory) {
    const t = tools.find((x) => x.code === h.code)
    const borrowTime = daysAgo(h.borrowDaysAgo)
    const returnTime = daysAgo(h.returnDaysAgo)
    insertRecord.run({
      record_no: nextRecordNo(),
      tool_id: toolIds[h.code],
      tool_code: h.code,
      tool_name: t.name,
      record_status: '已归还',
      borrower: h.borrower,
      borrow_department: h.dept,
      use_work_center: h.wc,
      borrow_time: borrowTime,
      expected_return_time: daysLater(5),
      return_time: returnTime,
      return_result: '正常归还',
      operator_name: h.borrower,
      remark: '历史记录',
      created_at: borrowTime,
      updated_at: returnTime,
    })
  }
})

seed()

const toolCount = db.prepare('SELECT COUNT(*) as c FROM tool_account').get()
const recordCount = db.prepare('SELECT COUNT(*) as c FROM borrow_return_record').get()
const inStock = db.prepare("SELECT COUNT(*) as c FROM tool_account WHERE status='在库'").get()
const borrowed = db.prepare("SELECT COUNT(*) as c FROM tool_account WHERE status='借出'").get()

console.log('')
console.log('演示数据已写入：')
console.log(`  数据库：${DB_FILE}`)
console.log(`  工装台账：${toolCount.c} 条（在库 ${inStock.c}，借出 ${borrowed.c}）`)
console.log(`  借还记录：${recordCount.c} 条（含 2 条已归还历史）`)
console.log('')
console.log('借出中工装 ID：10002、10005、10008（10008 为超期演示）')
console.log('在库可借示例：10001、10003、10004、10006 …')
console.log('')

db.close()
