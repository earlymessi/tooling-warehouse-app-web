import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const viewsDir = join(root, 'src', 'views')

const files = {
  'RecordList.vue': `<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { borrowApi } from '@/api/borrowApi'
import { importExportApi } from '@/api/systemApi'
import type { BorrowReturnRecord, RecordStatus } from '@/types/borrow'

const router = useRouter()
const loading = ref(false)
const items = ref<BorrowReturnRecord[]>([])
const total = ref(0)
const keyword = ref('')
const recordStatus = ref<RecordStatus | ''>('')
const borrower = ref('')
const page = ref(1)
const pageSize = ref(20)

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

async function exportExcel() {
  try {
    const path = await importExportApi.exportRecords({
      keyword: keyword.value,
      recordStatus: recordStatus.value,
      borrower: borrower.value,
    })
    ElMessage.success(\`导出成功：\${path}\`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导出失败')
  }
}

function statusTagType(status: string) {
  if (status === '已超期') return 'danger'
  if (status === '未归还') return 'warning'
  return 'success'
}

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">借还记录</h1>
      <div>
        <el-button size="large" @click="router.push('/')">返回首页</el-button>
        <el-button size="large" @click="exportExcel">导出 Excel</el-button>
      </div>
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

    <el-table v-loading="loading" :data="items" border>
      <el-table-column prop="record_no" label="记录号" width="136" />
      <el-table-column prop="tool_code" label="工装ID" width="88" />
      <el-table-column prop="tool_name" label="名称" width="120" />
      <el-table-column prop="borrower" label="借用人" width="88" />
      <el-table-column prop="borrow_department" label="借用部门" width="100" />
      <el-table-column prop="borrow_time" label="借用时间" width="156" />
      <el-table-column prop="expected_return_time" label="预计归还" width="156" />
      <el-table-column prop="return_time" label="归还时间" width="156" />
      <el-table-column label="状态" width="88" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.record_status)">{{ row.record_status }}</el-tag>
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
`,

  'ToolList.vue': `<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { toolApi } from '@/api/toolApi'
import { importExportApi } from '@/api/systemApi'
import type { ToolAccount, ToolStatus } from '@/types/tool'

const route = useRoute()
const router = useRouter()
const adminMode = computed(() => route.meta.adminMode === true)

const pageTitle = computed(() => {
  if (adminMode.value) return '工装管理'
  return '工装台账'
})

const backTarget = computed(() => (adminMode.value ? '/admin/data' : '/'))

const loading = ref(false)
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
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">{{ pageTitle }}</h1>
      <div>
        <el-button size="large" @click="router.push(backTarget)">
          {{ adminMode ? '返回数据' : '返回首页' }}
        </el-button>
        <template v-if="adminMode">
          <el-button size="large" type="primary" @click="router.push('/admin/tools/new')">新增</el-button>
          <el-button size="large" @click="exportExcel">导出 Excel</el-button>
        </template>
      </div>
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

    <el-table v-loading="loading" :data="items" border>
      <el-table-column prop="tool_code" label="工装ID" width="88" />
      <el-table-column prop="tool_name" label="名称" width="120" />
      <el-table-column prop="tool_category" label="种类" width="96" />
      <el-table-column prop="specification" label="规格型号" width="110" />
      <el-table-column prop="location_code" label="库位" width="72" />
      <el-table-column prop="quantity" label="数量" width="64" align="center" />
      <el-table-column prop="status" label="状态" width="72" align="center" />
      <el-table-column v-if="adminMode" label="操作" width="132" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="router.push(\`/admin/tools/\${row.id}/edit\`)">编辑</el-button>
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
  </div>
</template>
`,

  'Borrow.vue': `<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import ScanInput from '@/components/ScanInput.vue'
import { toolApi } from '@/api/toolApi'
import { borrowApi } from '@/api/borrowApi'
import { employeeApi } from '@/api/employeeApi'
import type { ToolAccount } from '@/types/tool'
import type { Employee } from '@/types/employee'

const router = useRouter()
const cart = ref<ToolAccount[]>([])
const scanError = ref('')
const submitting = ref(false)
const employees = ref<Employee[]>([])

const form = reactive({
  borrower: '',
  borrowDepartment: '',
  expectedReturnTime: '',
  remark: '',
})

const departmentOptions = computed(() => {
  const set = new Set(employees.value.map((e) => e.department))
  return [...set].sort()
})

const selectedEmployee = computed(() =>
  employees.value.find((e) => e.employee_name === form.borrower) ?? null,
)

const departmentLocked = computed(() => selectedEmployee.value !== null)

function isInCart(code: string) {
  return cart.value.some((t) => t.tool_code === code)
}

function onBorrowerChange(name: string) {
  const emp = employees.value.find((e) => e.employee_name === name)
  if (emp) {
    form.borrowDepartment = emp.department
  } else {
    form.borrowDepartment = ''
  }
}

async function loadEmployees() {
  try {
    const res = await employeeApi.list()
    employees.value = res.items
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载员工列表失败')
  }
}

async function onScan(code: string) {
  scanError.value = ''
  if (isInCart(code)) {
    scanError.value = \`工装 \${code} 已在清单中\`
    return
  }
  try {
    const result = await toolApi.getByCode(code)
    if (!result) {
      scanError.value = \`工装 \${code} 不存在\`
      return
    }
    if (result.status !== '在库' || result.quantity !== 1) {
      scanError.value = \`工装 \${code} 不在库或数量不为1\`
      return
    }
    cart.value.push(result)
    ElMessage.success(\`已添加：\${result.tool_name}\`)
  } catch (e) {
    scanError.value = e instanceof Error ? e.message : '扫码失败'
  }
}

function removeItem(code: string) {
  cart.value = cart.value.filter((t) => t.tool_code !== code)
}

function clearCart() {
  cart.value = []
  scanError.value = ''
}

async function submit() {
  if (cart.value.length === 0) {
    ElMessage.warning('请先扫描工装')
    return
  }
  if (!form.borrower.trim() || !form.borrowDepartment.trim() || !form.expectedReturnTime) {
    ElMessage.warning('请填写借用人、部门和预计归还时间')
    return
  }

  submitting.value = true
  const succeeded: string[] = []
  const failed: string[] = []

  try {
    for (const item of cart.value) {
      try {
        await borrowApi.borrow({
          toolCode: item.tool_code,
          borrower: form.borrower,
          borrowDepartment: form.borrowDepartment,
          expectedReturnTime: form.expectedReturnTime,
          remark: form.remark || undefined,
        })
        succeeded.push(item.tool_code)
      } catch (e) {
        failed.push(\`\${item.tool_code}：\${e instanceof Error ? e.message : '借出失败'}\`)
      }
    }

    if (succeeded.length > 0) {
      ElMessage.success(\`成功借出 \${succeeded.length} 件\`)
    }
    if (failed.length > 0) {
      ElMessage.error(\`失败 \${failed.length} 件：\${failed.join('；')}\`)
    }

    cart.value = cart.value.filter((t) => !succeeded.includes(t.tool_code))

    if (failed.length === 0) {
      form.borrower = ''
      form.borrowDepartment = ''
      form.expectedReturnTime = ''
      form.remark = ''
    }
  } finally {
    submitting.value = false
  }
}

onMounted(loadEmployees)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">工装借用</h1>
      <el-button size="large" @click="router.push('/')">返回首页</el-button>
    </div>

    <ScanInput placeholder="请扫描或输入工装ID，按回车加入清单" @scan="onScan" />
    <el-alert v-if="scanError" :title="scanError" type="error" show-icon style="margin-top: 12px" />

    <el-card v-if="cart.length > 0" style="margin-top: 16px">
      <template #header>
        <div class="cart-header">
          <span>借出清单（共 {{ cart.length }} 件）</span>
          <el-button link type="danger" @click="clearCart">清空清单</el-button>
        </div>
      </template>
      <el-table :data="cart" border>
        <el-table-column prop="tool_code" label="工装ID" width="88" />
        <el-table-column prop="tool_name" label="名称" width="140" />
        <el-table-column prop="specification" label="规格型号" width="120" />
        <el-table-column prop="location_code" label="库位" width="80" />
        <el-table-column label="操作" width="88" align="center">
          <template #default="{ row }">
            <el-button link type="danger" @click="removeItem(row.tool_code)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-form label-width="120px" style="margin-top: 16px">
      <el-form-item label="借用人" required>
        <el-select
          v-model="form.borrower"
          size="large"
          filterable
          allow-create
          default-first-option
          clearable
          placeholder="选择或输入借用人"
          style="width: 100%"
          @change="onBorrowerChange"
        >
          <el-option
            v-for="emp in employees"
            :key="emp.id"
            :label="\`\${emp.employee_name}（\${emp.employee_no}）\`"
            :value="emp.employee_name"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="使用部门" required>
        <el-input
          v-if="departmentLocked"
          :model-value="form.borrowDepartment"
          size="large"
          disabled
          placeholder="根据所选员工自动填充"
        />
        <el-select
          v-else
          v-model="form.borrowDepartment"
          size="large"
          filterable
          allow-create
          default-first-option
          clearable
          placeholder="选择或输入部门"
          style="width: 100%"
        >
          <el-option v-for="dept in departmentOptions" :key="dept" :label="dept" :value="dept" />
        </el-select>
      </el-form-item>
      <el-form-item label="预计归还时间" required>
        <el-date-picker
          v-model="form.expectedReturnTime"
          type="datetime"
          value-format="YYYY-MM-DDTHH:mm:ss"
          format="YYYY-MM-DD HH:mm"
          placeholder="选择预计归还时间"
          size="large"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="备注">
        <el-input v-model="form.remark" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          size="large"
          :loading="submitting"
          :disabled="cart.length === 0"
          @click="submit"
        >
          确认借出（{{ cart.length }} 件）
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
`,

  'Return.vue': `<script setup lang="ts">
import { h, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import ScanInput from '@/components/ScanInput.vue'
import { toolApi } from '@/api/toolApi'
import { borrowApi } from '@/api/borrowApi'
import type { ToolAccount } from '@/types/tool'
import type { BorrowReturnRecord } from '@/types/borrow'

interface ReturnCartItem {
  tool: ToolAccount
  record: BorrowReturnRecord
}

const router = useRouter()
const cart = ref<ReturnCartItem[]>([])
const scanError = ref('')
const remark = ref('')
const submitting = ref(false)

function isInCart(code: string) {
  return cart.value.some((item) => item.tool.tool_code === code)
}

async function onScan(code: string) {
  scanError.value = ''
  if (isInCart(code)) {
    scanError.value = \`工装 \${code} 已在清单中\`
    return
  }
  try {
    const tool = await toolApi.getByCode(code)
    if (!tool) {
      scanError.value = \`工装 \${code} 不存在\`
      return
    }
    const open = await borrowApi.getOpenRecord(code)
    if (!open) {
      scanError.value = \`工装 \${code} 没有未归还记录\`
      return
    }
    cart.value.push({ tool, record: open })
    ElMessage.success(\`已添加：\${tool.tool_name}\`)
  } catch (e) {
    scanError.value = e instanceof Error ? e.message : '扫码失败'
  }
}

function removeItem(code: string) {
  cart.value = cart.value.filter((item) => item.tool.tool_code !== code)
}

function clearCart() {
  cart.value = []
  scanError.value = ''
}

async function confirmReturnDialog() {
  await ElMessageBox.confirm(
    h(
      'div',
      { class: 'return-confirm-body' },
      cart.value.map((item) => {
        const location = item.tool.location_code?.trim() || '未设置'
        return h('div', { class: 'return-confirm-item', key: item.tool.tool_code }, [
          h('p', { class: 'return-tool-info' }, \`\${item.tool.tool_code} \${item.tool.tool_name}\`),
          h('p', { class: 'return-location-line' }, [
            '请放回库位 ',
            h('span', { class: 'return-location-code' }, location),
            ' 处',
          ]),
        ])
      }),
    ),
    '确认归还',
    {
      confirmButtonText: '确认归还',
      cancelButtonText: '取消',
      customClass: 'return-confirm-dialog',
      distinguishCancelAndClose: true,
    },
  )
}

async function submit() {
  if (cart.value.length === 0) {
    ElMessage.warning('请先扫描工装')
    return
  }

  try {
    await confirmReturnDialog()
  } catch {
    return
  }

  submitting.value = true
  try {
    for (const item of cart.value) {
      await borrowApi.return({
        toolCode: item.tool.tool_code,
        remark: remark.value || undefined,
      })
    }
    ElMessage.success(\`成功归还 \${cart.value.length} 件\`)
    router.push('/')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '归还失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">工装归还</h1>
      <el-button size="large" @click="router.push('/')">返回首页</el-button>
    </div>

    <ScanInput placeholder="请扫描或输入工装ID，按回车加入清单" @scan="onScan" />
    <el-alert v-if="scanError" :title="scanError" type="error" show-icon style="margin-top: 12px" />

    <el-card v-if="cart.length > 0" style="margin-top: 16px">
      <template #header>
        <div class="cart-header">
          <span>归还清单（共 {{ cart.length }} 件）</span>
          <el-button link type="danger" @click="clearCart">清空清单</el-button>
        </div>
      </template>
      <el-table :data="cart" border>
        <el-table-column label="工装ID" width="88">
          <template #default="{ row }">{{ row.tool.tool_code }}</template>
        </el-table-column>
        <el-table-column label="名称" width="140">
          <template #default="{ row }">{{ row.tool.tool_name }}</template>
        </el-table-column>
        <el-table-column label="借用人" width="96">
          <template #default="{ row }">{{ row.record.borrower }}</template>
        </el-table-column>
        <el-table-column label="库位" width="88">
          <template #default="{ row }">
            <span class="location-highlight">{{ row.tool.location_code || '未设置' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="88" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.record.is_overdue" type="danger">已超期</el-tag>
            <el-tag v-else type="warning">未超期</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="88" align="center">
          <template #default="{ row }">
            <el-button link type="danger" @click="removeItem(row.tool.tool_code)">移除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-form style="margin-top: 16px">
      <el-form-item label="备注">
        <el-input v-model="remark" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item>
        <el-button
          type="primary"
          size="large"
          :loading="submitting"
          :disabled="cart.length === 0"
          @click="submit"
        >
          确认归还（{{ cart.length }} 件）
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.location-highlight {
  color: #f56c6c;
  font-weight: 700;
  font-size: 16px;
}
</style>

<style>
.return-confirm-dialog .return-confirm-body {
  padding: 8px 0 4px;
  max-height: 420px;
  overflow-y: auto;
}

.return-confirm-dialog .return-confirm-item {
  padding: 16px 0;
  border-bottom: 1px dashed #ebeef5;
  text-align: center;
}

.return-confirm-dialog .return-confirm-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.return-confirm-dialog .return-tool-info {
  margin: 0 0 10px;
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  line-height: 1.5;
}

.return-confirm-dialog .return-location-line {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #f56c6c;
  line-height: 1.5;
}

.return-confirm-dialog .return-location-code {
  display: inline-block;
  margin: 0 6px;
  padding: 6px 20px;
  font-size: clamp(32px, 6vmin, 48px);
  font-weight: 800;
  color: #f56c6c;
  letter-spacing: 2px;
  background: #fef0f0;
  border: 3px solid #f56c6c;
  border-radius: 10px;
  vertical-align: middle;
}

.return-confirm-dialog .el-message-box__title {
  font-size: 18px;
  font-weight: 700;
}

.return-confirm-dialog .el-message-box__btns .el-button--primary {
  min-width: 240px;
}
</style>
`,

  'admin/AdminToolPanel.vue': `<script setup lang="ts">
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

    <el-table v-loading="loading" :data="items" border>
      <el-table-column prop="id" label="ID" width="64" align="center" />
      <el-table-column prop="tool_code" label="工装ID" width="88" />
      <el-table-column prop="tool_name" label="名称" width="120" />
      <el-table-column prop="tool_category" label="种类" width="96" />
      <el-table-column prop="specification" label="规格型号" width="110" />
      <el-table-column prop="location_code" label="库位" width="72" />
      <el-table-column prop="quantity" label="数量" width="64" align="center" />
      <el-table-column prop="unit" label="单位" width="64" align="center" />
      <el-table-column prop="status" label="状态" width="72" align="center" />
      <el-table-column prop="current_borrower" label="使用人" width="96" />
      <el-table-column prop="current_borrow_department" label="使用部门" width="100" />
      <el-table-column prop="current_borrow_time" label="借用时间" width="156" />
      <el-table-column prop="expected_return_time" label="预计归还" width="156" />
      <el-table-column prop="qr_content" label="二维码" width="88" />
      <el-table-column prop="remark" label="备注" width="100" />
      <el-table-column label="操作" width="132" align="center">
        <template #default="{ row }">
          <el-button link type="primary" @click="router.push(\`/admin/tools/\${row.id}/edit\`)">编辑</el-button>
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
  </div>
</template>

<style scoped>
.panel-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}
</style>
`,

  'admin/AdminRecordPanel.vue': `<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
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
    await ElMessageBox.confirm(\`确定删除记录 \${row.record_no} 吗？\`, '确认删除', { type: 'warning' })
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
    ElMessage.success(\`导出成功：\${path}\`)
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

    <el-table v-loading="loading" :data="items" border>
      <el-table-column prop="record_no" label="记录号" width="136" />
      <el-table-column prop="tool_code" label="工装ID" width="88" />
      <el-table-column prop="tool_name" label="名称" width="120" />
      <el-table-column prop="borrower" label="借用人" width="88" />
      <el-table-column prop="borrow_department" label="借用部门" width="100" />
      <el-table-column prop="borrow_time" label="借用时间" width="156" />
      <el-table-column prop="expected_return_time" label="预计归还" width="156" />
      <el-table-column prop="return_time" label="归还时间" width="156" />
      <el-table-column label="状态" width="88" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.record_status)">{{ row.record_status }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="132" align="center">
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
      :title="isEdit ? '编辑借还记录' : '新增借还记录'"
      width="640px"
      destroy-on-close
    >
      <el-form label-width="120px">
        <el-form-item label="工装ID" required>
          <el-input v-model="form.tool_code" size="large" />
        </el-form-item>
        <el-form-item label="借用人" required>
          <el-input v-model="form.borrower" size="large" />
        </el-form-item>
        <el-form-item label="借用部门" required>
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
  gap: 12px;
  margin-bottom: 16px;
}
</style>
`,

  'admin/AdminEmployeePanel.vue': `<script setup lang="ts">
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
      \`确定删除员工 \${row.employee_name}（\${row.employee_no}）吗？\`,
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
    ElMessage.success(\`模板已保存：\${path}\`)
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

onMounted(load)

defineExpose({ load })
</script>

<template>
  <div>
    <div class="panel-toolbar">
      <el-button type="primary" size="large" @click="openCreate">新增</el-button>
      <el-button size="large" @click="downloadTemplate">下载导入模板</el-button>
      <el-button size="large" :loading="importing" @click="importExcel">导入 Excel 数据</el-button>
    </div>

    <el-form inline>
      <el-form-item label="关键字">
        <el-input v-model="keyword" size="large" placeholder="工号/姓名/部门" clearable />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" size="large" @click="() => { page = 1; load() }">查询</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="items" border>
      <el-table-column prop="employee_no" label="工号" width="108" />
      <el-table-column prop="employee_name" label="姓名" width="108" />
      <el-table-column prop="department" label="部门" width="120" />
      <el-table-column label="操作" width="132" align="center">
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
`,
}

for (const [relativePath, content] of Object.entries(files)) {
  const path = join(viewsDir, relativePath)
  writeFileSync(path, content, 'utf8')
  console.log('fixed:', path)
}
