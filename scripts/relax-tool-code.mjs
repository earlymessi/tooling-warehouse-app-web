import { readFileSync, writeFileSync } from 'fs'

const p = 'D:/Desktop/tooling-warehouse-app/electron/services/tool.service.ts'
let s = readFileSync(p, 'utf8')

const oldFn = `function assertNumericToolCode(code: string): void {
  if (!/^\\d+$/.test(code.trim())) {
    throw new Error('TOOL_CODE_INVALID: 资产编号必须为纯数字')
  }
}`

const newFn = `function assertToolCode(code: string): void {
  if (!code.trim()) {
    throw new Error('TOOL_CODE_INVALID: 资产编号不能为空')
  }
}`

if (!s.includes('assertNumericToolCode')) {
  console.log('already patched or missing')
  process.exit(0)
}

// Match regardless of Chinese error message content
s = s.replace(
  /function assertNumericToolCode\(code: string\): void \{[\s\S]*?\n\}/,
  newFn,
)
s = s.replaceAll('assertNumericToolCode', 'assertToolCode')
writeFileSync(p, s, 'utf8')
console.log('patched tool.service.ts')
