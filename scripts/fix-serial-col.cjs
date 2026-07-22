const { app } = require('electron')
const Database = require('better-sqlite3')
const path = require('path')

// Inline migration test without full app
function tableHasColumn(db, table, column) {
  return db.prepare('PRAGMA table_info(' + table + ')').all().some(c => c.name === column)
}

const DB = 'C:\\\\tooling-warehouse-db\\\\data\\\\tooling.db'
const db = new Database(DB)
if (!tableHasColumn(db, 'tool_account', 'serial_no')) {
  db.exec('ALTER TABLE tool_account ADD COLUMN serial_no TEXT')
  console.log('added serial_no')
} else {
  console.log('serial_no already exists')
}
db.exec('CREATE INDEX IF NOT EXISTS idx_tool_account_serial ON tool_account(serial_no)')
console.log('index ok, columns:', db.prepare('PRAGMA table_info(tool_account)').all().map(c => c.name).join(','))
db.close()
app.quit()
