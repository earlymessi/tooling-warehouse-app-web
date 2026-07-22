import { readFileSync, writeFileSync } from 'fs'

const p = 'D:/Desktop/tooling-warehouse-app/src/views/Inbound.vue'
let s = readFileSync(p, 'utf8')
s = s.replace("work_center: 'LG-FT',", "work_center: '',")
s = s.replace(
  'v-model="row.work_center" size="large" placeholder="必填"',
  'v-model="row.work_center" size="large" placeholder="例如 LG-FT"',
)
writeFileSync(p, s, 'utf8')
console.log('ok')
