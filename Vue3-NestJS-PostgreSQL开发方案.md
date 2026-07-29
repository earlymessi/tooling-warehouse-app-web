# 工装库管理系统 Vue 3 + NestJS + PostgreSQL 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 将现有 Electron + Vue 3 + SQLite 单机应用改造成可通过公司内网浏览器访问的 Vue 3 + NestJS + PostgreSQL 前后端分离系统，并以只读方式把现有 SQLite 业务数据完整复制到 PostgreSQL。

**架构：** Vue 3 继续负责触屏交互和管理页面，NestJS 提供同源 `/api/v1` RESTful API，PostgreSQL 作为唯一生产业务库。现有 SQLite 数据文件始终保留，迁移程序只读源库并写入 PostgreSQL；生产首版采用普通进程部署，容器镜像放在全部业务与迁移验收通过之后制作。

**技术栈：** Vue 3、TypeScript、Vite、Element Plus、NestJS、Prisma ORM、PostgreSQL、OpenAPI、Argon2id、Vitest、Jest、Supertest、Nginx。

**设计规格：** `docs/superpowers/specs/2026-07-29-vue3-nestjs-postgresql-web-design.md`

---

## 1. 决策摘要

### 1.1 确定采用的方案

| 项目 | 决策 |
|---|---|
| 前端 | 保留现有 Vue 3 页面，移除 Electron 运行时依赖 |
| 后端 | 新建 NestJS HTTP API |
| 数据库 | PostgreSQL 作为生产唯一可写主库 |
| SQLite | 原文件不删除、不改表、不写入；仅作为迁移源和历史存档 |
| 前后端关系 | 代码分离、接口分离；生产使用同一内网域名 |
| 首次部署 | Vue 静态文件 + NestJS 普通进程 + Nginx + 公司 PostgreSQL |
| Docker | 首次生产运行稳定后再制作镜像，不阻塞主系统开发 |
| 权限 | 服务端认证、角色与权限点双重校验，默认拒绝 |
| 并发 | PostgreSQL 事务、条件更新、唯一约束和幂等键共同保证 |

### 1.2 不采用的方案

- 不让浏览器或 Vue 前端直接连接 PostgreSQL。
- 不在 SQLite 和 PostgreSQL 之间长期双写。
- 不把旧 SQLite 管理员密码哈希直接作为生产登录凭据。
- 不依赖前端隐藏按钮实现权限控制。
- 不因部署尚未确定而提前制作 Docker 镜像。
- 不把 PostgreSQL 的 5432 端口开放给普通办公网终端。

---

## 2. 当前项目现状

当前调用链：

```text
Vue 3
  ↓ window.api
Electron preload
  ↓ ipcRenderer / ipcMain
TypeScript service
  ↓ better-sqlite3
C:\tooling-warehouse-db\data\tooling.db
```

目标调用链：

```text
浏览器
  ↓ HTTPS
Vue 3
  ↓ /api/v1/*
NestJS Controller
  ↓ Service + 权限 + 事务
Prisma / 参数化 SQL
  ↓
PostgreSQL
```

截至 2026-07-29，默认路径 SQLite 实库检查结果如下。正式迁移以停机快照时重新统计的结果为准：

| 表 | 当前记录数 |
|---|---:|
| `tool_account` | 57 |
| `borrow_return_record` | 4 |
| `tool_inbound_record` | 6 |
| `employee` | 22 |
| `admin_user` | 1 |

已确认的改造重点：

1. `src/api/*` 当前依赖 `window.api`，需要改成 HTTP 客户端。
2. `electron/ipc/*` 改造成 NestJS Controller。
3. `electron/services/*` 的业务规则迁移到 NestJS Service。
4. `electron/db/*` 的同步 SQLite 查询改成异步 PostgreSQL 查询。
5. Electron 文件选择框改成浏览器文件上传和 HTTP 下载。
6. Electron 本地数据库备份按钮改为 DBA 备份说明和业务数据导出。
7. 当前管理员使用固定 SHA-256 哈希和前端 `sessionStorage`，不能进入 Web 生产环境。
8. `scripts/export-migration.cjs` 仍引用已删除的 `tool_category` 字段，不能作为正式迁移工具使用。

---

## 3. 目标目录结构

现有 Vue 代码暂时保留在根目录，避免为了目录美观产生大规模文件移动。新增 NestJS 服务端和独立迁移工具：

```text
tooling-warehouse-app/
├─ src/                              # Vue 3 前端
│  ├─ api/
│  │  ├─ httpClient.ts               # HTTP、Cookie、CSRF、错误映射
│  │  ├─ toolApi.ts
│  │  ├─ borrowApi.ts
│  │  ├─ employeeApi.ts
│  │  ├─ inboundApi.ts
│  │  ├─ importExportApi.ts
│  │  └─ authApi.ts
│  └─ ...
├─ server/                           # NestJS 后端
│  ├─ package.json
│  ├─ nest-cli.json
│  ├─ tsconfig.json
│  ├─ prisma/
│  │  ├─ schema.prisma
│  │  └─ migrations/
│  ├─ src/
│  │  ├─ main.ts
│  │  ├─ app.module.ts
│  │  ├─ common/
│  │  │  ├─ auth/
│  │  │  ├─ errors/
│  │  │  ├─ idempotency/
│  │  │  ├─ logging/
│  │  │  └─ validation/
│  │  ├─ database/
│  │  ├─ health/
│  │  ├─ auth/
│  │  ├─ tools/
│  │  ├─ borrow/
│  │  ├─ inbound/
│  │  ├─ employees/
│  │  ├─ import-export/
│  │  └─ audit/
│  └─ test/
├─ tools/
│  └─ sqlite-to-postgres/            # 只读迁移工具，不进入生产运行包
│     ├─ package.json
│     ├─ src/
│     └─ test/
├─ deploy/
│  ├─ nginx/tooling-warehouse.conf
│  ├─ systemd/tooling-warehouse-api.service
│  └─ env/api.env.example
├─ tests/
│  └─ unit/                          # 现有前端/纯业务测试逐步调整
├─ package.json
├─ vite.config.ts
└─ Vue3-NestJS-PostgreSQL开发方案.md
```

