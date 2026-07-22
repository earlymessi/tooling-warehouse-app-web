<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { employeeApi } from '@/api/employeeApi'
import { importExportApi } from '@/api/systemApi'
import { runImport } from '@/composables/useExcelImport'
import type { Employee } from '@/types/employee'

const loading = ref(false)
const importing = ref(false)
const items = ref<Employee[]>([])
const total = ref(0)
const keyword = ref('')
const page = ref(1)
const pageSize = ref(20)

const dialogVisible = ref(false)
const dialogLoading = ref(false)
const editingId = ref<number | null>(null)

const form = reactive({
  employee_no: '',
  employee_name: '',
  department: '',
})

const isEdit = computed(() => editingId.value !== null)

function resetForm() {
  editingId.value = null
  form.employee_no = ''
  form.employee_name = ''
  form.department = ''
}

async function load() {
  loading.value = true
  try {
    const res = await employeeApi.list({
      keyword: keyword.value,
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

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: Employee) {
  editingId.value = row.id
  form.employee_no = row.employee_no
  form.employee_name = row.employee_name
  form.department = row.department
  dialogVisible.value = true
}

async function submitForm() {
  dialogLoading.value = true
  try {
    const payload = {
      employee_no: form.employee_no,
      employee_name: form.employee_name,
      department: form.department,
    }
    if (isEdit.value && editingId.value) {
      await employeeApi.update(editingId.value, payload)
      ElMessage.success('更新成功')
    } else {
      await employeeApi.create(payload)
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

async function removeRow(row: Employee) {
  try {
    await ElMessageBox.confirm(
      `确定删除员工 ${row.employee_name}（${row.employee_no}）吗？`,
      '确认删除',
      { type: 'warning' },
    )
    await employeeApi.delete(row.id)
    ElMessage.success('删除成功')
    load()
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : '删除失败')
    }
  }
}

async function downloadTemplate() {
  try {
    const path = await importExportApi.downloadEmployeeTemplate()
    ElMessage.success(`模板已保存：${path}`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '下载失败')
  }
}

async function importExcel() {
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
      <el-button size="large" @click="downloadTemplate">下载导入模板</el-button>
      <el-button size="large" :loading="importing" @click="importExcel">导入 Excel 数据</el-button>
      <el-button size="large" @click="exportExcel">导出 Excel</el-button>
    </div>

    <el-form inline>
      <el-form-item label="关键字">
        <el-input v-model="keyword" size="large" placeholder="工号/姓名/部门" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" size="large" @click="() => { page = 1; load() }">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table class="table-fill" v-loading="loading" :data="items" border>
      <el-table-column prop="employee_no" label="工号" min-width="108" />
      <el-table-column prop="employee_name" label="姓名" min-width="108" />
      <el-table-column prop="department" label="部门" min-width="120" />
      <el-table-column label="操作" min-width="132" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="removeRow(row)">删除</el-button>
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
      :title="isEdit ? '编辑员工' : '新增员工'"
      width="520px"
      destroy-on-close
    >
      <el-form label-width="100px">
        <el-form-item label="工号" required>
          <el-input v-model="form.employee_no" size="large" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="姓名" required>
          <el-input v-model="form.employee_name" size="large" />
        </el-form-item>
        <el-form-item label="部门" required>
          <el-input v-model="form.department" size="large" />
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
  gap: 12px;
  margin-bottom: 16px;
}
</style>
