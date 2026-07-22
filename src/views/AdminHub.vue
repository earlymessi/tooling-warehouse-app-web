<script setup lang="ts">
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
      ElMessage.success(`备份成功：${path}`)
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
  <div class="page page-touch">
    <div class="page-header">
      <el-button class="page-back" size="large" @click="router.push('/')">返回首页</el-button>
      <div class="page-title-block">
        <h1 class="page-title">管理员系统</h1>
        <p v-if="session" class="sub-title">
          当前用户：{{ session.displayName }}（{{ session.username }}）
        </p>
      </div>
      <div class="page-header-right">
        <el-button size="large" type="warning" @click="logout">退出登录</el-button>
      </div>
    </div>

    <div class="page-body admin-body">
      <TouchButton v-for="item in entries" :key="item.title" @click="onEntryClick(item)">
        {{ item.title }}
      </TouchButton>
    </div>
  </div>
</template>

<style scoped>
.page-title-block {
  justify-self: center;
  text-align: center;
}

.page-title-block .page-title {
  margin: 0;
}

.sub-title {
  margin: 8px 0 0;
  color: #606266;
  font-size: 16px;
}

.admin-body {
  align-items: center;
  justify-content: center;
  width: min(520px, 100%) !important;
  gap: 28px;
  padding-bottom: 48px;
}
</style>