职责边界：

- `src/` 不出现数据库连接串、SQL、权限判定和密码处理。
- `server/src/*/controller` 只处理 HTTP 输入输出。
- `server/src/*/service` 处理业务规则、事务和权限上下文。
- `server/src/database` 统一管理 Prisma 生命周期和事务。
- `tools/sqlite-to-postgres` 只在迁移窗口运行，不被 API 服务引用。

---

## 4. RESTful API 规范

### 4.1 通用规则

- 统一前缀：`/api/v1`。
- 请求和响应使用 UTF-8 JSON；文件上传使用 `multipart/form-data`。
- Cookie 会话模式下，写请求必须携带 CSRF Token。
- 日期时间对外使用 ISO 8601，例如 `2026-07-29T08:42:48+08:00`。
- 分页参数统一为 `page`、`pageSize`，默认分别为 `1`、`20`，`pageSize` 最大为 `200`。
- 每个请求返回或记录 `requestId`，便于日志追踪。
- 错误响应不返回 SQL、堆栈、文件绝对路径和数据库连接信息。

成功响应：

```json
{
  "ok": true,
  "data": {
    "id": 1
  },
  "requestId": "01J..."
}
```

失败响应：

```json
{
  "ok": false,
  "code": "TOOL_ALREADY_BORROWED",
  "message": "该工装已被借出",
  "requestId": "01J..."
}
```

### 4.2 接口清单

| 模块 | 方法与路径 | 权限 |
|---|---|---|
| 健康检查 | `GET /api/v1/health/live` | 公开 |
| 健康检查 | `GET /api/v1/health/ready` | 内网监控 |
| 登录 | `POST /api/v1/auth/login` | 公开、严格限流 |
| 登出 | `POST /api/v1/auth/logout` | 已登录 |
| 当前会话 | `GET /api/v1/auth/me` | 已登录 |
| CSRF | `GET /api/v1/auth/csrf` | 已登录 |
| 工装列表 | `GET /api/v1/tools` | `tool:read` |
| 按编号查询 | `GET /api/v1/tools/by-code/:toolCode` | `tool:read` |
| 新建工装 | `POST /api/v1/tools` | `tool:write` |
| 修改工装 | `PATCH /api/v1/tools/:id` | `tool:write` |
| 删除工装 | `DELETE /api/v1/tools/:id` | `tool:delete` |
| 下一批编号 | `POST /api/v1/tools/next-codes` | `tool:write` |
| 借用 | `POST /api/v1/borrow/borrow` | `borrow:operate` |
| 归还 | `POST /api/v1/borrow/return` | `borrow:operate` |
| 借还记录 | `GET /api/v1/borrow/records` | `borrow:read` |
| 管理借还记录 | `POST/PATCH/DELETE /api/v1/borrow/records/*` | `borrow:manage` |
| 批量入库 | `POST /api/v1/inbound/batch` | `inbound:write` |
| 员工借用检索 | `GET /api/v1/employees/lookup` | `borrow:operate` |
| 员工查询 | `GET /api/v1/employees` | `employee:read` |
| 员工维护 | `POST/PATCH/DELETE /api/v1/employees/*` | `employee:write` |
| 导入 | `POST /api/v1/imports/{tools|employees|inbound}` | 对应写权限 |
| 导出 | `GET /api/v1/exports/{tools|records|employees}` | `export:read` |
| 模板 | `GET /api/v1/templates/{tools|employees|inbound}` | 对应写权限 |
| 审计日志 | `GET /api/v1/audit-logs` | `audit:read` |

HTTP 状态码：

| 状态码 | 使用场景 |
|---:|---|
| `200` | 查询、修改、借还成功 |
| `201` | 创建成功 |
| `204` | 删除成功且无响应体 |
| `400` | 格式或参数校验失败 |
| `401` | 未登录或会话失效 |
| `403` | 已登录但权限不足 |
| `404` | 数据不存在 |
| `409` | 已借出、编号重复、幂等冲突 |
| `413` | 上传文件或请求体过大 |
| `429` | 请求过于频繁 |
| `500` | 未预期服务器错误 |
| `503` | PostgreSQL 不可用或系统维护 |

---

## 5. PostgreSQL 数据设计

### 5.1 现有业务表映射

| SQLite | PostgreSQL | 关键变化 |
|---|---|---|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `BIGINT GENERATED BY DEFAULT AS IDENTITY` | 迁移时保留原 ID，迁移后重置序列 |
| `TEXT` 日期 | `TIMESTAMPTZ` | 旧值按 `Asia/Shanghai` 解释后转换 |
| `TEXT` 普通字段 | `VARCHAR(n)` 或 `TEXT` | 业务字段设置明确长度 |
| `INTEGER` 数量 | `INTEGER` | 只允许 0 或 1，并与工装状态保持一致 |
| 状态文本 | `VARCHAR` + `CHECK` | 禁止写入未定义状态 |

需要保留并迁移的业务表：

- `tool_account`
- `borrow_return_record`
- `tool_inbound_record`
- `employee`

管理员数据处理：

- 原 `admin_user` 表和 SQLite 文件完整保留。
- 迁移报告记录旧管理员的 `username`、`display_name` 和行数。
- 旧 SHA-256 `password_hash` 不作为新系统有效凭据。
- PostgreSQL 中创建新的 `app_user`，首次密码使用 Argon2id，并强制首次登录修改。

### 5.2 新增生产表

| 表 | 用途 |
|---|---|
| `app_user` | 登录账号、状态、密码哈希或统一认证标识 |
| `app_role` | 角色 |
| `app_permission` | 权限点 |
| `app_user_role` | 用户与角色关系 |
| `app_role_permission` | 角色与权限关系 |
| `app_session` | 服务端会话、过期时间和撤销状态 |
| `audit_log` | 登录、借还、入库、管理写操作审计 |
| `idempotency_request` | 防止重复扫码和重复提交 |
| `migration_run` | SQLite 迁移批次、行数、哈希和结果 |
| `business_sequence` | 并发安全地生成工装、借还和入库编号 |

