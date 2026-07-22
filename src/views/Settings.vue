<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { systemApi } from '@/api/systemApi'

const router = useRouter()
const paths = ref<Awaited<ReturnType<typeof systemApi.getPaths>> | null>(null)

onMounted(async () => {
  try {
    paths.value = await systemApi.getPaths()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '加载失败')
  }
})
</script>

<template>
  <div class="page page-touch">
    <div class="page-header">
      <el-button class="page-back" size="large" @click="router.push('/admin')">返回管理</el-button>
      <h1 class="page-title">系统设置</h1>
      <div class="page-header-right"></div>
    </div>

    <div class="page-body settings-body">
      <el-descriptions v-if="paths" title="数据目录" :column="1" border class="settings-desc">
        <el-descriptions-item label="数据根目录">{{ paths.dataRoot }}</el-descriptions-item>
        <el-descriptions-item label="数据库文件">{{ paths.dbFile }}</el-descriptions-item>
        <el-descriptions-item label="备份目录">{{ paths.backupDir }}</el-descriptions-item>
        <el-descriptions-item label="导出目录">{{ paths.exportDir }}</el-descriptions-item>
        <el-descriptions-item label="日志目录">{{ paths.logsDir }}</el-descriptions-item>
      </el-descriptions>
    </div>
  </div>
</template>

<style scoped>
.settings-body {
  justify-content: center;
}

.settings-desc {
  width: 100%;
}

.settings-desc :deep(.el-descriptions__title) {
  font-size: 22px;
}

.settings-desc :deep(.el-descriptions__label),
.settings-desc :deep(.el-descriptions__content) {
  font-size: 18px;
  padding: 16px 20px !important;
}
</style>
