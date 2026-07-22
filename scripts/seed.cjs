/**
 * 造演示数据：npm run seed
 * 数据库路径：C:\tooling-warehouse-db\data\tooling.db
 *
 * 数据特点：
 * - 一物一码，同库位可存放多件工装
 * - 种类为扭力螺丝刀、扭力扳手、数字万用表、数显卡尺、测量仪等
 */
const fs = require('node:fs')
const path = require('node:path')
const Database = require('better-sqlite3')
const { app } = require('electron')

const DATA_ROOT = 'C:\\tooling-warehouse-db'
const DB_FILE = path.join(DATA_ROOT, 'data', 'tooling.db')

const SCHEMA_SQL = fs
  .readFileSync(path.join(__dirname, '../electron/db/schema.ts'), 'utf8')
  .match(/export const SCHEMA_SQL = `([\s\S]*?)`/)?.[1]

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

function dropColumnIfExists(db, table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all()
  if (cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`)
  }
}

function migrateDropWorkCenter(db) {
  dropColumnIfExists(db, 'tool_account', 'work_center')
  dropColumnIfExists(db, 'tool_account', 'current_use_work_center')
  dropColumnIfExists(db, 'borrow_return_record', 'use_work_center')
}

// code, name, category, specification, location_code
// 同一 location_code 下可有多件工装（不同 tool_code）
const tools = [
  // A-01-01 扭力工具柜·上层（3 件）
  { code: '20001', name: '电动扭力螺丝刀', category: '扭力螺丝刀', spec: 'Atlas EBL 2-12N·m', wc: '总装一线', loc: 'A-01-01' },
  { code: '20002', name: '电动扭力螺丝刀', category: '扭力螺丝刀', spec: 'Atlas EBL 2-12N·m', wc: '总装一线', loc: 'A-01-01' },
  { code: '20003', name: '预置式扭力扳手', category: '扭力扳手', spec: '5-25N·m 可调', wc: '总装一线', loc: 'A-01-01' },

  // A-01-02 扭力工具柜·中层（3 件）
  { code: '20004', name: '预置式扭力扳手', category: '扭力扳手', spec: '10-50N·m 可调', wc: '总装一线', loc: 'A-01-02' },
  { code: '20005', name: '手持扭力螺丝刀', category: '扭力螺丝刀', spec: 'Desoutter 1.5-8N·m', wc: '总装二线', loc: 'A-01-02' },
  { code: '20006', name: '表盘式扭力扳手', category: '扭力扳手', spec: '0-25N·m', wc: '总装二线', loc: 'A-01-02' },

  // A-02-01 扭力工具柜·下层（2 件）
  { code: '20007', name: '预置式扭力扳手', category: '扭力扳手', spec: '20-100N·m', wc: '机加工', loc: 'A-02-01' },
  { code: '20008', name: '电动扭力螺丝刀', category: '扭力螺丝刀', spec: 'Makita 3-15N·m', wc: '机加工', loc: 'A-02-01' },

  // B-01-01 精密量具柜·左格（4 件，同库位混放）
  { code: '20009', name: '数显卡尺', category: '数显卡尺', spec: '0-150mm 0.01mm', wc: '质检室', loc: 'B-01-01' },
  { code: '20010', name: '数显卡尺', category: '数显卡尺', spec: '0-150mm 0.01mm', wc: '质检室', loc: 'B-01-01' },
  { code: '20011', name: '数显卡尺', category: '数显卡尺', spec: '0-200mm 0.01mm', wc: '质检室', loc: 'B-01-01' },
  { code: '20012', name: '外径千分尺', category: '测量仪', spec: '25-50mm', wc: '质检室', loc: 'B-01-01' },

  // B-01-02 精密量具柜·右格（3 件）
  { code: '20013', name: '数显卡尺', category: '数显卡尺', spec: '0-300mm 0.01mm', wc: '质检室', loc: 'B-01-02' },
  { code: '20014', name: '高度规', category: '测量仪', spec: '0-600mm 数显', wc: '质检室', loc: 'B-01-02' },
  { code: '20015', name: '塞尺组', category: '测量仪', spec: '0.02-1.00mm 13片', wc: '质检室', loc: 'B-01-02' },

  // B-02-01 电测仪器柜（3 件同库位）
  { code: '20016', name: '数字万用表', category: '数字万用表', spec: 'Fluke 15B+', wc: '设备维修', loc: 'B-02-01' },
  { code: '20017', name: '数字万用表', category: '数字万用表', spec: 'Fluke 17B+', wc: '设备维修', loc: 'B-02-01' },
  { code: '20018', name: '钳形万用表', category: '数字万用表', spec: 'UT204+ 600A', wc: '设备维修', loc: 'B-02-01' },

  // C-01-01 现场检测仪器架（3 件）
  { code: '20019', name: '激光测距仪', category: '测量仪', spec: 'Leica D2 100m', wc: '总装一线', loc: 'C-01-01' },
  { code: '20020', name: '表面粗糙度仪', category: '测量仪', spec: 'Mitutoyo SJ-210', wc: '质检室', loc: 'C-01-01' },
  { code: '20021', name: '红外测温仪', category: '测量仪', spec: '-32~550℃', wc: '设备维修', loc: 'C-01-01' },

  // C-01-02 备用仪器（2 件）
  { code: '20022', name: '数字万用表', category: '数字万用表', spec: 'UNI-T UT61E', wc: '总装二线', loc: 'C-01-02' },
  { code: '20023', name: '扭力测试仪', category: '测量仪', spec: '0.5-10N·m 校验', wc: '质检室', loc: 'C-01-02' },
]

// 当前借出：20002 正常、20016 超期、20020 正常
const borrowed = [
  { code: '20002', borrower: '陈浩', dept: '总装一课', overdue: false },
  { code: '20016', borrower: '刘洋', dept: '设备保障部', overdue: true },
  { code: '20020', borrower: '赵敏', dept: '品质部', overdue: false },
]

// 已归还历史
const returnedHistory = [
  { code: '20001', borrower: '王磊', dept: '总装一课', borrowDaysAgo: 12, returnDaysAgo: 9 },
  { code: '20009', borrower: '李娜', dept: '品质部', borrowDaysAgo: 8, returnDaysAgo: 6 },
  { code: '20007', borrower: '张伟', dept: '机加工', borrowDaysAgo: 15, returnDaysAgo: 11 },
  { code: '20022', borrower: '孙婷', dept: '总装二课', borrowDaysAgo: 5, returnDaysAgo: 2 },
]

const employees = [
  { no: 'E001', name: '陈浩', dept: '总装一课' },
  { no: 'E002', name: '王磊', dept: '总装一课' },
  { no: 'E003', name: '李娜', dept: '品质部' },
  { no: 'E004', name: '刘洋', dept: '设备保障部' },
  { no: 'E005', name: '赵敏', dept: '品质部' },
  { no: 'E006', name: '张伟', dept: '机加工' },
  { no: 'E007', name: '孙婷', dept: '总装二课' },
  { no: 'E008', name: '周强', dept: '总装二课' },
  { no: 'E009', name: '吴芳', dept: '设备保障部' },
  { no: 'E010', name: '郑凯', dept: '机加工' },
  { no: 'E011', name: '黄丽', dept: '总装一课' },
  { no: 'E012', name: '林峰', dept: '品质部' },
]

function runSeed() {
  fs.mkdirSync(path.join(DATA_ROOT, 'data'), { recursive: true })

  const db = new Database(DB_FILE)
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA_SQL)
  migrateDropWorkCenter(db)

  db.transaction(() => {
    db.exec('DELETE FROM borrow_return_record')
    db.exec('DELETE FROM tool_account')
    db.exec('DELETE FROM employee')
  })()

  const now = formatNow()
  const insertTool = db.prepare(`
    INSERT INTO tool_account (
      tool_code, tool_name, serial_no, specification, location_code,
      quantity, unit, status, qr_content, remark, created_at, updated_at,
      current_borrower, current_borrow_department,
      current_borrow_time, expected_return_time
    ) VALUES (
      @tool_code, @tool_name, @serial_no, @specification, @location_code,
      @quantity, @unit, @status, @qr_content, @remark, @created_at, @updated_at,
      @current_borrower, @current_borrow_department,
      @current_borrow_time, @expected_return_time
    )
  `)

  const insertEmployee = db.prepare(`
    INSERT INTO employee (employee_no, employee_name, department, created_at, updated_at)
    VALUES (@employee_no, @employee_name, @department, @created_at, @updated_at)
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
      borrower, borrow_department, borrow_time, expected_return_time,
      return_time, return_result, operator_name, remark, created_at, updated_at
    ) VALUES (
      @record_no, @tool_id, @tool_code, @tool_name, @record_status,
      @borrower, @borrow_department, @borrow_time, @expected_return_time,
      @return_time, @return_result, @operator_name, @remark, @created_at, @updated_at
    )
  `)

  const borrowedCodes = borrowed.map((b) => b.code)

  db.transaction(() => {
    for (const e of employees) {
      insertEmployee.run({
        employee_no: e.no,
        employee_name: e.name,
        department: e.dept,
        created_at: now,
        updated_at: now,
      })
    }

    const toolIds = {}

    for (const t of tools) {
      const b = borrowed.find((x) => x.code === t.code)
      const isBorrowed = !!b
      const r = insertTool.run({
        tool_code: t.code,
        tool_name: t.name,
        serial_no: null,
        specification: t.spec,
        location_code: t.loc,
        quantity: isBorrowed ? 0 : 1,
        unit: '件',
        status: isBorrowed ? '借出' : '在库',
        qr_content: t.code,
        remark: null,
        created_at: now,
        updated_at: now,
        current_borrower: isBorrowed ? b.borrower : null,
        current_borrow_department: isBorrowed ? b.dept : null,
        current_borrow_time: isBorrowed ? daysAgo(2) : null,
        expected_return_time: isBorrowed
          ? b.overdue
            ? daysAgo(1)
            : daysLater(3)
          : null,
      })
      toolIds[t.code] = Number(r.lastInsertRowid)
    }

    for (const b of borrowed) {
      const t = tools.find((x) => x.code === b.code)
      const borrowTime = daysAgo(2)
      const expected = b.overdue ? daysAgo(1) : daysLater(3)
      insertRecord.run({
        record_no: nextRecordNo(),
        tool_id: toolIds[b.code],
        tool_code: b.code,
        tool_name: t.name,
        record_status: '未归还',
        borrower: b.borrower,
        borrow_department: b.dept,
        borrow_time: borrowTime,
        expected_return_time: expected,
        return_time: null,
        return_result: null,
        operator_name: b.borrower,
        remark: b.overdue ? '超期未还演示' : null,
        created_at: borrowTime,
        updated_at: borrowTime,
      })
    }

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
        borrow_time: borrowTime,
        expected_return_time: daysLater(5),
        return_time: returnTime,
        return_result: '正常归还',
        operator_name: h.borrower,
        remark: null,
        created_at: borrowTime,
        updated_at: returnTime,
      })
    }
  })()

  const toolCount = db.prepare('SELECT COUNT(*) as c FROM tool_account').get()
  const recordCount = db.prepare('SELECT COUNT(*) as c FROM borrow_return_record').get()
  const inStock = db.prepare("SELECT COUNT(*) as c FROM tool_account WHERE status='在库'").get()
  const borrowedCount = db.prepare("SELECT COUNT(*) as c FROM tool_account WHERE status='借出'").get()
  const locStats = db
    .prepare(
      `SELECT location_code, COUNT(*) as cnt FROM tool_account GROUP BY location_code ORDER BY location_code`,
    )
    .all()

  console.log('')
  console.log('真实场景演示数据已写入：')
  console.log(`  数据库：${DB_FILE}`)
  console.log(`  工装台账：${toolCount.c} 条（在库 ${inStock.c}，借出 ${borrowedCount.c}）`)
  console.log(`  借还记录：${recordCount.c} 条（未归还 3，已归还历史 4）`)
  console.log('')
  console.log('库位分布（同库位多件）：')
  for (const row of locStats) {
    console.log(`  ${row.location_code}：${row.cnt} 件`)
  }
  console.log('')
  console.log(`  员工：${employees.length} 条`)
  console.log('借出中：20002（陈浩）、20016（刘洋·超期）、20020（赵敏）')
  console.log('在库可借示例：20001、20003、20009、20017 …')
  console.log('')

  db.close()
}

app.whenReady().then(() => {
  runSeed()
  app.quit()
})
