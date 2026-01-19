#!/bin/bash

# 使用 apt 直接安装 Docker（适用于网络受限环境）
# 使用方法: bash install-docker-apt.sh

set -e

echo "🔧 使用 apt 安装 Docker（适用于网络受限环境）"
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

# 检查 Docker 是否已安装
if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker 已安装: $(docker --version)${NC}"
    docker --version
    exit 0
fi

echo -e "${BLUE}📦 更新软件包列表...${NC}"
apt update

echo -e "${BLUE}📦 安装必要的依赖...${NC}"
apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    apt-transport-https

echo -e "${BLUE}🐳 方法1: 尝试从 Ubuntu 仓库安装 Docker...${NC}"

# Ubuntu 20.04 仓库中有 docker.io 包
if apt install -y docker.io docker-compose 2>&1 | tee /tmp/docker-install.log; then
    echo -e "${GREEN}✅ Docker 安装成功（Ubuntu 仓库）${NC}"
    
    # 启动 Docker
    systemctl start docker
    systemctl enable docker
    
    # 验证
    if docker --version; then
        echo -e "${GREEN}✅ Docker 运行正常${NC}"
        
        # 配置镜像加速器
        echo -e "${BLUE}⚙️  配置 Docker 镜像加速器...${NC}"
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
        
        echo -e "${GREEN}✅ Docker 镜像加速器配置完成${NC}"
        echo ""
        echo -e "${GREEN}═══════════════════════════════════════${NC}"
        echo -e "${GREEN}🎉 Docker 安装完成！${NC}"
        echo -e "${GREEN}═══════════════════════════════════════${NC}"
        echo ""
        echo "Docker 版本: $(docker --version)"
        echo "Docker Compose 版本: $(docker-compose --version 2>/dev/null || echo '未安装')"
        echo ""
        exit 0
    fi
fi

echo -e "${YELLOW}⚠️  方法1 失败，尝试方法2...${NC}"

# 方法2: 手动添加 Docker 仓库（使用阿里云镜像）
echo -e "${BLUE}🐳 方法2: 添加 Docker 官方仓库（使用阿里云镜像）...${NC}"

# 清理之前的尝试
apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
rm -f /etc/apt/sources.list.d/docker.list

# 创建目录
mkdir -p /etc/apt/keyrings

# 尝试添加 GPG key（多个备用源）
echo "下载 Docker GPG key..."
GPG_SUCCESS=0

# 尝试1: 官方源
if curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /tmp/docker.gpg 2>/dev/null; then
    gpg --dearmor < /tmp/docker.gpg > /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    GPG_SUCCESS=1
    echo -e "${GREEN}✅ GPG key 下载成功（官方源）${NC}"
# 尝试2: 阿里云镜像
elif curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg -o /tmp/docker.gpg 2>/dev/null; then
    gpg --dearmor < /tmp/docker.gpg > /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    GPG_SUCCESS=1
    echo -e "${GREEN}✅ GPG key 下载成功（阿里云镜像）${NC}"
else
    echo -e "${YELLOW}⚠️  GPG key 下载失败，尝试跳过验证...${NC}"
fi

if [ "$GPG_SUCCESS" = "1" ]; then
    # 添加仓库（使用阿里云镜像）
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # 更新并安装
    apt update
    
    if apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; then
        echo -e "${GREEN}✅ Docker 安装成功（Docker 官方仓库）${NC}"
        
        # 启动 Docker
        systemctl start docker
        systemctl enable docker
        
        # 验证
        if docker --version; then
            echo -e "${GREEN}✅ Docker 运行正常${NC}"
            
            # 配置镜像加速器
            echo -e "${BLUE}⚙️  配置 Docker 镜像加速器...${NC}"
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
            
            echo -e "${GREEN}✅ Docker 镜像加速器配置完成${NC}"
            echo ""
            echo -e "${GREEN}═══════════════════════════════════════${NC}"
            echo -e "${GREEN}🎉 Docker 安装完成！${NC}"
            echo -e "${GREEN}═══════════════════════════════════════${NC}"
            echo ""
            echo "Docker 版本: $(docker --version)"
            echo ""
            exit 0
        fi
    fi
fi

# 方法3: 如果都失败，提供手动安装说明
echo -e "${RED}❌ 自动安装失败${NC}"
echo ""
echo "请尝试以下方法之一："
echo ""
echo "方法1: 使用 Ubuntu 仓库（最简单）"
echo "  apt update"
echo "  apt install -y docker.io docker-compose"
echo "  systemctl start docker"
echo "  systemctl enable docker"
echo ""
echo "方法2: 下载离线安装包"
echo "  1. 在有网络的机器上下载 Docker 安装包"
echo "  2. 传输到服务器"
echo "  3. 使用 dpkg 安装"
echo ""
echo "方法3: 联系服务器提供商"
echo "  某些云服务商提供预装 Docker 的镜像"
echo ""
exit 1
