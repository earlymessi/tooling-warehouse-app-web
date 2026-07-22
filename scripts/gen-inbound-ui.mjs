/**
 * 生成自助入库页 + 更新首页/路由/文案
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const w = (rel, content) => {
  writeFileSync(join(root, rel), content, 'utf8')
  console.log('wrote', rel)
}
const patch = (rel, fn) => {
  const p = join(root, rel)
  const before = readFileSync(p, 'utf8')
  const after = fn(before)
  writeFileSync(p, after, 'utf8')
  console.log('patched', rel)
}

w(
  'src/views/Inbound.vue',
  `<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import ScanInput from '@/components/ScanInput.vue'
import { inboundApi } from '@/api/inboundApi'
import type { InboundToolItem, BatchInboundError } from '@/types/inbound'

const router = useRouter()
const submitting = ref(false)
const locationScanTarget = ref<number | null>(null)

const operatorName = ref('')
const items = ref<InboundToolItem[]>([
  emptyItem(),
])

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

function focusLocationScan(index: number) {
  locationScanTarget.value = index
  ElMessage.info(\`请扫描第 \${index + 1} 行的库位码\`)
}

function onLocationScan(code: string) {
  const idx = locationScanTarget.value ?? items.value.length - 1
  if (items.value[idx]) {
    items.value[idx].location_code = code
    ElMessage.success(\`第 \${idx + 1} 行库位已填入：\${code}\`)
  }
  locationScanTarget.value = null
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

      <div class="scan-row">
        <span class="scan-label">库位扫码：</span>
        <ScanInput placeholder="点击某行「扫库位」后，在此扫描库位码" @scan="onLocationScan" />
      </div>

      <el-table :data="items" border class="table-fill" style="margin-top: 12px">
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
        <el-table-column label="库位" min-width="140">
          <template #default="{ row, $index }">
            <div class="loc-cell">
              <el-input v-model="row.location_code" size="large" placeholder="手填或扫码" />
              <el-button size="large" @click="focusLocationScan($index)">扫库位</el-button>
            </div>
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
.scan-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.scan-label {
  white-space: nowrap;
  font-weight: 600;
  font-size: 18px;
}
.scan-row :deep(.el-input) {
  flex: 1;
}
.loc-cell {
  display: flex;
  gap: 8px;
  align-items: center;
}
.actions {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}
</style>
`,
)

// Home
w(
  'src/views/Home.vue',
  `<script setup lang="ts">
import { useRouter } from 'vue-router'
import { isAdminLoggedIn } from '@/composables/useAdminAuth'

const router = useRouter()

const entries = [
  { title: '工装借用', route: '/borrow' },
  { title: '工装归还', route: '/return' },
  { title: '自助入库', route: '/inbound' },
  { title: '库存查询', route: '/stock' },
  { title: '借还记录', route: '/records' },
  { title: '管理员系统', route: '/admin', requireLogin: true },
]

function onEntryClick(entry: (typeof entries)[number]) {
  if (entry.requireLogin && !isAdminLoggedIn()) {
    router.push({ path: '/admin/login', query: { redirect: '/admin' } })
    return
  }
  router.push(entry.route)
}
</script>

<template>
  <div class="page page-home">
    <h1 class="page-title">工装库管理系统</h1>
    <div class="home-grid">
      <button
        v-for="(item, index) in entries"
        :key="item.title"
        type="button"
        class="home-card"
        :class="{ 'home-card--admin': index === 5, 'home-card--inbound': index === 2 }"
        @click="onEntryClick(item)"
      >
        {{ item.title }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.page-home {
  max-width: none;
  width: 100%;
  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 28px 32px 32px;
}

.page-home .page-title {
  text-align: center;
  margin: 0 0 28px;
  font-size: clamp(30px, 4.5vmin, 44px);
  font-weight: 700;
  flex-shrink: 0;
}

.home-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 20px;
  min-height: 0;
}

.home-card {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 16px;
  background: linear-gradient(145deg, #409eff 0%, #337ecc 100%);
  color: #fff;
  font-size: clamp(30px, 5.5vmin, 52px);
  font-weight: 700;
  letter-spacing: 2px;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(64, 158, 255, 0.35);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
  padding: 24px;
  min-height: clamp(120px, 18vmin, 220px);
}

.home-card:active {
  transform: scale(0.98);
  box-shadow: 0 3px 12px rgba(64, 158, 255, 0.3);
}

.home-card--inbound {
  background: linear-gradient(145deg, #67c23a 0%, #529b2e 100%);
  box-shadow: 0 6px 20px rgba(103, 194, 58, 0.35);
}

.home-card--admin {
  background: linear-gradient(145deg, #606266 0%, #45474b 100%);
  box-shadow: 0 6px 20px rgba(96, 98, 102, 0.35);
}
</style>
`,
)

patch('src/router/index.ts', (s) => {
  if (s.includes("/inbound")) return s
  return s.replace(
    `{ path: '/stock', name: 'stock', component: () => import('@/views/StockQuery.vue') },`,
    `{ path: '/inbound', name: 'inbound', component: () => import('@/views/Inbound.vue') },
    { path: '/stock', name: 'stock', component: () => import('@/views/StockQuery.vue') },`,
  )
})

// Rename 工作中心 -> 借用工作中心 for borrow-side labels in key views
for (const rel of [
  'src/views/Borrow.vue',
  'src/views/admin/AdminRecordPanel.vue',
  'src/views/RecordList.vue',
]) {
  patch(rel, (s) =>
    s
      .replaceAll('label="工作中心"', 'label="借用工作中心"')
      .replaceAll('选择或输入工作中心', '选择或输入借用工作中心'),
  )
}

console.log('done ui')
