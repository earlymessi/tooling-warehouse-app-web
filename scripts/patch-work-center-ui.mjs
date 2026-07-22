import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function patchFile(rel, fn) {
  const p = join(root, rel)
  writeFileSync(p, fn(readFileSync(p, 'utf8')), 'utf8')
  console.log('patched', rel)
}

// ToolForm: add work_center, rename 使用人侧 to 借用工作中心
patchFile('src/views/ToolForm.vue', (s) => {
  if (!s.includes('serial_no')) return s
  let out = s
  if (!out.includes("work_center: ''")) {
    out = out.replace("serial_no: '',", "serial_no: '',\n  work_center: 'LG-FT',")
  }
  if (!out.includes('tool.work_center')) {
    out = out.replace(
      "serial_no: tool.serial_no ?? '',",
      "serial_no: tool.serial_no ?? '',\n      work_center: tool.work_center ?? 'LG-FT',",
    )
  }
  if (!out.includes('work_center: form.work_center')) {
    out = out.replace(
      'serial_no: form.serial_no || undefined,',
      "serial_no: form.serial_no || undefined,\n    work_center: form.work_center || undefined,",
    )
  }
  // form fields after 序列号
  if (!out.includes('label="工作中心"')) {
    out = out.replace(
      `<el-form-item label="序列号">
          <el-input v-model="form.serial_no" size="large" />
        </el-form-item>`,
      `<el-form-item label="序列号">
          <el-input v-model="form.serial_no" size="large" />
        </el-form-item>
        <el-form-item label="工作中心" required>
          <el-input v-model="form.work_center" size="large" placeholder="归属工作中心" />
        </el-form-item>`,
    )
  }
  out = out.replace('label="使用部门"', 'label="借用工作中心"')
  out = out.replace('label="当前使用人"', 'label="使用人"')
  out = out.replaceAll('label="使用部门"', 'label="借用工作中心"')
  // borrow side might already be 工作中心 from earlier rename in ToolForm
  out = out.replace(
    /<el-form-item label="工作中心">\s*<el-input v-model="form.current_borrow_department"/,
    '<el-form-item label="借用工作中心">\n            <el-input v-model="form.current_borrow_department"',
  )
  return out
})

// StockQuery: add work_center column, rename borrow dept
patchFile('src/views/StockQuery.vue', (s) => {
  let out = s
  out = out.replace(
    'label="工作中心" min-width="100"',
    'label="借用工作中心" min-width="100"',
  )
  out = out.replace(
    'prop="current_borrow_department" label="使用部门"',
    'prop="current_borrow_department" label="借用工作中心"',
  )
  if (!out.includes('prop="work_center"')) {
    out = out.replace(
      '<el-table-column prop="serial_no" label="序列号" min-width="100" />',
      `<el-table-column prop="serial_no" label="序列号" min-width="100" />
      <el-table-column prop="work_center" label="工作中心" min-width="100" />`,
    )
  }
  // if no serial column yet
  if (!out.includes('prop="work_center"') && out.includes('prop="specification"')) {
    out = out.replace(
      /<el-table-column prop="specification" label="型号"[^/]*\/>/,
      (m) =>
        `${m}
      <el-table-column prop="serial_no" label="序列号" min-width="100" />
      <el-table-column prop="work_center" label="工作中心" min-width="100" />`,
    )
  }
  out = out.replace(
    'prop="current_borrow_department" label="工作中心"',
    'prop="current_borrow_department" label="借用工作中心"',
  )
  return out
})

// AdminToolPanel
patchFile('src/views/admin/AdminToolPanel.vue', (s) => {
  let out = s
  out = out.replace(
    'prop="current_borrow_department" label="工作中心"',
    'prop="current_borrow_department" label="借用工作中心"',
  )
  out = out.replace(
    'prop="current_borrow_department" label="使用部门"',
    'prop="current_borrow_department" label="借用工作中心"',
  )
  if (!out.includes('prop="work_center"')) {
    out = out.replace(
      '<el-table-column prop="serial_no" label="序列号" min-width="88" />',
      `<el-table-column prop="serial_no" label="序列号" min-width="88" />
      <el-table-column prop="work_center" label="工作中心" min-width="84" />`,
    )
  }
  if (!out.includes('prop="serial_no"') && out.includes('prop="specification"')) {
    out = out.replace(
      /<el-table-column prop="specification" label="型号"[^/]*\/>/,
      (m) =>
        `${m}
      <el-table-column prop="serial_no" label="序列号" min-width="88" />
      <el-table-column prop="work_center" label="工作中心" min-width="84" />`,
    )
  }
  return out
})

// borrow service message
patchFile('electron/services/borrow.service.ts', (s) =>
  s.replaceAll('工作中心不能为空', '借用工作中心不能为空').replaceAll(
    '使用部门不能为空',
    '借用工作中心不能为空',
  ),
)

// clean excel comments
patchFile('electron/services/excel.service.ts', (s) =>
  s.replace(
    /\/\/ adminCreateTool[\s\S]*?toolService\.adminCreateToolFromImport\(db, create\)/,
    'toolService.adminCreateToolFromImport(db, create)',
  ),
)

console.log('form patches done')
