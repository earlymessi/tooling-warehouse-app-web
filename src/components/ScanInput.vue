<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import type { ElInput } from 'element-plus'
import CodeFieldInput from '@/components/CodeFieldInput.vue'
import { normalizeCodeField } from '@/utils/codeField'

const props = defineProps<{
  placeholder?: string
  modelValue?: string
}>()

const emit = defineEmits<{
  scan: [value: string]
  'update:modelValue': [value: string]
}>()

const inputRef = ref<InstanceType<typeof CodeFieldInput> | null>(null)
const inner = ref(props.modelValue ?? '')

async function focusInput() {
  await nextTick()
  inputRef.value?.focus()
}

onMounted(focusInput)

async function onEnter(e: KeyboardEvent) {
  e.preventDefault()
  await nextTick()
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
  const elInput = inputRef.value?.inputRef as InstanceType<typeof ElInput> | null | undefined
  const native = elInput?.input as HTMLInputElement | undefined
  const value = normalizeCodeField((native?.value ?? inner.value).trim())
  if (!value) return
  emit('scan', value)
  emit('update:modelValue', '')
  inner.value = ''
  focusInput()
}

defineExpose({ focus: focusInput })
</script>

<template>
  <CodeFieldInput
    ref="inputRef"
    v-model="inner"
    clearable
    :placeholder="placeholder ?? '请扫描工装二维码/条码'"
    @keydown.enter="onEnter"
  />
</template>
