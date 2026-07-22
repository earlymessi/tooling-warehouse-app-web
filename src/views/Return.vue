<script setup lang="ts">
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
    scanError.value = `工装 ${code} 已在清单中`
    return
  }
  try {
    const tool = await toolApi.getByCode(code)
    if (!tool) {
      scanError.value = `工装 ${code} 不存在`
      return
    }
    const open = await borrowApi.getOpenRecord(code)
    if (!open) {
      scanError.value = `工装 ${code} 没有未归还记录`
      return
    }
    cart.value.push({ tool, record: open })
    ElMessage.success(`已添加：${tool.tool_name}`)
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
          h('p', { class: 'return-tool-info' }, `${item.tool.tool_code} ${item.tool.tool_name}`),
          h('p', { class: 'return-location-line' }, [
            '请放回库位 ',
            h('span', { class: 'return-location-code' }, location),
            ' 处',
          ]),
        ])
      }),
    ),
    '',
    {
      confirmButtonText: '确认归还',
      cancelButtonText: '取消',
      customClass: 'return-confirm-dialog',
      distinguishCancelAndClose: true,
      showClose: false,
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
    ElMessage.success(`成功归还 ${cart.value.length} 件`)
    router.push('/')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '归还失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="page page-touch">
    <div class="page-header">
      <el-button class="page-back" size="large" @click="router.push('/')">返回首页</el-button>
      <h1 class="page-title">工装归还</h1>
      <div class="page-header-right"></div>
    </div>

    <div class="page-body">
      <ScanInput placeholder="请扫描或输入资产编号，按回车加入清单" @scan="onScan" />
      <el-alert v-if="scanError" :title="scanError" type="error" show-icon />

      <el-card v-if="cart.length > 0">
        <template #header>
          <div class="cart-header">
            <span>归还清单（共 {{ cart.length }} 件）</span>
            <el-button link type="danger" @click="clearCart">清空清单</el-button>
          </div>
        </template>
        <el-table class="table-fill" :data="cart" border>
          <el-table-column label="资产编号" min-width="88">
            <template #default="{ row }">{{ row.tool.tool_code }}</template>
          </el-table-column>
          <el-table-column label="名称" min-width="140">
            <template #default="{ row }">{{ row.tool.tool_name }}</template>
          </el-table-column>
          <el-table-column label="借用人" min-width="96">
            <template #default="{ row }">{{ row.record.borrower }}</template>
          </el-table-column>
          <el-table-column label="库位" min-width="88">
            <template #default="{ row }">
              <span class="location-highlight">{{ row.tool.location_code || '未设置' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" min-width="88" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.record.is_overdue" type="danger">已超期</el-tag>
              <el-tag v-else type="warning">未超期</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" min-width="88" align="center">
            <template #default="{ row }">
              <el-button link type="danger" @click="removeItem(row.tool.tool_code)">移除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <el-form label-width="80px" class="touch-form">
        <el-form-item label="备注">
          <el-input v-model="remark" type="textarea" :rows="2" />
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
        确认归还（{{ cart.length }} 件）
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

.location-highlight {
  color: #f56c6c;
  font-weight: 700;
  font-size: 16px;
}
</style>

<style>
.return-confirm-dialog {
  width: min(92vw, 920px) !important;
  max-width: 920px !important;
  padding: 36px 40px 28px !important;
}

.return-confirm-dialog .el-message-box__header {
  display: none;
}

.return-confirm-dialog .el-message-box__content {
  text-align: center;
  padding: 12px 8px 0;
}

.return-confirm-dialog .el-message-box__container {
  justify-content: center;
}

.return-confirm-dialog .el-message-box__message {
  width: 100%;
}

.return-confirm-dialog .return-confirm-body {
  padding: 12px 0 8px;
  max-height: 520px;
  overflow-y: auto;
  text-align: center;
}

.return-confirm-dialog .return-confirm-item {
  padding: 22px 0;
  border-bottom: 1px dashed #ebeef5;
  text-align: center;
}

.return-confirm-dialog .return-confirm-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.return-confirm-dialog .return-tool-info {
  margin: 0 0 14px;
  font-size: 24px;
  font-weight: 700;
  color: #303133;
  line-height: 1.5;
  text-align: center;
}

.return-confirm-dialog .return-location-line {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: #f56c6c;
  line-height: 1.5;
  text-align: center;
}

.return-confirm-dialog .return-location-code {
  display: inline-block;
  margin: 0 8px;
  padding: 10px 28px;
  font-size: clamp(40px, 7vmin, 64px);
  font-weight: 800;
  color: #f56c6c;
  letter-spacing: 2px;
  background: #fef0f0;
  border: 3px solid #f56c6c;
  border-radius: 12px;
  vertical-align: middle;
}

.return-confirm-dialog .el-message-box__btns {
  padding-top: 28px;
  display: flex;
  justify-content: center;
  gap: 24px;
}

.return-confirm-dialog .el-message-box__btns .el-button {
  min-height: 88px;
  min-width: 220px;
  font-size: 26px;
  font-weight: 700;
}

.return-confirm-dialog .el-message-box__btns .el-button--primary {
  min-width: 280px;
}
</style>
