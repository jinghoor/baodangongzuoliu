#!/bin/bash
#===============================================================================
# 手动连接服务器并部署（使用密码/令牌）
#===============================================================================

set -e

SERVER_IP="206.119.175.36"
SERVER_PORT="64478"
SERVER_USER="root"
PROJECT_DIR="/root/baodangongzuoliu"
GITHUB_REPO="https://github.com/jinghoor/baodangongzuoliu.git"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "======================================"
echo "  手动连接服务器并部署"
echo "======================================"
echo ""

echo -e "${BLUE}服务器信息：${NC}"
echo "  IP: $SERVER_IP"
echo "  端口: $SERVER_PORT"
echo "  用户: $SERVER_USER"
echo "  项目目录: $PROJECT_DIR"
echo ""

echo -e "${YELLOW}请按照以下步骤操作：${NC}"
echo ""
echo "1. 手动连接到服务器："
echo -e "   ${GREEN}ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP${NC}"
echo ""
echo "2. 连接成功后，在服务器上执行以下命令："
echo ""
echo -e "${GREEN}   # 进入项目目录${NC}"
echo "   cd $PROJECT_DIR"
echo ""
echo -e "${GREEN}   # 拉取最新代码${NC}"
echo "   git fetch origin main"
echo "   git reset --hard origin/main"
echo ""
echo -e "${GREEN}   # 停止旧容器${NC}"
echo "   docker compose down"
echo ""
echo -e "${GREEN}   # 构建新镜像${NC}"
echo "   docker compose build --no-cache"
echo ""
echo -e "${GREEN}   # 启动服务${NC}"
echo "   docker compose up -d"
echo ""
echo -e "${GREEN}   # 查看服务状态${NC}"
echo "   docker compose ps"
echo ""
echo -e "${YELLOW}或者，您也可以直接复制下面的完整命令序列：${NC}"
echo ""
echo "--------------------------------------"
cat << 'DEPLOY_COMMANDS'
cd /root/baodangongzuoliu && \
git fetch origin main && \
git reset --hard origin/main && \
docker compose down && \
docker compose build --no-cache && \
docker compose up -d && \
docker compose ps
DEPLOY_COMMANDS
echo "--------------------------------------"
echo ""

echo -e "${BLUE}提示：${NC}"
echo "- 如果项目目录不存在，需要先克隆："
echo "  git clone $GITHUB_REPO $PROJECT_DIR"
echo ""
echo "- 如果遇到权限问题，确保有执行权限："
echo "  chmod +x $PROJECT_DIR/一键部署.sh"
echo ""
