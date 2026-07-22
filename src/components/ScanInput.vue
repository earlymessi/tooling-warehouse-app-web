<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import type { ElInput } from 'element-plus'

const props = defineProps<{
  placeholder?: string
  modelValue?: string
}>()

const emit = defineEmits<{
  scan: [value: string]
  'update:modelValue': [value: string]
}>()

const inputRef = ref<InstanceType<typeof ElInput> | null>(null)
const inner = ref(props.modelValue ?? '')

async function focusInput() {
  await nextTick()
  inputRef.value?.focus()
}

onMounted(focusInput)

function onEnter() {
  const value = inner.value.trim()
  if (!value) return
  emit('scan', value)
  emit('update:modelValue', '')
  inner.value = ''
  focusInput()
}

defineExpose({ focus: focusInput })
</script>

<template>
  <el-input
    ref="inputRef"
    v-model="inner"
    size="large"
    :placeholder="placeholder ?? '请扫描工装二维码/条码'"
    clearable
    @keyup.enter="onEnter"
  />
</template>
