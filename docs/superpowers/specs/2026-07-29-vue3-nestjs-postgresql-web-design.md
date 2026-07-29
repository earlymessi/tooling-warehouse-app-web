# 工装库管理系统 Web 化技术设计规格

| 属性 | 内容 |
|---|---|
| 文档版本 | 1.0 |
| 日期 | 2026-07-29 |
| 状态 | 实现前评审稿 |
| 目标技术栈 | Vue 3 + NestJS + PostgreSQL |
| 关联实现计划 | `Vue3-NestJS-PostgreSQL开发方案.md` |
| 适用范围 | 工装台账、员工、借用、归还、自助入库、导入导出、权限与审计 |

## 1. 背景

当前系统是 Windows 单机 Electron 应用：

```text
Vue 3 → preload/window.api → Electron IPC → TypeScript Service
       → better-sqlite3 → C:\tooling-warehouse-db\data\tooling.db
```

它适合单机使用，但不适合公司内网多人并发访问，主要限制是：

1. 业务服务与 Electron 主进程绑定，普通浏览器不能调用。
2. SQLite 是单文件本地数据库，无法作为多应用实例的生产主库。
3. 当前登录仅验证本地管理员，前端用 `sessionStorage` 保存身份，没有服务端会话和接口级授权。
4. 当前密码使用固定前缀 SHA-256，不能满足生产密码存储要求。
5. Electron 文件选择、打开目录、切换输入法和本地数据库备份等能力无法直接迁移到浏览器。
6. 现有借还事务在单进程 SQLite 中可工作，但不能直接证明多人并发下不会双借或重复写入。

本次改造保留现有 Vue 页面和业务语义，将业务逻辑迁移到 NestJS，通过 RESTful API 访问 PostgreSQL。

## 2. 目标与非目标

### 2.1 目标

系统必须实现：

- 公司内网浏览器访问，不再要求客户端安装 exe。
- Vue 3 前端和 NestJS 后端通过版本化 HTTP API 通信。
- PostgreSQL 成为生产唯一可写业务库。
- 原 SQLite 文件不删除、不修改，以只读方式复制业务数据到 PostgreSQL。
- 支持工装查询、维护、借用、归还、自助入库、员工维护和 Excel 导入导出。
- 每个受保护接口执行服务端身份和权限校验。
- 并发借用同一工装时只允许一个请求成功。
- 重复扫码或重复提交不能产生重复业务记录。
- 登录、借还、入库、导入、管理写操作产生可查询审计记录。
- 支持健康检查、结构化日志、备份恢复和应用回滚。
- 首版不依赖 Docker；代码稳定后可以制作容器交付物。

### 2.2 非目标

以下内容不进入首版：

- 不设计新的页面视觉风格。
- 不改变现有工装编号、借还编号和入库编号的业务含义。
- 不增加审批流、消息通知、知识库或移动 App。
- 不实施 SQLite 与 PostgreSQL 长期双写。
- 不让前端直接连接 PostgreSQL。
- 不在首版引入微服务、消息队列、Redis 或 Kubernetes。
- 不把旧管理员密码哈希直接作为新系统有效凭据。
- 不由应用提供 PostgreSQL 数据库文件下载；数据库备份由 DBA 或运维平台负责。

## 3. 已确认设计决策

### 3.1 架构决策

采用“代码前后端分离、生产同源访问”：

```text
浏览器
   │ HTTPS
   ▼
Nginx / 公司网关
   ├─ /               → Vue 3 静态文件
   └─ /api/v1/*       → NestJS 127.0.0.1:3000
                              │
                              ▼
                        PostgreSQL
```

代码分离使前后端可以独立测试和发布；同一域名减少 CORS、Cookie、证书和 CSRF 配置复杂度。

### 3.2 技术决策

| 层 | 选择 | 理由 |
|---|---|---|
| 前端 | Vue 3 + TypeScript + Vite + Element Plus | 保留现有页面与类型 |
| 后端 | NestJS | 与现有 TypeScript 技术栈一致，模块、Guard、Pipe、Interceptor 边界清晰 |
| API | RESTful JSON + OpenAPI | 浏览器和运维工具易于调用与验收 |
| 数据库 | PostgreSQL | 支持事务、行锁、约束、索引和集中备份 |
| 数据访问 | Prisma + 受控参数化 SQL | 普通 CRUD 类型安全；关键并发 SQL 保持可审计 |
| 登录 | 服务端会话 Cookie | 便于撤销会话，避免浏览器存储认证令牌 |
| 密码 | Argon2id | 替代快速 SHA-256 |
| 数据库迁移 | Prisma Migrate + 人工审查 SQL | Schema 可版本化，特殊索引用原生 SQL |
| 测试 | Vitest + Jest + Supertest | 前端沿用 Vitest，后端使用 NestJS 常用测试体系 |
| 首次部署 | Nginx + Node.js 服务进程 | 不让 Docker 阻塞开发和首次上线 |

## 4. 系统边界与组件

### 4.1 Vue 前端

职责：

- 页面渲染和触屏交互。
- 扫码输入、表单校验和友好错误提示。
- 调用 `/api/v1`。
- 根据当前用户权限控制菜单展示。
- 上传 Excel、接收文件下载。

不得承担：

- 密码校验。
- 最终权限判定。
- 数据库连接。
- 借还并发判定。
- 记录号、入库号的最终生成。
- 信任客户端传入的员工姓名、部门或操作人身份。

### 4.2 NestJS API

职责：

