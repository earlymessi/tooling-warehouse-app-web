<script setup lang="ts">
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
    ElMessage.success(`导出成功：${path}`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导出失败')
  }
}

async function removeRow(row: ToolAccount) {
  try {
    await ElMessageBox.confirm(`确定删除工装 ${row.tool_code}（${row.tool_name}）吗？`, '确认删除', {
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
  <div class="page page-touch page-touch--wide">
    <div class="page-header">
      <el-button class="page-back" size="large" @click="router.push(backTarget)">
        {{ adminMode ? '返回数据' : '返回首页' }}
      </el-button>
      <h1 class="page-title">{{ pageTitle }}</h1>
      <div class="page-header-right">
        <template v-if="adminMode">
          <el-button size="large" type="primary" @click="router.push('/admin/tools/new')">新增</el-button>
          <el-button size="large" @click="exportExcel">导出 Excel</el-button>
        </template>
      </div>
    </div>

    <div class="page-body">
      <el-form inline class="touch-form">
        <el-form-item label="关键字">
          <el-input
            v-model="keyword"
            size="large"
            placeholder="资产编号/名称/型号/序列号"
            clearable
            style="width: 320px"
          />
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

      <el-table class="table-fill" v-loading="loading" :data="items" border>
        <el-table-column prop="tool_code" label="资产编号" min-width="88" />
        <el-table-column prop="tool_name" label="名称" min-width="120" />
        <el-table-column prop="specification" label="型号" min-width="110" />
        <el-table-column prop="serial_no" label="序列号" min-width="100" />
        <el-table-column prop="location_code" label="库位" min-width="72" />
        <el-table-column prop="quantity" label="数量" min-width="64" align="center" />
        <el-table-column prop="status" label="状态" min-width="72" align="center" />
        <el-table-column v-if="adminMode" label="操作" min-width="132" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="router.push(`/admin/tools/${row.id}/edit`)">编辑</el-button>
            <el-button link type="danger" @click="removeRow(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="load"
        @size-change="load"
      />
    </div>
  </div>
</template>
