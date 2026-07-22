# 自助入库表格导入预填实现计划

> **面向 AI 代理的工作者：** 使用 `executing-plans` 按任务执行；每个生产行为必须先有失败测试。

**目标：** 在自助入库页提供专用模板下载和 Excel/CSV 导入，将解析结果经用户确认后覆盖预填到清单中，不直接写数据库。

**架构：** 文件选择与 XLSX/CSV 解析放在 Electron 主进程，返回可结构化克隆的 `InboundToolItem[]`；renderer 仅负责确认覆盖和替换 Vue 状态。模板使用独立六列结构，不复用管理员的台账导入模板。

**技术栈：** Vue 3、TypeScript、Electron IPC、SheetJS `xlsx`、Element Plus、Vitest

---

### 任务 1：用测试锁定表格解析行为

**文件：**
- 创建：`tests/unit/inbound-spreadsheet.test.ts`
- 修改：`electron/services/excel.service.ts`

- [ ] 编写失败测试：调用尚未实现的 `parseInboundSpreadsheet(filePath)`，读取包含中文标准列、额外列和空行的临时 `.xlsx`，断言只返回六个字段且值已去除首尾空格。
- [ ] 编写失败测试：读取使用别名列头的临时 `.csv`，断言 `工装ID/工装名称/规格型号` 正确映射。
- [ ] 编写失败测试：无可识别列或无有效行时抛出可展示的中文错误。
- [ ] 使用 Electron Node 运行时执行：
  `$env:ELECTRON_RUN_AS_NODE='1'; .\node_modules\.bin\electron.cmd .\node_modules\vitest\vitest.mjs run tests/unit/inbound-spreadsheet.test.ts`
  预期因导出函数不存在而失败。
- [ ] 在 `excel.service.ts` 新增 `parseInboundSpreadsheet(filePath): InboundToolItem[]`：读取首个工作表，使用显示值转换字符串，映射列头，过滤空白行，遇到无有效数据时抛出中文错误。
- [ ] 重跑定向测试并确认全部通过。

### 任务 2：增加自助入库专用模板

**文件：**
- 修改：`tests/unit/inbound-spreadsheet.test.ts`
- 修改：`electron/services/excel.service.ts`

- [ ] 编写失败测试：调用尚未实现的 `writeInboundImportTemplate(outputPath?)`，读取生成的工作簿并断言表头严格为：资产编号、名称、型号、序列号、工作中心、库位。
- [ ] 验证测试因函数不存在而失败。
- [ ] 新增模板函数。生产调用默认写入 Windows 桌面；测试传入临时路径，避免污染桌面或业务数据。
- [ ] 重跑定向测试并确认通过。

### 任务 3：通过 IPC 暴露“解析”和“下载模板”

**文件：**
- 修改：`electron/ipc/importExport.ipc.ts`
- 修改：`electron/preload.ts`
- 修改：`src/api/systemApi.ts`

- [ ] 将现有文件选择辅助函数泛化为表格文件选择，过滤器支持 `xlsx/xls/csv`。
- [ ] 注册 `importExport:parseInboundSpreadsheet`，文件取消返回现有 `CANCELLED/已取消`，成功时只返回解析结果，不调用 `getDb()`。
- [ ] 注册 `importExport:downloadInboundTemplate`。
- [ ] 在 preload 的 `importExport` 对象暴露两个方法。
- [ ] 在 renderer API 包装层用 `unwrap` 返回 `InboundToolItem[]` 和模板路径。
- [ ] 运行 `vue-tsc --noEmit`，确认 IPC 类型链路完整。

### 任务 4：实现页面覆盖确认和预填

**文件：**
- 修改：`src/views/Inbound.vue`

- [ ] 新增 `importing` 状态和两个处理函数：下载模板、导入表格。
- [ ] 页头右侧增加大尺寸“下载模板”和主按钮“导入表格”；导入时显示 loading，避免重复触发。
- [ ] 解析成功后调用 `ElMessageBox.confirm`，正文包含行数和覆盖提示。
- [ ] 仅在确认回调后执行 `items.value = importedItems.map(...)`；解析失败、文件取消、确认取消均不修改 `items`。
- [ ] 成功提示“已导入 N 条，请核对后确认入库”；入库人状态保持不变。
- [ ] 运行 `npm.cmd run build:app`，确认 Vue 模板和 TypeScript 编译通过。

### 任务 5：回归验证与决策记录

**文件：**
- 修改：`docs/superpowers/specs/2026-07-22-inbound-spreadsheet-prefill-design.md`（仅在实现与规格存在必要偏差时）

- [ ] 重跑 `tests/unit/inbound-spreadsheet.test.ts`，确认解析、错误和模板测试全部通过。
- [ ] 使用 Electron Node 运行时执行完整 Vitest；记录既有登录测试失败，不将其误归因于本功能。
- [ ] 运行 `npm.cmd run build:app`，确认退出码为 0。
- [ ] 核对代码：解析 IPC 不调用数据库；管理员导入路径未改变；无数据库迁移。
- [ ] 手工验收清单：按钮位置、模板列、Excel/CSV 预填、覆盖取消、错误保留、编辑后提交。

## 计划审查结论

- 解析测试先于生产实现，符合 TDD。
- 解析与数据库写入边界明确；无需数据库迁移或回滚数据。
- 现有 `xlsx` 依赖可直接支持 Excel 和 CSV，无需新增依赖。
- 当前目录无 Git 仓库，因此计划不包含 worktree 和 commit；回滚方式为撤销本次文件差异。