- HTTP 输入校验和统一响应。
- 身份认证、会话、CSRF 和权限校验。
- 工装、员工、借还、入库和导入导出业务规则。
- PostgreSQL 事务和幂等控制。
- 审计日志和结构化运行日志。
- 健康检查和 OpenAPI 文档。

NestJS 按业务能力分模块：

```text
AuthModule
ToolsModule
EmployeesModule
BorrowModule
InboundModule
ImportExportModule
AuditModule
HealthModule
DatabaseModule
```

模块间只通过公开 Service 接口协作，不跨模块直接操作对方 Repository 或数据库表。

### 4.3 PostgreSQL

职责：

- 保存生产业务数据。
- 使用唯一约束、检查约束和外键兜底数据完整性。
- 使用事务和条件更新保证并发正确性。
- 保存会话、幂等请求和审计日志。

PostgreSQL 端口只允许应用服务器和 DBA 管理网段访问。

### 4.4 SQLite 迁移工具

职责：

- 以只读方式打开原 SQLite。
- 审计 Schema、行数、最大 ID、状态和完整性。
- 复制数据到空的 PostgreSQL 目标库。
- 重置 PostgreSQL identity sequence。
- 输出可复核的 JSON 迁移报告。

迁移工具不被 NestJS API 引用，也不进入生产运行包。

## 5. 身份模型

### 5.1 两类身份

系统区分：

1. **系统身份**：当前登录账号或触屏终端，用于接口授权和安全审计。
2. **业务参与人**：实际借用工装的员工，用员工工号标识。

自助终端使用独立 `KIOSK` 账号登录。员工借用时，前端只提交员工工号，后端从 `employee` 表读取姓名和部门，不能信任客户端提交的员工姓名和部门。

审计日志同时记录：

- `session_user_id`：执行请求的账号或终端。
- `business_actor_employee_no`：实际借用人。
- `request_id`：请求追踪 ID。

### 5.2 角色

| 角色 | 说明 |
|---|---|
| `KIOSK` | 触屏终端，只能查询必要数据并执行借用、归还 |
| `OPERATOR` | 库管员，维护台账、员工和入库，执行导入导出 |
| `AUDITOR` | 只读查询记录、导出和查看审计日志 |
| `ADMIN` | 管理账号、角色和权限 |

### 5.3 权限点

| 权限 | 说明 |
|---|---|
| `tool:read` | 查询工装 |
| `tool:write` | 新增和修改工装 |
| `tool:delete` | 删除符合条件的工装 |
| `borrow:operate` | 借用和归还 |
| `borrow:read` | 查询借还记录 |
| `borrow:manage` | 管理员维护借还记录 |
| `inbound:write` | 自助或批量入库 |
| `employee:read` | 查询完整员工列表和部门 |
| `employee:write` | 维护和导入员工 |
| `export:read` | 导出业务数据 |
| `audit:read` | 查询审计日志 |
| `system:manage` | 管理账号、角色和权限 |

默认权限矩阵：

| 权限 | KIOSK | OPERATOR | AUDITOR | ADMIN |
|---|:---:|:---:|:---:|:---:|
| `tool:read` | ✓ | ✓ | ✓ | ✓ |
| `tool:write` |  | ✓ |  | ✓ |
| `tool:delete` |  | ✓ |  | ✓ |
| `borrow:operate` | ✓ | ✓ |  | ✓ |
| `borrow:read` | 受限 | ✓ | ✓ | ✓ |
| `borrow:manage` |  | ✓ |  | ✓ |
| `inbound:write` |  | ✓ |  | ✓ |
| `employee:read` |  | ✓ | ✓ | ✓ |
| `employee:write` |  | ✓ |  | ✓ |
| `export:read` |  | ✓ | ✓ | ✓ |
| `audit:read` |  |  | ✓ | ✓ |
| `system:manage` |  |  |  | ✓ |

“受限”表示 KIOSK 只能查询完成当前归还操作所需的未归还记录，不允许浏览完整借还历史。KIOSK 通过专用员工检索接口选择借用人，该接口要求 `borrow:operate`，最多返回 20 条，只包含工号、姓名和部门。

## 6. 会话与登录安全

### 6.1 登录流程

```text
浏览器 → POST /auth/login
       → 账号锁定检查
       → Argon2id 验证
       → 创建服务端 Session
       → 返回 HttpOnly Cookie
       → 写入登录审计
```

会话 Cookie：

```text
Name: __Host-tooling_session
HttpOnly: true
Secure: true
SameSite: Strict
Path: /
Domain: 不设置
```

### 6.2 会话规则

- 无操作 30 分钟过期。
- 绝对存活时间 8 小时。
- 登录成功后生成新 Session ID。
- 登出、账号停用、密码修改和角色变更后撤销相关会话。
- Session ID 只保存在 Cookie；数据库保存其哈希，不保存明文。
- 写请求必须携带与 Session 绑定的 CSRF Token。
- 首版 Session 存 PostgreSQL；只有部署多个 API 实例时才允许切换到公司 Redis。

### 6.3 登录保护

- 本地密码使用 Argon2id。
- 连续 5 次登录失败后锁定 15 分钟。
- 限流维度为账号和来源 IP。
- 登录失败统一返回 `AUTH_INVALID_CREDENTIALS`。
- 日志不得记录密码、Cookie、CSRF Token 和数据库连接串。
- 生产环境不存在固定默认密码。

### 6.4 旧管理员

原 SQLite `admin_user` 使用固定前缀 SHA-256。处理方式：

