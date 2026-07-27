<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import CodeFieldInput from '@/components/CodeFieldInput.vue'
import { borrowApi } from '@/api/borrowApi'
import { importExportApi } from '@/api/systemApi'
import type { BorrowReturnRecord, RecordStatus } from '@/types/borrow'

const loading = ref(false)
const items = ref<BorrowReturnRecord[]>([])
const total = ref(0)
const keyword = ref('')
const recordStatus = ref<RecordStatus | ''>('')
const borrower = ref('')
const page = ref(1)
const pageSize = ref(20)

const dialogVisible = ref(false)
const dialogLoading = ref(false)
const editingId = ref<number | null>(null)

const form = reactive({
  tool_code: '',
  borrower: '',
  borrower_employee_no: '',
  borrow_department: '',
  borrow_time: '',
  expected_return_time: '',
  record_status: '未归还' as '未归还' | '已归还',
  return_time: '',
  return_result: '',
  remark: '',
})

const isEdit = computed(() => editingId.value !== null)

function resetForm() {
  editingId.value = null
  form.tool_code = ''
  form.borrower = ''
  form.borrower_employee_no = ''
  form.borrow_department = ''
  form.borrow_time = ''
  form.expected_return_time = ''
  form.record_status = '未归还'
  form.return_time = ''
  form.return_result = ''
  form.remark = ''
}

async function load() {
  loading.value = true
  try {
    const res = await borrowApi.listRecords({
      keyword: keyword.value,
      recordStatus: recordStatus.value,
      borrower: borrower.value,
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

function statusTagType(status: string) {
  if (status === '已超期') return 'danger'
  if (status === '未归还') return 'warning'
  return 'success'
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

async function openEdit(row: BorrowReturnRecord) {
  resetForm()
  editingId.value = row.id
  form.tool_code = row.tool_code
  form.borrower = row.borrower ?? ''
  form.borrower_employee_no = row.borrower_employee_no ?? ''
  form.borrow_department = row.borrow_department ?? ''
  form.borrow_time = row.borrow_time ?? ''
  form.expected_return_time = row.expected_return_time ?? ''
  form.record_status = row.record_status === '已归还' ? '已归还' : '未归还'
  form.return_time = row.return_time ?? ''
  form.return_result = row.return_result ?? ''
  form.remark = row.remark ?? ''
  dialogVisible.value = true
}

async function submitForm() {
  dialogLoading.value = true
  try {
    const payload = {
      tool_code: form.tool_code,
      borrower: form.borrower,
      borrower_employee_no: form.borrower_employee_no || null,
      borrow_department: form.borrow_department,
      borrow_time: form.borrow_time || undefined,
      expected_return_time: form.expected_return_time,
      record_status: form.record_status,
      return_time: form.record_status === '已归还' ? form.return_time || undefined : null,
      return_result: form.record_status === '已归还' ? form.return_result || undefined : null,
      remark: form.remark || null,
    }

    if (isEdit.value && editingId.value) {
      await borrowApi.adminUpdate(editingId.value, payload)
      ElMessage.success('更新成功')
    } else {
      await borrowApi.adminCreate(payload)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    dialogLoading.value = false
  }
}

async function removeRow(row: BorrowReturnRecord) {
  try {
    await ElMessageBox.confirm(`确定删除记录 ${row.record_no} 吗？`, '确认删除', { type: 'warning' })
    await borrowApi.adminDelete(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }
}

async function exportExcel() {
  try {
    const path = await importExportApi.exportRecords({
      keyword: keyword.value,
      recordStatus: recordStatus.value,
      borrower: borrower.value,
    })
    ElMessage.success(`导出成功：${path}`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导出失败')
  }
}

onMounted(load)

defineExpose({ load })
</script>

<template>
  <div>
    <div class="panel-toolbar">
      <el-button type="primary" size="large" @click="openCreate">新增</el-button>
      <el-button size="large" @click="exportExcel">导出 Excel</el-button>
    </div>

    <el-form inline>
      <el-form-item label="关键字">
        <el-input v-model="keyword" size="large" clearable />
      </el-form-item>
      <el-form-item label="借用人">
        <el-input v-model="borrower" size="large" clearable />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="recordStatus" size="large" clearable placeholder="全部" style="width: 140px">
          <el-option label="未归还" value="未归还" />
          <el-option label="已归还" value="已归还" />
          <el-option label="已超期" value="已超期" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" size="large" @click="() => { page = 1; load() }">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table class="table-fill admin-tool-table" v-loading="loading" :data="items" border>
      <el-table-column prop="record_no" label="记录号" min-width="108" />
      <el-table-column prop="tool_code" label="资产编号" min-width="72" />
      <el-table-column prop="tool_name" label="名称" min-width="96" />
      <el-table-column prop="borrower" label="借用人" min-width="76" />
      <el-table-column prop="borrower_employee_no" label="员工工号" min-width="88" />
      <el-table-column prop="borrow_department" label="借用工作中心" min-width="84" />
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

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑借还记录' : '新增借还记录'"
      width="640px"
      destroy-on-close
    >
      <el-form label-width="120px">
        <el-form-item label="资产编号" required>
          <CodeFieldInput v-model="form.tool_code" />
        </el-form-item>
        <el-form-item label="借用人" required>
          <el-input v-model="form.borrower" size="large" />
        </el-form-item>
        <el-form-item label="员工工号">
          <el-input v-model="form.borrower_employee_no" size="large" />
        </el-form-item>
        <el-form-item label="借用工作中心" required>
          <el-input v-model="form.borrow_department" size="large" />
        </el-form-item>
        <el-form-item label="借用时间">
          <el-date-picker
            v-model="form.borrow_time"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            format="YYYY-MM-DD HH:mm"
            placeholder="选择借用时间"
            size="large"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="预计归还" required>
          <el-date-picker
            v-model="form.expected_return_time"
            type="datetime"
            value-format="YYYY-MM-DDTHH:mm:ss"
            format="YYYY-MM-DD HH:mm"
            size="large"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="记录状态" required>
          <el-select v-model="form.record_status" size="large" style="width: 100%">
            <el-option label="未归还" value="未归还" />
            <el-option label="已归还" value="已归还" />
          </el-select>
        </el-form-item>
        <template v-if="form.record_status === '已归还'">
          <el-form-item label="归还时间">
            <el-date-picker
              v-model="form.return_time"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss"
              format="YYYY-MM-DD HH:mm"
              placeholder="选择归还时间"
              size="large"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="归还结果">
            <el-input v-model="form.return_result" size="large" />
          </el-form-item>
        </template>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button size="large" @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" size="large" :loading="dialogLoading" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>
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
