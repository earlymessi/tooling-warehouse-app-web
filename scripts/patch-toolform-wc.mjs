import { readFileSync, writeFileSync } from 'fs'

const p = 'D:/Desktop/tooling-warehouse-app/src/views/ToolForm.vue'
let s = readFileSync(p, 'utf8')

if (s.includes('v-model="form.work_center"')) {
  console.log('already has work_center input')
  process.exit(0)
}

const oldBlock = `        <el-form-item label="序列号">
          <el-input v-model="form.serial_no" size="large" />
        </el-form-item>
        <el-form-item label="库位">`

const newBlock = `        <el-form-item label="序列号">
          <el-input v-model="form.serial_no" size="large" />
        </el-form-item>
        <el-form-item label="工作中心" required>
          <el-input v-model="form.work_center" size="large" placeholder="归属工作中心" />
        </el-form-item>
        <el-form-item label="库位">`

if (!s.includes(oldBlock)) {
  console.error('block not found')
  process.exit(1)
}

writeFileSync(p, s.replace(oldBlock, newBlock), 'utf8')
console.log('ok')
