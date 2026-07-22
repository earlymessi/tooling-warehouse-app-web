# 工装库管理单机程序 MVP 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 交付 Windows 触屏单机版工装库管理程序 MVP（扫码借还、台账、Excel、备份）。

**架构：** Electron 主进程承载 SQLite 与业务逻辑；preload 通过 `contextBridge` 暴露 `window.api`；Vue 3 渲染触屏页面。业务逻辑集中在 `electron/services/`，数据访问在 `electron/db/` repository 层。

**技术栈：** Electron 33、Vue 3、TypeScript、Vite、Element Plus、better-sqlite3、xlsx、Vitest、electron-builder

**设计规格：** `docs/superpowers/specs/2026-06-26-tooling-warehouse-mvp-design.md`

---

## 文件结构

| 路径 | 职责 |
|------|------|
| `package.json` | 依赖、脚本（dev/build/test） |
| `electron-builder.yml` | Windows 安装包配置 |
| `vite.config.ts` | Vite + Electron 双入口 |
| `electron/main.ts` | 窗口创建、IPC 注册、DB 初始化 |
| `electron/preload.ts` | `contextBridge.exposeInMainWorld('api', ...)` |
| `electron/paths.ts` | `C:\tooling-warehouse-db\` 路径常量与目录创建 |
| `electron/db/index.ts` | better-sqlite3 单例、`PRAGMA foreign_keys` |
| `electron/db/schema.sql` | 建表 SQL |
| `electron/db/tool.repository.ts` | tool_account CRUD 查询 |
| `electron/db/borrow.repository.ts` | borrow_return_record 查询与写入 |
| `electron/services/time.ts` | ISO 8601 时间格式化 |
| `electron/services/recordNo.ts` | `BR` + 日期 + 序号生成 |
| `electron/services/overdue.ts` | 超期判定（展示用） |
| `electron/services/tool.service.ts` | 台账业务规则 |
| `electron/services/borrow.service.ts` | 借用/归还事务 |
| `electron/services/excel.service.ts` | xlsx 导入导出 |
| `electron/services/backup.service.ts` | db 文件复制备份 |
| `electron/ipc/*.ts` | IPC handler 薄层，调用 service |
| `src/types/*.ts` | 前后端共享类型定义 |
| `src/api/*.ts` | 渲染进程 IPC 封装 |
| `src/components/*.vue` | 触屏复用组件 |
| `src/views/*.vue` | 页面 |
| `src/styles/touch.scss` | 触屏尺寸全局样式 |
| `tests/unit/*.test.ts` | 业务逻辑单元测试（不启动 Electron） |

---

## Phase P0：项目脚手架

### 任务 1：初始化项目与依赖

**文件：**
- 创建：`package.json`
- 创建：`tsconfig.json`
- 创建：`tsconfig.node.json`
- 创建：`.gitignore`

- [ ] **步骤 1：创建 `package.json`**

```json
{
  "name": "tooling-warehouse-app",
  "version": "0.1.0",
  "private": true,
  "main": "dist-electron/main.js",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build && electron-builder",
    "test": "vitest run",
    "test:watch": "vitest",
    "postinstall": "electron-builder install-app-deps"
  },
  "dependencies": {
    "better-sqlite3": "^11.8.1",
    "element-plus": "^2.9.7",
    "vue": "^3.5.13",
    "vue-router": "^4.5.0",
    "xlsx": "^0.18.5"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@vitejs/plugin-vue": "^5.2.1",
    "electron": "^33.3.1",
    "electron-builder": "^25.1.8",
    "sass": "^1.83.4",
    "typescript": "^5.7.3",
    "vite": "^6.0.7",
    "vite-plugin-electron": "^0.28.8",
    "vite-plugin-electron-renderer": "^0.14.6",
    "vitest": "^3.0.5",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **步骤 2：创建 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "lib": ["ES2022", "DOM"],
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "electron/**/*.ts", "tests/**/*.ts"]
}
```

- [ ] **步骤 3：创建 `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **步骤 4：创建 `.gitignore`**

```gitignore
node_modules/
dist/
dist-electron/
release/
*.db
C:/tooling-warehouse-db/
.DS_Store
```

- [ ] **步骤 5：安装依赖**

运行：`npm install`
预期：成功，无 peer dependency 致命错误

- [ ] **步骤 6：Commit**