- 原表随 SQLite 文件永久保留。
- 迁移报告记录用户名、显示名称和行数。
- 旧 `password_hash` 不写入新系统有效认证字段。
- 新系统创建独立管理员账号并设置 Argon2id 密码。
- 首次登录强制修改初始密码。

## 7. API 契约

### 7.1 通用约定

- 基础路径：`/api/v1`。
- JSON 字段使用 `camelCase`。
- 数据库列使用 `snake_case`。
- 时间使用 ISO 8601，带时区。
- 业务时区为 `Asia/Shanghai`。
- 默认分页：`page=1&pageSize=20`。
- `pageSize` 最大为 200。
- 写接口接受 `Idempotency-Key`；借用和归还必须携带。
- 响应包含 `requestId`。

成功：

```json
{
  "ok": true,
  "data": {},
  "requestId": "01J43YH5Q8A2P8QZB7H5JYJ0HB"
}
```

失败：

```json
{
  "ok": false,
  "code": "TOOL_NOT_AVAILABLE",
  "message": "当前状态不可借用",
  "details": [],
  "requestId": "01J43YH5Q8A2P8QZB7H5JYJ0HB"
}
```

生产响应不包含堆栈、SQL、磁盘路径和内部类名。

### 7.2 认证接口

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/auth/login` | 登录 |
| `POST` | `/auth/logout` | 登出 |
| `GET` | `/auth/me` | 当前用户、角色和权限 |
| `GET` | `/auth/csrf` | 获取当前会话 CSRF Token |

登录请求：

```json
{
  "username": "warehouse.operator",
  "password": "用户输入的密码"
}
```

`/auth/me` 响应：

```json
{
  "ok": true,
  "data": {
    "id": "12",
    "username": "warehouse.operator",
    "displayName": "库管员",
    "roles": ["OPERATOR"],
    "permissions": [
      "tool:read",
      "tool:write",
      "borrow:operate",
      "borrow:read",
      "inbound:write"
    ]
  },
  "requestId": "01J43YH5Q8A2P8QZB7H5JYJ0HB"
}
```

### 7.3 工装接口

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| `GET` | `/tools` | `tool:read` | 分页查询 |
| `GET` | `/tools/:id` | `tool:read` | 按 ID 查询 |
| `GET` | `/tools/by-code/:toolCode` | `tool:read` | 扫码查询 |
| `POST` | `/tools` | `tool:write` | 新建 |
| `PATCH` | `/tools/:id` | `tool:write` | 修改 |
| `DELETE` | `/tools/:id` | `tool:delete` | 删除 |
| `POST` | `/tools/next-codes` | `tool:write` | 生成下一批编号 |

新建工装请求：

```json
{
  "toolCode": "10058",
  "toolName": "测试夹具",
  "specification": "A-01",
  "serialNo": "SN-10058",
  "workCenter": "LG-FT",
  "locationCode": "A-01-01",
  "unit": "件",
  "remark": ""
}
```

服务端固定：

- 新建普通工装初始状态为 `在库`。
- 初始数量为 `1`。
- `qrContent` 默认为 `toolCode`。
- 借用相关字段为空。
- 删除借出中的工装返回 `409 TOOL_BORROWED`。
- 删除工装不会删除借还和入库历史，历史表的 `tool_id` 变为空，快照字段保留。
- `/tools/next-codes` 从数据库计数器原子分配编号；已分配编号不回收，允许因用户取消出现空号。

### 7.4 借用接口

`POST /borrow/borrow`

Header：

```text
Idempotency-Key: 01J43YJH1AZHRQTKAXCHBPKS56
X-CSRF-Token: 当前会话令牌
```

请求：

```json
{
  "toolCode": "10058",
  "borrowerEmployeeNo": "E00123",
  "expectedReturnTime": "2026-08-05T17:00:00+08:00",
  "remark": ""
}
```

后端行为：

1. 按 `toolCode` 查询工装。
2. 按 `borrowerEmployeeNo` 查询员工。
3. 姓名和部门从员工表读取。
4. 验证工装 `status=在库` 且 `quantity=1`。
5. 在单个事务内更新工装、创建未归还记录、保存幂等结果和审计日志。
6. 返回借还记录快照。

客户端不得提交最终借用人姓名和部门，避免冒充或篡改。

### 7.5 归还接口

`POST /borrow/return`

请求：

```json
{
  "toolCode": "10058",
  "remark": ""
}
```

后端行为：

1. 锁定工装。
2. 找到该工装唯一的 `未归还` 记录。
3. 把借还记录改为 `已归还`，写入归还时间和 `正常归还`。
4. 把工装改为 `在库`、`quantity=1`，清空当前借用字段。
5. 写入审计和幂等结果。

没有未归还记录时返回 `409 NO_OPEN_RECORD`。

### 7.6 借还记录接口

| 方法 | 路径 | 权限 |
|---|---|---|
| `GET` | `/borrow/records` | `borrow:read` |
| `GET` | `/borrow/records/:id` | `borrow:read` |
| `POST` | `/borrow/records` | `borrow:manage` |
| `PATCH` | `/borrow/records/:id` | `borrow:manage` |
| `DELETE` | `/borrow/records/:id` | `borrow:manage` |

持久化状态只有：

- `未归还`
- `已归还`

`已超期` 是查询时根据 `expected_return_time` 计算的展示状态，不写入数据库。

管理员维护借还记录时，必须在同一事务中重新同步工装状态和当前借用快照，不能只修改历史表。

### 7.7 自助入库接口

`POST /inbound/batch`

请求：

```json
{
  "items": [
    {
      "toolCode": "10059",
      "toolName": "定位夹具",
      "specification": "B-02",
      "serialNo": "SN-10059",
      "workCenter": "LG-FT",
      "locationCode": "B-01-01"
    }
  ],
  "remark": ""
}
```

操作人从当前 Session 获取，不接受客户端传入 `operatorName`。

规则：

- 每批 1～200 条。
- 在写入前完成整批字段、重复编号和数据库冲突校验。
- 任意一行错误时整批不写入。
- 成功时为整批生成同一个 `inboundNo`。
- 每件工装创建台账和入库历史。
- 每件工装初始 `status=在库`、`quantity=1`、`unit=件`。

成功响应：

```json
{
  "ok": true,
  "data": {
    "inboundNo": "IN202607290001",
    "count": 1,
    "labelsDownloadUrl": "/api/v1/inbound/IN202607290001/labels"
  },
  "requestId": "01J43YH5Q8A2P8QZB7H5JYJ0HB"
}
```

浏览器通过下载接口获取标签文件，不接收服务器本地路径。

### 7.8 员工接口

| 方法 | 路径 | 权限 |
|---|---|---|
| `GET` | `/employees/lookup` | `borrow:operate` |
| `GET` | `/employees` | `employee:read` |
| `GET` | `/employees/:id` | `employee:read` |
| `GET` | `/employees/departments` | `employee:read` |
| `POST` | `/employees` | `employee:write` |
| `PATCH` | `/employees/:id` | `employee:write` |
| `DELETE` | `/employees/:id` | `employee:write` |

员工工号全局唯一。`/employees/lookup?keyword=` 最多返回 20 条，只返回借用所需的工号、姓名和部门。修改员工不会改写已有借还历史中的姓名、工号和部门快照。

### 7.9 导入导出接口

| 方法 | 路径 | 语义 |
|---|---|---|
| `POST` | `/imports/tools` | 按工装编号逐行新增或更新 |
| `POST` | `/imports/employees` | 按员工工号逐行新增或更新 |
| `POST` | `/imports/inbound/parse` | 解析自助入库预填文件，不写库 |
| `GET` | `/exports/tools` | 下载工装台账 |
| `GET` | `/exports/borrow-records` | 下载借还记录 |
| `GET` | `/exports/employees` | 下载员工 |
| `GET` | `/templates/tools` | 下载工装模板 |
| `GET` | `/templates/employees` | 下载员工模板 |
| `GET` | `/templates/inbound` | 下载入库模板 |

导入语义保持现有行为：

- 工装导入按 `toolCode` upsert。
- 工装编号为空但名称有效时，按现有编号规则批量顺延生成。
- 导入行有借用人时，同步创建或更新未归还记录和工装借用状态。
- 工装导入新建台账时同步创建“管理员导入”入库历史。
- 员工导入按 `employeeNo` upsert。
- 普通导入允许逐行成功，响应包含成功数、失败数和逐行错误。
- 自助入库 `/inbound/batch` 保持整批原子性，不使用逐行成功语义。

上传限制：

- 文件最大 10 MB。
- 只接受 `.xlsx`、`.xls`、`.csv`。
- 同时校验扩展名、MIME、工作表存在性、列名、行数和字段长度。
- 临时文件在请求结束后删除。
- 导出通过 HTTP 流返回，不在响应中暴露服务器路径。

## 8. 数据模型

数据库字段使用 `snake_case`。所有业务时间列使用 `TIMESTAMPTZ`，数据库会话时区使用 UTC，API 按 ISO 8601 输出，页面按 `Asia/Shanghai` 显示。

### 8.1 `tool_account`

| 字段 | PostgreSQL 类型 | 约束 |
|---|---|---|
| `id` | `BIGINT GENERATED BY DEFAULT AS IDENTITY` | 主键 |
| `tool_code` | `VARCHAR(64)` | 非空、唯一 |
| `tool_name` | `VARCHAR(200)` | 非空 |
| `specification` | `VARCHAR(500)` | 可空 |
| `serial_no` | `VARCHAR(200)` | 可空 |
| `work_center` | `VARCHAR(64)` | 可空 |
| `location_code` | `VARCHAR(64)` | 可空 |
| `quantity` | `INTEGER` | 非空，只允许 0 或 1 |
| `unit` | `VARCHAR(32)` | 非空，默认“件” |
| `status` | `VARCHAR(16)` | 非空，只允许“在库”“借出” |
| `current_borrower` | `VARCHAR(100)` | 可空 |
| `current_borrow_department` | `VARCHAR(100)` | 可空 |
| `current_borrow_time` | `TIMESTAMPTZ` | 可空 |
| `expected_return_time` | `TIMESTAMPTZ` | 可空 |
| `qr_content` | `VARCHAR(256)` | 可空 |
| `remark` | `VARCHAR(1000)` | 可空 |
| `created_at` | `TIMESTAMPTZ` | 非空 |
| `updated_at` | `TIMESTAMPTZ` | 非空 |

状态—数量不变量：

```sql
CHECK (
  (status = '在库' AND quantity = 1)
  OR
  (status = '借出' AND quantity = 0)
)
```

借用快照不变量：

- `status=在库` 时当前借用人、部门、借用时间和预计归还时间必须为空。
- `status=借出` 时当前借用人、借用时间和预计归还时间必须非空。

### 8.2 `borrow_return_record`

| 字段 | PostgreSQL 类型 | 约束 |
|---|---|---|
| `id` | `BIGINT GENERATED BY DEFAULT AS IDENTITY` | 主键 |
| `record_no` | `VARCHAR(64)` | 非空、唯一 |
| `tool_id` | `BIGINT` | 可空，删除工装时置空 |
| `tool_code` | `VARCHAR(64)` | 非空、历史快照 |
| `tool_name` | `VARCHAR(200)` | 非空、历史快照 |
| `record_status` | `VARCHAR(16)` | “未归还”或“已归还” |
| `borrower` | `VARCHAR(100)` | 可空 |
| `borrower_employee_no` | `VARCHAR(64)` | 可空 |
| `borrow_department` | `VARCHAR(100)` | 可空 |
| `borrow_time` | `TIMESTAMPTZ` | 可空 |
| `expected_return_time` | `TIMESTAMPTZ` | 可空 |
| `return_time` | `TIMESTAMPTZ` | 可空 |
| `return_result` | `VARCHAR(100)` | 可空 |
| `operator_name` | `VARCHAR(100)` | 可空 |
| `remark` | `VARCHAR(1000)` | 可空 |
| `created_at` | `TIMESTAMPTZ` | 非空 |
| `updated_at` | `TIMESTAMPTZ` | 非空 |

每件工装最多一条未归还记录：

```sql
CREATE UNIQUE INDEX uq_borrow_open_tool
ON borrow_return_record (tool_id)
WHERE record_status = '未归还' AND tool_id IS NOT NULL;
```

### 8.3 `tool_inbound_record`

`inbound_no` 不唯一，因为同一批次中的多件工装共享入库单号。`tool_id` 可空，其他工装信息作为历史快照保留。

主要索引：

- `inbound_no`
- `tool_code`
- `inbound_time`

### 8.4 `employee`

| 字段 | 类型 | 约束 |
|---|---|---|
| `id` | `BIGINT GENERATED BY DEFAULT AS IDENTITY` | 主键 |
| `employee_no` | `VARCHAR(64)` | 非空、唯一 |
| `employee_name` | `VARCHAR(100)` | 非空 |
| `department` | `VARCHAR(100)` | 非空 |
| `created_at` | `TIMESTAMPTZ` | 非空 |
| `updated_at` | `TIMESTAMPTZ` | 非空 |

### 8.5 安全与运行表

| 表 | 用途 |
|---|---|
| `app_user` | 用户名、显示名、密码哈希、认证来源、启停状态 |
| `app_role` | 角色 |
| `app_permission` | 权限点 |
| `app_user_role` | 用户角色 |
| `app_role_permission` | 角色权限 |
| `app_session` | 会话哈希、CSRF 哈希、过期和撤销时间 |
| `idempotency_request` | 幂等键、请求指纹、执行状态、响应快照 |
| `audit_log` | 操作人、业务参与人、动作、资源、结果、请求 ID |
| `migration_run` | 迁移批次、源文件哈希、行数、校验和结果 |
| `business_sequence` | 原子生成工装编号、借还编号和入库编号 |

### 8.6 ID 的 API 表示

数据库使用 `BIGINT`，API 把 ID 序列化为十进制字符串，避免 JavaScript 安全整数上限问题。Vue 类型中的 `id` 和 `toolId` 在 HTTP 改造时统一变为 `string`；业务编号继续使用字符串。

## 9. 状态机

### 9.1 工装

```text
在库(quantity=1)
   │ borrow
   ▼
