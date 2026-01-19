#!/bin/bash

# Docker 安装修复脚本（适用于网络问题）
# 使用方法: bash fix-docker-install.sh

set -e

echo "🔧 Docker 安装修复脚本"
echo "=================================="

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}⚠️  需要 root 权限，使用 sudo 运行${NC}"
    exec sudo bash "$0" "$@"
fi

# 方法1: 使用阿里云镜像安装 Docker
echo -e "${BLUE}📦 方法1: 尝试使用阿里云镜像安装 Docker...${NC}"

# 卸载旧版本
apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

# 安装依赖
apt update
apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# 使用阿里云镜像源
mkdir -p /etc/apt/keyrings

# 添加阿里云 Docker 镜像源
cat > /etc/apt/sources.list.d/docker.list << 'EOF'
deb [arch=amd64] https://mirrors.aliyun.com/docker-ce/linux/ubuntu focal stable
EOF

# 添加 Docker 官方 GPG key（使用备用方法）
echo -e "${BLUE}🔑 添加 Docker GPG key...${NC}"
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null || {
    echo -e "${YELLOW}⚠️  GPG key 下载失败，尝试备用方法...${NC}"
    # 使用预定义的 key
    echo "9DC858229FC7DD38854AE2D88D81803C0EBFCD88" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null || true
}

chmod a+r /etc/apt/keyrings/docker.gpg

# 更新并安装
apt update

# 尝试安装 Docker
if apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin 2>&1 | tee /tmp/docker-install.log; then
    echo -e "${GREEN}✅ Docker 安装成功（方法1）${NC}"
    METHOD=1
else
    echo -e "${YELLOW}⚠️  方法1 失败，尝试方法2...${NC}"
    METHOD=0
fi

# 方法2: 使用 get.docker.com 脚本（如果方法1失败）
if [ "$METHOD" = "0" ]; then
    echo -e "${BLUE}📦 方法2: 使用官方安装脚本...${NC}"
    
    # 清理之前的尝试
    apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    rm -f /etc/apt/sources.list.d/docker.list
    
    # 使用官方安装脚本
    curl -fsSL https://get.docker.com -o get-docker.sh
    if bash get-docker.sh; then
        echo -e "${GREEN}✅ Docker 安装成功（方法2）${NC}"
        METHOD=2
        rm -f get-docker.sh
    else
        echo -e "${RED}❌ 方法2 也失败${NC}"
        rm -f get-docker.sh
        exit 1
    fi
fi

# 启动 Docker
echo -e "${BLUE}🚀 启动 Docker 服务...${NC}"
systemctl start docker
systemctl enable docker

# 验证 Docker
if docker --version; then
    echo -e "${GREEN}✅ Docker 运行正常${NC}"
else
    echo -e "${RED}❌ Docker 启动失败${NC}"
    exit 1
fi

# 安装 Docker Compose（独立版本）
echo -e "${BLUE}📦 安装 Docker Compose...${NC}"
if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✅ Docker Compose 已安装${NC}"
else
    # 尝试多个下载源
    DOCKER_COMPOSE_VERSION="v2.24.5"
    
    echo "尝试从 GitHub 下载 Docker Compose..."
    if curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose; then
        chmod +x /usr/local/bin/docker-compose
        ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
        echo -e "${GREEN}✅ Docker Compose 安装成功${NC}"
    else
        echo -e "${YELLOW}⚠️  GitHub 下载失败，尝试使用 apt 安装...${NC}"
        apt install -y docker-compose || {
            echo -e "${RED}❌ Docker Compose 安装失败${NC}"
            exit 1
        }
    fi
fi

# 验证 Docker Compose
if docker-compose --version; then
    echo -e "${GREEN}✅ Docker Compose 运行正常${NC}"
else
    echo -e "${RED}❌ Docker Compose 验证失败${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 Docker 安装完成！${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "现在可以继续部署项目了："
echo ""
echo "cd /opt/workflow || mkdir -p /opt/workflow && cd /opt/workflow"
echo "git clone https://github.com/jinghoor/gongzuoliu123.git ."
echo "mkdir -p data uploads logs"
echo "cat > .env << 'EOF'"
echo "PORT=1888"
echo "NODE_ENV=production"
echo "DOUBAO_API_KEY=09484874-9519-4aa3-9cd4-f84ef0c6d44e"
echo "EOF"
echo "docker-compose up -d --build"
echo ""
