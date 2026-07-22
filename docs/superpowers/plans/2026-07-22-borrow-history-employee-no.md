# 借还历史保留与员工工号快照实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 删除工装时保留借还历史，并让新借还记录保存员工工号快照。

**架构：** 通过 SQLite 表重建迁移解除借还记录对工装台账的强外键依赖；借用入口传递员工工号，仓储层把它作为记录快照保存。查询、管理员维护和导出沿用同一字段。

**技术栈：** Vue 3、TypeScript、Electron、better-sqlite3、Vitest

---

### 任务 1：用测试锁定新行为

**文件：**
- 修改：`tests/unit/borrow.service.test.ts`
- 创建：`tests/unit/migrations.test.ts`

- [ ] 编写“借用记录保存员工工号”失败测试。
- [ ] 编写“删除工装后保留借还历史并置空 tool_id”失败测试。
- [ ] 编写“旧借还表迁移不丢记录”失败测试。
- [ ] 使用 Electron Node 运行时执行上述测试并确认因功能缺失而失败。

### 任务 2：调整数据模型和迁移

**文件：**
- 修改：`src/types/borrow.ts`
- 修改：`electron/db/schema.ts`
- 修改：`electron/db/migrations.ts`
- 修改：`electron/db/borrow.repository.ts`
- 修改：`electron/db/tool.repository.ts`

- [ ] 将 `BorrowReturnRecord.tool_id` 改为 `number | null` 并增加 `borrower_employee_no`。
- [ ] 新库结构使用可空 `tool_id`、无工装外键，并增加员工工号列。
- [ ] 旧库迁移通过临时表保留全部记录和主键。
- [ ] 删除工装时改为置空借还记录关联。
- [ ] 运行迁移与删除相关测试，确认通过。

### 任务 3：贯通借用、管理和导出

**文件：**
- 修改：`electron/services/borrow.service.ts`
- 修改：`electron/services/tool.service.ts`
- 修改：`electron/services/excel.service.ts`
- 修改：`src/views/Borrow.vue`
- 修改：`src/views/RecordList.vue`
- 修改：`src/views/admin/AdminRecordPanel.vue`

- [ ] 自助借用选择值改为员工工号，并同时提交姓名、工号和部门。
- [ ] 借用服务校验并保存员工工号。
- [ ] 管理员创建、编辑记录时支持可空员工工号。
- [ ] 普通记录页、管理员记录页及 Excel 导出展示员工工号。
- [ ] 处理历史记录 `tool_id = null` 时的管理员同步逻辑。

### 任务 4：验证与交付

**文件：**
- 验证：`tests/unit/*.test.ts`
- 验证：`src/**/*.ts`、`src/**/*.vue`、`electron/**/*.ts`

- [ ] 运行本次相关 Vitest 测试。
- [ ] 运行 `npm.cmd run build:app` 完成类型检查和前端构建。
- [ ] 运行完整测试并记录与本次无关的既有失败。
- [ ] 审查差异，确认没有修改真实业务数据库或引入新依赖。

