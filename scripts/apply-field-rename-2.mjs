import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function patch(rel, replacer) {
  const path = join(root, rel)
  const before = readFileSync(path, 'utf8')
  const after = replacer(before)
  writeFileSync(path, after, 'utf8')
  console.log('patched', rel, before === after ? '(no change)' : '')
}

// Generic label replacements that are safe across files
const LABEL_REPLACEMENTS = [
  [/label="工装ID"/g, 'label="资产编号"'],
  [/label="规格型号"/g, 'label="型号"'],
  [/label="使用部门"/g, 'label="工作中心"'],
  [/label="借用部门"/g, 'label="工作中心"'],
  [/placeholder="ID\/名称\/规格\/种类"/g, 'placeholder="资产编号/名称/型号/序列号"'],
  [/请扫描或输入工装ID/g, '请扫描或输入资产编号'],
  [/请扫描工装，可连续扫码加入列表/g, '请扫描资产编号，可连续扫码加入列表'],
]

for (const rel of [
  'src/views/Borrow.vue',
  'src/views/Return.vue',
  'src/views/RecordList.vue',
  'src/views/admin/AdminRecordPanel.vue',
  'src/views/ToolList.vue',
  'src/components/ToolInfoCard.vue',
]) {
  patch(rel, (s) => {
    let out = s
    for (const [re, to] of LABEL_REPLACEMENTS) out = out.replace(re, to)
    return out
  })
}

// AdminToolPanel: rebuild table columns section
patch('src/views/admin/AdminToolPanel.vue', (s) => {
  let out = s
  for (const [re, to] of LABEL_REPLACEMENTS) out = out.replace(re, to)

  // Replace table columns block
  out = out.replace(
    /<el-table class="table-fill admin-tool-table"[\s\S]*?<\/el-table>/,
    `<el-table class="table-fill admin-tool-table" v-loading="loading" :data="items" border>
      <el-table-column prop="tool_code" label="资产编号" min-width="88" />
      <el-table-column prop="tool_name" label="名称" min-width="96" />
      <el-table-column prop="specification" label="型号" min-width="88" />
      <el-table-column prop="serial_no" label="序列号" min-width="88" />
      <el-table-column prop="location_code" label="库位" min-width="60" align="center" />
      <el-table-column prop="quantity" label="数量" min-width="52" align="center" />
      <el-table-column prop="unit" label="单位" min-width="52" align="center" />
      <el-table-column prop="status" label="状态" min-width="60" align="center" />
      <el-table-column prop="current_borrower" label="使用人" min-width="76" />
      <el-table-column prop="current_borrow_department" label="工作中心" min-width="84" />
      <el-table-column prop="current_borrow_time" label="借用时间" min-width="120" />
      <el-table-column prop="expected_return_time" label="预计归还" min-width="120" />
      <el-table-column prop="qr_content" label="二维码" min-width="72" />
      <el-table-column prop="remark" label="备注" min-width="76" />
      <el-table-column label="操作" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button link type="primary" @click="router.push(\`/admin/tools/\${row.id}/edit\`)">编辑</el-button>
            <el-button link type="danger" @click="removeRow(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>`,
  )
  return out
})

// ToolList: remove category column, rename
patch('src/views/ToolList.vue', (s) => {
  let out = s
  for (const [re, to] of LABEL_REPLACEMENTS) out = out.replace(re, to)
  out = out.replace(/\n\s*<el-table-column prop="tool_category"[^\n]*\n/g, '\n')
  out = out.replace(
    /prop="specification" label="型号"/g,
    'prop="specification" label="型号"',
  )
  // insert serial after specification if missing
  if (!out.includes('prop="serial_no"')) {
    out = out.replace(
      /(<el-table-column prop="specification"[^/]*\/>)/,
      '$1\n      <el-table-column prop="serial_no" label="序列号" min-width="100" />',
    )
  }
  return out
})

// ToolInfoCard
patch('src/components/ToolInfoCard.vue', (s) => {
  let out = s
  for (const [re, to] of LABEL_REPLACEMENTS) out = out.replace(re, to)
  out = out.replace(
    /<el-descriptions-item label="种类">\{\{ tool\.tool_category \|\| '-' \}\}<\/el-descriptions-item>\n\s*/g,
    '',
  )
  out = out.replace(
    /label="型号">\{\{ tool\.specification/,
    'label="型号">{{ tool.specification',
  )
  if (!out.includes('serial_no')) {
    out = out.replace(
      /(<el-descriptions-item label="型号">\{\{ tool\.specification \|\| '-' \}\}<\/el-descriptions-item>)/,
      `$1
      <el-descriptions-item label="序列号">{{ tool.serial_no || '-' }}</el-descriptions-item>`,
    )
  }
  return out
})

// Borrow: department label already patched; ensure 使用部门 text in form
patch('src/views/Borrow.vue', (s) => {
  let out = s
  for (const [re, to] of LABEL_REPLACEMENTS) out = out.replace(re, to)
  out = out.replace(/选择或输入使用部门/g, '选择或输入工作中心')
  out = out.replace(/随借用人自动带出/g, '随借用人自动带出')
  return out
})

console.log('done')
