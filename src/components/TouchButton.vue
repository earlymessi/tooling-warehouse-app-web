<script setup lang="ts">
defineProps<{
  label?: string
  loading?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <el-button type="primary" size="large" class="touch-btn" :loading="loading" @click="emit('click')">
    <slot>{{ label }}</slot>
  </el-button>
</template>

<style scoped>
.touch-btn {
  width: 100%;
  min-height: 96px;
  font-size: 26px;
  font-weight: 700;
}
</style>
