<script setup lang="ts">
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
  borrowerEmployeeNo: '',
  borrowDepartment: '',
  expectedReturnTime: '',
  remark: '',
})

const departmentOptions = computed(() => {
  const set = new Set(employees.value.map((e) => e.department))
  return [...set].sort()
})

const selectedEmployee = computed(() =>
  employees.value.find((e) => e.employee_no === form.borrowerEmployeeNo) ?? null,
)

const departmentLocked = computed(() => selectedEmployee.value !== null)

function isInCart(code: string) {
  return cart.value.some((t) => t.tool_code === code)
}

function onBorrowerChange(employeeNo: string) {
  const emp = employees.value.find((e) => e.employee_no === employeeNo)
  if (emp) {
    form.borrower = emp.employee_name
    form.borrowDepartment = emp.department
  } else {
    form.borrower = ''
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
    scanError.value = `工装 ${code} 已在清单中`
    return
  }
  try {
    const result = await toolApi.getByCode(code)
    if (!result) {
      scanError.value = `工装 ${code} 不存在`
      return
    }
    if (result.status !== '在库' || result.quantity !== 1) {
      scanError.value = `工装 ${code} 不在库或数量不为1`
      return
    }
    cart.value.push(result)
    ElMessage.success(`已添加：${result.tool_name}`)
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
  if (
    !form.borrower.trim() ||
    !form.borrowerEmployeeNo.trim() ||
    !form.borrowDepartment.trim() ||
    !form.expectedReturnTime
  ) {
    ElMessage.warning('请选择借用人并填写部门和预计归还时间')
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
          borrowerEmployeeNo: form.borrowerEmployeeNo,
          borrowDepartment: form.borrowDepartment,
          expectedReturnTime: form.expectedReturnTime,
          remark: form.remark || undefined,
        })
        succeeded.push(item.tool_code)
      } catch (e) {
        failed.push(`${item.tool_code}：${e instanceof Error ? e.message : '借出失败'}`)
      }
    }

    if (succeeded.length > 0) {
      ElMessage.success(`成功借出 ${succeeded.length} 件`)
    }
    if (failed.length > 0) {
      ElMessage.error(`失败 ${failed.length} 件：${failed.join('；')}`)
    }

    cart.value = cart.value.filter((t) => !succeeded.includes(t.tool_code))

    if (failed.length === 0) {
      form.borrower = ''
      form.borrowerEmployeeNo = ''
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
  <div class="page page-touch">
    <div class="page-header">
      <el-button class="page-back" size="large" @click="router.push('/')">返回首页</el-button>
      <h1 class="page-title">工装借用</h1>
      <div class="page-header-right"></div>
    </div>

    <div class="page-body">
      <ScanInput placeholder="请扫描或输入资产编号，按回车加入清单" @scan="onScan" />
      <el-alert v-if="scanError" :title="scanError" type="error" show-icon />

      <el-card v-if="cart.length > 0">
        <template #header>
          <div class="cart-header">
            <span>借出清单（共 {{ cart.length }} 件）</span>
            <el-button link type="danger" @click="clearCart">清空清单</el-button>
          </div>
        </template>
        <el-table class="table-fill" :data="cart" border>
          <el-table-column prop="tool_code" label="资产编号" min-width="88" />
          <el-table-column prop="tool_name" label="名称" min-width="140" />
          <el-table-column prop="specification" label="型号" min-width="120" />
          <el-table-column prop="location_code" label="库位" min-width="80" />
          <el-table-column label="操作" min-width="88" align="center">
            <template #default="{ row }">
              <el-button link type="danger" @click="removeItem(row.tool_code)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-form label-width="180px" class="touch-form" label-position="right">
        <el-form-item label="借用人" required>
          <el-select
            v-model="form.borrowerEmployeeNo"
            size="large"
            filterable
            default-first-option
            clearable
            placeholder="请选择借用人"
            style="width: 100%"
            @change="onBorrowerChange"
          >
            <el-option
              v-for="emp in employees"
              :key="emp.id"
              :label="`${emp.employee_name}（${emp.employee_no}）`"
              :value="emp.employee_no"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="借用工作中心" required>
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
            placeholder="选择或输入借用工作中心"
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
      </el-form>
    </div>

    <div class="page-actions">
      <el-button
        type="primary"
        size="large"
        :loading="submitting"
        :disabled="cart.length === 0"
        @click="submit"
      >
        确认借出（{{ cart.length }} 件）
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.cart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
