<script setup lang="ts">
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
    ElMessage.success(`导出成功：${path}`)
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
  <div class="page page-touch page-touch--wide">
    <div class="page-header">
      <el-button class="page-back" size="large" @click="router.push('/')">返回首页</el-button>
      <h1 class="page-title">借还记录</h1>
      <div class="page-header-right">
        <el-button size="large" @click="exportExcel">导出 Excel</el-button>
      </div>
    </div>

    <div class="page-body">
      <el-form inline class="touch-form">
        <el-form-item label="关键字">
          <el-input v-model="keyword" size="large" clearable style="width: 220px" />
        </el-form-item>
        <el-form-item label="借用人">
          <el-input v-model="borrower" size="large" clearable style="width: 180px" />
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

      <el-table class="table-fill" v-loading="loading" :data="items" border>
        <el-table-column prop="record_no" label="记录号" min-width="136" />
        <el-table-column prop="tool_code" label="资产编号" min-width="88" />
        <el-table-column prop="tool_name" label="名称" min-width="120" />
        <el-table-column prop="borrower" label="借用人" min-width="88" />
        <el-table-column prop="borrower_employee_no" label="员工工号" min-width="96" />
        <el-table-column prop="borrow_department" label="借用工作中心" min-width="100" />
        <el-table-column prop="borrow_time" label="借用时间" min-width="156" />
        <el-table-column prop="expected_return_time" label="预计归还" min-width="156" />
        <el-table-column prop="return_time" label="归还时间" min-width="156" />
        <el-table-column label="状态" min-width="88" align="center">
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
        @current-change="load"
        @size-change="load"
      />
    </div>
  </div>
</template>