```bash
git init
git add package.json tsconfig.json tsconfig.node.json .gitignore
git commit -m "chore: initialize tooling-warehouse-app project"
```

---

### 任务 2：Vite + Electron + Vue 入口

**文件：**
- 创建：`vite.config.ts`
- 创建：`index.html`
- 创建：`src/main.ts`
- 创建：`src/App.vue`
- 创建：`electron/main.ts`
- 创建：`electron/preload.ts`

- [ ] **步骤 1：创建 `vite.config.ts`**

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron/simple'
import path from 'node:path'

export default defineConfig({
  plugins: [
    vue(),
    electron({
      main: { entry: 'electron/main.ts' },
      preload: { input: 'electron/preload.ts' },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **步骤 2：创建 `index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>工装库管理系统</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **步骤 3：创建 `src/main.ts`**

```ts
import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import './styles/touch.scss'

createApp(App).use(ElementPlus).use(router).mount('#app')
```

- [ ] **步骤 4：创建 `src/App.vue`**

```vue
<template>
  <router-view />
</template>
```

- [ ] **步骤 5：创建 `electron/main.ts`**

```ts
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { ensureDataDirs } from './paths'
import { initDatabase } from './db'
import { registerIpcHandlers } from './ipc'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  ensureDataDirs()
  initDatabase()
  registerIpcHandlers(ipcMain)
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
```

- [ ] **步骤 6：创建 `electron/preload.ts`（骨架，后续任务补全 API）**

```ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),
})
```

- [ ] **步骤 7：创建 `src/router/index.ts` 与占位 `Home.vue`**

`src/router/index.ts`:

```ts
import { createRouter, createWebHashHistory } from 'vue-router'
import Home from '@/views/Home.vue'

export default createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', name: 'home', component: Home }],
})
```

`src/views/Home.vue`:

```vue
<template>
  <div class="page-home"><h1>工装库管理系统</h1></div>
</template>
```

- [ ] **步骤 8：创建 `src/styles/touch.scss`**

```scss
:root {
  --touch-btn-height: 72px;
  --touch-input-height: 56px;
  --touch-table-row-height: 48px;
}
.el-button--large { min-height: var(--touch-btn-height); font-size: 18px; }
.el-input__wrapper { min-height: var(--touch-input-height); }
.el-table .el-table__row { height: var(--touch-table-row-height); }
```

- [ ] **步骤 9：运行开发服务器**

运行：`npm run dev`
预期：Electron 窗口打开，显示「工装库管理系统」

- [ ] **步骤 10：Commit**

```bash
git add vite.config.ts index.html src/ electron/main.ts electron/preload.ts
git commit -m "feat: scaffold Electron + Vue + Vite dev environment"
```

---

### 任务 3：数据路径与 SQLite 初始化

**文件：**
- 创建：`electron/paths.ts`
- 创建：`electron/db/schema.sql`
- 创建：`electron/db/index.ts`
- 测试：`tests/unit/paths.test.ts`

- [ ] **步骤 1：编写失败的测试 `tests/unit/paths.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { DATA_ROOT, DB_FILE, BACKUP_DIR, EXPORT_DIR } from '../../electron/paths'

describe('paths', () => {
  it('uses C drive tooling-warehouse-db root', () => {
    expect(DATA_ROOT).toBe('C:\\tooling-warehouse-db')
    expect(DB_FILE).toBe('C:\\tooling-warehouse-db\\data\\tooling.db')
    expect(BACKUP_DIR).toBe('C:\\tooling-warehouse-db\\backup')
    expect(EXPORT_DIR).toBe('C:\\tooling-warehouse-db\\export')
  })
})
```

- [ ] **步骤 2：运行测试验证失败**

运行：`npm test -- tests/unit/paths.test.ts`
预期：FAIL，`Cannot find module '../../electron/paths'`

- [ ] **步骤 3：实现 `electron/paths.ts`**

```ts
import fs from 'node:fs'
import path from 'node:path'

export const DATA_ROOT = 'C:\\tooling-warehouse-db'
export const DB_FILE = path.join(DATA_ROOT, 'data', 'tooling.db')
export const BACKUP_DIR = path.join(DATA_ROOT, 'backup')
export const EXPORT_DIR = path.join(DATA_ROOT, 'export')
export const LOGS_DIR = path.join(DATA_ROOT, 'logs')

const DIRS = [
  path.join(DATA_ROOT, 'data'),
  BACKUP_DIR,
  EXPORT_DIR,
  LOGS_DIR,
]

