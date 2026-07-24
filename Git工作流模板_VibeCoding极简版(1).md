# Git 工作流模板

> **Vibe Coding 极简版 · 按场景直接复制**

> **先记住：** 把尖括号内容替换成自己的信息。危险操作前先执行 `git status` 和 `git log --oneline`。

## 首次配置（只做一次）

```bash
git config --global user.name "<你的名字>"
git config --global user.email "<GitHub邮箱>"
```

---

## 常用查看github指令：
```bash
# 1. 当前仓库连的是哪个远程（GitHub 地址）
git remote -v

# 2. 本地 Git 用户名 / 邮箱（提交用的身份）
git config user.name
git config user.email

# 3. GitHub CLI 当前登录的是哪个账号（推荐）
gh auth status

# 4. 整体 Git 状态（分支、改动、是否领先/落后远程）
git status -sb

# 5. 本地分支及是否跟踪远程
git branch -vv

# 6. 最近提交
git log --oneline -5

# 可以将分支名字改成main
git branch -m master main

```

# 一、创建并联动 GitHub 仓库

## 工作流 1｜已有本地项目，命令行创建 GitHub 仓库

第一次使用 GitHub CLI 时先登录：

```bash
gh a uth login
```

进入项目并上传：

```bash
cd <项目目录>

git init
git branch -M main

git add .
git commit -m "初始化项目"

gh repo create <仓库名> --private --source=. --remote=origin --push
```

公开仓库把 `--private` 改成：

```bash
--public
```

这条命令会同时完成：

```text
创建 GitHub 仓库
关联远程仓库 origin
推送本地代码
```

## 工作流 2｜先在 GitHub 网页创建仓库，再关联本地项目

```bash
cd <项目目录>

git init
git branch -M main

git add .
git commit -m "初始化项目"

git remote add origin https://github.com/<用户名>/<仓库名>.git
git push -u origin main
```

## 工作流 3｜新建空项目并创建 GitHub 仓库

```bash
mkdir <项目名>
cd <项目名>

git init
git branch -M main

echo "# <项目名>" > README.md

git add .
git commit -m "初始化项目"

gh repo create <项目名> --private --source=. --remote=origin --push
```

## 工作流 4｜检查或修改 GitHub 远程仓库

查看当前关联：

```bash
git remote -v
```

修改远程仓库地址：

```bash
git remote set-url origin <新仓库地址>
```

删除原有远程关联：

```bash
git remote remove origin
```

重新关联：

```bash
git remote add origin <仓库地址>
git push -u origin main
```

---

# 二、日常开发工作流

## 工作流 5｜第一次拉取项目

```bash
git clone <仓库地址>
cd <项目目录>
git status
```

## 工作流 6｜本地项目首次上传 GitHub

```bash
cd <项目目录>
git init
git add .
git commit -m "初始化项目"
git branch -M main
git remote add origin <仓库地址>
git push -u origin main
```

> 上传前先准备 `.gitignore`，至少忽略 `.env`、`node_modules`、`dist` 和密钥文件。

## 工作流 7｜单人项目每天提交

```bash
git pull
git status
git diff
git add .
git commit -m "<提交说明>"
git push
```

## 工作流 8｜团队开发新功能

```bash
git switch main
git pull origin main
git switch -c feature/<功能名>

# 开发完成
git status
git diff
git add .
git commit -m "<提交说明>"
git push -u origin feature/<功能名>
```

> 推送后去 GitHub 创建 PR，审核后合并。

## 工作流 9｜继续已有功能分支

```bash
git switch feature/<功能名>
git pull
git add .
git commit -m "<提交说明>"
git push
```

## 工作流 10｜第一次拉取远程分支

```bash
git fetch origin
git switch -c <分支名> --track origin/<分支名>
```

## 工作流 11｜合并并更新

### 团队项目：PR 合并后更新本地

```bash
git switch main
git pull origin main
git branch -d feature/<功能名>
```

### 个人项目：本地直接合并

```bash
git switch main
git merge <分支名>
git push origin main
```

## 工作流 12｜解决合并冲突

```bash
git status

# 打开冲突文件，保留正确代码
# 删除 <<<<<<<、=======、>>>>>>>

git add .
git commit -m "解决合并冲突"
git push
```

不想继续本次合并：

```bash
git merge --abort
```

