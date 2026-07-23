# 工装库管理系统 — 启动说明测试

## 一、日常使用（推荐）

安装完成后，双击桌面或开始菜单中的 **「工装库管理系统」** 即可启动。

若使用免安装版本，进入目录：

```
release\win-unpacked\
```

双击 **工装库管理系统.exe** 启动。

> 数据自动保存在 `C:\tooling-warehouse-db\`，无需手动配置。

---

## 二、开发 / 调试启动

适用于开发人员修改代码后本地运行。

**环境要求：** Windows 10+，已安装 [Node.js](https://nodejs.org/)（建议 18 及以上）

**首次运行：**

```powershell
cd D:\Desktop\tooling-warehouse-app
npm install
```

**启动：**

```powershell
npm run dev
```

执行后会自动打开应用窗口。关闭窗口即退出。

**重新启动：** 先关闭已打开的应用窗口，再重新执行 `npm run dev`。

---

## 三、生成新的 Setup 安装包

改完代码、要给触屏机或他人使用时，按下面步骤生成新的安装程序。

### 步骤 1：关闭正在运行的程序

打包前务必关闭：
- 所有「工装库管理系统」窗口
- 任务栏里可能残留的 exe
- 正在跑的 `npm run dev`（终端里 `Ctrl+C` 停掉）

否则可能打包失败，或生成旧文件。

### 步骤 2：打开终端，进入项目目录

```powershell
cd D:\Desktop\tooling-warehouse-app
```

### 步骤 3：执行打包命令

```powershell
npm run build
```

首次打包或依赖有变化时，先执行一次：

```powershell
npm install
```

`npm run build` 会依次：检查类型 → 编译前端 → 编译 Electron → 生成安装包（约 1～3 分钟）。

### 步骤 4：找到生成的文件

打包成功后，在项目的 `release\` 目录下：

| 文件 / 文件夹 | 用途 |
|---------------|------|
| `工装库管理系统 Setup 0.1.0.exe` | **安装程序**（推荐发给现场机器） |
| `win-unpacked\工装库管理系统.exe` | **免安装版**（整个 `win-unpacked` 文件夹拷走即可用） |

完整路径示例：

```
D:\Desktop\tooling-warehouse-app\release\工装库管理系统 Setup 0.1.0.exe
```

### 步骤 5：安装到触屏机

1. 把 `工装库管理系统 Setup 0.1.0.exe` 拷到目标电脑
2. 双击运行安装向导
3. **安装路径保持默认**（`perMachine` 会装到 `C:\Program Files\工装库管理系统`）
4. **不要**选到 `D:\Desktop\tooling-warehouse-app` 等开发目录
5. 若提示权限不足，右键 Setup → **以管理员身份运行**
6. 安装完成后，从开始菜单或桌面快捷方式启动

**升级已有版本：** 直接运行新的 Setup，覆盖安装即可。业务数据在 `C:\tooling-warehouse-db\`，不会被清除。

### 开发调试 vs 正式安装

| 场景 | 命令 | 是否要打 Setup |
|------|------|----------------|
| 自己改代码、本地试 | `npm run dev` | 不用 |
| 触屏机 / 交付给用户 | `npm run build` → 安装 Setup | **要** |

---

## 四、默认管理员账号

| 项目 | 内容 |
|------|------|
| 用户名 | `admin` |
| 密码 | `amec` |

首页点击 **管理员系统** 进入登录。

---

## 五、常见问题

**误装到开发项目导致卸载删源码**  
安装时路径请选 `C:\Program Files\工装库管理系统`，不要选 `D:\Desktop\tooling-warehouse-app`。

**打包时出现 `chunks are larger than 500 kB` 警告**  
这是体积提示，不影响打包，可忽略。

**`installDir` / electron-builder 配置报错**  
electron-builder 25 不支持 `nsis.installDir`，用 `perMachine: true` 即可默认装到 Program Files。

**安装版 / 免安装 exe 打不开，但 `npm run dev` 正常**  
请先关闭所有程序窗口后执行 `npm run build` 重新打包。

**打不开 / 启动没反应**  
检查是否已有程序在运行（任务栏），先关闭再重新启动。

**开发模式下改了代码没生效**  
关闭应用窗口，重新执行 `npm run dev`。若仍无效，执行 `npm run build:app` 后再启动。

**数据库被占用**  
同一时间只能运行一个程序实例，关闭所有窗口后再试。
