#!/bin/bash

# Ubuntu 20.04 专用部署脚本
# 使用方法: bash ubuntu20-deploy.sh

set -e

echo "🚀 Ubuntu 20.04 服务器部署脚本"
echo "=================================="

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查系统版本
echo -e "${BLUE}📋 检查系统版本...${NC}"
if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [ "$ID" != "ubuntu" ] || [ "$VERSION_ID" != "20.04" ]; then
        echo -e "${YELLOW}⚠️  此脚本专为 Ubuntu 20.04 设计，当前系统: $ID $VERSION_ID${NC}"
        read -p "是否继续? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    else
        echo -e "${GREEN}✅ 系统版本: Ubuntu $VERSION_ID${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  无法检测系统版本，继续执行...${NC}"
fi

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}⚠️  需要 root 权限，使用 sudo 运行${NC}"
    exec sudo bash "$0" "$@"
fi

# 项目目录
PROJECT_DIR="/opt/workflow"
REPO_URL="https://github.com/jinghoor/gongzuoliu123.git"

# 1. 更新系统
echo -e "${BLUE}📦 更新系统包...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt update
apt upgrade -y

# 2. 安装基础工具
echo -e "${BLUE}📦 安装基础工具...${NC}"
apt install -y \
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    lsb-release \
    apt-transport-https

# 3. 安装 Docker
echo -e "${BLUE}🐳 安装 Docker...${NC}"
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker 已安装: $(docker --version)${NC}"
else
    echo "安装 Docker..."
    
    # 卸载旧版本
    apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # 添加 Docker 官方 GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # 设置仓库
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 安装 Docker Engine
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # 启动 Docker
    systemctl start docker
    systemctl enable docker
    
    echo -e "${GREEN}✅ Docker 安装完成${NC}"
fi

# 4. 安装 Docker Compose（独立版本，兼容性更好）
echo -e "${BLUE}🐳 检查 Docker Compose...${NC}"
if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✅ Docker Compose 已安装: $(docker-compose --version)${NC}"
else
    echo "安装 Docker Compose..."
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep tag_name | cut -d '"' -f 4)
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    echo -e "${GREEN}✅ Docker Compose 安装完成${NC}"
fi

# 5. 创建项目目录
echo -e "${BLUE}📁 创建项目目录...${NC}"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# 6. 克隆或更新代码
if [ -d ".git" ]; then
    echo -e "${BLUE}🔄 更新代码...${NC}"
    git pull || {
        echo -e "${YELLOW}⚠️  Git pull 失败，尝试重新克隆...${NC}"
        cd ..
        rm -rf $PROJECT_DIR
        mkdir -p $PROJECT_DIR
        cd $PROJECT_DIR
        git clone $REPO_URL .
    }
else
    echo -e "${BLUE}📥 克隆代码...${NC}"
    git clone $REPO_URL .
fi

# 7. 创建必要的目录
echo -e "${BLUE}📁 创建数据目录...${NC}"
mkdir -p data uploads logs
chmod 755 data uploads logs

# 8. 配置环境变量
echo -e "${BLUE}⚙️  配置环境变量...${NC}"
if [ ! -f .env ]; then
    cat > .env << 'EOF'
PORT=1888
NODE_ENV=production
DOUBAO_API_KEY=09484874-9519-4aa3-9cd4-f84ef0c6d44e
EOF
    chmod 600 .env
    echo -e "${GREEN}✅ 已创建 .env 文件${NC}"
    echo -e "${YELLOW}⚠️  请根据需要修改 .env 文件中的配置${NC}"
else
    echo -e "${GREEN}✅ .env 文件已存在${NC}"
fi

# 9. 配置防火墙
echo -e "${BLUE}🔥 配置防火墙...${NC}"
if command -v ufw &> /dev/null; then
    # 检查 UFW 是否已启用
    if ufw status | grep -q "Status: active"; then
        echo -e "${GREEN}✅ UFW 已启用${NC}"
    else
        echo "启用 UFW..."
        ufw --force enable
    fi
    
    # 允许 SSH（重要！）
    ufw allow 22/tcp 2>/dev/null || true
    
    # 允许应用端口
    ufw allow 1888/tcp 2>/dev/null || true
    
    echo -e "${GREEN}✅ 防火墙规则已配置${NC}"
else
    echo -e "${YELLOW}⚠️  UFW 未安装，跳过防火墙配置${NC}"
fi

# 10. 构建并启动容器
echo -e "${BLUE}🔨 构建并启动容器...${NC}"
docker-compose down 2>/dev/null || true
docker-compose build --no-cache
docker-compose up -d

# 11. 等待服务启动
echo -e "${BLUE}⏳ 等待服务启动...${NC}"
sleep 10

# 12. 检查服务状态
echo -e "${BLUE}🔍 检查服务状态...${NC}"
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ 服务已启动！${NC}"
else
    echo -e "${RED}❌ 服务启动失败${NC}"
    echo "查看日志: docker-compose logs"
    exit 1
fi

# 13. 测试健康检查
echo -e "${BLUE}🏥 测试健康检查...${NC}"
sleep 5
for i in {1..5}; do
    if curl -f http://localhost:1888/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 应用运行正常！${NC}"
        break
    else
        if [ $i -eq 5 ]; then
            echo -e "${YELLOW}⚠️  健康检查失败，但服务可能正在启动中${NC}"
            echo "请稍后手动检查: curl http://localhost:1888/health"
        else
            echo "等待服务启动... ($i/5)"
            sleep 3
        fi
    fi
done

# 14. 显示访问信息
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ipinfo.io/ip 2>/dev/null || hostname -I | awk '{print $1}')
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📌 访问地址:${NC}"
echo "   本地: http://localhost:1888"
if [ ! -z "$SERVER_IP" ]; then
    echo "   外网: http://${SERVER_IP}:1888"
fi
echo ""
echo -e "${BLUE}📝 常用命令:${NC}"
echo "   查看日志: cd $PROJECT_DIR && docker-compose logs -f"
echo "   重启服务: cd $PROJECT_DIR && docker-compose restart"
echo "   停止服务: cd $PROJECT_DIR && docker-compose stop"
echo "   更新代码: cd $PROJECT_DIR && git pull && docker-compose up -d --build"
echo ""
echo -e "${BLUE}📚 文档:${NC}"
echo "   详细文档: $PROJECT_DIR/Ubuntu20.04部署指南.md"
echo ""
echo -e "${YELLOW}⚠️  重要提示:${NC}"
echo "   1. 确保防火墙已开放 1888 端口"
echo "   2. 如需配置域名，请参考部署指南中的 Nginx 配置"
echo "   3. 定期备份 data/ 和 uploads/ 目录"
echo ""