export function ensureDataDirs(): void {
  for (const dir of DIRS) {
    fs.mkdirSync(dir, { recursive: true })
  }
}
```

- [ ] **步骤 4：创建 `electron/db/schema.sql`**

将设计规格 §3.1、§3.2 的完整 `CREATE TABLE` 与 `CREATE INDEX` 语句原样写入（含 `idx_tool_account_spec`）。

- [ ] **步骤 5：实现 `electron/db/index.ts`**

```ts
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { DB_FILE } from '../paths'

let db: Database.Database | null = null

export function initDatabase(): Database.Database {
  if (db) return db
  const schemaPath = path.join(__dirname, 'schema.sql')
  const schema = fs.readFileSync(schemaPath, 'utf8')
  db = new Database(DB_FILE)
  db.pragma('foreign_keys = ON')
  db.exec(schema)
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

/** 仅测试用：内存库 */
export function initTestDatabase(): Database.Database {
  const testDb = new Database(':memory:')
  testDb.pragma('foreign_keys = ON')
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  testDb.exec(schema)
  return testDb
}
```

- [ ] **步骤 6：在 `electron/ipc/index.ts` 注册 ping**

```ts
import type { IpcMain } from 'electron'

export function registerIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle('ping', () => ({ ok: true, dbPath: 'C:\\tooling-warehouse-db\\data\\tooling.db' }))
}
```

更新 `electron/main.ts` 已引用 `registerIpcHandlers`。

- [ ] **步骤 7：运行测试与手动验证**

运行：`npm test -- tests/unit/paths.test.ts`
预期：PASS

运行：`npm run dev`，检查 `C:\tooling-warehouse-db\data\tooling.db` 文件已创建。

- [ ] **步骤 8：Commit**

```bash
git add electron/paths.ts electron/db/ electron/ipc/index.ts tests/unit/paths.test.ts
git commit -m "feat: add data paths and SQLite schema initialization"
```

---

### 任务 4：共享类型与 IPC 响应格式

**文件：**
- 创建：`src/types/tool.ts`
- 创建：`src/types/borrow.ts`
- 创建：`src/types/api.ts`
- 创建：`electron/ipc/response.ts`

- [ ] **步骤 1：创建 `src/types/tool.ts`**

```ts
export type ToolStatus = '在库' | '借出'

export interface ToolAccount {
  id: number
  tool_code: string
  tool_name: string
  tool_category: string | null
  specification: string | null
  work_center: string | null
  location_code: string | null
  quantity: number
  unit: string
  status: ToolStatus
  current_borrower: string | null
  current_borrow_department: string | null
  current_use_work_center: string | null
  current_borrow_time: string | null
  expected_return_time: string | null
  qr_content: string | null
  remark: string | null
  created_at: string
  updated_at: string
}

export interface ToolListParams {
  keyword?: string
  status?: ToolStatus
  page?: number
  pageSize?: number
}

export interface CreateToolInput {
  tool_code: string
  tool_name: string
  tool_category?: string
  specification?: string
  work_center?: string
  location_code?: string
  quantity?: number
  unit?: string
  remark?: string
}
```

- [ ] **步骤 2：创建 `src/types/borrow.ts`**

```ts
export type RecordStatus = '未归还' | '已归还' | '已超期'

export interface BorrowReturnRecord {
  id: number
  record_no: string
  tool_id: number
  tool_code: string
  tool_name: string
  record_status: RecordStatus
  borrower: string | null
  borrow_department: string | null
  use_work_center: string | null
  borrow_time: string | null
  expected_return_time: string | null
  return_time: string | null
  return_result: string | null
  operator_name: string | null
  remark: string | null
  created_at: string
  updated_at: string
  is_overdue?: boolean
}

export interface BorrowToolInput {
  toolCode: string
  borrower: string
  borrowDepartment: string
  useWorkCenter: string
  expectedReturnTime: string
  remark?: string
}

export interface BorrowRecordListParams {
  keyword?: string
  recordStatus?: RecordStatus
  borrower?: string
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}
```

- [ ] **步骤 3：创建 `src/types/api.ts`**

```ts
export interface ApiSuccess<T> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  code: string
  message: string
}

export type ApiResult<T> = ApiSuccess<T> | ApiError

