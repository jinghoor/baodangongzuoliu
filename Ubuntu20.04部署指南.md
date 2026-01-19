# Ubuntu 20.04 服务器部署指南

本指南专门针对 Ubuntu 20.04 64-bit 系统。

## 📋 前置检查

```bash
# 检查系统版本
lsb_release -a

# 应该显示：
# Description:    Ubuntu 20.04.x LTS
```

## 🚀 一键部署（推荐）

### 在服务器上执行：

```bash
# 下载并运行部署脚本
curl -fsSL https://raw.githubusercontent.com/jinghoor/gongzuoliu123/main/server-deploy.sh -o server-deploy.sh
chmod +x server-deploy.sh
sudo bash server-deploy.sh
```

## 📝 手动部署步骤

### 1. 更新系统

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. 安装 Docker

```bash
# 卸载旧版本（如果有）
sudo apt remove docker docker-engine docker.io containerd runc 2>/dev/null || true

# 安装依赖
sudo apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# 添加 Docker 官方 GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# 设置仓库
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 将当前用户添加到 docker 组（可选，避免每次都用 sudo）
sudo usermod -aG docker $USER

# 验证安装
docker --version
sudo docker run hello-world
```

**注意**：如果添加了用户到 docker 组，需要重新登录才能生效，或者使用 `newgrp docker`。

### 3. 安装 Docker Compose（如果使用独立版本）

```bash
# 下载最新版本
DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
sudo curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# 设置执行权限
sudo chmod +x /usr/local/bin/docker-compose

# 创建符号链接（可选）
sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose

# 验证安装
docker-compose --version
```

### 4. 安装 Git（如果未安装）

```bash
sudo apt install -y git
```

### 5. 克隆项目

```bash
# 创建项目目录
sudo mkdir -p /opt/workflow
sudo chown $USER:$USER /opt/workflow
cd /opt/workflow

# 克隆仓库
git clone https://github.com/jinghoor/gongzuoliu123.git .

# 或者使用 SSH（如果配置了 SSH key）
# git clone git@github.com:jinghoor/gongzuoliu123.git .
```

### 6. 配置环境变量

```bash
cd /opt/workflow

# 创建 .env 文件
cat > .env << 'EOF'
PORT=1888
NODE_ENV=production
DOUBAO_API_KEY=09484874-9519-4aa3-9cd4-f84ef0c6d44e
EOF

# 设置权限（保护敏感信息）
chmod 600 .env
```

### 7. 创建数据目录

```bash
mkdir -p data uploads logs
chmod 755 data uploads logs
```

### 8. 构建并启动服务

```bash
# 使用 docker-compose（推荐）
docker-compose up -d --build

# 或者使用 docker compose（新版本）
# docker compose up -d --build
```

### 9. 查看服务状态

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 测试健康检查
curl http://localhost:1888/health
```

## 🔥 配置防火墙（UFW）

```bash
# 检查 UFW 状态
sudo ufw status

# 如果未启用，先启用
sudo ufw enable

# 允许 SSH（重要！先执行这个，避免被锁在外面）
sudo ufw allow 22/tcp

# 允许应用端口
sudo ufw allow 1888/tcp

# 如果使用 Nginx，允许 HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 重新加载
sudo ufw reload

# 查看状态
sudo ufw status numbered
```

## 🌐 配置 Nginx 反向代理（可选）

### 1. 安装 Nginx

```bash
sudo apt install -y nginx
```

### 2. 创建配置文件

```bash
sudo nano /etc/nginx/sites-available/workflow
```

粘贴以下内容（替换 `your-domain.com` 为你的域名）：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 客户端最大上传文件大小
    client_max_body_size 30M;

    # 前端和 API 代理
    location / {
        proxy_pass http://localhost:1888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 上传文件访问
    location /uploads {
        proxy_pass http://localhost:1888;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### 3. 启用配置

```bash
# 创建符号链接
sudo ln -s /etc/nginx/sites-available/workflow /etc/nginx/sites-enabled/