借出(quantity=0)
   │ return
   ▼
在库(quantity=1)
```

禁止状态：

- 在库但 `quantity=0`。
- 借出但 `quantity=1`。
- 在库但存在未归还记录。
- 借出但不存在未归还记录。

### 9.2 借还记录

```text
未归还 ── return ──> 已归还
```

`已超期` 是展示状态：

```text
record_status = 未归还
AND expected_return_time < 当前时间
```

它不能通过管理员直接写入数据库。

### 9.3 自助入库

```text
草稿/表格预填
  → 整批校验
  → 事务创建台账与入库历史
  → 生成标签下载
```

校验失败时停留在前端编辑状态，数据库无新增。

## 10. 事务与并发

### 10.1 借用事务

锁顺序固定为：

1. 工装。
2. 未归还记录约束。
3. 幂等记录。
4. 审计记录。

核心更新使用条件 SQL：

```sql
UPDATE tool_account
SET status = '借出',
    quantity = 0,
    current_borrower = $1,
    current_borrow_department = $2,
    current_borrow_time = $3,
    expected_return_time = $4,
    updated_at = $3
WHERE id = $5
  AND status = '在库'
  AND quantity = 1
RETURNING id;
```

返回零行时响应 `409 TOOL_NOT_AVAILABLE`。成功后在同一事务插入未归还记录。

### 10.2 归还事务

归还先锁工装，再把未归还记录条件更新为已归还：

```sql
UPDATE borrow_return_record
SET record_status = '已归还',
    return_time = $1,
    return_result = '正常归还',
    updated_at = $1