### 5.3 关键约束与索引

必须由数据库兜底：

```sql
CREATE UNIQUE INDEX uq_borrow_open_tool
ON borrow_return_record (tool_id)
WHERE record_status = '未归还';
```

其他约束：

- `tool_account.tool_code` 唯一。
- `employee.employee_no` 唯一。
- `borrow_return_record.record_no` 唯一。
- `tool_account.quantity` 只允许 0 或 1。
- `status=在库` 时 `quantity=1`；`status=借出` 时 `quantity=0`。
- 工装状态仅允许 `在库`、`借出`。
- 借还记录的持久化状态仅允许 `未归还`、`已归还`；`已超期`由查询时根据预计归还时间计算，不写入数据库。
- 借还和入库历史允许 `tool_id` 为空，以便删除台账后仍保留快照。
- `idempotency_request` 对 `(scope, idempotency_key)` 建唯一索引。
- 高频查询字段保留现有索引：工装编号、名称、规格、状态，借还状态、借用人、借用时间。
- `business_sequence` 对 `(sequence_type, business_date)` 建唯一约束，通过原子 upsert 分配编号。

数据库使用 `BIGINT` 主键，REST API 把 ID 序列化为十进制字符串，避免超过 JavaScript 安全整数范围。

### 5.4 并发借用

借用不能采用“先查状态，再单独更新”的无锁流程。事务必须完成以下动作：

```sql
UPDATE tool_account
SET status = '借出',
    current_borrower = $1,
    current_borrow_department = $2,
    current_borrow_time = $3,
    expected_return_time = $4,
    updated_at = $3
WHERE id = $5
  AND status = '在库'
RETURNING *;
```

- 返回零行：响应 `409 TOOL_ALREADY_BORROWED`。
- 返回一行：在同一事务内插入借还记录和审计日志。
- 请求必须携带 `Idempotency-Key`。
- 同一幂等键再次请求时返回首次结果，不重复写库。
- 事务发生死锁或序列化失败时，最多重试两次，并记录告警。

---

## 6. 登录、会话与权限

### 6.1 角色

| 角色 | 主要能力 |
|---|---|
| `KIOSK` | 指定触屏终端上的查询、借用、归还 |
| `OPERATOR` | 工装维护、入库、员工维护、业务导入导出 |
| `AUDITOR` | 只读查询、记录导出、审计日志 |
| `ADMIN` | 用户、角色、权限和系统配置 |

权限判断以权限点为准，角色只是权限集合。所有接口默认拒绝，公开接口仅限健康检查和登录。

### 6.2 会话

- 使用服务端不透明会话，不把 JWT、会话 ID 或刷新令牌存入 `localStorage/sessionStorage`。
- Cookie 名称使用 `__Host-tooling_session`。
- Cookie 设置 `HttpOnly`、`Secure`、`SameSite=Strict`、`Path=/`。
- 登录成功后重新生成 Session ID，登出和密码修改后撤销原会话。
- 普通会话无操作 30 分钟失效，最长 8 小时；管理员敏感操作可要求重新验证。
- 写请求检查 CSRF Token。
- 首版单实例使用 PostgreSQL 会话表；扩展为多实例时可把会话和分布式限流迁移到公司 Redis。

### 6.3 密码与登录保护

- 本地密码使用 Argon2id，每个密码使用独立随机盐。
- 禁止默认密码 `amec` 进入生产。
- 登录接口按“账号 + 来源 IP”限制失败次数。
- 连续 5 次失败锁定 15 分钟，同时写入审计日志。
- 错误提示统一为“账号或密码错误”，不暴露账号是否存在。
- 公司具备 OIDC、AD 或 LDAP 时，通过独立认证适配器接入，不改业务权限模型。

---

## 7. 安全与性能基线

### 7.1 API 安全

- NestJS 全局启用 `ValidationPipe`，设置 `whitelist: true`、`forbidNonWhitelisted: true`、`transform: true`。
- DTO 对所有字符串规定最大长度，对枚举、页码、日期和批量条数做校验。
- 全局请求体上限 2 MB；Excel 上传上限 10 MB；单次批量入库不超过 200 条。
- 上传只接受 `.xlsx`、`.xls`、`.csv`，同时校验 MIME、扩展名和解析结果。
- Prisma 查询默认参数化；确需原生 SQL 时只使用绑定参数。
- CORS 默认关闭；需要独立域名时只允许明确的公司前端域名。
- Nginx 和 NestJS 双层限流，登录、导入、导出使用独立策略。
- 设置 Helmet 安全响应头，生产禁用详细错误和 Swagger 公网访问。
- 数据库账号仅拥有业务 Schema 的必要权限，不授予超级用户、建库和创建角色权限。

### 7.2 连接池和超时

首版单实例基线：

| 项目 | 基线 |
|---|---:|
| PostgreSQL 连接池 | 10 |
| 获取连接等待 | 3 秒 |
| 普通 SQL 超时 | 5 秒 |
| 业务事务超时 | 10 秒 |
| HTTP API 超时 | 15 秒 |
| 导入导出超时 | 60 秒 |

扩容时按“API 实例数 × 每实例连接池”核算数据库连接，不能只增加应用实例而忽略 PostgreSQL 上限。

### 7.3 验收负载

- 100 个并发虚拟用户持续 15 分钟。
- 普通查询 p95 小于 500 ms。
- 借用、归还写操作 p95 小于 1 s。
- 错误率低于 1%，业务冲突 `409` 不计入系统错误。
- 20 个请求同时借用同一件工装，必须恰好一个成功，其余返回 `409`。
- 连续重复提交同一个幂等键，数据库只产生一次业务写入。
- 压测期间 `/health/live` 持续可用，不出现连接池耗尽和未受控内存增长。

