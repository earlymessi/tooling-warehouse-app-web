import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/views/admin/AdminToolPanel.vue')

writeFileSync(
  path,
  `<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { toolApi } from '@/api/toolApi'
import { importExportApi } from '@/api/systemApi'
import { runImport } from '@/composables/useExcelImport'
import type { ToolAccount, ToolStatus } from '@/types/tool'

const router = useRouter()
const loading = ref(false)
const importing = ref(false)
const items = ref<ToolAccount[]>([])
const total = ref(0)
const keyword = ref('')
const status = ref<ToolStatus | ''>('')
const page = ref(1)
const pageSize = ref(20)

async function load() {
  loading.value = true
  try {
    const res = await toolApi.list({
      keyword: keyword.value,
      status: status.value,
      page: page.value,
      pageSize: pageSize.value,
    })
    items.value = res.items
    total.value = res.total
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function exportExcel() {
  try {
    const path = await importExportApi.exportTools({ keyword: keyword.value, status: status.value })
    ElMessage.success(\`导出成功：\${path}\`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导出失败')
  }
}

async function downloadTemplate() {
  try {
    const path = await importExportApi.downloadToolTemplate()
    ElMessage.success(\`模板已保存：\${path}\`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '下载失败')
  }
}

async function importExcel() {
  importing.value = true
  try {
    await runImport(() => importExportApi.importTools(), load)
  } finally {
    importing.value = false
  }
}

async function removeRow(row: ToolAccount) {
  try {
    await ElMessageBox.confirm(\`确定删除工装 \${row.tool_code}（\${row.tool_name}）吗？\`, '确认删除', {
      type: 'warning',
    })
    await toolApi.delete(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }
}

onMounted(load)

defineExpose({ load })
</script>

<template>
  <div>
    <div class="panel-toolbar">
      <el-button type="primary" size="large" @click="router.push('/admin/tools/new')">新增</el-button>
      <el-button size="large" @click="downloadTemplate">下载导入模板</el-button>
      <el-button size="large" :loading="importing" @click="importExcel">导入 Excel 数据</el-button>
      <el-button size="large" @click="exportExcel">导出 Excel</el-button>
    </div>

    <el-form inline>
      <el-form-item label="关键字">
        <el-input v-model="keyword" size="large" placeholder="ID/名称/规格/种类" clearable />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="status" size="large" clearable placeholder="全部" style="width: 140px">
          <el-option label="在库" value="在库" />
          <el-option label="借出" value="借出" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" size="large" @click="() => { page = 1; load() }">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table class="table-fill admin-tool-table" v-loading="loading" :data="items" border>
      <el-table-column prop="tool_code" label="工装ID" min-width="72" />
      <el-table-column prop="tool_name" label="名称" min-width="96" />
      <el-table-column prop="tool_category" label="种类" min-width="72" />
      <el-table-column prop="specification" label="规格型号" min-width="88" />
      <el-table-column prop="location_code" label="库位" min-width="60" align="center" />
      <el-table-column prop="quantity" label="数量" min-width="52" align="center" />
      <el-table-column prop="unit" label="单位" min-width="52" align="center" />
      <el-table-column prop="status" label="状态" min-width="60" align="center" />
      <el-table-column prop="current_borrower" label="使用人" min-width="76" />
      <el-table-column prop="current_borrow_department" label="使用部门" min-width="84" />
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
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      layout="total, prev, pager, next"
      style="margin-top: 16px"
      @current-change="load"
      @size-change="load"
    />
  </div>
</template>

<style scoped>
.panel-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.table-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.table-actions :deep(.el-button.is-link) {
  padding: 14px 10px;
}
</style>
`,
  'utf8',
)

console.log('AdminToolPanel.vue updated')
