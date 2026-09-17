# Bun 安装说明（Windows / Linux）

> 用途：为 `qt-headless` 分支（opencode headless 发行版）准备运行时。
> 仓库要求：`packageManager` 为 `bun@1.3.14`，建议安装 **1.3.14 或更高的稳定版**。
> 官方文档：<https://bun.sh/docs/installation>

---

## 0. 版本与验证基线

| 项目 | 要求 |
|---|---|
| Bun 版本 | ≥ 1.3.14（仓库声明 `bun@1.3.14`） |
| Windows | Windows 10 1809+（x64 / ARM64） |
| Linux | glibc ≥ 2.17（musl 系统用 musl 包）；建议内核 ≥ 5.6（最低 3.10） |
| CPU | x64 需 SSE4.2（Nehalem / Bulldozer 及更新） |

安装完成后验证：

```bash
bun --version     # 1.x.y
bun --revision    # 1.x.y+<commit>
```

---

## 1. Windows 安装

### 方式 A：官方脚本（推荐，无需 Node）

```powershell
powershell -c "irm bun.sh/install.ps1|iex"
```

- 安装目录：`%USERPROFILE%\.bun\bin`，脚本会自动加入用户 PATH。
- **安装后必须新开一个终端**再执行 `bun --version`。
- 若提示 `command not found` / 无法识别，见 1.5 PATH 修复。

### 方式 B：npm 安装（已有 Node 或受限网络时）

```powershell
npm install -g bun
bun --version
```

适用于配置了企业 npm 镜像的机器（见第 3 节）。

### 方式 C：Scoop

```powershell
scoop install bun
scoop update bun      # 后续升级
```

### 方式 D：手动下载（离线 / 代理受限）

1. 下载对应架构的压缩包（GitHub Releases）：
   - x64：`https://github.com/oven-sh/bun/releases/latest/download/bun-windows-x64.zip`
   - ARM64：`https://github.com/oven-sh/bun/releases/latest/download/bun-windows-aarch64.zip`
2. 解压后将 `bun.exe` 放到 `%USERPROFILE%\.bun\bin`（目录不存在则创建）。
3. 按 1.5 配置 PATH，新开终端验证。

### 1.5 PATH 修复（安装成功但命令不识别）

先用绝对路径确认二进制存在：

```powershell
& "$env:USERPROFILE\.bun\bin\bun" --version
```

若正常，把目录写入用户 PATH（官方方案）：

```powershell
[System.Environment]::SetEnvironmentVariable(
  "Path",
  [System.Environment]::GetEnvironmentVariable("Path", "User") + ";$env:USERPROFILE\.bun\bin",
  [System.EnvironmentVariableTarget]::User
)
```

**重启终端**后执行 `bun --version`。

### 1.6 指定版本 / 升级 / 卸载

```powershell
# 安装指定版本（官方脚本参数）
iex "& {$(irm https://bun.com/install.ps1)} -Version 1.3.14"

# 升级
bun upgrade

# 卸载
powershell -c ~\.bun\uninstall.ps1
```

### 1.7 Windows 常见问题

| 现象 | 处理 |
|---|---|
| `bun` 不识别 | 见 1.5；确认已重启终端 |
| 脚本被安全策略拦截 | 优先用方式 B/D；必要时（仅当前用户）`Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| 下载超时/公司代理 | 安装前设置 `$env:HTTPS_PROXY="http://<proxy>:<port>"`；或改用方式 B/D |
| 杀毒软件拦截 | 将 `%USERPROFILE%\.bun` 加入白名单 |
| 想用 WSL 而非原生 | 直接按第 2 节在 WSL 发行版内安装 |

---

## 2. Linux 安装

### 前置依赖

```bash
# Debian/Ubuntu
sudo apt update && sudo apt install -y curl unzip
# RHEL/CentOS/Fedora
sudo dnf install -y curl unzip
# Alpine（musl）
sudo apk add curl unzip bash
```

### 方式 A：官方脚本（推荐）

```bash
curl -fsSL https://bun.sh/install | bash
# 等价的官方域名： https://bun.com/install
```

- 安装目录：`~/.bun`，脚本会向 `~/.bashrc` / `~/.zshrc` 追加 PATH。
- 执行 `source ~/.bashrc`（或重开终端）后验证。
- musl 系统（Alpine/Void）脚本会自动选择 musl 二进制；也可手动安装（见方式 D）。

### 方式 B：npm

```bash
npm install -g bun
```

### 方式 C：Homebrew（Linuxbrew）

```bash
brew install oven-sh/bun/bun
brew upgrade bun          # 升级
```

### 方式 D：手动下载（离线 / 无外网）

```bash
mkdir -p ~/.bun/bin && cd /tmp
# 按架构选择：
#   x64 glibc   : bun-linux-x64.zip
#   arm64 glibc : bun-linux-aarch64.zip
#   x64 musl    : bun-linux-x64-musl.zip
#   arm64 musl  : bun-linux-aarch64-musl.zip
curl -fL -o bun.zip https://github.com/oven-sh/bun/releases/latest/download/bun-linux-x64.zip
unzip -o bun.zip
# 解压出的目录名形如 bun-linux-x64，把其中的 bun 放入 PATH
mv bun-linux-x64/bun ~/.bun/bin/bun
chmod +x ~/.bun/bin/bun
```

### 2.5 PATH 配置

把以下内容加入对应 shell 配置（bash：`~/.bashrc`；zsh：`~/.zshrc`；fish：`~/.config/fish/config.fish`）：

```bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