export interface ImportResult {
  successCount: number
  failCount: number
  errors: Array<{ row: number; reason: string }>
}
```

- [ ] **步骤 4：创建 `electron/ipc/response.ts`**

```ts
import type { ApiError, ApiResult, ApiSuccess } from '../../src/types/api'

export function success<T>(data: T): ApiSuccess<T> {
  return { ok: true, data }
}

export function failure(code: string, message: string): ApiError {
  return { ok: false, code, message }
}

export function wrap<T>(fn: () => T): ApiResult<T> {
  try {
    return success(fn())
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return failure('INTERNAL_ERROR', msg)
  }
}
```

- [ ] **步骤 5：Commit**

```bash
git add src/types/ electron/ipc/response.ts
git commit -m "feat: add shared types and IPC response helpers"
```

---

### 任务 5：时间、记录号、超期工具函数（TDD）

**文件：**
- 创建：`electron/services/time.ts`
- 创建：`electron/services/recordNo.ts`
- 创建：`electron/services/overdue.ts`
- 测试：`tests/unit/time.test.ts`
- 测试：`tests/unit/recordNo.test.ts`
- 测试：`tests/unit/overdue.test.ts`

- [ ] **步骤 1：编写 `tests/unit/time.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { formatNow, parseIso } from '../../electron/services/time'

describe('time', () => {
  it('formatNow matches ISO 8601 without timezone', () => {
    const s = formatNow(new Date('2026-06-26T14:30:00'))
    expect(s).toBe('2026-06-26T14:30:00')
  })

  it('parseIso parses local datetime', () => {
    const d = parseIso('2026-06-26T14:30:00')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(26)
  })
})
```

- [ ] **步骤 2：实现 `electron/services/time.ts`**

```ts
function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatNow(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function parseIso(iso: string): Date {
  const [datePart, timePart] = iso.split('T')
  const [y, m, d] = datePart.split('-').map(Number)
  const [hh, mm, ss] = timePart.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm, ss)
}
```

- [ ] **步骤 3：编写 `tests/unit/recordNo.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { initTestDatabase } from '../../electron/db'
import { generateRecordNo } from '../../electron/services/recordNo'

describe('recordNo', () => {
  it('generates BR + date + 4 digit sequence', () => {
    const db = initTestDatabase()
    const no1 = generateRecordNo(db, new Date('2026-06-26T10:00:00'))
    const no2 = generateRecordNo(db, new Date('2026-06-26T10:01:00'))
    expect(no1).toBe('BR202606260001')
    expect(no2).toBe('BR202606260002')
    db.close()
  })
})
```

- [ ] **步骤 4：实现 `electron/services/recordNo.ts`**

```ts
import type Database from 'better-sqlite3'

export function generateRecordNo(db: Database.Database, now: Date): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const prefix = `BR${y}${m}${d}`
  const row = db
    .prepare(
      `SELECT record_no FROM borrow_return_record WHERE record_no LIKE ? ORDER BY record_no DESC LIMIT 1`
    )
    .get(`${prefix}%`) as { record_no: string } | undefined
  const seq = row ? Number(row.record_no.slice(-4)) + 1 : 1
  return `${prefix}${String(seq).padStart(4, '0')}`
}
```

- [ ] **步骤 5：编写 `tests/unit/overdue.test.ts` 并实现 `overdue.ts`**

```ts
// overdue.ts
import { parseIso, formatNow } from './time'

export function isOverdue(expectedReturnTime: string | null, now = new Date()): boolean {
  if (!expectedReturnTime) return false
  return parseIso(expectedReturnTime) < now
}

