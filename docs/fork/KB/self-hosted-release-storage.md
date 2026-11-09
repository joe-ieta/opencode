# 自建发布物存储 KB

> 适用场景：未来需要为 OpenCode My 的 Windows/Linux/macOS 发布物提供独立下载源时参考。
> 状态：设计草案，尚未接入当前发布脚本。当前只使用本仓库 GitHub Release 保存全部平台完整资产；本文不改变顶层仓库约束。
> 目标：单项目、低维护、可公开下载、可选作为 Electron 更新源。

## 1. 结论

推荐第一版使用 **Caddy 静态文件服务 + SSH/rsync 发布**：

- 不写上传 API，不引入数据库。
- 服务器只读提供发布物，维护者通过 SSH/rsync 写入。
- Caddy 自动申请和续期 TLS 证书。
- 版本目录不可变，`latest` 作为稳定入口。
- 单台 2C2G、20–50 GB 磁盘的 Linux 服务器即可。

不建议一开始上 MinIO、Kubernetes 或对象存储。只有出现 CI 上传、预签名 URL、多项目隔离或生命周期管理需求时，再考虑 MinIO。

不采用的做法：

- 不开放匿名 HTTP 上传，也不让 Web 根目录可写。
- 不用“覆盖已发布 tag”的方式修复发布物；出问题就发新的 `.N`。
- 不把认证令牌、私钥或构建凭据放进发布目录。

## 2. 架构

```text
维护者
  │ rsync / ssh
  ▼
/srv/opencode-my/incoming/<tag>/       ← 上传暂存，不对外提供
  │ publish-release.sh
  ▼
/srv/opencode-my/public/releases/<tag>/ ← 只读、不可变
  │
  ▼
Caddy（自动 HTTPS）→ https://dl.example.com/releases/<tag>/...
  │
  ├─ GitHub Release 说明页放下载链接
  └─ 可选：public/latest/windows/ 作为 Electron 更新源
```

核心约定：

| 路径               | 用途                               | 缓存                  |
| ------------------ | ---------------------------------- | --------------------- |
| `/releases/<tag>/` | 某个版本的完整发布物               | `immutable`，长期缓存 |
| `/latest/windows/` | Windows 稳定版更新清单和完整安装包 | `no-cache`            |
| `/incoming/`       | 上传暂存，不放在 Web 根目录        | 不对外                |

## 3. 服务器与域名

以下按 Ubuntu 24.04 说明；其他 Linux 发行版只需替换包管理器命令。

1. 准备一台有公网 IP 的服务器，建议 2C2G、20–50 GB 磁盘。
2. DNS 添加 `A`/`AAAA` 记录：

```text
dl.example.com → 服务器公网 IP
```

3. 防火墙只开放 SSH、HTTP 和 HTTPS：

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

4. 安装 Caddy 和 rsync：

```bash
sudo apt update
sudo apt install -y caddy rsync
```

Caddy 会自动为 `dl.example.com` 申请 Let's Encrypt 证书。服务器没有公网入口时，可改用 Cloudflare Tunnel 或内网反向代理，但不要用自签名证书做公开下载。

## 4. 目录与用户

创建专用发布用户和目录：

```bash
sudo useradd -r -m -d /home/publish -s /bin/bash publish
sudo mkdir -p /srv/opencode-my/incoming /srv/opencode-my/public/releases
sudo chown -R root:root /srv/opencode-my
sudo chown -R publish:publish /srv/opencode-my/incoming /srv/opencode-my/public/releases
sudo chmod 755 /srv/opencode-my /srv/opencode-my/public /srv/opencode-my/public/releases
```

最终结构：

```text
/srv/opencode-my/
├── incoming/                     # 不对外
└── public/                       # Caddy 根目录
    ├── releases/
    │   └── v2.2.3-dev-my.6/
    │       ├── opencode-desktop-win-x64.exe
    │       ├── latest.yml
    │       ├── SHA256SUMS
    │       └── build.json
    └── latest/
        └── windows/
            ├── latest.yml
            └── opencode-desktop-win-x64.exe
```

Caddy 只需要读 `public/`；上传用户只写 `incoming/` 和 `public/releases/`。不要让 Caddy 以 `publish` 用户运行，也不要给 Web 根目录写权限。

