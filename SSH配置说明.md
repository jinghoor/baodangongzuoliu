# SSH 配置说明

## 当前状态
代码已成功推送到 GitHub ✅

SSH 连接失败，需要配置 SSH 密钥到服务器。

## 解决方案

### 方案 1：配置 SSH 密钥（推荐）

1. **上传公钥到服务器**（需要输入一次服务器密码）：
```bash
ssh-copy-id -p 64478 root@206.119.175.36
```

2. **测试连接**：
```bash
ssh -p 64478 root@206.119.175.36
```

3. **如果连接成功，执行部署**：
```bash
./一键部署.sh update
```

### 方案 2：使用密码认证脚本

如果不想配置 SSH 密钥，可以使用令牌版脚本（需要安装 sshpass）：

```bash
# macOS 安装 sshpass
brew install sshpass

# 使用密码部署
export SERVER_PASSWORD=你的服务器密码
./一键部署-令牌版.sh update
```

### 方案 3：手动部署

如果以上方案都不行，可以手动连接服务器执行：

```bash
# 1. 连接到服务器
ssh -p 64478 root@206.119.175.36

# 2. 在服务器上执行以下命令
cd /root/baodangongzuoliu
git fetch origin main
git reset --hard origin/main
docker compose down
docker compose build --no-cache
docker compose up -d
```

## 快速配置脚本

我已经创建了 `配置SSH并部署.sh` 脚本，可以自动配置 SSH 并部署：

```bash
./配置SSH并部署.sh
```

这个脚本会：
1. 检查并生成 SSH 密钥（如果需要）
2. 尝试自动配置 SSH 免密登录
3. 测试连接
4. 执行部署

---

**注意**：如果服务器密码未知或无法配置 SSH 密钥，请联系服务器管理员。
