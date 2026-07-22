import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const path = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/views/AdminHub.vue')

writeFileSync(
  path,
  `<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import TouchButton from '@/components/TouchButton.vue'
import { systemApi } from '@/api/systemApi'
import { clearAdminSession, getAdminSession } from '@/composables/useAdminAuth'

const router = useRouter()
const session = getAdminSession()

const entries = [
  { title: '数据更新', route: '/admin/data' },
  { title: '数据备份', action: 'backup' as const },
  { title: '系统设置', route: '/admin/settings' },
]

async function onEntryClick(entry: (typeof entries)[number]) {
  if ('action' in entry && entry.action === 'backup') {
    try {
      const path = await systemApi.backupDatabase()
      ElMessage.success(\`备份成功：\${path}\`)
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : '备份失败')
    }
    return
  }
  if ('route' in entry) router.push(entry.route)
}

function logout() {
  clearAdminSession()
  router.replace('/admin/login')
}
</script>

<template>
  <div class="page page-admin">
    <div class="page-header">
      <div>
        <h1 class="page-title">管理员系统</h1>
        <p v-if="session" class="sub-title">当前用户：{{ session.displayName }}（{{ session.username }}）</p>
      </div>
      <div>
        <el-button size="large" @click="router.push('/')">返回首页</el-button>
        <el-button size="large" type="warning" @click="logout">退出登录</el-button>
      </div>
    </div>
    <div class="admin-entries">
      <TouchButton v-for="item in entries" :key="item.title" @click="onEntryClick(item)">
        {{ item.title }}
      </TouchButton>
    </div>
  </div>
</template>

<style scoped>
.page-admin {
  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.page-admin .page-title {
  margin: 0;
}

.sub-title {
  margin: 8px 0 0;
  color: #606266;
  font-size: 14px;
}

.admin-entries {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  width: min(480px, 100%);
  margin: 0 auto;
  padding: 24px 0 48px;
}
</style>
`,
  'utf8',
)

console.log('AdminHub.vue updated')
