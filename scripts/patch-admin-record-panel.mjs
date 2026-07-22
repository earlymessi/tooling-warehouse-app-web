import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/views/admin/AdminRecordPanel.vue')
let content = readFileSync(path, 'utf8')

const newTable = `    <el-table class="table-fill admin-tool-table" v-loading="loading" :data="items" border>
      <el-table-column prop="record_no" label="记录号" min-width="108" />
      <el-table-column prop="tool_code" label="工装ID" min-width="72" />
      <el-table-column prop="tool_name" label="名称" min-width="96" />
      <el-table-column prop="borrower" label="借用人" min-width="76" />
      <el-table-column prop="borrow_department" label="使用部门" min-width="84" />
      <el-table-column prop="borrow_time" label="借用时间" min-width="120" />
      <el-table-column prop="expected_return_time" label="预计归还" min-width="120" />
      <el-table-column prop="return_time" label="归还时间" min-width="120" />
      <el-table-column label="状态" min-width="60" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.record_status)">{{ row.record_status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <div class="table-actions">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="removeRow(row)">删除</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>`

content = content.replace(
  /    <el-table class="table-fill"[\s\S]*?    <\/el-table>/,
  newTable,
)

const newStyles = `<style scoped>
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
</style>`

content = content.replace(
  /<style scoped>[\s\S]*?<\/style>/,
  newStyles,
)

// 表单标签与工装表统一：借用部门 -> 使用部门
content = content.replace(
  '<el-form-item label="借用部门" required>',
  '<el-form-item label="使用部门" required>',
)

writeFileSync(path, content, 'utf8')
console.log('AdminRecordPanel.vue updated')