export function displayRecordStatus(
  recordStatus: string,
  expectedReturnTime: string | null,
  now = new Date()
): '未归还' | '已归还' | '已超期' {
  if (recordStatus === '已归还') return '已归还'
  if (recordStatus === '未归还' && isOverdue(expectedReturnTime, now)) return '已超期'
  return recordStatus as '未归还'
}
```

- [ ] **步骤 6：运行全部单元测试**

运行：`npm test`
预期：全部 PASS

- [ ] **步骤 7：Commit**

```bash
git add electron/services/time.ts electron/services/recordNo.ts electron/services/overdue.ts tests/unit/
git commit -m "feat: add time, record number, and overdue utilities with tests"
```

---

## Phase P1：工装台账

### 任务 6：tool.repository 与 tool.service

**文件：**
- 创建：`electron/db/tool.repository.ts`
- 创建：`electron/services/tool.service.ts`
- 测试：`tests/unit/tool.service.test.ts`
- 创建：`electron/ipc/tool.ipc.ts`

- [ ] **步骤 1：实现 `electron/db/tool.repository.ts`**

提供方法：`findByCode(toolCode)`、`findById(id)`、`list(params)` 返回 `{ items, total }`、`insert(data)`、`update(id, data)`、`upsertByCode(data)`（Excel 用）。

`list` 支持 `keyword` 模糊匹配 `tool_code`/`tool_name`/`specification`，`status` 精确过滤，分页 `LIMIT/OFFSET`。

- [ ] **步骤 2：编写 `tests/unit/tool.service.test.ts`**

覆盖：
- `createTool` 成功，`qr_content = tool_code`，`status = 在库`，`quantity = 1`
- 重复 `tool_code` 抛错 `TOOL_CODE_EXISTS`
- `getToolByCode` 不存在返回 null

- [ ] **步骤 3：实现 `electron/services/tool.service.ts`**

```ts
// 核心校验
function assertNumericToolCode(code: string): void {
  if (!/^\d+$/.test(code)) throw new Error('TOOL_CODE_INVALID: 工装ID必须为纯数字')
}

export function createTool(db: Database.Database, input: CreateToolInput): ToolAccount {
  assertNumericToolCode(input.tool_code)
  const now = formatNow()
  return toolRepo.insert(db, {
    ...input,
    quantity: input.quantity ?? 1,
    unit: input.unit ?? '件',
    status: '在库',
    qr_content: input.tool_code,
    created_at: now,
    updated_at: now,
  })
}
```

- [ ] **步骤 4：实现 `electron/ipc/tool.ipc.ts` 并注册**

Handlers：`tool:list`、`tool:getByCode`、`tool:create`、`tool:update`

- [ ] **步骤 5：扩展 `electron/preload.ts` 与 `src/api/toolApi.ts`**

- [ ] **步骤 6：运行测试**

运行：`npm test -- tests/unit/tool.service.test.ts`
预期：PASS

- [ ] **步骤 7：Commit**

```bash
git commit -am "feat: implement tool repository, service, and IPC"
```

---

### 任务 7：触屏组件与台账页面

**文件：**
- 创建：`src/components/TouchButton.vue`
- 创建：`src/components/ScanInput.vue`
- 创建：`src/components/ToolInfoCard.vue`
- 创建：`src/views/ToolList.vue`
- 创建：`src/views/ToolForm.vue`

- [ ] **步骤 1：实现 `ScanInput.vue`**

- `ref` 输入框，`onMounted` + `watch` 自动 `focus()`
- 监听 `keydown Enter`：`emit('scan', value.trim())` 后清空
- 最小高度 56px

- [ ] **步骤 2：实现 `ToolList.vue`**

- 顶部关键字搜索 + 状态下拉（全部/在库/借出）
- `el-table` 展示台账，行高 48px
- 「新增」按钮跳转 `ToolForm`；行内「编辑」按钮
- 调用 `toolApi.getToolList`

- [ ] **步骤 3：实现 `ToolForm.vue`**

- 字段：tool_code、tool_name、tool_category、specification、work_center、location_code、unit、remark
- 新建时 tool_code 可编辑；编辑时 tool_code 只读
- 保存调用 `createTool` / `updateTool`，成功后 `router.back()`

- [ ] **步骤 4：更新路由**

```ts
{ path: '/tools', component: () => import('@/views/ToolList.vue') },
{ path: '/tools/new', component: () => import('@/views/ToolForm.vue') },
{ path: '/tools/:id/edit', component: () => import('@/views/ToolForm.vue'), props: true },
```

- [ ] **步骤 5：手动验证**

运行：`npm run dev`，新增工装 ID `10001`，列表可见。

- [ ] **步骤 6：Commit**

```bash
git add src/components/ src/views/ToolList.vue src/views/ToolForm.vue src/router/
git commit -m "feat: add tool list and form pages with touch components"
```

---

### 任务 8：Excel 导入导出

**文件：**
- 创建：`electron/services/excel.service.ts`
- 创建：`electron/ipc/importExport.ipc.ts`
- 测试：`tests/unit/excel.service.test.ts`
- 创建：`src/views/Import.vue`

- [ ] **步骤 1：编写 `tests/unit/excel.service.test.ts`**

用临时 xlsx 文件测试：
- 解析列头映射（工装ID→tool_code）
- 新增行 + 更新已存在 tool_code
- 缺少工装ID/名称的行记入 errors

- [ ] **步骤 2：实现 `electron/services/excel.service.ts`**

```ts
const COLUMN_MAP: Record<string, keyof CreateToolInput> = {
  '工装ID': 'tool_code',
  '工装名称': 'tool_name',
  '工装种类': 'tool_category',
  '规格型号': 'specification',
  '所属工作中心': 'work_center',
  '库位': 'location_code',
  '数量': 'quantity',
  '单位': 'unit',
  '备注': 'remark',
}