然后 `source ~/.bashrc`（或重开终端）并验证。

### 2.6 指定版本 / 升级 / 卸载

```bash
# 指定版本
curl -fsSL https://bun.sh/install | bash -s "bun-v1.3.14"

# 升级
bun upgrade

# 卸载
rm -rf ~/.bun
# 并从 ~/.bashrc / ~/.zshrc 中删除 BUN_INSTALL / PATH 两行
```

### 2.7 Linux 常见问题

| 现象 | 处理 |
|---|---|
| `GLIBC_... not found` | 改用 musl 二进制（方式 D 的 `-musl.zip`） |
| 缺 `unzip` | 安装前置依赖（见上） |
| 无外网 | 方式 D 手动拷贝 zip |
| 代理 | `export HTTPS_PROXY=http://<proxy>:<port>` 后再执行安装脚本 |
| Docker/CI | `docker run --rm --init --ulimit memlock=-1:-1 oven/bun`（镜像变体：`oven/bun:slim`、`oven/bun:alpine`） |

---

## 3. 企业网络 / 受限环境

1. **代理**：安装前设置 `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`（Windows 用 `$env:HTTPS_PROXY`，Linux 用 `export HTTPS_PROXY`）。
2. **npm 镜像**（方式 B）：`npm config set registry <企业镜像>` 后执行 `npm install -g bun`；`bun` 的 npm 包内含对应平台二进制。
3. **完全离线**：用第 1/2 节方式 D，从有网机器下载 zip 后拷贝安装。
4. **验证来源**：下载后可用 `bun --revision` 记录 commit，便于审计。

---

## 4. 安装后验证本仓库（headless）

```bash
# Windows PowerShell 或 Linux bash 均可
bun --version                                  # 应 ≥ 1.3.14

cd <repo>                                      # qt-headless 分支工作区
bun install                                    # 安装依赖（首次较慢）

# 类型检查（可选，建议首次执行）
bun turbo typecheck

# 启动 headless server 冒烟
# Windows:
$env:OPENCODE_SERVER_PASSWORD="dev-secret"; $env:OPENCODE_CLIENT="desktop"
bun run --cwd packages/opencode src/index.ts serve --hostname 127.0.0.1 --port 4096
# Linux:
OPENCODE_SERVER_PASSWORD=dev-secret OPENCODE_CLIENT=desktop \
  bun run --cwd packages/opencode src/index.ts serve --hostname 127.0.0.1 --port 4096

# 健康检查（另开终端）
curl -s -u opencode:dev-secret http://127.0.0.1:4096/global/health
```

构建单文件二进制：

```bash
bun run --cwd packages/opencode script/build.ts --single
```

详细验证清单见 `docs/qt-headless.md` 第 4 节。

---

## 5. 本机实测记录（Windows，2026-09-17）

| 项目 | 结果 |
|---|---|
| Bun 版本 | 1.4.2（`%USERPROFILE%\.bun\bin\bun.exe`） |
| 首次 `bun install` | 失败：C 盘仅剩 0.2 GB（ENOSPC）+ `tree-sitter-powershell` 的 node-gyp 原生构建失败 |
| 处理 1（磁盘） | `BUN_INSTALL_CACHE_DIR=E:\Temp\opencode\bun-cache`、`TMP/TEMP=E:\Temp\opencode`，并 `bun pm cache rm` 释放 C 盘 |
| 处理 2（原生构建） | 本分支已将 `tree-sitter` / `tree-sitter-bash` / `tree-sitter-powershell` / `electron` 移出 `trustedDependencies`（opencode 使用 wasm，无需原生构建），无需 `--ignore-scripts` |
| 清洁安装 | `bun install` 成功：1130 packages / 19.3s |
| 类型检查 | `bun run typecheck`：17/17 通过 |
| 源码 serve 冒烟 | `/global/health` 正常；tool ids 含 `question`；SSE 收到 `server.connected`；`POST /session` 成功 |
| 二进制构建 | `bun run script/build.ts --single --skip-install` 成功；产物 `packages/opencode/dist/opencode-windows-x64/bin/opencode.exe`（118.3 MB） |
| 二进制 serve 冒烟 | `/global/health` 返回 `{"healthy":true,"version":"0.0.0-qt-headless-..."}` |

> 在未裁剪的上游分支（含 desktop/TUI 原生依赖）遇到 node-gyp 报错时，可先用 `bun install --ignore-scripts` 跳过原生构建；本分支不需要。

---

## 6. 快速排错表

| 现象 | 处理 |
|---|---|
| `bun: command not found`（两平台） | 按 1.5 / 2.5 配置 PATH，重开终端 |
| `bun install` 报 workspace 缺失 | 确认在 `qt-headless` 分支（已裁剪 UI 包） |
| `bun install` 卡住/超时 | 配置代理或镜像（第 3 节） |
| 版本低于 1.3.14 | `bun upgrade` 或按指定版本重装 |
| Windows 上 `serve` 无法执行 shell 工具 | 安装 Git（Git Bash），见集成文档风险表 |