启用 `latest/` 更新源时，另建 `public/latest/windows/`，由 root 或受控更新脚本维护；普通版本发布只写 `public/releases/`。

## 5. Caddy 配置

编辑 `/etc/caddy/Caddyfile`：

```caddyfile
dl.example.com {
    root * /srv/opencode-my/public

    # 公开下载目录。不需要目录列表时去掉 browse。
    file_server browse

    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
    }

    # 版本目录不可变，长期缓存
    @immutable path /releases/*
    header @immutable Cache-Control "public, max-age=31536000, immutable"

    # latest 需要及时更新，不做长缓存
    @latest path /latest/*
    header @latest Cache-Control "no-cache"

    log {
        output file /var/log/caddy/opencode-my.log {
            roll_size 50MiB
            roll_keep 5
        }
    }
}
```

重载并检查：

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

公开地址示例：

```text
https://dl.example.com/releases/v2.2.3-dev-my.6/opencode-desktop-win-x64.exe
https://dl.example.com/releases/v2.2.3-dev-my.6/SHA256SUMS
https://dl.example.com/releases/v2.2.3-dev-my.6/latest.yml
```

Caddy 默认支持 Range 请求，Electron 更新器和大文件断点续传可以直接使用。

## 6. 发布脚本

创建 `/usr/local/bin/publish-release.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail

tag="${1:?usage: publish-release.sh <tag> <source-dir>}"
src="${2:?usage: publish-release.sh <tag> <source-dir>}"
root="/srv/opencode-my/public"
dest="$root/releases/$tag"

test -f "$src/SHA256SUMS" || { echo "missing SHA256SUMS"; exit 1; }

# 分卷发布时 SHA256SUMS 可能包含未上传的完整安装包行，允许忽略缺失文件。
(cd "$src" && sha256sum -c --ignore-missing SHA256SUMS)

rm -rf "$dest.tmp"
rsync -a --chmod=D755,F644 "$src/" "$dest.tmp/"

rm -rf "$dest.old"
if [ -d "$dest" ]; then
  mv "$dest" "$dest.old"
fi
mv "$dest.tmp" "$dest"
rm -rf "$dest.old"

echo "published $tag"
```

设置权限：

```bash
sudo chown root:root /usr/local/bin/publish-release.sh
sudo chmod 755 /usr/local/bin/publish-release.sh
```

上传并发布：

```bash
rsync -av --progress \
  dist/releases/v2.2.3-dev-my.6/ \
  publish@dl.example.com:/srv/opencode-my/incoming/v2.2.3-dev-my.6/

ssh publish@dl.example.com \
  '/usr/local/bin/publish-release.sh v2.2.3-dev-my.6 /srv/opencode-my/incoming/v2.2.3-dev-my.6'
```

如果 `publish` 用户对 `public/releases` 没有写权限，可让脚本由 root 拥有、通过受限 `sudo` 执行；不要直接给 `publish` 全盘写权限。

更严格的 CI 场景可以在 `authorized_keys` 中使用 `command=` 限制远端命令，或改用独立的部署密钥和只允许执行发布脚本的 SSH 账户。

## 7. 与项目发布流程集成

建议保留 `origin` 的 Releases 作为完整资产的权威来源和默认自动更新源；自建服务器作为 Windows 安装包的主下载或加速镜像。

发行记录中可以增加：

```text
Windows 完整安装包：
https://dl.example.com/releases/v2.2.3-dev-my.6/opencode-desktop-win-x64.exe

SHA256SUMS：
https://dl.example.com/releases/v2.2.3-dev-my.6/SHA256SUMS
```

未来若接入独立存储，可在本仓库 GitHub Release 说明页附完整安装包地址；当前仍统一使用 GitHub Release。

### 7.1 自动更新

Electron 自动更新需要 **完整安装包** 和 `latest.yml` 位于同一目录，不能使用分卷。用于更新源时：

```text
/srv/opencode-my/public/latest/windows/
├── latest.yml
└── opencode-desktop-win-x64.exe
```

构建时把更新地址改为：

```text
https://dl.example.com/latest/windows/
```

