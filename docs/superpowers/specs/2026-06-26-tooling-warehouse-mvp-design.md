# 工装库管理单机程序 MVP 设计规格

> 基于《工装库管理单机程序产品设计文档》审核结论与用户确认（2026-06-26）整理。
> 状态：已批准（2026-06-26）

## 1. 目标与范围

### 1.1 目标

在 Windows 触屏一体机上部署单机版工装库管理程序，通过扫码枪扫描工装数字 ID，完成借用、归还、台账维护与记录追溯。不依赖网络。

### 1.2 MVP 范围

| 包含 | 不包含（后期） |
|------|----------------|
| 首页入口（全部卡片先展示，不做鉴权） | 管理员登录 / 按角色显示卡片 |
| 工装台账 CRUD、Excel 导入导出 | 台账停用/报废、二维码标签打印 |
| 扫码借用 / 扫码归还（仅正常归还） | 损坏归还、转维修、维修状态流转 |
| 借还记录查询与导出 | 自动备份、超期提醒弹窗、操作日志表 |
| 工装状态自动变化 | 开机自启、全屏锁定 |
| SQLite 本地库、手动备份 | 数据库恢复（restore） |
| 触屏大按钮 UI | 停用 / 报废 / 维修相关复杂规则 |

## 2. 核心业务模型

### 2.1 一物一码

- 每件实物对应台账中**唯一一条记录**，`tool_code` 为唯一工装 ID（纯数字字符串，即二维码内容）。
- **同一型号**可有多件实物：通过相同的 `tool_category`、`specification` 等字段表达，但 `tool_code` 各不相同。
- 每件默认 `quantity = 1`。借用时**扣减**（`quantity → 0`），归还时**回补**（`quantity → 1`）。`status` 与 `quantity` 同步维护。

### 2.2 状态（MVP 简化）

**台账状态 `tool_account.status`（MVP 仅用）：**

| 状态 | 含义 | 可借用 |
|------|------|--------|
| 在库 | 在库且 quantity = 1 | 是 |
| 借出 | 已借出且 quantity = 0 | 否 |

> 维修、报废、停用等状态枚举保留在文档中供后期扩展，MVP 不实现相关流转与校验。

**借还记录状态 `borrow_return_record.record_status`：**

| 状态 | 含义 |
|------|------|
| 未归还 | 借用已确认，尚未归还 |
| 已归还 | 归还完成 |
| 已超期 | 未归还且 `expected_return_time < 当前时间`（展示/筛选用，不自动改库） |

超期判定：`expected_return_time` 与当前时间（ISO 8601）比较，仅用于 UI 展示与记录筛选，**不触发后台定时任务**。

### 2.3 字段语义

| 字段 | 说明 |
|------|------|
| `tool_code` | 工装唯一 ID，纯数字，二维码扫描内容 |
| `qr_content` | MVP 与 `tool_code` 相同 |
| `work_center` | 台账归属工作中心 |
| `use_work_center` | 借用时实际使用的工作中心 |
| `operator_name` | 由**借用人**填写，写入借还记录（与 `borrower` 同源） |
| `quantity` | 当前可借数量，MVP 仅 0 或 1 |

### 2.4 借用规则

1. 扫码得到 `tool_code`，查询 `tool_account`。
2. 不存在 → 提示「工装不存在」。
3. `status !== '在库'` 或 `quantity !== 1` → 提示不可借用。
4. 填写：借用人、借用部门、使用工作中心、预计归还时间、备注（可选）。
5. 事务内：
   - 插入 `borrow_return_record`（`record_status = '未归还'`）
   - 更新 `tool_account`：`status = '借出'`，`quantity = 0`，写入当前借用信息字段
6. `operator_name` = 借用人姓名。

### 2.5 归还规则（MVP 仅正常归还）

