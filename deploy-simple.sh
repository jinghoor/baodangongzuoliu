#!/bin/bash

# 跨境电商工作流 - 一键部署脚本
# 使用方式: ./deploy-simple.sh

set -e

echo "=========================================="
echo "  跨境电商工作流 - 一键部署"
echo "=========================================="
echo ""

# 服务器配置
SERVER_IP="206.119.175.36"
SERVER_PORT="64478"
SERVER_USER="root"
SERVER_PASSWORD="vyqtHWDW3189"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}开始部署...${NC}"

# 使用 sshpass 直接执行命令
echo -e "${YELLOW}[1/6] 安装 Docker...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh -p "$SERVER_PORT" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "yum install -y docker || curl -fsSL https://get.docker.com | sh"

echo -e "${YELLOW}[2/6] 启动 Docker...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh -p "$SERVER_PORT" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "systemctl start docker && systemctl enable docker"

echo -e "${YELLOW}[3/6] 安装 Docker Compose...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh -p "$SERVER_PORT" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "curl -L https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-\$(uname -s)-\$(uname -m) -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose"

echo -e "${YELLOW}[4/6] 克隆代码仓库...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh -p "$SERVER_PORT" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "cd /root && rm -rf baodangongzuoliu && git clone https://github.com/jinghoor/baodangongzuoliu.git"

echo -e "${YELLOW}[5/6] 配置防火墙...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh -p "$SERVER_PORT" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "firewall-cmd --permanent --add-service=http 2>/dev/null || true && firewall-cmd --permanent --add-service=https 2>/dev/null || true && firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true && firewall-cmd --reload 2>/dev/null || true"

echo -e "${YELLOW}[6/6] 构建并启动服务...${NC}"
sshpass -p "$SERVER_PASSWORD" ssh -p "$SERVER_PORT" -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "cd /root/baodangongzuoliu && docker-compose down 2>/dev/null || true && docker-compose build --no-cache && docker-compose up -d"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "访问地址："
echo "  http://206.119.175.36"
echo ""
echo "查看日志："
echo "  ssh -p 64478 root@206.119.175.36 'cd /root/baodangongzuoliu && docker-compose logs -f'"
echo ""
