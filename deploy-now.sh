#!/bin/bash

# 简化版一键部署脚本 - 使用密码认证

set -e

echo "=========================================="
echo "  跨境电商工作流 - 服务器端一键部署"
echo "=========================================="
echo ""

# 服务器配置
SERVER_IP="206.119.175.36"
SERVER_PORT="64478"
SERVER_USER="root"
SERVER_PASSWORD="vyqtHWDW3189"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}开始部署流程...${NC}"
echo ""

# 使用 sshpass 连接到服务器
echo -e "${YELLOW}连接到服务器...${NC}"

sshpass -p "$SERVER_PASSWORD" ssh -p "$SERVER_PORT" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" << 'ENDSSH'

set -e

echo "=========================================="
echo "  服务器端部署脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 步骤 1: 安装基础依赖
echo -e "${YELLOW}[步骤 1/6] 安装基础依赖...${NC}"
yum update -y
yum install -y curl git wget vim net-tools

# 步骤 2: 安装 Docker
echo -e "${YELLOW}[步骤 2/6] 安装 Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo "安装 Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl start docker
    systemctl enable docker
    echo -e "${GREEN}Docker 安装成功${NC}"
else
    echo -e "${GREEN}Docker 已安装${NC}"
fi

# 步骤 3: 安装 Docker Compose
echo -e "${YELLOW}[步骤 3/6] 安装 Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    echo "安装 Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}Docker Compose 安装成功${NC}"
else
    echo -e "${GREEN}Docker Compose 已安装${NC}"
fi

# 步骤 4: 克隆代码仓库
echo -e "${YELLOW}[步骤 4/6] 克隆代码仓库...${NC}"
APP_DIR="/root/baodangongzuoliu"
REPO_URL="https://github.com/jinghoor/baodangongzuoliu.git"

if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}目录已存在，拉取最新代码...${NC}"
    cd "$APP_DIR"
    git fetch origin main
    git reset --hard origin/main
else
    echo "克隆仓库..."
    git clone "$REPO_URL" "$APP_DIR"
    cd "$APP_DIR"
fi

# 步骤 5: 配置防火墙
echo -e "${YELLOW}[步骤 5/6] 配置防火墙...${NC}"
if command -v firewall-cmd &> /dev/null; then
    echo "配置防火墙规则..."
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --permanent --add-port=80/tcp
    firewall-cmd --permanent --add-port=443/tcp
    firewall-cmd --reload
    echo -e "${GREEN}防火墙配置完成${NC}"
else
    echo -e "${YELLOW}firewalld 未安装，跳过防火墙配置${NC}"
fi

# 步骤 6: 构建并启动服务
echo -e "${YELLOW}[步骤 6/6] 构建并启动服务...${NC}"
cd "$APP_DIR"

# 检查 docker-compose.yml 是否存在
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}错误: docker-compose.yml 文件不存在${NC}"
    exit 1
fi

docker-compose down
docker-compose build --no-cache
docker-compose up -d

# 等待服务启动
echo ""
echo -e "${GREEN}等待服务启动...${NC}"
sleep 15

# 检查服务状态
echo ""
echo -e "${GREEN}检查服务状态...${NC}"
docker-compose ps

# 检查容器日志
echo ""
echo -e "${YELLOW}容器日志（最近 20 行）：${NC}"
docker-compose logs --tail=20

# 显示访问信息
echo ""
echo "=========================================="
echo -e "${GREEN}部署完成！${NC}"
echo "=========================================="
echo ""
echo "访问地址："
echo "  - 前端: http://206.119.175.36"
echo "  - 后端: http://206.119.175.36/api"
echo ""
echo "常用命令："
echo "  - 查看日志: docker-compose logs -f"
echo "  - 重启服务: docker-compose restart"
echo "  - 停止服务: docker-compose down"
echo "  - 更新代码: cd $APP_DIR && git pull && docker-compose up -d --build"
echo ""
echo "=========================================="

ENDSSH

echo ""
echo "=========================================="
echo -e "${GREEN}远程部署完成！${NC}"
echo "=========================================="