export function importToolAccountFromExcel(db: Database.Database, filePath: string): ImportResult {
  const workbook = XLSX.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
  // 逐行 upsertByCode，收集 errors
}

export function exportToolAccountToExcel(db: Database.Database, filePath: string, params: ToolListParams): string {
  // 查询结果写入 xlsx，返回 filePath（EXPORT_DIR 下带时间戳文件名）
}
```

- [ ] **步骤 3：IPC 使用 `dialog.showOpenDialog` / `showSaveDialog`**

`importExport:importTools` — 选文件后导入，返回 `ImportResult`
`importExport:exportTools` — 导出到 `EXPORT_DIR`

- [ ] **步骤 4：实现 `Import.vue`**

- 按钮「选择 Excel 文件导入」
- 展示成功/失败统计与错误行列表

- [ ] **步骤 5：在 ToolList 添加「导出 Excel」按钮**

- [ ] **步骤 6：运行测试并手动验证**

- [ ] **步骤 7：Commit**

```bash
git commit -am "feat: add Excel import and export for tool accounts"
```

---

## Phase P2：借还核心

### 任务 9：borrow.repository 与 borrow.service（TDD）

**文件：**
- 创建：`electron/db/borrow.repository.ts`
- 创建：`electron/services/borrow.service.ts`
- 测试：`tests/unit/borrow.service.test.ts`
- 创建：`electron/ipc/borrow.ipc.ts`

- [ ] **步骤 1：编写 `tests/unit/borrow.service.test.ts`**

用 `initTestDatabase()` 测试：

**借用成功：**
```ts
const tool = createTool(db, { tool_code: '10001', tool_name: '夹具A' })
borrowTool(db, { toolCode: '10001', borrower: '张三', borrowDepartment: '生产', useWorkCenter: 'WC01', expectedReturnTime: '2026-07-01T18:00:00' })
const updated = findByCode(db, '10001')
expect(updated.status).toBe('借出')
expect(updated.quantity).toBe(0)
```

**不可借用（已借出）：** 第二次 `borrowTool` 返回/抛出 `TOOL_NOT_AVAILABLE`

**归还成功：**
```ts
returnTool(db, { toolCode: '10001' })
expect(findByCode(db, '10001').status).toBe('在库')
expect(findByCode(db, '10001').quantity).toBe(1)
```

- [ ] **步骤 2：实现 `electron/services/borrow.service.ts`**

```ts
export function borrowTool(db: Database.Database, input: BorrowToolInput): BorrowReturnRecord {
  const tool = toolRepo.findByCode(db, input.toolCode)
  if (!tool) throw new Error('TOOL_NOT_FOUND: 工装不存在')
  if (tool.status !== '在库' || tool.quantity !== 1) {
    throw new Error('TOOL_NOT_AVAILABLE: 当前状态不可借用')
  }
  const open = borrowRepo.findOpenByToolId(db, tool.id)
  if (open) throw new Error('BORROW_EXISTS: 存在未归还记录')

  const now = formatNow()
  const tx = db.transaction(() => {
    const recordNo = generateRecordNo(db, new Date())
    const record = borrowRepo.insert(db, {
      record_no: recordNo,
      tool_id: tool.id,
      tool_code: tool.tool_code,
      tool_name: tool.tool_name,
      record_status: '未归还',
      borrower: input.borrower,
      borrow_department: input.borrowDepartment,
      use_work_center: input.useWorkCenter,
      borrow_time: now,
      expected_return_time: input.expectedReturnTime,
      operator_name: input.borrower,
      remark: input.remark ?? null,
      created_at: now,
      updated_at: now,
    })
    toolRepo.update(db, tool.id, {
      status: '借出',
      quantity: 0,
      current_borrower: input.borrower,
      current_borrow_department: input.borrowDepartment,
      current_use_work_center: input.useWorkCenter,
      current_borrow_time: now,
      expected_return_time: input.expectedReturnTime,
      updated_at: now,
    })
    return record
  })
  return tx()
}
```

`returnTool` 同理：查未归还记录 → 更新 record → 清空 tool 借用字段 → `status=在库, quantity=1, return_result=正常归还`。

- [ ] **步骤 3：实现 IPC 并扩展 preload/api**

- [ ] **步骤 4：运行测试**

运行：`npm test -- tests/unit/borrow.service.test.ts`
预期：PASS

- [ ] **步骤 5：Commit**

```bash
git commit -am "feat: implement borrow and return transaction logic"
```

---

### 任务 10：借用与归还页面

**文件：**
- 创建：`src/views/Borrow.vue`
- 创建：`src/views/Return.vue`

- [ ] **步骤 1：实现 `Borrow.vue`**

布局：
1. `ScanInput` @scan → `getToolByCode`
2. `ToolInfoCard` 展示工装信息；不可借时 `el-alert` 错误
3. 表单：借用人、借用部门、使用工作中心、`el-date-picker`（预计归还，输出 ISO 字符串）、备注
4. 「确认借用」→ `borrowTool` → 成功 `ElMessage.success` + 清空表单 + refocus 扫码框

- [ ] **步骤 2：实现 `Return.vue`**

1. `ScanInput` @scan → 查工装 + 未归还记录
2. 无记录 → 提示「不需要归还或记录异常」
3. 展示借用人、部门、工作中心、借用时间、预计归还；若超期显示红色「已超期」标签
4. 「确认归还」→ `returnTool` → 清空 + refocus

- [ ] **步骤 3：注册路由 `/borrow`、`/return`**

- [ ] **步骤 4：端到端手动测试**

借 10001 → 台账借出 → 还 10001 → 台账在库。

- [ ] **步骤 5：Commit**

```bash
git add src/views/Borrow.vue src/views/Return.vue
git commit -m "feat: add borrow and return touch pages"
```

---

## Phase P3：收尾功能

### 任务 11：首页九宫格与导航

**文件：**
- 修改：`src/views/Home.vue`
- 创建：`src/views/StockQuery.vue`
- 创建：`src/views/Export.vue`
- 创建：`src/views/Settings.vue`

- [ ] **步骤 1：实现 `Home.vue` 3×3 大按钮网格**

```vue
const entries = [
  { title: '工装借用', route: '/borrow', icon: '...' },
  { title: '工装归还', route: '/return' },
  { title: '工装台账', route: '/tools' },
  { title: '借还记录', route: '/records' },
  { title: '库存查询', route: '/stock' },
  { title: '数据导出', route: '/export' },
  { title: '台账导入', route: '/import' },
  { title: '数据备份', action: 'backup' },
  { title: '系统设置', route: '/settings' },
]
```

每个按钮 `min-height: 72px`，点击路由跳转；「数据备份」直接调 `systemApi.backupDatabase()` 并提示备份路径。

- [ ] **步骤 2：`StockQuery.vue`**

复用 `ToolList` 的表格与筛选，隐藏新增/编辑按钮（只读）。

- [ ] **步骤 3：`Export.vue`**

两个大按钮：「导出台账 Excel」「导出借还记录 Excel」。

- [ ] **步骤 4：`Settings.vue`**

展示：`C:\tooling-warehouse-db\` 各子目录路径（调 `systemApi.getPaths()`）。

- [ ] **步骤 5：Commit**

```bash
git commit -am "feat: add home grid and remaining navigation pages"
```

---

### 任务 12：借还记录查询与导出

**文件：**
- 创建：`src/views/RecordList.vue`
- 扩展：`electron/services/borrow.service.ts` 的 `listRecords`
- 扩展：`excel.service.ts` 的 `exportBorrowRecordsToExcel`

- [ ] **步骤 1：实现 `listRecords`**

筛选：keyword（tool_code/tool_name）、recordStatus、borrower、borrow_time 范围。
返回记录时附加 `is_overdue`（`displayRecordStatus` 计算，库中 `record_status` 仍为「未归还」）。

- [ ] **步骤 2：实现 `RecordList.vue`**

筛选表单 + 表格；状态列：未归还/已归还/已超期（超期用 `el-tag type=danger`）。

- [ ] **步骤 3：实现借还记录 Excel 导出**

列：记录号、工装ID、工装名称、借用人、部门、工作中心、借用时间、预计归还、归还时间、状态、归还结果。

- [ ] **步骤 4：Commit**

```bash
git commit -am "feat: add borrow record list and export"
```

---

### 任务 13：数据库备份

**文件：**
- 创建：`electron/services/backup.service.ts`
- 创建：`electron/ipc/backup.ipc.ts`

- [ ] **步骤 1：实现 `backup.service.ts`**

```ts
import fs from 'node:fs'
import path from 'node:path'
import { DB_FILE, BACKUP_DIR } from '../paths'
import { formatNow } from './time'

