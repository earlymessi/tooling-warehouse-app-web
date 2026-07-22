<script setup lang="ts">
import type { ToolAccount } from '@/types/tool'

defineProps<{
  tool: ToolAccount | null
}>()
</script>

<template>
  <el-card v-if="tool" class="tool-card">
    <template #header>工装信息</template>
    <el-descriptions :column="2" border>
      <el-descriptions-item label="资产编号">{{ tool.tool_code }}</el-descriptions-item>
      <el-descriptions-item label="名称">{{ tool.tool_name }}</el-descriptions-item>
      <el-descriptions-item label="型号">{{ tool.specification || '-' }}</el-descriptions-item>
      <el-descriptions-item label="序列号">{{ tool.serial_no || '-' }}</el-descriptions-item>
      <el-descriptions-item label="库位">{{ tool.location_code || '-' }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="tool.status === '在库' ? 'success' : 'warning'">{{ tool.status }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="数量">{{ tool.quantity }}</el-descriptions-item>
    </el-descriptions>
  </el-card>
</template>

<style scoped>
.tool-card {
  margin: 16px 0;
}
</style>
