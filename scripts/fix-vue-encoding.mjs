import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const views = join(root, 'src', 'views')

const files = {
  'StockQuery.vue': `<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
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

onMounted(load)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <h1 class="page-title">库存查询</h1>
      <el-button size="large" @click="router.push('/')">返回首页</el-button>
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
      <el-table-column prop="current_borrower" label="使用人" width="96" />
      <el-table-column prop="current_borrow_department" label="使用部门" width="100" />
      <el-table-column prop="expected_return_time" label="预计归还" width="156" />
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
}

for (const [name, content] of Object.entries(files)) {
  const path = name.includes('/') ? join(views, name) : join(views, name)
  writeFileSync(path, content, 'utf8')
  console.log('fixed:', path)
}