当前 `packages/desktop/script/release-my.ts` 把 `OPENCODE_DESKTOP_UPDATE_URL` 固定为 GitHub 地址。要启用自建更新源，应增加显式配置，例如：

```ts
process.env.OPENCODE_DESKTOP_UPDATE_URL =
  process.env.OPENCODE_DESKTOP_UPDATE_URL ?? `https://github.com/joe-ieta/opencode/releases/download/${tag}/`
```

在未修改发布脚本前，建议只把自建服务器用于手动下载，GitHub 继续负责自动更新。所有安装包保持完整文件，不使用分卷。

### 7.2 发布前检查

- `SHA256SUMS` 与实际文件一致。
- `latest.yml` 中的 `path`、`size`、`sha512` 与完整安装包一致。
- 版本目录不放临时文件、密钥或构建缓存。
- 公开下载返回 `200`，Range 请求可用，`Content-Length` 正确。
- `latest/*` 返回 `Cache-Control: no-cache`；`releases/*` 返回长缓存头。

## 8. 容量、带宽与缓存

- Windows 安装包约 278 MB；保留 3–5 个版本通常小于 2 GB。
- Linux amd64/arm64 的 AppImage/deb 单版本约 1.2 GB；如果只托管 Windows，可不放 Linux。
- 1 TB 月流量约等于 3,600 次 278 MB 下载。下载量较大时，可在 Caddy 前加 Cloudflare 或 BunnyCDN。
- 版本目录适合 CDN 长缓存；`latest` 目录不要长缓存，避免客户端拿到旧清单。
- 不要对已发布 tag 目录做覆盖写；需要修复时发新的 `.N` 并更新 `latest`。

## 9. 安全与运维

- SSH 只用密钥，禁用密码登录。
- 防火墙只开放必要端口；不要在公网暴露数据库、MinIO 控制台或构建服务。
- Web 根目录只读；上传走 SSH/rsync 或受控发布脚本。
- 发布目录按版本隔离，文件名固定，避免路径穿越和符号链接。
- 定期检查磁盘、Caddy 进程和 HTTP 状态；Caddy 日志已按大小轮转。
- 用 `restic`、`rsync` 或对象存储把 `public/` 备份到另一块盘或另一台机器。
- 发布物未签名；如果后续需要供应链校验，可增加 SHA256SUMS、cosign 或 GitHub Attestations，但这不替代 TLS 和主机安全。

## 10. 可选：MinIO

只有在需要 S3 API、预签名 URL、CI 直传或多项目隔离时才建议使用 MinIO。单项目静态下载用 Caddy 更简单。

单机示例：

```bash
docker run -d --name minio \
  -p 127.0.0.1:9000:9000 \
  -p 127.0.0.1:9001:9001 \
  -v /srv/minio:/data \
  -e MINIO_ROOT_USER=admin \
  -e MINIO_ROOT_PASSWORD='<strong-password>' \
  minio/minio server /data --console-address ':9001'
```

Caddy 反代到 `127.0.0.1:9000`，用 `mc` 上传并设置公开读：

```bash
mc alias set local http://127.0.0.1:9000 admin '<password>'
mc mb local/opencode-my
mc anonymous set download local/opencode-my
mc cp --recursive dist/releases/v2.2.3-dev-my.6/ local/opencode-my/releases/v2.2.3-dev-my.6/
```

MinIO 的代价是多一个常驻服务、控制台暴露面、凭据管理和升级维护；如果只是给本项目提供下载，不值得增加这些复杂度。

## 11. 上线清单

- [ ] 域名解析到服务器，80/443 可达。
- [ ] Caddy 自动 HTTPS 生效，HTTP 跳转 HTTPS。
- [ ] `publish` 用户、`incoming/`、`public/releases/` 权限正确。
- [ ] 发布脚本通过 `sha256sum -c --ignore-missing` 校验。
- [ ] 首个版本上传后，公开下载和 Range 请求通过。
- [ ] `releases/*` 长缓存、`latest/*` 不缓存。
- [ ] 备份任务和磁盘告警已配置。
- [ ] 发行记录、README、GitHub Release 说明已更新下载地址。
- [ ] 明确是否启用自建自动更新源；未启用时继续使用 GitHub。