---

## 8. SQLite 只读复制到 PostgreSQL

### 8.1 保护原则

源文件：

```text
C:\tooling-warehouse-db\data\tooling.db
```

必须遵守：

1. 迁移前关闭现有 Electron 程序，避免复制到写入中的文件。
2. 先制作带时间戳的文件副本和 SHA-256 哈希。
3. 迁移工具使用 SQLite 只读连接。
4. 迁移过程不执行 SQLite `INSERT`、`UPDATE`、`DELETE`、`ALTER`、`VACUUM`。
5. PostgreSQL 导入失败时回滚 PostgreSQL 事务，不处理源文件。
6. 迁移完成后原文件和快照都保留。

迁移前人工执行：

```powershell
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$archive = 'C:\tooling-warehouse-db\archive'
New-Item -ItemType Directory -Force -Path $archive
Copy-Item -LiteralPath 'C:\tooling-warehouse-db\data\tooling.db' `
  -Destination (Join-Path $archive "tooling-before-pg-$stamp.db")
Get-FileHash -Algorithm SHA256 `
  -LiteralPath 'C:\tooling-warehouse-db\data\tooling.db'
```

### 8.2 迁移顺序

1. 对 SQLite 执行 `PRAGMA integrity_check`，必须返回 `ok`。
2. 统计各表行数、最大 ID、状态分布和空值情况。
3. 创建 PostgreSQL Schema 和权限。
4. 执行 Prisma 数据库迁移。
5. 在单个 PostgreSQL 事务内依次复制员工、工装、借还记录和入库记录。
6. 保留原业务表 ID，避免历史关联错位。
7. 重置 PostgreSQL identity sequence。
8. 创建新管理员和角色权限数据。
9. 执行逐表行数、唯一键、状态和业务一致性校验。
10. 将校验结果写入 `migration_run` 并导出 JSON 报告。

### 8.3 校验口径

| 检查 | 通过条件 |
|---|---|
| SQLite 完整性 | `PRAGMA integrity_check = ok` |
| 业务表行数 | SQLite 与 PostgreSQL 完全一致 |
| 主键 | 无缺失、无重复 |
| 工装编号 | 无重复、无空值 |
| 员工工号 | 无重复、无空值 |
| 借用关系 | 每件工装最多一条未归还记录 |
| 工装状态 | 未归还记录与工装借出状态一致 |
| 时间字段 | 全部成功转换为 `TIMESTAMPTZ` |
| 序列 | 新增记录 ID 大于迁移最大 ID |
| 源文件 | SHA-256 与迁移前记录一致 |

### 8.4 切换与回退

- 正式迁移窗口内停止旧 Electron 程序写入。
- 迁移、校验和冒烟测试全部通过后开放新 Web 地址。
- 禁止新旧系统同时写入。
- 新系统产生生产写入前，可以关闭 Web 系统并重新启用原 Electron 程序。
- 新系统已经产生生产写入后，不自动把数据逆向写回 SQLite；应用回滚使用上一版本 NestJS，数据库采用向后兼容迁移或修复前进。

---

## 9. 非 Docker 首次部署

推荐同源访问：

```text
https://tooling.company.local/
├─ /                  Nginx 返回 Vue dist
└─ /api/v1/*          Nginx 反向代理 NestJS 127.0.0.1:3000
                             ↓
                       公司 PostgreSQL
```

部署要求：

- Vue 构建产物发布到 Nginx 静态目录。
- NestJS 执行编译后的 `dist/main.js`，Linux 使用 systemd 托管。
- NestJS 只监听服务器本机或应用网段，不直接暴露管理端口。
- PostgreSQL 仅允许应用服务器 IP 访问。
- 数据库连接串、会话密钥、初始管理员密码从受控环境变量或公司密钥系统注入。
- Nginx 配置 HTTPS、请求体限制、超时、安全头和访问日志。
- PostgreSQL 备份由 DBA 或公司备份平台负责，应用不提供数据库文件下载。

Docker 阶段只在以下条件全部满足后开始：

- Web 主流程验收通过。
- 权限、安全测试通过。
- SQLite 迁移演练至少成功两次。
- 非容器生产运行稳定。
- IT 明确镜像仓库、基础镜像、密钥和持久化规范。

---

## 10. 分阶段实施计划

### 任务 1：建立 NestJS 服务骨架和健康检查

**文件：**

- 创建：`server/package.json`
- 创建：`server/nest-cli.json`
- 创建：`server/tsconfig.json`
- 创建：`server/src/main.ts`
- 创建：`server/src/app.module.ts`
- 创建：`server/src/health/health.controller.ts`
- 测试：`server/test/health.e2e-spec.ts`

- [ ] **步骤 1：创建失败的健康检查测试**

```ts
it('GET /api/v1/health/live returns ok', async () => {
  await request(app.getHttpServer())
    .get('/api/v1/health/live')
    .expect(200)
    .expect(({ body }) => {
      expect(body.ok).toBe(true)
      expect(body.data.status).toBe('up')
    })
})
```

- [ ] **步骤 2：运行测试确认接口尚不存在**

运行：`npm --prefix server test -- health.e2e-spec.ts`

预期：FAIL，响应为 404 或模块无法加载。

- [ ] **步骤 3：实现 NestJS 启动、全局前缀和健康接口**

`server/src/main.ts` 必须设置 `/api/v1`、全局校验、请求体上限和统一异常过滤器；`health.controller.ts` 返回应用存活状态。

- [ ] **步骤 4：验证**

运行：

```powershell
npm --prefix server run lint
npm --prefix server test -- health.e2e-spec.ts
npm --prefix server run build
```

预期：全部通过。

- [ ] **步骤 5：提交**

```powershell
git add server
git commit -m "feat: 初始化 NestJS 服务和健康检查"
```

### 任务 2：建立 PostgreSQL Schema 和 Prisma 生命周期

**文件：**