# 删除默认配置（可选）
sudo rm /etc/nginx/sites-enabled/default

# 测试配置
sudo nginx -t

# 重新加载 Nginx
sudo systemctl reload nginx
```

### 4. 配置 SSL（Let's Encrypt）

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取证书（替换为你的域名）
sudo certbot --nginx -d your-domain.com

# 测试自动续期
sudo certbot renew --dry-run
```

## 🔄 更新代码

```bash
cd /opt/workflow

# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build

# 查看日志确认
docker-compose logs -f
```

## 📊 数据备份

```bash
cd /opt/workflow

# 备份数据
tar -czf backup-$(date +%Y%m%d-%H%M%S).tar.gz data/ uploads/

# 恢复备份
# tar -xzf backup-YYYYMMDD-HHMMSS.tar.gz
```

## 🛠️ 常用管理命令

```bash
# 进入项目目录
cd /opt/workflow

# 启动服务
docker-compose up -d

# 停止服务
docker-compose stop

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f

# 查看最近 100 行日志
docker-compose logs --tail=100

# 查看容器状态
docker-compose ps

# 进入容器（调试用）
docker exec -it cross-border-workflow sh

# 查看容器资源使用
docker stats cross-border-workflow
```

## 🐛 故障排查

### 服务无法启动

```bash
# 查看详细日志
docker-compose logs app

# 检查端口占用
sudo netstat -tulpn | grep 1888
# 或
sudo ss -tulpn | grep 1888

# 检查 Docker 服务状态
sudo systemctl status docker

# 检查容器状态
docker ps -a
```

### 无法访问应用

1. **检查防火墙**
   ```bash
   sudo ufw status
   ```

2. **检查容器是否运行**
   ```bash
   docker-compose ps
   ```

3. **检查端口映射**
   ```bash
   docker ps
   ```

4. **测试本地访问**
   ```bash
   curl http://localhost:1888/health
   ```

### 权限问题

```bash
# 如果遇到权限问题，确保用户有权限访问目录
sudo chown -R $USER:$USER /opt/workflow
```

### Docker 服务未运行

```bash
# 启动 Docker
sudo systemctl start docker
sudo systemctl enable docker

# 检查状态
sudo systemctl status docker
```

## 📝 设置自动更新脚本

创建自动更新脚本：

```bash
cat > /opt/workflow/update.sh << 'EOF'
#!/bin/bash
set -e

cd /opt/workflow

echo "🔄 拉取最新代码..."
git pull

echo "🔨 重新构建并启动..."
docker-compose up -d --build

echo "✅ 更新完成！"
echo "查看日志: docker-compose logs -f"
EOF

chmod +x /opt/workflow/update.sh
```

使用：`/opt/workflow/update.sh`

## ⚙️ 系统优化（可选）

### 增加文件描述符限制

```bash
# 编辑 limits.conf
sudo nano /etc/security/limits.conf

# 添加以下行
* soft nofile 65535
* hard nofile 65535

# 重新登录后生效
```

### 优化 Docker 日志大小

```bash
# 编辑 Docker daemon 配置
sudo nano /etc/docker/daemon.json

# 添加以下内容
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}

# 重启 Docker
sudo systemctl restart docker
```

## ✅ 部署验证清单

- [ ] Docker 已安装并运行
- [ ] Docker Compose 已安装
- [ ] 项目代码已克隆
- [ ] `.env` 文件已配置
- [ ] 数据目录已创建
- [ ] 容器已启动
- [ ] 健康检查通过：`curl http://localhost:1888/health`
- [ ] 防火墙已配置
- [ ] 可以访问应用

## 📞 获取帮助

如果遇到问题：

1. 查看应用日志：`docker-compose logs -f`
2. 查看系统日志：`journalctl -u docker`
3. 检查容器状态：`docker-compose ps`
4. 查看完整部署文档：`服务器部署指南.md`
