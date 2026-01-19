#!/bin/bash

# 服务器一键部署脚本
# 使用方法: bash server-deploy.sh

set -e

echo "🚀 开始部署工作流应用到服务器..."

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}⚠️  建议使用 root 用户运行此脚本${NC}"
    read -p "是否继续? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 项目目录
PROJECT_DIR="/opt/workflow"
REPO_URL="https://github.com/jinghoor/gongzuoliu123.git"

# 1. 检查并安装 Docker
echo -e "${GREEN}📦 检查 Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo "安装 Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl start docker
    systemctl enable docker
else
    echo "✅ Docker 已安装"
fi

# 2. 检查并安装 Docker Compose
echo -e "${GREEN}📦 检查 Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    echo "安装 Docker Compose..."
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo "✅ Docker Compose 已安装"
fi

# 3. 创建项目目录
echo -e "${GREEN}📁 创建项目目录...${NC}"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# 4. 克隆或更新代码
if [ -d ".git" ]; then
    echo "🔄 更新代码..."
    git pull
else
    echo "📥 克隆代码..."
    git clone $REPO_URL .
fi

# 5. 创建必要的目录
echo -e "${GREEN}📁 创建数据目录...${NC}"
mkdir -p data uploads logs
chmod 755 data uploads logs

# 6. 配置环境变量
echo -e "${GREEN}⚙️  配置环境变量...${NC}"
if [ ! -f .env ]; then
    cat > .env << 'EOF'
PORT=1888
NODE_ENV=production
DOUBAO_API_KEY=09484874-9519-4aa3-9cd4-f84ef0c6d44e
EOF
    echo "✅ 已创建 .env 文件，请根据需要修改"
else
    echo "✅ .env 文件已存在"
fi

# 7. 构建并启动容器
echo -e "${GREEN}🔨 构建并启动容器...${NC}"
docker-compose down 2>/dev/null || true
docker-compose build
docker-compose up -d

# 8. 等待服务启动
echo -e "${GREEN}⏳ 等待服务启动...${NC}"
sleep 5

# 9. 检查服务状态
echo -e "${GREEN}🔍 检查服务状态...${NC}"
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ 服务已启动！${NC}"
else
    echo -e "${RED}❌ 服务启动失败，请查看日志: docker-compose logs${NC}"
    exit 1
fi

# 10. 测试健康检查
echo -e "${GREEN}🏥 测试健康检查...${NC}"
sleep 3
if curl -f http://localhost:1888/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 应用运行正常！${NC}"
else
    echo -e "${YELLOW}⚠️  健康检查失败，但服务可能正在启动中${NC}"
fi

# 11. 显示访问信息
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "📌 访问地址:"
echo "   本地: http://localhost:1888"
echo "   外网: http://${SERVER_IP}:1888"
echo ""
echo "📝 常用命令:"
echo "   查看日志: docker-compose logs -f"
echo "   重启服务: docker-compose restart"
echo "   停止服务: docker-compose stop"
echo "   更新代码: cd $PROJECT_DIR && git pull && docker-compose up -d --build"
echo ""
echo -e "${YELLOW}⚠️  请确保防火墙已开放 1888 端口${NC}"
echo "   Ubuntu/Debian: sudo ufw allow 1888/tcp"
echo "   CentOS: sudo firewall-cmd --permanent --add-port=1888/tcp && sudo firewall-cmd --reload"
echo ""