WHERE tool_id = $2
  AND record_status = '未归还'
RETURNING id;
```

返回零行时响应 `409 NO_OPEN_RECORD`。成功后在同一事务把工装恢复为在库。

### 10.3 幂等

借用、归还、批量入库和管理写操作接受 `Idempotency-Key`：

- 唯一范围：`用户/终端 + 接口 + Idempotency-Key`。
- 同一个 Key、相同请求体：返回首次响应。
- 同一个 Key、不同请求体：返回 `409 IDEMPOTENCY_KEY_REUSED`。
- 正在执行的相同请求：等待首次执行结果或返回 `409 REQUEST_IN_PROGRESS`。
- 幂等记录保存 24 小时。

### 10.4 事务重试

仅对 PostgreSQL 可重试错误执行重试：

- 死锁。
- 序列化失败。

最多重试两次，使用短随机退避。业务冲突、唯一约束冲突和校验错误不得重试。

### 10.5 业务编号

禁止通过“查询当前最大编号再加一”生成新编号。`business_sequence` 使用 `(sequence_type, sequence_scope, business_date)` 作为唯一键，并保存 `current_value` 和 `number_width`：

- 工装编号使用 `sequence_type=TOOL_CODE`，`sequence_scope` 保存前缀，`business_date` 固定为 `1970-01-01`；默认前缀为 `LG-GZQ-`，默认宽度为 3，格式示例为 `LG-GZQ-001`。
- 借还编号使用 `sequence_type=BORROW_RECORD`、空 scope 和当天日期，格式为 `BRYYYYMMDDNNNN`。
- 入库编号使用 `sequence_type=INBOUND_RECORD`、空 scope 和当天日期，格式为 `INYYYYMMDDNNNN`。

日期按 `Asia/Shanghai` 计算。生成时使用单条 upsert 原子递增并返回新值。迁移完成后，根据已有且符合格式的最大编号初始化计数器；不符合格式的历史工装编号继续保留，但不参与自动顺延。计数器允许空号，不允许重复或回退。

## 11. 错误模型

### 11.1 业务错误码

| 错误码 | HTTP | 含义 |
|---|---:|---|
| `VALIDATION_FAILED` | 400 | DTO 校验失败 |
| `AUTH_INVALID_CREDENTIALS` | 401 | 账号或密码错误 |
| `AUTH_SESSION_EXPIRED` | 401 | 会话过期 |
| `CSRF_INVALID` | 403 | CSRF 校验失败 |
| `PERMISSION_DENIED` | 403 | 权限不足 |
| `TOOL_NOT_FOUND` | 404 | 工装不存在 |
| `EMPLOYEE_NOT_FOUND` | 404 | 员工不存在 |
| `TOOL_CODE_EXISTS` | 409 | 工装编号重复 |
| `EMPLOYEE_NO_EXISTS` | 409 | 员工工号重复 |
| `TOOL_NOT_AVAILABLE` | 409 | 工装不可借 |
| `TOOL_BORROWED` | 409 | 借出中不可编辑或删除 |
| `BORROW_EXISTS` | 409 | 已有未归还记录 |
| `NO_OPEN_RECORD` | 409 | 没有可归还记录 |
| `IDEMPOTENCY_KEY_REUSED` | 409 | 幂等键与请求不匹配 |
| `BATCH_INBOUND_INVALID` | 400 | 批量入库整批校验失败 |
| `UPLOAD_TOO_LARGE` | 413 | 上传超过限制 |
| `RATE_LIMITED` | 429 | 触发限流 |
| `DATABASE_UNAVAILABLE` | 503 | 数据库不可用 |
| `INTERNAL_ERROR` | 500 | 未分类服务器错误 |

### 11.2 错误记录

- 4xx 业务错误记录为结构化 info 或 warn。
- 5xx 记录 requestId、错误类型和脱敏堆栈。
- 客户端只显示可理解的业务消息。
- 批量错误使用 `details` 返回行号、工装编号和原因。

## 12. 安全设计

### 12.1 输入

- 全局 `ValidationPipe` 开启白名单和禁止未知字段。
- 所有字符串去除首尾空格并设最大长度。
- 编号字段只接受业务允许的字符集。
- 日期必须可解析且预计归还时间晚于当前时间。
- 分页和批量条数设置上限。
- 不使用客户端传入的操作人姓名。

### 12.2 数据库

- Prisma 默认参数化。
- 原生 SQL 只允许绑定参数，不允许拼接用户输入。
- 应用数据库账号只拥有目标 Schema 的 DML 权限。
- Schema 迁移使用独立发布账号。
- 设置 statement timeout 和事务超时。
- PostgreSQL 不对普通客户端网段开放。

### 12.3 HTTP

- 只提供 HTTPS。
- CORS 默认关闭。
- 使用 Helmet 设置安全头。
- Nginx 和 NestJS 同时限制请求体。
- 登录、导入、导出和普通 API 分别限流。
- Swagger 仅在测试环境或受限运维网段开放。
- 文件下载设置明确 `Content-Type`、`Content-Disposition` 和安全文件名。

### 12.4 审计

以下事件必须审计：

- 登录成功、登录失败、登出。
- 工装新增、修改、删除。
- 借用、归还。
- 批量入库。
- 工装和员工导入。
- 数据导出。
- 员工维护。
- 借还记录管理员维护。
- 账号、角色和权限变更。

审计日志只追加，普通业务账号不能修改或删除。

## 13. 性能与容量

### 13.1 首版基线

| 参数 | 基线 |
|---|---:|
| 单个 API 实例连接池 | 10 |
| 获取数据库连接等待 | 3 秒 |
| 普通 SQL 超时 | 5 秒 |
| 业务事务超时 | 10 秒 |
| 普通 HTTP 超时 | 15 秒 |
| 导入导出超时 | 60 秒 |
| JSON 请求体 | 最大 2 MB |
| Excel 上传 | 最大 10 MB |
| 单次批量入库 | 最大 200 条 |

### 13.2 性能验收

在接近生产配置的测试环境：

- 100 个并发虚拟用户持续 15 分钟。
- 普通查询 p95 小于 500 ms。
- 借用、归还 p95 小于 1 秒。
- 系统错误率低于 1%。
- 20 个并发请求借同一工装，恰好一个成功。
- 同一幂等键连续提交只产生一次业务写入。
- 压测期间 liveness 始终可用。

业务冲突返回的 409 不计入系统错误率。

## 14. 可观测性

### 14.1 健康检查

| 接口 | 内容 |
|---|---|
| `/health/live` | Node 进程和事件循环仍可响应 |
| `/health/ready` | PostgreSQL 可执行轻量查询，关键配置已加载 |

数据库不可用时：

- liveness 可以保持 200，表示进程仍存活。
- readiness 返回 503，阻止流量继续进入。

### 14.2 日志字段

每条请求日志至少包含：

- `timestamp`
- `level`
- `requestId`
- `method`
- `pathTemplate`
- `statusCode`
- `durationMs`
- `sessionUserId`
- `clientIp`
- `errorCode`

不得记录密码、完整 Cookie、CSRF Token、数据库连接串、Excel 原始内容和个人敏感信息。

### 14.3 指标

首版至少采集：

- 请求量、状态码和延迟。
- 登录失败和限流次数。
- PostgreSQL 连接池使用、等待和超时。
- 事务失败和重试次数。
- 导入成功/失败行数。
- 借用业务冲突数量。

## 15. SQLite 到 PostgreSQL 迁移

### 15.1 源数据保护

源文件固定为：

```text
C:\tooling-warehouse-db\data\tooling.db
```

迁移程序必须：

- 使用 SQLite 只读连接。
- 在 Electron 完全关闭后运行。
- 迁移前执行 `PRAGMA integrity_check`。
- 不对源库执行写入、DDL、VACUUM 或修复操作。
- 记录源文件大小、最后修改时间和 SHA-256。
- 迁移失败只回滚 PostgreSQL。

迁移前复制：

```text
C:\tooling-warehouse-db\archive\tooling-before-pg-YYYYMMDD-HHmmss.db
```

原文件和副本都不进入代码仓库。

### 15.2 迁移范围

完整复制业务数据：

- `tool_account`
- `borrow_return_record`
- `tool_inbound_record`
- `employee`

`admin_user`：

- 保留在原 SQLite。
- 复制非密码元数据到迁移报告。
- 不把旧 SHA-256 哈希设置成新系统有效密码。

### 15.3 类型转换

| SQLite | PostgreSQL |
|---|---|
| 自增整数 ID | identity，保留原值 |
| 日期文本 | 按 `Asia/Shanghai` 解释后写为 `TIMESTAMPTZ` |
| 空字符串可选字段 | 转换为 `NULL` |
| `status` | 保留“在库/借出” |
| `record_status` | 保留“未归还/已归还” |

迁移时如果源数据违反新约束：

- 不修改源库。
- 迁移终止。
- 报告列出表、主键、字段和违反原因。
- 由开发人员确定 PostgreSQL 侧的显式修复映射后重新迁移。

### 15.4 迁移顺序

1. 创建迁移批次。
2. 读取并校验源库。
3. 检查目标业务表为空。
4. 导入员工。
5. 导入工装。
6. 导入借还历史。
7. 导入入库历史。
8. 重置 identity sequence。
9. 创建新账号、角色和权限。
10. 校验行数、状态、唯一键和业务不变量。
11. 写入 `migration_run`。
12. 输出 JSON 报告。

迁移工具不允许对已有生产数据执行覆盖式导入。目标业务表非空时必须拒绝，除非使用已验证的同一迁移批次恢复执行。

### 15.5 校验

必须全部满足：

- SQLite `integrity_check=ok`。
- 四张业务表行数一致。
- 主键无缺失和重复。
- 工装编号、员工工号、借还编号唯一。
- 所有时间字段成功转换。
- 每件工装最多一条未归还记录。
- 工装状态、数量和未归还记录一致。
- identity sequence 大于各表最大 ID。
- 源文件迁移前后 SHA-256 一致。

## 16. 前端兼容与行为变化

### 16.1 保持不变

- 页面布局和触屏尺寸。
- 工装、员工、借还、入库字段含义。
- 编号自动顺延。
- 扫码输入自动转为大写英文。
- 工装和员工 Excel 列含义。
- 管理员维护历史记录时同步台账状态。

### 16.2 必须变化

| Electron 行为 | Web 行为 |
|---|---|
| `window.api` IPC | `fetch` 调用 `/api/v1` |
| Electron 文件选择框 | 浏览器 `<input type=file>` |
| 返回服务器本地导出路径 | HTTP 文件下载 |
| `openPath/showItemInFolder` | 删除 |
| 本地 SQLite 备份按钮 | DBA 备份说明和业务导出 |
| `setCodeInputMode` 切换 Windows 输入法 | 前端规范化扫码内容，不控制操作系统输入法 |
| 前端 `sessionStorage` 管理员身份 | `/auth/me` + 服务端 Session |

## 17. 配置

NestJS 运行配置：

| 环境变量 | 用途 | 是否敏感 |
|---|---|:---:|
| `NODE_ENV` | `production`、`test` | 否 |
| `PORT` | API 监听端口 | 否 |
| `DATABASE_URL` | PostgreSQL 连接 | 是 |
| `SESSION_SECRET` | Session 签名密钥 | 是 |
| `CSRF_SECRET` | CSRF 派生密钥 | 是 |
| `TRUST_PROXY` | 是否信任公司网关 | 否 |
| `LOG_LEVEL` | 日志等级 | 否 |
| `APP_ORIGIN` | 允许的同源地址 | 否 |
| `TZ` | 固定为 `Asia/Shanghai` | 否 |

规则：

- 敏感值不写入仓库、镜像、前端构建和日志。
- 应用启动时校验全部配置，缺少必需项立即退出。
- 测试、预生产、生产使用独立数据库和密钥。

## 18. 部署

### 18.1 首次部署

```text
Nginx
├─ Vue dist
└─ NestJS 进程
      └─ 公司 PostgreSQL
