import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const files = [
  'src/views/StockQuery.vue',
  'src/views/RecordList.vue',
  'src/views/ToolList.vue',
  'src/views/Borrow.vue',
  'src/views/Return.vue',
  'src/views/admin/AdminToolPanel.vue',
  'src/views/admin/AdminRecordPanel.vue',
  'src/views/admin/AdminEmployeePanel.vue',
]

function patchTableLayout(content) {
  let out = content

  // Undo broken replacement: el-table-column was mistaken for el-table
  out = out.replace(/<el-table class="table-fill"-column/g, '<el-table-column')

  // Add table-fill only to real el-table tags (not el-table-column)
  out = out.replace(/<el-table(?![-\w])([^>]*)>/g, (match, attrs) => {
    if (attrs.includes('table-fill')) return match
    if (/class="/.test(attrs)) {
      return `<el-table${attrs.replace(/class="([^"]*)"/, 'class="$1 table-fill"')}>`
    }
    return `<el-table class="table-fill"${attrs}>`
  })

  // Column fixed width -> min-width
  out = out.replace(/^(\s*<el-table-column[^>]*?) width="(\d+)"/gm, '$1 min-width="$2"')

  return out
}

for (const rel of files) {
  const path = join(root, rel)
  const before = readFileSync(path, 'utf8')
  const after = patchTableLayout(before)
  writeFileSync(path, after, 'utf8')
  console.log('fixed:', rel)
}

console.log('done')