1. 扫码得到 `tool_code`，查询该工装 `record_status = '未归还'` 的记录。
2. 不存在 → 提示「不需要归还或记录异常」。
3. 展示借用信息与是否超期（时间比较）。
4. 确认归还（MVP 无损坏/维修选项）。
5. 事务内：
   - 更新记录：`record_status = '已归还'`，`return_time`，`return_result = '正常归还'`
   - 更新台账：`status = '在库'`，`quantity = 1`，清空当前借用信息字段

### 2.6 记录号

`record_no` 格式：`BR` + `YYYYMMDD` + 4 位当日序号（如 `BR202606260001`），当日递增。

## 3. 数据设计（仅两张表）

### 3.1 tool_account

```sql
CREATE TABLE IF NOT EXISTS tool_account (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tool_code TEXT NOT NULL UNIQUE,
  tool_name TEXT NOT NULL,
  tool_category TEXT,
  specification TEXT,
  work_center TEXT,
  location_code TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit TEXT DEFAULT '件',
  status TEXT NOT NULL DEFAULT '在库',
  current_borrower TEXT,
  current_borrow_department TEXT,
  current_use_work_center TEXT,
  current_borrow_time TEXT,
  expected_return_time TEXT,
  qr_content TEXT,
  remark TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_account_code ON tool_account(tool_code);
CREATE INDEX IF NOT EXISTS idx_tool_account_status ON tool_account(status);
CREATE INDEX IF NOT EXISTS idx_tool_account_name ON tool_account(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_account_spec ON tool_account(specification);
```

初始化：`PRAGMA foreign_keys = ON`。

### 3.2 borrow_return_record

```sql
CREATE TABLE IF NOT EXISTS borrow_return_record (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_no TEXT NOT NULL UNIQUE,
  tool_id INTEGER NOT NULL,
  tool_code TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  record_status TEXT NOT NULL,
  borrower TEXT,
  borrow_department TEXT,
  use_work_center TEXT,
  borrow_time TEXT,
  expected_return_time TEXT,
  return_time TEXT,
  return_result TEXT,
  operator_name TEXT,
  remark TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tool_id) REFERENCES tool_account(id)
);

CREATE INDEX IF NOT EXISTS idx_borrow_record_tool_code ON borrow_return_record(tool_code);
CREATE INDEX IF NOT EXISTS idx_borrow_record_status ON borrow_return_record(record_status);
CREATE INDEX IF NOT EXISTS idx_borrow_record_borrower ON borrow_return_record(borrower);
CREATE INDEX IF NOT EXISTS idx_borrow_record_borrow_time ON borrow_return_record(borrow_time);
```

约束：同一 `tool_id` 在 MVP 中不允许存在多条 `record_status = '未归还'` 记录（借用前校验 + 唯一业务逻辑）。

## 4. 部署与路径

```text
数据根目录：C:\tooling-warehouse-db\
数据库文件：C:\tooling-warehouse-db\data\tooling.db
备份目录：  C:\tooling-warehouse-db\backup\
导出目录：  C:\tooling-warehouse-db\export\
日志目录：  C:\tooling-warehouse-db\logs\
```

