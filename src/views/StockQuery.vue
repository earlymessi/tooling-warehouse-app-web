<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import CodeFieldInput from '@/components/CodeFieldInput.vue'
import { toolApi } from '@/api/toolApi'
import type { ToolAccount, ToolStatus } from '@/types/tool'

const router = useRouter()
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

async function search() {
  page.value = 1
  await load()
}

onMounted(load)
</script>

<template>
  <div class="page page-touch page-touch--wide">
    <div class="page-header">
      <el-button class="page-back" size="large" @click="router.push('/')">返回首页</el-button>
      <h1 class="page-title">库存查询</h1>
      <div class="page-header-right"></div>
    </div>

    <div class="page-body">
      <el-form inline class="touch-form" @submit.prevent="search">
        <el-form-item label="关键字">
          <CodeFieldInput
            v-model="keyword"
            :strict="false"
            placeholder="资产编号/名称/型号/序列号"
            clearable
            style="width: 320px"
            @keydown.enter.prevent="search"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="status" size="large" clearable placeholder="全部" style="width: 140px">
            <el-option label="在库" value="在库" />
            <el-option label="借出" value="借出" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" size="large" @click="search">查询</el-button>
        </el-form-item>
      </el-form>

      <el-table v-loading="loading" :data="items" border class="table-fill">
        <el-table-column prop="tool_code" label="资产编号" min-width="88" />
        <el-table-column prop="tool_name" label="名称" min-width="120" />
        <el-table-column prop="specification" label="型号" min-width="110" />
        <el-table-column prop="serial_no" label="序列号" min-width="100" />
        <el-table-column prop="work_center" label="工作中心" min-width="100" />
        <el-table-column prop="location_code" label="库位" min-width="72" />
        <el-table-column prop="quantity" label="数量" min-width="64" align="center" />
        <el-table-column prop="status" label="状态" min-width="72" align="center" />
        <el-table-column prop="current_borrower" label="使用人" min-width="96" />
        <el-table-column prop="current_borrow_department" label="借用工作中心" min-width="100" />
        <el-table-column prop="expected_return_time" label="预计归还" min-width="156" />
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
