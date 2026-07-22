<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import TouchButton from '@/components/TouchButton.vue'
import { importExportApi } from '@/api/systemApi'

const router = useRouter()

async function exportTools() {
  try {
    const path = await importExportApi.exportTools({})
    ElMessage.success(`导出成功：${path}`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导出失败')
  }
}

async function exportRecords() {
  try {
    const path = await importExportApi.exportRecords({})
    ElMessage.success(`导出成功：${path}`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导出失败')
  }
}
</script>

<template>
  <div class="page page-touch">
    <div class="page-header">
      <el-button class="page-back" size="large" @click="router.push('/')">返回首页</el-button>
      <h1 class="page-title">数据导出</h1>
      <div class="page-header-right"></div>
    </div>

    <div class="page-body export-body">
      <TouchButton @click="exportTools">导出台账 Excel</TouchButton>
      <TouchButton @click="exportRecords">导出借还记录 Excel</TouchButton>
    </div>
  </div>
</template>

<style scoped>
.export-body {
  align-items: center;
  justify-content: center;
  width: min(520px, 100%) !important;
  gap: 28px;
  padding-bottom: 48px;
}
</style>
