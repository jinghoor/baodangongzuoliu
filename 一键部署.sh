#!/bin/bash
#===============================================================================
# 一键部署脚本
# 服务器信息：
#   IP: 206.119.175.36
#   SSH端口: 64478
#   用户: root
#===============================================================================

set -e

SERVER_IP="206.119.175.36"
SERVER_PORT="64478"
SERVER_USER="root"
GITHUB_REPO="https://github.com/jinghoor/baodangongzuoliu.git"
PROJECT_DIR="/root/baodangongzuoliu"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "======================================"
echo "  跨境电商工作流 - 一键部署"
echo "======================================"
echo ""

ACTION=${1:-"help"}

case $ACTION in
    "init")
        echo -e "${GREEN}[1/4]${NC} 安装 Docker..."
        ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP << 'ENDSSH'
            # 安装 Docker
            if ! command -v docker &> /dev/null; then
                echo "安装 Docker..."
                yum install -y yum-utils
                yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                yum install -y docker-ce docker-ce-cli containerd.io
                systemctl start docker
                systemctl enable docker
            else
                echo "Docker 已安装"
            fi
            
            # 安装 Docker Compose
            if ! command -v docker-compose &> /dev/null; then
                echo "安装 Docker Compose..."
                curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
                chmod +x /usr/local/bin/docker-compose
                ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
            else
                echo "Docker Compose 已安装"
            fi
            
            # 开放 80 端口
            firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true
            firewall-cmd --reload 2>/dev/null || true
            
            echo "Docker: $(docker --version)"
            echo "Docker Compose: $(docker-compose --version)"
ENDSSH

        echo -e "${GREEN}[2/4]${NC} 克隆代码..."
        ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP << ENDSSH
            rm -rf $PROJECT_DIR
            git clone $GITHUB_REPO $PROJECT_DIR
ENDSSH

        echo -e "${GREEN}[3/4]${NC} 构建镜像..."
        ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP "cd $PROJECT_DIR && docker-compose build"

        echo -e "${GREEN}[4/4]${NC} 启动服务..."
        ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP "cd $PROJECT_DIR && docker-compose up -d"

        echo ""
        echo -e "${GREEN}部署完成！${NC}"
        echo "访问地址: http://$SERVER_IP"
        ;;

    "update"|"deploy")
        echo -e "${YELLOW}更新部署...${NC}"
        ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP << ENDSSH
            cd $PROJECT_DIR
            git fetch origin main
            git reset --hard origin/main
            docker-compose down
            docker-compose build --no-cache
            docker-compose up -d
ENDSSH
        echo -e "${GREEN}更新完成！${NC}"
        ;;

    "status")
        ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP "cd $PROJECT_DIR && docker-compose ps"
        ;;

    "logs")
        ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP "cd $PROJECT_DIR && docker-compose logs -f"
        ;;

    "restart")
        ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP "cd $PROJECT_DIR && docker-compose restart"
        echo -e "${GREEN}重启完成！${NC}"
        ;;

    "stop")
        ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP "cd $PROJECT_DIR && docker-compose down"
        echo -e "${GREEN}已停止！${NC}"
        ;;

    "ssh")
        ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP
        ;;

    *)
        echo "用法: ./一键部署.sh [命令]"
        echo ""
        echo "命令:"
        echo "  init     首次部署（安装Docker、克隆代码、启动）"
        echo "  update   更新部署（拉取最新代码并重启）"
        echo "  status   查看服务状态"
        echo "  logs     查看日志"
        echo "  restart  重启服务"
        echo "  stop     停止服务"
        echo "  ssh      连接到服务器"
        echo ""
        echo "示例:"
        echo "  ./一键部署.sh init    # 首次部署"
        echo "  ./一键部署.sh update  # 代码更新后重新部署"
        ;;
esac