- 创建：`server/prisma/schema.prisma`
- 创建：`server/src/database/prisma.service.ts`
- 创建：`server/src/database/database.module.ts`
- 创建：`server/src/config/env.validation.ts`
- 测试：`server/test/database.e2e-spec.ts`

- [ ] **步骤 1：编写数据库就绪测试**

测试要求 `/health/ready` 在 PostgreSQL 可查询时返回 200，连接失败时返回 503。

- [ ] **步骤 2：运行测试确认失败**

运行：`npm --prefix server test -- database.e2e-spec.ts`

预期：FAIL，`PrismaService` 或 `/health/ready` 不存在。

- [ ] **步骤 3：定义业务表、权限表、会话表、审计表和幂等表**

Prisma Schema 必须包含第 5 章列出的表、唯一约束、索引、时间字段和可空历史外键。

- [ ] **步骤 4：创建测试库并执行迁移**

运行：

```powershell
$env:DATABASE_URL='postgresql://tooling_test:password@127.0.0.1:5432/tooling_test'
npm --prefix server run prisma:migrate
npm --prefix server test -- database.e2e-spec.ts
```

预期：迁移成功，测试通过。

- [ ] **步骤 5：提交**

```powershell
git add server/prisma server/src/database server/src/config server/test/database.e2e-spec.ts
git commit -m "feat: 建立 PostgreSQL 数据模型"
```

### 任务 3：实现 SQLite 只读迁移工具

**文件：**

- 创建：`tools/sqlite-to-postgres/package.json`
- 创建：`tools/sqlite-to-postgres/src/audit-source.ts`
- 创建：`tools/sqlite-to-postgres/src/migrate.ts`
- 创建：`tools/sqlite-to-postgres/src/validate-target.ts`
- 创建：`tools/sqlite-to-postgres/src/report.ts`
- 测试：`tools/sqlite-to-postgres/test/migrate.test.ts`

- [ ] **步骤 1：创建包含五张旧表的小型 SQLite 测试库**

测试库包含一件在库工装、一件已借工装、一名员工、一条借用记录、一条入库记录和一个旧管理员。

- [ ] **步骤 2：编写保护性测试**

测试必须证明：

- SQLite 使用只读连接。
- 源表行数迁移前后不变。
- PostgreSQL 业务表行数与源库一致。
- 旧管理员密码哈希不成为新系统可登录凭据。
- 重复运行同一迁移批次不会重复插入数据。

- [ ] **步骤 3：运行测试确认失败**

运行：`npm --prefix tools/sqlite-to-postgres test`

预期：FAIL，迁移函数尚不存在。

- [ ] **步骤 4：实现审计、迁移、序列重置和 JSON 报告**

迁移命令：

```powershell
npm --prefix tools/sqlite-to-postgres run migrate -- `
  --source 'C:\tooling-warehouse-db\data\tooling.db' `
  --target-env 'D:\secure-config\tooling-api.env' `
  --report 'C:\tooling-warehouse-db\migration-reports\latest.json'
