# 跨境电商工作流 - 部署指南

本文档提供了将跨境电商工作流项目部署到云服务器的详细步骤。

## 📋 前置要求

- **云服务器**: Linux 系统（推荐 Ubuntu 20.04+ 或 CentOS 7+）
- **Node.js**: 20.x 或更高版本
- **npm**: 随 Node.js 一起安装
- **可选**: Docker 和 docker-compose（用于容器化部署）

## 🚀 部署方式

项目支持三种部署方式，请根据你的需求选择：

### 方式一：Docker 部署（推荐）

最简单的方式，适合快速部署和运维。

#### 1. 安装 Docker 和 docker-compose

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# 安装 docker-compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. 上传项目文件到服务器

```bash
# 使用 scp 上传（在本地执行）
scp -r /path/to/项目91-跨境电商工作流 user@your-server-ip:/opt/

# 或使用 git clone（如果项目在 Git 仓库中）
git clone <your-repo-url> /opt/cross-border-workflow
```

#### 3. 部署

```bash
# 登录服务器
ssh user@your-server-ip

# 进入项目目录
cd /opt/项目91-跨境电商工作流

# 给部署脚本执行权限
chmod +x deploy.sh

# 执行 Docker 部署
./deploy.sh docker
```

#### 4. 验证部署

```bash
# 查看容器状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 访问应用
curl http://localhost:1888
```

### 方式二：PM2 部署

适合需要进程管理和自动重启的场景。

#### 1. 安装 Node.js 和 PM2

```bash
# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 安装 PM2
sudo npm install -g pm2
```

#### 2. 上传项目文件

同 Docker 部署步骤 2。

#### 3. 部署

```bash
cd /opt/项目91-跨境电商工作流
chmod +x deploy.sh
./deploy.sh pm2
```

#### 4. PM2 常用命令

```bash
# 查看状态
pm2 status

# 查看日志
pm2 logs cross-border-workflow

# 重启应用
pm2 restart cross-border-workflow

# 停止应用
pm2 stop cross-border-workflow

# 设置开机自启
pm2 startup
pm2 save
```

### 方式三：手动部署

适合需要完全控制部署过程的场景。

#### 1. 安装 Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. 上传项目文件

同 Docker 部署步骤 2。

#### 3. 构建和启动

```bash
cd /opt/项目91-跨境电商工作流
chmod +x deploy.sh
./deploy.sh manual

# 手动启动（在后台运行）
cd backend
nohup npm start > ../logs/app.log 2>&1 &
```

## 🔧 配置 Nginx 反向代理（可选）

如果你想让应用通过 80 端口访问，可以配置 Nginx：

#### 1. 安装 Nginx

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

#### 2. 配置 Nginx

```bash
# 复制配置文件
sudo cp nginx.conf /etc/nginx/sites-available/cross-border-workflow

# 编辑配置文件，修改 server_name 为你的域名
sudo nano /etc/nginx/sites-available/cross-border-workflow

# 创建软链接
sudo ln -s /etc/nginx/sites-available/cross-border-workflow /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

#### 3. 配置 SSL（可选，使用 Let's Encrypt）

```bash
# 安装 Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# 获取 SSL 证书
sudo certbot --nginx -d your-domain.com
```

## 🔒 防火墙配置

确保开放必要的端口：

```bash
# Ubuntu (ufw)
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 1888/tcp  # 应用端口（如果直接访问）
sudo ufw enable

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-port=22/tcp
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --permanent --add-port=1888/tcp
sudo firewall-cmd --reload
```

## 📁 目录结构

部署后的目录结构：

```
/opt/项目91-跨境电商工作流/
├── backend/          # 后端代码
│   ├── dist/        # 构建后的后端代码
│   └── ...
├── frontend/         # 前端代码
│   └── dist/        # 构建后的前端代码
├── data/            # 数据目录（工作流、运行记录等）
├── uploads/         # 上传文件目录
├── logs/            # 日志目录
├── Dockerfile       # Docker 配置
├── docker-compose.yml
├── nginx.conf       # Nginx 配置
├── ecosystem.config.js  # PM2 配置
└── deploy.sh        # 部署脚本
```

## 🔄 更新部署

### Docker 方式

```bash
cd /opt/项目91-跨境电商工作流
git pull  # 如果使用 Git
docker-compose down
docker-compose build
docker-compose up -d
```

### PM2 方式

```bash
cd /opt/项目91-跨境电商工作流
git pull  # 如果使用 Git
./deploy.sh pm2
```

## 🐛 故障排查

### 查看日志

**Docker:**
```bash
docker-compose logs -f
```

**PM2:**
```bash
pm2 logs cross-border-workflow
```

**手动部署:**
```bash
tail -f logs/app.log
```

### 检查端口占用

```bash
sudo netstat -tlnp | grep 1888
# 或
sudo lsof -i :1888
```

### 检查进程

```bash
# Docker
docker-compose ps

# PM2
pm2 status

# 手动
ps aux | grep node
```

## 📝 环境变量

可以通过环境变量配置应用：

- `PORT`: 应用端口（默认: 1888）
- `NODE_ENV`: 运行环境（production/development）

在 `docker-compose.yml` 或 `ecosystem.config.js` 中修改。

## 🔐 安全建议

1. **使用 HTTPS**: 配置 SSL 证书
2. **防火墙**: 只开放必要端口
3. **定期更新**: 保持系统和依赖包更新
4. **备份数据**: 定期备份 `data` 和 `uploads` 目录
5. **监控**: 设置应用监控和告警

## 📞 支持

如有问题，请检查：
1. 日志文件
2. 端口是否被占用
3. 防火墙配置
4. 文件权限

---

**祝部署顺利！** 🎉
