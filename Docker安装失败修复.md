# Docker 安装失败修复指南

## 🔍 问题诊断

从你的终端日志看到：
- ❌ `Unit docker.service not found` - Docker 服务不存在
- ❌ `Connection reset by peer` - 无法连接到 get.docker.com

这说明 Docker 根本没有安装成功。

## 🚀 快速修复（最简单的方法）

### 在服务器上执行以下命令：

```bash
# 1. 更新软件包列表
apt update

# 2. 直接使用 apt 安装 Docker（Ubuntu 仓库版本）
apt install -y docker.io docker-compose

# 3. 启动 Docker
systemctl start docker
systemctl enable docker

# 4. 验证安装
docker --version
docker-compose --version
```

**这是最简单可靠的方法**，因为 Ubuntu 20.04 的官方仓库中已经包含了 Docker。

## 📝 完整部署步骤

安装完 Docker 后，继续部署项目：

```bash
# 1. 配置 Docker 镜像加速器
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "registry-mirrors": [
    "https://docker.mirrors.ustc.edu.cn",
    "https://hub-mirror.c.163.com",
    "https://mirror.baidubce.com",
    "https://ccr.ccs.tencentyun.com"
  ]
}
EOF

systemctl daemon-reload
systemctl restart docker

# 2. 创建项目目录
mkdir -p /opt/workflow
cd /opt/workflow

# 3. 克隆项目（如果 GitHub 访问失败，使用代理）
git clone https://github.com/jinghoor/gongzuoliu123.git . || \
git clone https://ghproxy.com/https://github.com/jinghoor/gongzuoliu123.git .

# 4. 创建数据目录
mkdir -p data uploads logs

# 5. 创建环境变量
cat > .env << 'EOF'
PORT=1888
NODE_ENV=production
DOUBAO_API_KEY=09484874-9519-4aa3-9cd4-f84ef0c6d44e
EOF

# 6. 启动服务
docker-compose up -d --build

# 7. 查看状态
docker-compose ps

# 8. 测试
curl http://localhost:1888/health
```

## 🎯 一键部署脚本

或者使用我创建的简单部署脚本：

```bash
# 下载脚本
curl -fsSL https://raw.githubusercontent.com/jinghoor/gongzuoliu123/main/简单部署.sh -o 简单部署.sh

# 添加执行权限
chmod +x 简单部署.sh

# 运行
bash 简单部署.sh
```

## ⚠️ 注意事项

### Ubuntu 仓库的 Docker 版本

- Ubuntu 20.04 仓库中的 `docker.io` 版本可能较旧（约 19.03）
- 但对于我们的项目来说完全够用
- 如果需要最新版本，可以等网络问题解决后再升级

### Docker Compose 版本

- Ubuntu 仓库中的 `docker-compose` 是 Python 版本（v1.x）
- 功能完全够用，语法兼容
- 如果遇到问题，可以手动安装 v2.x 版本

## 🔧 如果 apt 安装也失败

### 检查网络连接

```bash
# 测试网络
ping 8.8.8.8
ping mirrors.aliyun.com

# 检查 DNS
nslookup github.com
```

### 使用国内镜像源

如果网络有问题，可以配置 apt 使用国内镜像源：

```bash
# 备份原配置
cp /etc/apt/sources.list /etc/apt/sources.list.bak

# 使用阿里云镜像（Ubuntu 20.04）
cat > /etc/apt/sources.list << 'EOF'
deb https://mirrors.aliyun.com/ubuntu/ focal main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ focal-security main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ focal-updates main restricted universe multiverse
deb https://mirrors.aliyun.com/ubuntu/ focal-backports main restricted universe multiverse
EOF

# 更新
apt update
```

## ✅ 验证安装

安装成功后，应该能够：

```bash
# 1. 查看 Docker 版本
docker --version
# 应该显示: Docker version 19.03.x 或更高

# 2. 查看 Docker Compose 版本
docker-compose --version
# 应该显示: docker-compose version 1.x.x 或更高

# 3. 测试 Docker
docker run hello-world
# 应该能够成功拉取并运行 hello-world 镜像

# 4. 查看 Docker 服务状态
systemctl status docker
# 应该显示: active (running)
```

## 🐛 常见问题

### 问题 1: apt update 失败

**解决方案**：
```bash
# 检查网络
ping mirrors.aliyun.com

# 如果无法访问，配置国内镜像源（见上方）
```

### 问题 2: docker.io 安装失败

**解决方案**：
```bash
# 查看错误信息
apt install -y docker.io 2>&1 | tee docker-install.log

# 检查依赖
apt install -f

# 清理并重试
apt clean
apt update
apt install -y docker.io
```

### 问题 3: Docker 服务无法启动

**解决方案**：
```bash
# 查看错误日志
journalctl -u docker.service

# 检查 Docker 配置
docker info

# 重启服务
systemctl restart docker
```

## 📞 获取帮助

如果以上方法都失败，请提供：

1. `apt update` 的输出
2. `apt install -y docker.io` 的完整输出
3. `systemctl status docker` 的输出
4. `journalctl -u docker.service -n 50` 的输出

这些信息可以帮助进一步诊断问题。