```

预期：报告包含源文件哈希、逐表行数、最大 ID、状态统计、目标校验和最终 `passed: true`。

- [ ] **步骤 5：提交**

```powershell
git add tools/sqlite-to-postgres
git commit -m "feat: 添加 SQLite 到 PostgreSQL 只读迁移工具"
```

### 任务 4：实现认证、会话和权限框架

**文件：**

- 创建：`server/src/auth/auth.module.ts`
- 创建：`server/src/auth/auth.controller.ts`
- 创建：`server/src/auth/auth.service.ts`
- 创建：`server/src/auth/password.service.ts`
- 创建：`server/src/common/auth/auth.guard.ts`
- 创建：`server/src/common/auth/permissions.guard.ts`
- 创建：`server/src/common/auth/require-permissions.decorator.ts`
- 创建：`server/src/common/auth/csrf.guard.ts`
- 测试：`server/test/auth.e2e-spec.ts`
- 测试：`server/test/permissions.e2e-spec.ts`

- [ ] **步骤 1：编写 401、403、登录、登出和 CSRF 测试**

覆盖未登录访问、权限不足、正确登录、失败锁定、登出失效、写请求缺少 CSRF Token。

- [ ] **步骤 2：运行测试确认失败**

运行：`npm --prefix server test -- auth.e2e-spec.ts permissions.e2e-spec.ts`

预期：FAIL，认证路由和 Guard 不存在。

- [ ] **步骤 3：实现 Argon2id、服务端会话和默认拒绝**

只有标记为公开的路由绕过 `AuthGuard`；业务路由同时通过 `PermissionsGuard`。

- [ ] **步骤 4：验证**

运行：`npm --prefix server test -- auth.e2e-spec.ts permissions.e2e-spec.ts`

预期：所有身份和权限用例通过。

- [ ] **步骤 5：提交**

```powershell
git add server/src/auth server/src/common/auth server/test
git commit -m "feat: 添加服务端认证和权限控制"
```

### 任务 5：迁移工装台账模块

**文件：**

- 创建：`server/src/tools/tools.module.ts`
- 创建：`server/src/tools/tools.controller.ts`
- 创建：`server/src/tools/tools.service.ts`
- 创建：`server/src/tools/dto/list-tools.dto.ts`
- 创建：`server/src/tools/dto/create-tool.dto.ts`
- 创建：`server/src/tools/dto/update-tool.dto.ts`
- 创建：`server/src/tools/dto/next-tool-codes.dto.ts`
- 测试：`server/test/tools.e2e-spec.ts`

- [ ] **步骤 1：把现有工装服务行为写成 API 测试**

覆盖分页、关键词、状态筛选、按编号查询、新增、修改、删除、编号唯一和下一批编号。

- [ ] **步骤 2：运行测试确认失败**

运行：`npm --prefix server test -- tools.e2e-spec.ts`

预期：FAIL，工装路由不存在。

- [ ] **步骤 3：实现最少业务逻辑和参数化数据访问**

保持 `src/types/tool.ts` 中的字段语义；删除台账时不得级联删除借还和入库历史。

- [ ] **步骤 4：验证**

运行：`npm --prefix server test -- tools.e2e-spec.ts`

预期：通过，并确认未授权请求返回 401、越权请求返回 403。

- [ ] **步骤 5：提交**

```powershell
git add server/src/tools server/test/tools.e2e-spec.ts
git commit -m "feat: 迁移工装台账 API"
```

### 任务 6：迁移员工模块

**文件：**

- 创建：`server/src/employees/employees.module.ts`
- 创建：`server/src/employees/employees.controller.ts`
- 创建：`server/src/employees/employees.service.ts`
- 创建：`server/src/employees/dto/list-employees.dto.ts`
- 创建：`server/src/employees/dto/create-employee.dto.ts`
- 创建：`server/src/employees/dto/update-employee.dto.ts`
- 测试：`server/test/employees.e2e-spec.ts`

- [ ] **步骤 1：编写员工查询、部门列表和维护测试**
- [ ] **步骤 2：运行 `npm --prefix server test -- employees.e2e-spec.ts` 确认失败**
- [ ] **步骤 3：实现唯一工号、分页、搜索和权限校验**
- [ ] **步骤 4：重新运行测试，预期全部通过**
- [ ] **步骤 5：提交**

```powershell
git add server/src/employees server/test/employees.e2e-spec.ts
git commit -m "feat: 迁移员工管理 API"
```

### 任务 7：迁移借用归还并实现并发保护

**文件：**

- 创建：`server/src/borrow/borrow.module.ts`
- 创建：`server/src/borrow/borrow.controller.ts`
- 创建：`server/src/borrow/borrow.service.ts`
- 创建：`server/src/borrow/dto/borrow-tool.dto.ts`
- 创建：`server/src/borrow/dto/return-tool.dto.ts`
- 创建：`server/src/borrow/dto/list-borrow-records.dto.ts`
- 创建：`server/src/borrow/dto/admin-create-borrow-record.dto.ts`
- 创建：`server/src/borrow/dto/admin-update-borrow-record.dto.ts`
- 创建：`server/src/common/idempotency/idempotency.service.ts`
- 创建：`server/src/common/idempotency/idempotency.interceptor.ts`
- 测试：`server/test/borrow.e2e-spec.ts`
- 测试：`server/test/borrow-concurrency.e2e-spec.ts`

- [ ] **步骤 1：编写借用、归还、历史快照和管理维护测试**
- [ ] **步骤 2：编写 20 个并发请求只允许一个借用成功的测试**
- [ ] **步骤 3：运行测试确认业务路由和并发保护尚不存在**

运行：`npm --prefix server test -- borrow.e2e-spec.ts borrow-concurrency.e2e-spec.ts`

- [ ] **步骤 4：实现条件更新、单事务写入、唯一约束和幂等键**
- [ ] **步骤 5：重复运行并发测试十次**

预期：每轮恰好一个 200，其余为 409；借还表只新增一条记录。

- [ ] **步骤 6：提交**

```powershell
git add server/src/borrow server/src/common/idempotency server/test
git commit -m "feat: 迁移借还流程并增加并发保护"
```

### 任务 8：迁移批量入库

**文件：**

- 创建：`server/src/inbound/inbound.module.ts`
- 创建：`server/src/inbound/inbound.controller.ts`
- 创建：`server/src/inbound/inbound.service.ts`
- 创建：`server/src/inbound/dto/batch-inbound.dto.ts`
- 测试：`server/test/inbound.e2e-spec.ts`

- [ ] **步骤 1：编写整批校验、编号冲突和事务回滚测试**
- [ ] **步骤 2：运行测试确认失败**
- [ ] **步骤 3：实现最多 200 条、全量校验后一次提交的批量事务**
- [ ] **步骤 4：运行测试确认任意一行失败时整批不写入**
- [ ] **步骤 5：提交**

```powershell
git add server/src/inbound server/test/inbound.e2e-spec.ts
git commit -m "feat: 迁移批量入库 API"
```

### 任务 9：迁移 Excel 导入导出

**文件：**

- 创建：`server/src/import-export/import-export.module.ts`
- 创建：`server/src/import-export/import-export.controller.ts`
- 创建：`server/src/import-export/import-export.service.ts`
- 测试：`server/test/import-export.e2e-spec.ts`
- 修改：`src/views/Inbound.vue`
- 修改：相关导入导出页面

- [ ] **步骤 1：编写文件大小、扩展名、内容校验和下载头测试**
- [ ] **步骤 2：运行测试确认上传下载接口不存在**
- [ ] **步骤 3：迁移现有 `xlsx` 解析与导出规则到 NestJS**
- [ ] **步骤 4：把 Electron 文件对话框改成浏览器文件控件和 Blob 下载**
- [ ] **步骤 5：运行服务端测试和前端构建**

运行：

```powershell
npm --prefix server test -- import-export.e2e-spec.ts
npm run build:app
```

预期：测试通过，浏览器可以上传和下载，不返回服务器绝对路径。

- [ ] **步骤 6：提交**

```powershell
git add server/src/import-export server/test src/views
git commit -m "feat: 改造浏览器导入导出流程"
```

### 任务 10：将 Vue IPC 客户端替换为 HTTP 客户端

**文件：**

- 创建：`src/api/httpClient.ts`
- 创建：`src/api/authApi.ts`
- 修改：`src/api/toolApi.ts`
- 修改：`src/api/borrowApi.ts`
- 修改：`src/api/employeeApi.ts`
- 修改：`src/api/inboundApi.ts`
- 拆分：`src/api/systemApi.ts` 为 `importExportApi.ts`
- 删除：`src/api/client.ts`
- 删除：`src/types/window.d.ts`
- 测试：`tests/unit/httpClient.test.ts`

- [ ] **步骤 1：编写 Cookie、CSRF、错误码和 401 跳转测试**
- [ ] **步骤 2：运行 `npm test -- httpClient.test.ts` 确认失败**
- [ ] **步骤 3：实现基于 `fetch` 的同源 HTTP 客户端**

客户端固定使用 `credentials: 'same-origin'`，写请求读取 CSRF Token，统一把错误响应映射成带 `code` 的异常。

- [ ] **步骤 4：逐个 API 模块替换 `getApi().xxx`**
- [ ] **步骤 5：运行**

```powershell
npm test
npm run build:app
```

预期：前端测试和类型检查通过，不再引用 `window.api`。

- [ ] **步骤 6：提交**

```powershell
git add src/api src/types tests/unit
git commit -m "refactor: 将前端 IPC 调用替换为 HTTP API"
```

### 任务 11：改造登录状态和前端权限展示

**文件：**

- 修改：`src/composables/useAdminAuth.ts`
- 修改：`src/views/AdminLogin.vue`
- 修改：`src/views/AdminHub.vue`
- 修改：`src/router/index.ts`
- 创建：`src/composables/useCurrentUser.ts`
- 测试：`tests/unit/auth-ui.test.ts`

- [ ] **步骤 1：编写刷新后从 `/auth/me` 恢复会话的测试**
- [ ] **步骤 2：编写无权限菜单隐藏但接口仍由后端拒绝的测试**
- [ ] **步骤 3：删除 `sessionStorage` 管理员身份，改用服务端会话**
- [ ] **步骤 4：删除本地数据库备份和打开本地路径按钮**
- [ ] **步骤 5：运行 `npm test` 与 `npm run build:app`**
- [ ] **步骤 6：提交**

```powershell
git add src/composables src/views src/router tests/unit
git commit -m "feat: 接入服务端会话和前端权限展示"
```

### 任务 12：补齐审计、日志、限流和安全头

**文件：**

- 创建：`server/src/audit/audit.module.ts`
- 创建：`server/src/audit/audit.service.ts`
- 创建：`server/src/common/logging/request-id.middleware.ts`
- 创建：`server/src/common/errors/http-exception.filter.ts`
- 修改：`server/src/main.ts`
- 测试：`server/test/security.e2e-spec.ts`
- 测试：`server/test/audit.e2e-spec.ts`

- [ ] **步骤 1：编写登录限流、请求体超限、字段白名单和错误脱敏测试**
- [ ] **步骤 2：编写借还、入库和管理写操作审计测试**
- [ ] **步骤 3：运行测试确认失败**
- [ ] **步骤 4：启用 Helmet、Throttler、请求 ID、统一异常和审计日志**
- [ ] **步骤 5：验证 401、403、413、429、500 响应不包含堆栈和 SQL**
- [ ] **步骤 6：提交**

```powershell
git add server/src/audit server/src/common server/src/main.ts server/test
git commit -m "feat: 增加审计日志和 API 安全基线"
```

### 任务 13：系统级联调和负载验证

**文件：**

- 创建：`server/test/system-flow.e2e-spec.ts`
- 创建：`server/test/load/borrow-concurrency.js`
- 创建：`docs/operations/security-test-record.md`
- 创建：`docs/operations/load-test-record.md`

- [ ] **步骤 1：编写“员工识别 → 借用 → 查询 → 归还”的完整测试**
- [ ] **步骤 2：运行全部前后端测试**

```powershell
npm test
npm run build:app
npm --prefix server test
npm --prefix server run build
```

- [ ] **步骤 3：执行第 7.3 节负载场景**
- [ ] **步骤 4：记录环境、并发数、p50、p95、错误率、数据库连接数和结论**
- [ ] **步骤 5：执行权限矩阵、注入输入、重复提交和上传边界测试**
- [ ] **步骤 6：提交**

```powershell
git add server/test docs/operations
git commit -m "test: 完成系统联调和生产基线验证"
```

### 任务 14：准备非 Docker 生产部署

**文件：**

- 创建：`deploy/nginx/tooling-warehouse.conf`
- 创建：`deploy/systemd/tooling-warehouse-api.service`
- 创建：`deploy/env/api.env.example`
- 创建：`docs/operations/deploy.md`
- 创建：`docs/operations/backup-restore.md`
- 创建：`docs/operations/rollback.md`

- [ ] **步骤 1：配置 Nginx 同源静态页面和 `/api/v1` 代理**
- [ ] **步骤 2：配置 systemd 非 root 用户、自动重启和环境文件**
- [ ] **步骤 3：配置 HTTPS、访问日志、请求大小和代理超时**
- [ ] **步骤 4：在测试服务器执行部署和重启演练**
- [ ] **步骤 5：验证服务器重启后 Web、API 和健康检查自动恢复**
- [ ] **步骤 6：提交**

```powershell
git add deploy docs/operations
git commit -m "docs: 添加非容器生产部署和回退手册"
```

### 任务 15：执行迁移演练和正式切换

**文件：**

- 生成：`C:\tooling-warehouse-db\archive\tooling-before-pg-YYYYMMDD-HHmmss.db`
- 生成：`C:\tooling-warehouse-db\migration-reports\YYYYMMDD-HHmmss.json`
- 更新：`docs/operations/migration-record.md`

- [ ] **步骤 1：在测试 PostgreSQL 上完成至少两次迁移演练**
- [ ] **步骤 2：关闭旧 Electron 程序并制作 SQLite 快照与哈希**
- [ ] **步骤 3：执行正式迁移**
- [ ] **步骤 4：核对第 8.3 节全部校验项**
- [ ] **步骤 5：完成借用、归还、入库、员工查询和导出冒烟测试**
- [ ] **步骤 6：开放内网地址，保持旧 Electron 程序停止写入**
- [ ] **步骤 7：归档迁移报告，不删除任何 SQLite 数据文件**

### 任务 16：验收后移除 Electron 和运行时 SQLite 代码

此任务只能在正式迁移、验收和回退窗口结束后执行。

**文件：**

- 删除：`electron/`
- 删除：`electron-builder.yml`
- 删除：`scripts/clear-tools-records.cjs`
- 删除：`scripts/export-migration.cjs`
- 删除：`scripts/fix-serial-col.cjs`
- 删除：`scripts/seed.cjs`
- 删除：`scripts/seed.mjs`
- 复核并删除：`scripts/patch-admin-hub.mjs`
- 修改：`package.json`
- 修改：`vite.config.ts`
- 修改：`readme.md`

- [ ] **步骤 1：扫描残留依赖**

运行：

```powershell
rg -n "electron|better-sqlite3|window\.api|ipcRenderer|ipcMain|tooling\.db" `
  src package.json vite.config.ts scripts tests
```