```

要求：

- NestJS 使用非 root 系统用户。
- Linux 使用 systemd 自动启动和异常重启。
- Nginx 终止 HTTPS。
- API 仅监听 `127.0.0.1` 或受控应用网段。
- PostgreSQL 仅允许应用服务器连接。
- 发布包不包含 SQLite 文件、旧密码、开发依赖和源码映射。

### 18.2 Docker 出口

非容器版本稳定后，可以提供：

- Vue + Nginx 镜像。
- NestJS 非 root 运行镜像。
- 只编排 Web/API 的 Compose 文件。

公司已有 PostgreSQL 时，Compose 不启动生产数据库。Docker 不改变 API、Schema、会话和迁移设计。

## 19. 测试策略

### 19.1 单元测试

- 编号生成。
- 超期状态计算。
- DTO 字段规范化。
- 权限集合计算。
- 错误码映射。
- SQLite 时间转换。

### 19.2 PostgreSQL 集成测试

- Schema、约束和索引。
- 工装 CRUD。
- 员工 upsert。
- 借用和归还事务。
- 并发借同一工装。
- 幂等键。
- 批量入库整批回滚。
- 管理员修改借还记录后同步台账。
- 删除工装后历史快照保留。

### 19.3 API E2E

- 401、403、CSRF。
- 登录锁定和登出撤销。
- 各角色权限矩阵。
- 工装、员工、借还、入库主流程。
- 导入逐行错误。
- 文件大小、类型和内容限制。
- 错误响应脱敏。

### 19.4 迁移测试

- 只读源库。
- 正常迁移。
- 重复迁移拒绝或安全恢复。
- 非法时间和状态生成报告。
- 行数、ID、序列和业务不变量校验。
- 迁移前后源文件哈希一致。

### 19.5 性能和安全

- 并发借用。
- 登录、导入、导出限流。
- SQL 注入输入。
- 超大 JSON 和 Excel。
- 猜测资源 ID 的越权访问。
- Session 固定、过期和撤销。

## 20. 发布与回退

### 20.1 发布顺序

1. 在测试 PostgreSQL 完成两次 SQLite 迁移演练。
2. 通过功能、权限、迁移、并发和安全验收。
3. 发布 Vue 和 NestJS，但不开放用户流量。
4. 停止旧 Electron 写入。
5. 复制 SQLite 快照并记录哈希。
6. 执行正式迁移和校验。
7. 执行 Web 冒烟测试。
8. 开放内网域名。
9. 监控日志、数据库连接和业务错误。
10. 保持旧 SQLite 和 Electron 安装包可恢复，但禁止同时运行。

### 20.2 回退

在新系统没有产生生产写入前：

- 关闭 Web 入口。
- 停止 NestJS。
- 重新启用原 Electron。
- 原 SQLite 无需恢复，因为迁移从未写入它。

在新系统已经产生生产写入后：

- 不逆向覆盖 SQLite。
- 应用回退到兼容当前 PostgreSQL Schema 的上一版本。
- 数据库问题采用向前修复或 DBA 恢复。

数据库变更必须优先使用向后兼容方式：先加字段或表，再发布代码，确认旧版本不受影响后才执行清理。

## 21. 验收标准

### 21.1 功能

- 浏览器完成现有工装、员工、借还和入库流程。
- Excel 导入导出不依赖本地文件路径。
- 管理员维护记录时台账与历史一致。
- 旧业务数据可以从 PostgreSQL 查询。

### 21.2 数据

- 原 SQLite 文件存在且哈希未变化。
- 迁移报告全部通过。
- 四张业务表源端与目标端行数一致。
- 状态、数量、未归还记录和序列校验一致。

### 21.3 权限

- 未登录返回 401。
- 越权返回 403。
- KIOSK 无管理和批量导出权限。
- AUDITOR 不能写入业务数据。
- 权限只在服务端最终判定。

### 21.4 并发

- 同一工装 20 个并发借用请求只成功一个。
- 重复 Idempotency-Key 只产生一条记录。
- 并发失败不留下半完成事务。

### 21.5 安全与运维

- 密码使用 Argon2id。
- Cookie、CSRF、限流和安全头生效。
- 错误响应无敏感信息。
- 5432 不对普通终端开放。
- readiness、liveness、日志、备份和回退流程可验证。

## 22. 实现边界

本 spec 批准后，开发必须按以下顺序推进：

1. NestJS 骨架和 PostgreSQL Schema。
2. SQLite 只读迁移工具。
3. 登录、会话和权限。
4. 工装、员工、借还、入库业务 API。
5. 导入导出。
6. Vue IPC 到 HTTP 的替换。
7. 安全、审计、性能和迁移验收。
8. 非 Docker 生产部署。
9. 迁移和回退窗口结束后移除 Electron/SQLite 运行时代码。
10. 稳定运行后制作 Docker 交付物。

在开始第 9 步前，`C:\tooling-warehouse-db\data\tooling.db` 和迁移快照始终保留；第 9 步只移除代码依赖，不删除数据文件。