export function backupDatabase(): string {
  const stamp = formatNow().replace(/[:T]/g, '-').slice(0, 19)
  const dest = path.join(BACKUP_DIR, `tooling-${stamp}.db`)
  fs.copyFileSync(DB_FILE, dest)
  return dest
}
```

- [ ] **步骤 2：IPC `backup:run` + preload + `systemApi.backupDatabase`**

- [ ] **步骤 3：手动验证**

首页点备份 → `C:\tooling-warehouse-db\backup\` 出现新 db 文件。

- [ ] **步骤 4：Commit**

```bash
git commit -am "feat: add manual database backup"
```

---

### 任务 14：补全 preload API 与类型声明

**文件：**
- 修改：`electron/preload.ts`
- 创建：`src/types/window.d.ts`

- [ ] **步骤 1：在 `preload.ts` 暴露完整 `window.api`**

```ts
contextBridge.exposeInMainWorld('api', {
  tool: { list, getByCode, create, update },
  borrow: { borrow, return: returnTool, listRecords },
  importExport: { importTools, exportTools, exportRecords },
  system: { backupDatabase, getPaths },
})
```

- [ ] **步骤 2：创建 `src/types/window.d.ts`**

```ts
import type { ToolApi } from '@/api/toolApi'
// ... 声明 Window.api 类型
```

- [ ] **步骤 3：Commit**

```bash
git commit -am "feat: expose full IPC API via preload"
```

---

## Phase P4：打包与验收

### 任务 15：electron-builder 配置

**文件：**
- 创建：`electron-builder.yml`

- [ ] **步骤 1：创建 `electron-builder.yml`**

```yaml
appId: com.tooling.warehouse
productName: 工装库管理系统
directories:
  output: release
