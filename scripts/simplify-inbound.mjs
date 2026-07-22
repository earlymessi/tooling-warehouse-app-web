import { writeFileSync } from 'fs'

writeFileSync(
  'D:/Desktop/tooling-warehouse-app/src/views/Inbound.vue',
  `<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { inboundApi } from '@/api/inboundApi'
import type { InboundToolItem, BatchInboundError } from '@/types/inbound'

const router = useRouter()
const submitting = ref(false)
const operatorName = ref('')
const items = ref<InboundToolItem[]>([emptyItem()])

function emptyItem(): InboundToolItem {
  return {
    tool_code: '',
    tool_name: '',
    specification: '',
    serial_no: '',
    work_center: 'LG-FT',
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
    .map((e) => \`第\${e.index + 1}行\${e.tool_code ? \`（\${e.tool_code}）\` : ''}：\${e.reason}\`)
    .join('\\n')
}

async function submit() {
  if (!operatorName.value.trim()) {
    ElMessage.warning('请填写入库人')
    return
  }
  submitting.value = true
  try {
    const result = await inboundApi.batch({
      operator_name: operatorName.value.trim(),
      items: items.value,
    })
    await ElMessageBox.alert(
      \`入库成功 \${result.count} 件。\\n入库单号：\${result.inbound_no}\\n标签CSV已保存到桌面：\\n\${result.csvPath}\`,
      '入库成功',
      { confirmButtonText: '知道了', type: 'success' },
    )
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
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">自助入库</h1>
      <el-button size="large" @click="router.push('/')">返回首页</el-button>
    </div>

    <el-form label-width="100px" style="margin-bottom: 16px">
      <el-form-item label="入库人" required>
        <el-input v-model="operatorName" size="large" placeholder="请输入入库人姓名" style="max-width: 360px" />
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
            <el-input v-model="row.work_center" size="large" placeholder="必填" />
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

    <div class="actions">
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
.actions {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}
</style>
`,
  'utf8',
)

console.log('Inbound.vue simplified')
