<script setup lang="ts">
import { h, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { inboundApi } from '@/api/inboundApi'
import { employeeApi } from '@/api/employeeApi'
import { importExportApi, systemApi } from '@/api/systemApi'
import type { InboundToolItem, BatchInboundError } from '@/types/inbound'
import type { Employee } from '@/types/employee'

const router = useRouter()
const submitting = ref(false)
const importing = ref(false)
const downloadingTemplate = ref(false)
const operatorName = ref('')
const employees = ref<Employee[]>([])
const items = ref<InboundToolItem[]>([emptyItem()])

function emptyItem(): InboundToolItem {
  return {
    tool_code: '',
    tool_name: '',
    specification: '',
    serial_no: '',
    work_center: '',
    location_code: '',
  }
}

function addRow() {
  items.value.push(emptyItem())
}

function removeRow(index: number) {
  if (items.value.length <= 1) {
    items.value[0] = emptyItem()
    return
  }
  items.value.splice(index, 1)
}

function formatErrors(errors: BatchInboundError[]) {
  return errors
    .map((e) => `第${e.index + 1}行${e.tool_code ? `（${e.tool_code}）` : ''}：${e.reason}`)
    .join('\n')
}

async function loadEmployees() {
  try {
    const res = await employeeApi.list()
    employees.value = res.items
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载员工列表失败')
  }
}

async function downloadTemplate() {
  downloadingTemplate.value = true
  try {
    const templatePath = await importExportApi.downloadInboundTemplate()
    ElMessage.success(`模板已保存：${templatePath}`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '下载模板失败')
  } finally {
    downloadingTemplate.value = false
  }
}

async function importSpreadsheet() {
  importing.value = true
  try {
    const importedItems = await importExportApi.parseInboundSpreadsheet()
    try {
      await ElMessageBox.confirm(
        `检测到 ${importedItems.length} 条工装，将覆盖当前清单，是否继续？`,
        '确认导入',
        {
          confirmButtonText: '覆盖并导入',
          cancelButtonText: '取消',
          type: 'warning',
        },
      )
    } catch {
      return
    }

    items.value = importedItems.map((item) => ({ ...item }))
    ElMessage.success(`已导入 ${importedItems.length} 条，请核对后确认入库`)
  } catch (e) {
    if (!(e instanceof Error) || e.message !== '已取消') {
      ElMessage.error(e instanceof Error ? e.message : '导入表格失败')
    }
  } finally {
    importing.value = false
  }
}

async function openCsv(csvPath: string) {
  try {
    await systemApi.openPath(csvPath)
  } catch (e) {
    try {
      await systemApi.showItemInFolder(csvPath)
    } catch {
      ElMessage.error(e instanceof Error ? e.message : '无法打开文件')
    }
  }
}

async function showSuccessDialog(result: {
  count: number
  inbound_no: string
  csvPath: string
}) {
  await ElMessageBox.alert(
    h('div', { class: 'inbound-success-body' }, [
      h('p', { class: 'inbound-success-title' }, `入库成功 ${result.count} 件`),
      h('p', { class: 'inbound-success-line' }, `入库单号：${result.inbound_no}`),
      h('p', { class: 'inbound-success-line' }, '标签 CSV 已保存到桌面：'),
      h(
        'a',
        {
          class: 'inbound-success-link',
          href: '#',
          onClick: (e: MouseEvent) => {
            e.preventDefault()
            void openCsv(result.csvPath)
          },
        },
        result.csvPath,
      ),
      h('p', { class: 'inbound-success-hint' }, '点击上方路径可打开文件'),
    ]),
    '',
    {
      confirmButtonText: '知道了',
      customClass: 'inbound-success-dialog',
      showClose: false,
      dangerouslyUseHTMLString: false,
    },
  )
}

async function submit() {
  if (!operatorName.value.trim()) {
    ElMessage.warning('请选择入库人')
    return
  }
  submitting.value = true
  try {
    // Electron IPC 只能传可结构化克隆的纯数据，不能直接传 Vue 响应式 Proxy
    const result = await inboundApi.batch({
      operator_name: operatorName.value.trim(),
      items: items.value.map((item) => ({
        tool_code: item.tool_code,
        tool_name: item.tool_name,
        specification: item.specification,
        serial_no: item.serial_no,
        work_center: item.work_center,
        location_code: item.location_code,
      })),
    })
    await showSuccessDialog(result)
    items.value = [emptyItem()]
    operatorName.value = ''
  } catch (e) {
    const err = e as Error & { code?: string; inboundErrors?: BatchInboundError[] }
    if (err.inboundErrors?.length) {
      await ElMessageBox.alert(formatErrors(err.inboundErrors), '入库失败（已全部回滚）', {
        confirmButtonText: '返回修改',
        type: 'error',
      })
    } else {
      ElMessage.error(err.message || '入库失败')
    }
  } finally {
    submitting.value = false
  }
}

onMounted(loadEmployees)
</script>

<template>
  <div class="page page-touch">
    <div class="page-header">
      <el-button class="page-back" size="large" @click="router.push('/')">返回首页</el-button>
      <h1 class="page-title">自助入库</h1>
      <div class="page-header-right">
        <el-button size="large" :loading="downloadingTemplate" @click="downloadTemplate">
          下载模板
        </el-button>
        <el-button type="primary" size="large" :loading="importing" @click="importSpreadsheet">
          导入表格
        </el-button>
      </div>
    </div>

    <div class="page-body">
      <el-form label-width="120px" class="touch-form">
        <el-form-item label="入库人" required>
          <el-select
            v-model="operatorName"
            size="large"
            filterable
            clearable
            placeholder="请选择入库人"
            style="width: 100%"
          >
            <el-option
              v-for="emp in employees"
              :key="emp.id"
              :label="`${emp.employee_name}（${emp.employee_no}）`"
              :value="emp.employee_name"
            />
          </el-select>
        </el-form-item>
      </el-form>

      <el-card>
        <template #header>
          <div class="card-header">
            <span>工装清单（可批量）</span>
            <el-button type="primary" @click="addRow">新增一行</el-button>
          </div>
        </template>

        <el-table :data="items" border class="table-fill">
          <el-table-column label="#" width="56" align="center">
            <template #default="{ $index }">{{ $index + 1 }}</template>
          </el-table-column>
          <el-table-column label="资产编号" min-width="120">
            <template #default="{ row }">
              <el-input v-model="row.tool_code" size="large" placeholder="必填" />
            </template>
          </el-table-column>
          <el-table-column label="名称" min-width="120">
            <template #default="{ row }">
              <el-input v-model="row.tool_name" size="large" placeholder="必填" />
            </template>
          </el-table-column>
          <el-table-column label="型号" min-width="100">
            <template #default="{ row }">
              <el-input v-model="row.specification" size="large" />
            </template>
          </el-table-column>
          <el-table-column label="序列号" min-width="110">
            <template #default="{ row }">
              <el-input v-model="row.serial_no" size="large" placeholder="必填" />
            </template>
          </el-table-column>
          <el-table-column label="工作中心" min-width="100">
            <template #default="{ row }">
              <el-input v-model="row.work_center" size="large" placeholder="例如 LG-FT" />
            </template>
          </el-table-column>
          <el-table-column label="库位" min-width="110">
            <template #default="{ row }">
              <el-input v-model="row.location_code" size="large" placeholder="手填或扫码" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" align="center">
            <template #default="{ $index }">
              <el-button link type="danger" @click="removeRow($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <div class="page-actions">
      <el-button type="primary" size="large" :loading="submitting" @click="submit">
        确认入库
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>

<style>
.inbound-success-dialog {
  width: min(92vw, 920px) !important;
  max-width: 920px !important;
  padding: 36px 40px 28px !important;
}

.inbound-success-dialog .el-message-box__header {
  display: none;
}

.inbound-success-dialog .el-message-box__content {
  text-align: center;
  padding: 12px 8px 0;
}

.inbound-success-dialog .el-message-box__container {
  justify-content: center;
}

.inbound-success-dialog .el-message-box__message {
  width: 100%;
}

.inbound-success-dialog .inbound-success-body {
  text-align: center;
  padding: 8px 0;
}

.inbound-success-dialog .inbound-success-title {
  margin: 0 0 20px;
  font-size: 30px;
  font-weight: 800;
  color: #67c23a;
  line-height: 1.4;
}

.inbound-success-dialog .inbound-success-line {
  margin: 0 0 14px;
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  line-height: 1.5;
}

.inbound-success-dialog .inbound-success-link {
  display: inline-block;
  margin: 8px 0 12px;
  max-width: 100%;
  font-size: 20px;
  font-weight: 700;
  color: #409eff;
  line-height: 1.5;
  word-break: break-all;
  text-decoration: underline;
  cursor: pointer;
}

.inbound-success-dialog .inbound-success-link:hover {
  color: #337ecc;
}

.inbound-success-dialog .inbound-success-hint {
  margin: 0;
  font-size: 18px;
  color: #909399;
}

.inbound-success-dialog .el-message-box__btns {
  padding-top: 28px;
  display: flex;
  justify-content: center;
  gap: 24px;
}

.inbound-success-dialog .el-message-box__btns .el-button {
  min-height: 88px;
  min-width: 280px;
  font-size: 26px;
  font-weight: 700;
}
</style>
