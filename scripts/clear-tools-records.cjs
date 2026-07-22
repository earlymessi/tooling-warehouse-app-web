/**
 * 清空工装台账 + 借还记录，保留管理员与员工
 */
const Database = require('better-sqlite3')
const path = require('node:path')
const fs = require('node:fs')

const DB_FILE = 'C:\\tooling-warehouse-db\\data\\tooling.db'

if (!fs.existsSync(DB_FILE)) {
  console.error('数据库不存在:', DB_FILE)
  process.exit(1)
}

const db = new Database(DB_FILE)
db.pragma('foreign_keys = ON')

const before = {
  tools: db.prepare('SELECT COUNT(*) AS c FROM tool_account').get().c,
  records: db.prepare('SELECT COUNT(*) AS c FROM borrow_return_record').get().c,
  employees: db.prepare('SELECT COUNT(*) AS c FROM employee').get().c,
  admins: db.prepare('SELECT COUNT(*) AS c FROM admin_user').get().c,
}

const tx = db.transaction(() => {
  db.exec('DELETE FROM borrow_return_record')
  db.exec('DELETE FROM tool_account')
  // 重置自增（可选）
  db.exec(`DELETE FROM sqlite_sequence WHERE name IN ('tool_account','borrow_return_record')`)
})
tx()

const after = {
  tools: db.prepare('SELECT COUNT(*) AS c FROM tool_account').get().c,
  records: db.prepare('SELECT COUNT(*) AS c FROM borrow_return_record').get().c,
  employees: db.prepare('SELECT COUNT(*) AS c FROM employee').get().c,
  admins: db.prepare('SELECT COUNT(*) AS c FROM admin_user').get().c,
}

db.close()

console.log('cleared tools+records')
console.log('before', before)
console.log('after', after)