- 首次启动自动创建上述目录。
- 不以管理员身份运行；Operator 对 `C:\tooling-warehouse-db\` 需有读写权限。
- 程序安装目录可与数据目录分离（electron-builder 默认安装位置即可）。

## 5. 时间格式

所有时间字段统一 **ISO 8601 本地时间字符串**：`2026-06-26T14:30:00`（不含时区后缀）。

## 6. Excel 导入导出

### 6.1 导入

- 按 Excel 行数据填充/创建台账记录。
- 列与字段映射（建议模板）：

| Excel 列 | 字段 | 必填 |
|----------|------|------|
| 工装ID | tool_code | 是 |
| 工装名称 | tool_name | 是 |
| 工装种类 | tool_category | 否 |
| 规格型号 | specification | 否 |
| 所属工作中心 | work_center | 否 |
| 库位 | location_code | 否 |
| 数量 | quantity | 否，默认 1 |
| 单位 | unit | 否，默认 件 |
| 备注 | remark | 否 |

- `tool_code` 已存在：**更新**该行对应字段（保留 id，刷新 `updated_at`）。
- `tool_code` 不存在：**新增**，`status = '在库'`，`qr_content = tool_code`。
- 导入结果返回：成功数、失败数、失败行及原因。

### 6.2 导出

- 台账导出：当前查询结果或全量。
- 借还记录导出：按筛选条件。

## 7. 页面与导航（MVP）

首页 9 宫格全部保留入口；**后期通过鉴权控制可见卡片**，MVP 不做隐藏。

| 入口 | MVP 行为 |
|------|----------|
| 工装借用 | 完整实现 |
| 工装归还 | 完整实现（仅正常归还） |
| 工装台账 | 完整实现 |
| 借还记录 | 完整实现 |
| 库存查询 | 台账只读列表，按状态/关键字筛选 |
| 数据导出 | 跳转或弹窗选择导出类型 |
| 台账导入 | Excel 导入 |
| 数据备份 | 手动备份 db 文件 |
| 系统设置 | 占位页，展示数据路径信息即可 |

触屏规范（沿用原文档）：

- 主按钮高度 ≥ 72px
- 输入框高度 ≥ 56px
- 表格行高 ≥ 48px
- 借用/归还页扫码框自动聚焦
- 不依赖鼠标悬停

## 8. 技术架构

```text
Vue 3 + TypeScript + Vite + Element Plus（触屏定制）
  ↓ window.api / IPC
Electron preload
  ↓ ipcMain
主进程 Service 层（tool / borrow / importExport / backup）
  ↓ better-sqlite3（PRAGMA foreign_keys = ON）
C:\tooling-warehouse-db\data\tooling.db
```

### IPC 接口（MVP）

```ts
// 台账
getToolList(params)
getToolByCode(toolCode)
createTool(data)
updateTool(id, data)
// 借还
borrowTool({ toolCode, borrower, borrowDepartment, useWorkCenter, expectedReturnTime, remark })
returnTool({ toolCode, remark })
getBorrowReturnRecords(params)

// 导入导出与备份
importToolAccountFromExcel(filePath)
exportToolAccountToExcel(params)
exportBorrowRecordsToExcel(params)
backupDatabase()
```

`borrowTool` 内部将 `operator_name` 设为 `borrower`。`returnTool` MVP 固定 `return_result = '正常归还'`。

## 9. 开发阶段安排

| 阶段 | 内容 | 预估 |
|------|------|------|
| **P0 脚手架** | Electron+Vue 初始化、better-sqlite3 编译、IPC 骨架、建表、目录自动创建 | 3–4 天 |
| **P1 台账** | CRUD、列表筛选、Excel 导入导出、触屏基础组件 | 5–6 天 |
| **P2 借还** | 借用/归还事务、record_no 生成、超期展示、Borrow/Return 页 | 5–6 天 |
| **P3 收尾** | 借还记录查询导出、备份、库存查询、首页导航、设置占位 | 4–5 天 |
| **P4 联调** | 扫码枪实机、打包安装、路径权限验证 | 2–3 天 |

推荐按 P0→P4 纵向切片交付，每阶段可演示。

## 10. 验收标准（MVP）

- [ ] 扫码工装 ID 可完成借用，台账 status/quantity 正确
- [ ] 扫码可完成归还，记录与台账恢复在库
- [ ] 同一工装不能重复借出
- [ ] 超期记录在列表/归还页正确标识
- [ ] Excel 导入可新增/更新台账
- [ ] Excel 可导出台账与借还记录
- [ ] 手动备份生成带时间戳的 db 副本
- [ ] 数据写入 `C:\tooling-warehouse-db\`
- [ ] 触屏尺寸符合规范

## 11. 后期扩展（不在 MVP）

- 鉴权与首页卡片按角色显示
- 停用 / 报废 / 维修 / 损坏归还状态机
- system_config、operation_log、operator_user 表
- 二维码打印、自动备份、超期提醒、restoreDatabase
- D 盘路径可配置化
