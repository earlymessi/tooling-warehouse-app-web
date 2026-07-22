<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { toolApi } from '@/api/toolApi'
import type { ToolStatus } from '@/types/tool'

const route = useRoute()
const router = useRouter()
const isEdit = computed(() => !!route.params.id)
const loading = ref(false)

const form = reactive({
  tool_code: '',
  tool_name: '',
  specification: '',
  serial_no: '',
  work_center: 'LG-FT',
  location_code: '',
  quantity: 1,
  unit: '件',
  status: '在库' as ToolStatus,
  qr_content: '',
  current_borrower: '',
  current_borrow_department: '',
  current_borrow_time: '',
  expected_return_time: '',
  remark: '',
})

const isBorrowed = computed(() => form.status === '借出')

watch(
  () => form.tool_code,
  (code) => {
    if (!isEdit.value && !form.qr_content) {
      form.qr_content = code
    }
  },
)

watch(isBorrowed, (borrowed) => {
  if (!borrowed) {
    form.current_borrower = ''
    form.current_borrow_department = ''
    form.current_borrow_time = ''
    form.expected_return_time = ''
    form.quantity = 1
  } else {
    form.quantity = 0
  }
})

async function load() {
  if (!isEdit.value) return
  loading.value = true
  try {
    const id = Number(route.params.id)
    const tool = await toolApi.getById(id)
    if (!tool) throw new Error('工装不存在')
    Object.assign(form, {
      tool_code: tool.tool_code,
      tool_name: tool.tool_name,
      specification: tool.specification ?? '',
      serial_no: tool.serial_no ?? '',
      work_center: tool.work_center ?? 'LG-FT',
      location_code: tool.location_code ?? '',
      quantity: tool.quantity,
      unit: tool.unit,
      status: tool.status,
      qr_content: tool.qr_content ?? tool.tool_code,
      current_borrower: tool.current_borrower ?? '',
      current_borrow_department: tool.current_borrow_department ?? '',
      current_borrow_time: tool.current_borrow_time ?? '',
      expected_return_time: tool.expected_return_time ?? '',
      remark: tool.remark ?? '',
    })
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败')
  } finally {
    loading.value = false
  }
}

function buildPayload() {
  return {
    tool_name: form.tool_name,
    specification: form.specification || undefined,
    serial_no: form.serial_no || undefined,
    work_center: form.work_center || undefined,
    location_code: form.location_code || undefined,
    quantity: form.quantity,
    unit: form.unit,
    status: form.status,
    qr_content: form.qr_content || form.tool_code,
    remark: form.remark || undefined,
    current_borrower: isBorrowed.value ? form.current_borrower || null : null,
    current_borrow_department: isBorrowed.value ? form.current_borrow_department || null : null,
    current_borrow_time: isBorrowed.value ? form.current_borrow_time || null : null,
    expected_return_time: isBorrowed.value ? form.expected_return_time || null : null,
  }
}

async function submit() {
  loading.value = true
  try {
    if (isEdit.value) {
      await toolApi.adminUpdate(Number(route.params.id), buildPayload())
      ElMessage.success('更新成功，借还记录已同步')
    } else {
      await toolApi.adminCreate({
        tool_code: form.tool_code,
        ...buildPayload(),
      })
      ElMessage.success('创建成功')
    }
    router.push('/admin/data?tab=tools')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="page page-touch">
    <div class="page-header">
      <el-button class="page-back" size="large" @click="router.push('/admin/data?tab=tools')">
        返回列表
      </el-button>
      <h1 class="page-title">{{ isEdit ? '编辑工装' : '新增工装' }}</h1>
      <div class="page-header-right"></div>
    </div>

    <div class="page-body">
      <el-form v-loading="loading" label-width="140px" class="tool-form">
        <el-divider content-position="left">基本信息</el-divider>
        <div class="form-grid">
          <el-form-item label="资产编号" required>
            <el-input v-model="form.tool_code" size="large" :disabled="isEdit" />
          </el-form-item>
          <el-form-item label="名称" required>
            <el-input v-model="form.tool_name" size="large" />
          </el-form-item>
          <el-form-item label="型号">
            <el-input v-model="form.specification" size="large" />
          </el-form-item>
          <el-form-item label="序列号">
            <el-input v-model="form.serial_no" size="large" />
          </el-form-item>
          <el-form-item label="工作中心" required>
            <el-input v-model="form.work_center" size="large" placeholder="归属工作中心" />
          </el-form-item>
          <el-form-item label="库位">
            <el-input v-model="form.location_code" size="large" />
          </el-form-item>
          <el-form-item label="二维码内容">
            <el-input v-model="form.qr_content" size="large" placeholder="默认同资产编号" />
          </el-form-item>
          <el-form-item label="单位">
            <el-input v-model="form.unit" size="large" />
          </el-form-item>
          <el-form-item class="form-span-2" label="备注">
            <el-input v-model="form.remark" type="textarea" :rows="2" />
          </el-form-item>
        </div>

        <el-divider content-position="left">库存状态</el-divider>
        <div class="form-grid">
          <el-form-item label="库存状态" required>
            <el-select v-model="form.status" size="large" style="width: 100%">
              <el-option label="在库" value="在库" />
              <el-option label="借出" value="借出" />
            </el-select>
          </el-form-item>
          <el-form-item label="数量">
            <el-input-number v-model="form.quantity" size="large" :min="0" :max="1" style="width: 100%" />
          </el-form-item>
          <el-form-item class="form-span-2 form-hint-item">
            <div class="form-hint">改为「在库」将自动关闭未归还记录；改为「借出」将自动补建借出记录</div>
          </el-form-item>
        </div>

        <template v-if="isBorrowed">
          <el-divider content-position="left">借出信息</el-divider>
          <div class="form-grid">
            <el-form-item label="使用人">
              <el-input v-model="form.current_borrower" size="large" />
            </el-form-item>
            <el-form-item label="借用工作中心">
              <el-input v-model="form.current_borrow_department" size="large" />
            </el-form-item>
            <el-form-item label="借用时间">
              <el-date-picker
                v-model="form.current_borrow_time"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm:ss"
                format="YYYY-MM-DD HH:mm"
                placeholder="选择借用时间"
                size="large"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="预计归还时间">
              <el-date-picker
                v-model="form.expected_return_time"
                type="datetime"
                value-format="YYYY-MM-DDTHH:mm:ss"
                format="YYYY-MM-DD HH:mm"
                placeholder="选择预计归还时间"
                size="large"
                style="width: 100%"
              />
            </el-form-item>
          </div>
        </template>
      </el-form>
    </div>

    <div class="page-actions">
      <el-button type="primary" size="large" :loading="loading" @click="submit">保存</el-button>
    </div>
  </div>
</template>

<style scoped>
.tool-form {
  width: 100%;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 32px;
}

.form-span-2 {
  grid-column: 1 / -1;
}

.form-hint-item :deep(.el-form-item__content) {
  margin-left: 0 !important;
}

.form-hint {
  font-size: 14px;
  color: #909399;
  line-height: 1.4;
}
</style>
