import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/views/admin/AdminEmployeePanel.vue')
let content = readFileSync(path, 'utf8')

if (!content.includes('exportExcel')) {
  content = content.replace(
    `async function importExcel() {
  importing.value = true
  try {
    await runImport(() => importExportApi.importEmployees(), load)
  } finally {
    importing.value = false
  }
}

onMounted(load)`,
    `async function importExcel() {
  importing.value = true
  try {
    await runImport(() => importExportApi.importEmployees(), load)
  } finally {
    importing.value = false
  }
}

async function exportExcel() {
  try {
    const path = await importExportApi.exportEmployees({ keyword: keyword.value })
    ElMessage.success(\`导出成功：\${path}\`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导出失败')
  }
}

onMounted(load)`,
  )

  content = content.replace(
    `      <el-button size="large" :loading="importing" @click="importExcel">导入 Excel 数据</el-button>
    </div>`,
    `      <el-button size="large" :loading="importing" @click="importExcel">导入 Excel 数据</el-button>
      <el-button size="large" @click="exportExcel">导出 Excel</el-button>
    </div>`,
  )

  writeFileSync(path, content, 'utf8')
  console.log('AdminEmployeePanel.vue updated')
} else {
  console.log('AdminEmployeePanel.vue already has exportExcel')
}