## 工作流 13｜代码没写完，临时切分支

```bash
git stash push -m "<未完成内容>"
git switch <其他分支>

# 回来继续
git switch <原分支>
git stash pop
```

## 工作流 14｜用 worktree 隔离开发（适合大改造）

创建功能分支和独立工作目录：

```bash
git switch main
git pull origin main
git worktree add ../<项目名>-<功能名> -b feature/<功能名> main

cd ../<项目名>-<功能名>
```
切换路径，注意查看左侧资源管理器也要对应
Set-Location D:\Desktop\tooling-warehouse-app-llm
git branch --show-current

在新目录开发并推送：

```bash
git add .
git commit -m "<提交说明>"
git push -u origin feature/<功能名>
```

查看所有 worktree：

```bash
git worktree list
```

功能合并且不再需要独立目录后清理：

```bash
cd <原项目目录>
git worktree remove ../<项目名>-<功能名>
git branch -d feature/<功能名>
```

> `git switch` 会切换当前目录的代码；`worktree` 会创建新目录，让原目录继续保持在 `main`。清理前先确认代码已经提交。

---

# 三、代码回退工作流

> **判断：** 没有 `push`，使用 `restore` 或 `reset`；已经 `push` 或多人共享，优先使用 `revert`。

## 工作流 15｜撤销未提交操作

丢弃文件修改：

```bash
git restore <文件路径>
```

取消 `git add`，但保留代码：

```bash
git restore --staged <文件路径>
```

## 工作流 16｜撤销最近提交（还没 push）

撤销提交，保留代码：

```bash
git reset --soft HEAD~1
```

提交和代码一起删除：

```bash
git reset --hard HEAD~1
```

> `reset --hard` 风险较高，代码会被直接删除。

## 工作流 17｜已 push 的代码安全回滚

回滚最新提交：

```bash
git revert HEAD
git push
```

回滚指定提交：

```bash
git revert <提交ID>
git push
```

> `revert` 会新增一个反向提交，不破坏共享历史。

## 工作流 18｜回到某个历史版本

### 共享分支：安全回到旧版本

```bash
git log --oneline
git revert --no-commit <目标提交ID>..HEAD
git commit -m "回滚到 <目标提交ID>"
git push
```

### 个人分支：直接回到旧版本

```bash
git reset --hard <目标提交ID>
git push --force-with-lease
```

> 共享 `main` 只用第一种；第二种只用于个人分支。

## 工作流 19｜找回误删版本

```bash
git reflog
git switch -c recover/<名称> <找到的提交ID>
```

> 先创建恢复分支最稳妥。

---

# 四、4 套最常用模板

## 模板 A｜每天提交代码

```bash
git pull
git status
git diff
git add .
git commit -m "<提交说明>"
git push
```

## 模板 B｜新功能分支

```bash
git switch main
git pull origin main
git switch -c feature/<功能名>

# 开发完成
git add .
git commit -m "新增 <功能名>"
git push -u origin feature/<功能名>
```

## 模板 C｜已 push 代码回滚

```bash
git log --oneline
git revert <提交ID>
git push
```

## 模板 D｜找回误删代码

```bash
git reflog
git switch -c recover/<名称> <提交ID>
```

---

# 五、一套完整例子

场景：拉取工装管理系统，开发“自助入库”，提交 PR，合并后发现错误并安全回滚。

```bash
# 1. 拉取项目
git clone https://github.com/example/tool-system.git
cd tool-system

# 2. 从最新 main 创建功能分支
git switch main
git pull origin main
git switch -c feature/self-storage

# 3. 开发完成并推送
git status
git diff
git add .
git commit -m "新增工装自助入库功能"
git push -u origin feature/self-storage

# 4. 去 GitHub 创建 PR，审核并合并

# 5. 更新本地 main 并清理分支
git switch main
git pull origin main
git branch -d feature/self-storage

# 6. 合并后若最新提交有问题，安全回滚
git log --oneline
git revert HEAD
git push origin main
```

---

# 六、只记这 5 条

1. 提交前：`git status` + `git diff`
2. 日常提交：`add` → `commit` → `push`
3. 团队开发：`main` 拉最新 → 新建功能分支 → PR
4. 已经 `push` 的错误：使用 `revert`，不要改共享历史
5. 高风险命令：`reset --hard`、`push --force-with-lease`
