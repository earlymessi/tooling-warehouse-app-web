<script setup lang="ts">
import { ref } from 'vue'
import type { ElInput } from 'element-plus'
import { systemApi } from '@/api/systemApi'
import { normalizeCodeField, normalizeSearchKeyword } from '@/utils/codeField'

const model = defineModel<string>({ default: '' })

withDefaults(
  defineProps<{
    placeholder?: string
    size?: 'large' | 'default' | 'small'
    clearable?: boolean
    disabled?: boolean
    /** true=资产编号/序列号/库位/工作中心；false=查询关键字（保留中文） */
    strict?: boolean
  }>(),
  {
    size: 'large',
    clearable: false,
    disabled: false,
    strict: true,
  },
)

const inputRef = ref<InstanceType<typeof ElInput> | null>(null)

function normalize(value: string, strict: boolean): string {
  return strict ? normalizeCodeField(value) : normalizeSearchKeyword(value)
}

function onUpdate(value: string, strict: boolean) {
  model.value = normalize(value, strict)
}

async function onFocus() {
  try {
    await systemApi.setCodeInputMode(true)
  } catch {
    // 非 Electron 环境（如单元测试）忽略
  }
}

async function onBlur() {
  try {
    await systemApi.setCodeInputMode(false)
  } catch {
    // ignore
  }
}

function onCompositionStart(event: CompositionEvent) {
  event.preventDefault()
  event.stopPropagation()
}

defineExpose({
  focus: () => inputRef.value?.focus(),
  inputRef,
})
</script>

<template>
  <el-input
    ref="inputRef"
    class="code-field-input"
    :model-value="model"
    :size="size"
    :placeholder="placeholder"
    :clearable="clearable"
    :disabled="disabled"
    lang="en"
    autocomplete="off"
    spellcheck="false"
    inputmode="latin"
    @update:model-value="(value: string) => onUpdate(value, strict)"
    @focus="onFocus"
    @blur="onBlur"
    @compositionstart="onCompositionStart"
  />
</template>

<style scoped>
.code-field-input :deep(.el-input__inner) {
  ime-mode: disabled;
  text-transform: uppercase;
}
</style>