- [ ] **步骤 2：移除 Electron、better-sqlite3、koffi 和相关构建插件**
- [ ] **步骤 3：移除 Vite Electron 插件配置和 Windows 本地路径功能**
- [ ] **步骤 4：更新 README 为浏览器开发、构建和部署说明**
- [ ] **步骤 5：验证**

```powershell
npm test
npm run build:app
npm --prefix server test
npm --prefix server run build
```

预期：全部通过；前端构建不再生成 Electron 主进程；原 SQLite 文件仍存在且哈希未改变。

- [ ] **步骤 6：提交**

```powershell
git add -A
git commit -m "refactor: 移除 Electron 和运行时 SQLite 依赖"
```

### 任务 17：稳定运行后制作 Docker 交付物

**文件：**

- 创建：`Dockerfile.web`
- 创建：`server/Dockerfile`
- 创建：`.dockerignore`
- 创建：`deploy/compose/docker-compose.app.yml`
- 创建：`docs/operations/docker-deploy.md`

- [ ] **步骤 1：制作非 root NestJS 运行镜像**
- [ ] **步骤 2：制作 Nginx + Vue 静态文件镜像**
- [ ] **步骤 3：Compose 只编排 Web/API；生产数据库继续使用公司 PostgreSQL**
- [ ] **步骤 4：验证镜像中不存在 SQLite 数据库、源代码、开发依赖和明文密钥**
- [ ] **步骤 5：执行镜像启动、健康检查、资源限制和回滚测试**
- [ ] **步骤 6：提交**