win:
  target: nsis
  icon: build/icon.ico
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
extraResources: []
```

- [ ] **步骤 2：添加应用图标 `build/icon.ico`（可用占位 256×256）**

- [ ] **步骤 3：运行打包**

运行：`npm run build`
预期：`release/` 下生成安装包

- [ ] **步骤 4：Commit**

```bash
git add electron-builder.yml build/
git commit -m "chore: add electron-builder Windows packaging"
```

---

### 任务 16：验收清单执行

- [ ] 扫码工装 ID 完成借用，台账 `status=借出, quantity=0`
- [ ] 扫码完成归还，台账 `status=在库, quantity=1`
- [ ] 同一工装不能重复借出（第二次提示不可借用）
- [ ] 预计归还时间早于当前时间时，记录列表与归还页显示「已超期」
- [ ] Excel 导入新增/更新台账
- [ ] Excel 导出台账与借还记录
- [ ] 手动备份生成带时间戳 db
- [ ] 数据目录为 `C:\tooling-warehouse-db\`
- [ ] 按钮 ≥72px、输入框 ≥56px、表格行 ≥48px
- [ ] 扫码枪（键盘+回车）在借用/归还页可用

- [ ] **最终 Commit**

```bash
git commit -am "chore: MVP acceptance verified"
```

---

## 规格覆盖度自检

| 规格章节 | 对应任务 |
|----------|----------|
| §1 MVP 范围 | 任务 7–14（页面）、任务 9（借还）、任务 8（Excel）、任务 13（备份） |
| §2 业务模型 | 任务 5（时间/超期/记录号）、任务 9（借还事务） |
| §3 两张表 | 任务 3（schema） |
| §4 部署路径 | 任务 3（paths） |
| §5 ISO 8601 | 任务 5（time.ts） |
| §6 Excel | 任务 8 |
| §7 页面导航 | 任务 11、10、7、12 |
| §8 IPC | 任务 4、6、8、9、13、14 |
| §10 验收标准 | 任务 16 |

无遗漏项。

## 执行顺序依赖

```text
任务1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16
```

任务 14 可与 11–13 并行，但必须在全部 IPC handler 完成后合并。
