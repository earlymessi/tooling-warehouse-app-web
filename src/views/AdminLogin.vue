<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { adminApi } from '@/api/adminApi'
import { setAdminSession } from '@/composables/useAdminAuth'

const router = useRouter()
const route = useRoute()
const username = ref('admin')
const password = ref('')
const loading = ref(false)

async function submit() {
  if (!username.value.trim() || !password.value) {
    ElMessage.warning('请输入账号和密码')
    return
  }
  loading.value = true
  try {
    const result = await adminApi.login(username.value.trim(), password.value)
    setAdminSession({
      username: result.username,
      displayName: result.displayName,
      loggedInAt: new Date().toISOString(),
    })
    ElMessage.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/admin'
    router.replace(redirect)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="page page-touch">
    <div class="page-header">
      <el-button class="page-back" size="large" @click="router.push('/')">返回首页</el-button>
      <h1 class="page-title">管理员登录</h1>
      <div class="page-header-right"></div>
    </div>

    <div class="page-body login-body">
      <el-card class="login-card">
        <el-form label-width="80px" @submit.prevent="submit">
          <el-form-item label="账号">
            <el-input v-model="username" size="large" autocomplete="username" />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="password"
              type="password"
              size="large"
              show-password
              autocomplete="current-password"
              @keyup.enter="submit"
            />
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <div class="page-actions">
      <el-button type="primary" size="large" :loading="loading" @click="submit">登录</el-button>
    </div>
  </div>
</template>

<style scoped>
.login-body {
  align-items: center;
  justify-content: center;
  width: min(560px, 100%) !important;
}

.login-card {
  width: 100%;
}
</style>