```powershell
git add Dockerfile.web server/Dockerfile .dockerignore deploy/compose docs/operations/docker-deploy.md
git commit -m "build: 添加生产 Docker 交付物"
```

---

## 11. 上线验收清单

### 功能

- [ ] 浏览器完成工装查询、新增、修改和删除。
- [ ] 浏览器完成借用、归还、批量入库。
- [ ] 员工、工装、借还记录可导入导出。
- [ ] 所有旧业务数据在 PostgreSQL 中可查询。
- [ ] 删除工装后历史借还和入库记录仍保留。

### 数据迁移

- [ ] SQLite `integrity_check` 为 `ok`。
- [ ] SQLite 原文件和迁移前快照均保留。
- [ ] 原文件迁移前后 SHA-256 一致。
- [ ] 四张业务表源端和目标端行数一致。
- [ ] 主键、唯一键、时间、状态和借用关系校验通过。
- [ ] PostgreSQL 序列已重置，新数据不会与旧 ID 冲突。
- [ ] 旧管理员 SHA-256 密码不能登录新系统。

### 安全与权限

- [ ] 未登录访问业务接口返回 401。
- [ ] 权限不足返回 403。
- [ ] 普通终端无法调用管理、员工维护和导出接口。
- [ ] 会话 Cookie 带 `HttpOnly`、`Secure`、`SameSite`。
- [ ] 写请求缺少 CSRF Token 时被拒绝。
- [ ] 登录失败触发限流和审计。
- [ ] SQL 注入输入不会改变查询结构。
- [ ] 错误响应无 SQL、堆栈、连接串和绝对路径。
- [ ] PostgreSQL 5432 不对普通终端开放。

### 并发与运行

- [ ] 同一工装并发借用只成功一次。
- [ ] 重复幂等键只写入一次。
- [ ] 达到第 7.3 节负载基线。
- [ ] 数据库不可用时 readiness 返回 503，liveness 仍可判断进程状态。
- [ ] NestJS 异常退出后服务管理器能够恢复。
- [ ] 应用版本可以回滚，数据库迁移具备兼容路径。

---

## 12. 风险与控制

| 风险 | 控制措施 |
|---|---|
| 误改或误删 SQLite | 迁移工具只读、停机快照、SHA-256、源文件不纳入清理任务 |
| 新旧系统同时写造成分叉 | 正式切换窗口停止 Electron，不实施双写 |
| 日期文本转换错误 | 固定按 `Asia/Shanghai` 解析，迁移报告列出失败行 |
| 并发双借 | 条件更新、部分唯一索引、事务、幂等键 |
| 权限只做在前端 | NestJS 全局 Guard 默认拒绝，接口逐项声明权限 |
| 旧密码不安全 | 不复用旧 SHA-256 哈希，创建 Argon2id 新账号 |
| 文件上传攻击 | 大小、扩展名、MIME、解析行数和字段长度共同限制 |
| 数据库连接耗尽 | 固定连接池、查询超时、负载测试、监控池等待 |
| 一开始容器化拖慢主线 | 先普通进程上线，稳定后执行任务 17 |
| Java 与 Node 方案来回切换 | 本方案冻结为 NestJS；只有公司明确技术规范变更才重新评审 |

---

## 13. 完成定义

只有同时满足以下条件，才视为改造完成：

1. Vue 不再引用 Electron IPC。
2. NestJS 承担全部业务、权限、事务和审计。
3. PostgreSQL 是生产唯一可写业务库。
4. SQLite 原文件和迁移快照完整保留。
5. SQLite 数据迁移报告全部通过。
6. 功能、权限、并发、安全、备份和回退验收通过。
7. Electron 和生产运行时 SQLite 依赖已移除。
8. 非 Docker 生产部署可稳定运行。
9. Docker 交付物是否启用由公司 IT 决定，不影响前八项完成。
