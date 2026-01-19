#!/bin/bash

# 中国大陆服务器专用部署脚本
# 使用国内镜像源加速安装
# 使用方法: bash china-deploy.sh

set -e

echo "🚀 中国大陆服务器专用部署脚本"
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

PROJECT_DIR="/opt/workflow"
REPO_URL="https://github.com/jinghoor/gongzuoliu123.git"

# 第一步：更新系统并安装基础工具
echo -e "${BLUE}📦 第一步：更新系统并安装基础工具...${NC}"
apt update
apt install -y \
    ca-certificates \
    curl \
    wget \
    git \
    gnupg \
    lsb-release \
    apt-transport-https

# 第二步：安装 Docker（使用国内镜像源）
echo -e "${BLUE}🐳 第二步：安装 Docker（使用阿里云镜像源）...${NC}"

if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker 已安装: $(docker --version)${NC}"
else
    echo "卸载旧版本..."
    apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    echo "配置阿里云 Docker 镜像源..."
    # 创建目录
    mkdir -p /etc/apt/keyrings
    
    # 添加阿里云 Docker 镜像源
    cat > /etc/apt/sources.list.d/docker.list << 'EOF'
deb [arch=amd64] https://mirrors.aliyun.com/docker-ce/linux/ubuntu focal stable
EOF
    
    # 添加 Docker 官方 GPG key（使用多个备用源）
    echo "下载 Docker GPG key..."
    GPG_SUCCESS=0
    
    # 方法1: 官方源
    if curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null; then
        GPG_SUCCESS=1
        echo -e "${GREEN}✅ GPG key 下载成功（官方源）${NC}"
    # 方法2: 使用预定义 key（如果网络问题）
    else
        echo -e "${YELLOW}⚠️  官方源失败，使用备用方法...${NC}"
        # 使用已知的 Docker GPG key ID
        curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null || {
            echo -e "${YELLOW}⚠️  尝试直接安装（跳过 GPG 验证）...${NC}"
            # 如果 GPG 也失败，使用官方安装脚本
            curl -fsSL https://get.docker.com | bash -s -- --mirror Aliyun
            GPG_SUCCESS=2
        }
    fi
    
    if [ "$GPG_SUCCESS" != "2" ]; then
        chmod a+r /etc/apt/keyrings/docker.gpg
        
        # 更新并安装
        echo "更新软件包列表..."
        apt update
        
        echo "安装 Docker..."
        apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    fi
    
    # 启动 Docker
    systemctl start docker
    systemctl enable docker
    
    # 验证
    if docker --version; then
        echo -e "${GREEN}✅ Docker 安装成功${NC}"
    else
        echo -e "${RED}❌ Docker 安装失败${NC}"
        exit 1
    fi
fi

# 第三步：配置 Docker 镜像加速器（使用国内镜像）
echo -e "${BLUE}⚙️  第三步：配置 Docker 镜像加速器...${NC}"
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

# 第四步：安装 Docker Compose（使用国内镜像）
echo -e "${BLUE}📦 第四步：安装 Docker Compose...${NC}"

if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✅ Docker Compose 已安装: $(docker-compose --version)${NC}"
else
    # 尝试多个国内下载源
    VERSIONS=("v2.24.5" "v2.23.3" "v2.21.0")
    COMPOSE_INSTALLED=0
    
    for VERSION in "${VERSIONS[@]}"; do
        echo "尝试下载 Docker Compose ${VERSION}..."
        
        # 方法1: GitHub（可能较慢但最可靠）
        if curl -L "https://github.com/docker/compose/releases/download/${VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /tmp/docker-compose 2>/dev/null; then
            mv /tmp/docker-compose /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
            ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
            COMPOSE_INSTALLED=1
            echo -e "${GREEN}✅ Docker Compose 安装成功（GitHub）${NC}"
            break
        fi
        
        # 方法2: 使用 GitHub 代理（如果直接访问失败）
        if curl -L "https://ghproxy.com/https://github.com/docker/compose/releases/download/${VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /tmp/docker-compose 2>/dev/null; then
            mv /tmp/docker-compose /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
            ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
            COMPOSE_INSTALLED=1
            echo -e "${GREEN}✅ Docker Compose 安装成功（GitHub 代理）${NC}"
            break
        fi
    done
    
    # 如果都失败，使用 apt 安装（版本可能较旧）
    if [ "$COMPOSE_INSTALLED" = "0" ]; then
        echo -e "${YELLOW}⚠️  直接下载失败，尝试使用 apt 安装...${NC}"
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

# 第五步：创建项目目录
echo -e "${BLUE}📁 第五步：创建项目目录...${NC}"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# 第六步：克隆项目（使用 GitHub 代理如果直接访问失败）
echo -e "${BLUE}📥 第六步：克隆项目...${NC}"
if [ -d ".git" ]; then
    echo "更新代码..."
    git pull || {
        echo "更新失败，重新克隆..."
        cd ..
        rm -rf $PROJECT_DIR
        mkdir -p $PROJECT_DIR
        cd $PROJECT_DIR
        git clone $REPO_URL . || {
            echo -e "${YELLOW}⚠️  直接克隆失败，尝试使用代理...${NC}"
            git clone https://ghproxy.com/${REPO_URL} .
        }
    }
else
    echo "克隆代码..."
    git clone $REPO_URL . || {
        echo -e "${YELLOW}⚠️  直接克隆失败，尝试使用代理...${NC}"
        git clone https://ghproxy.com/${REPO_URL} .
    }
fi

# 第七步：创建数据目录
echo -e "${BLUE}📁 第七步：创建数据目录...${NC}"
mkdir -p data uploads logs
chmod 755 data uploads logs

# 第八步：配置环境变量
echo -e "${BLUE}⚙️  第八步：配置环境变量...${NC}"
if [ ! -f .env ]; then
    cat > .env << 'EOF'
PORT=1888
NODE_ENV=production
DOUBAO_API_KEY=09484874-9519-4aa3-9cd4-f84ef0c6d44e
EOF
    chmod 600 .env
    echo -e "${GREEN}✅ 已创建 .env 文件${NC}"
else
    echo -e "${GREEN}✅ .env 文件已存在${NC}"
fi

# 第九步：配置防火墙
echo -e "${BLUE}🔥 第九步：配置防火墙...${NC}"
ufw allow 22/tcp 2>/dev/null || true
ufw allow 1888/tcp 2>/dev/null || true
echo -e "${GREEN}✅ 防火墙规则已配置${NC}"

# 第十步：构建并启动
echo -e "${BLUE}🔨 第十步：构建并启动服务...${NC}"
docker-compose down 2>/dev/null || true

echo "开始构建镜像（这可能需要几分钟，请耐心等待）..."
docker-compose build

echo "启动服务..."
docker-compose up -d

# 第十一步：等待服务启动
echo -e "${BLUE}⏳ 等待服务启动...${NC}"
sleep 20

# 第十二步：验证部署
echo -e "${BLUE}🔍 验证部署...${NC}"
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ 服务已启动！${NC}"
else
    echo -e "${RED}❌ 服务启动失败${NC}"
    echo "查看日志:"
    docker-compose logs --tail=50
    exit 1
fi

# 测试健康检查
echo -e "${BLUE}🏥 测试健康检查...${NC}"
sleep 5
for i in {1..10}; do
    if curl -f http://localhost:1888/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 应用运行正常！${NC}"
        break
    else
        if [ $i -eq 10 ]; then
            echo -e "${YELLOW}⚠️  健康检查失败，但服务可能正在启动中${NC}"
            echo "请稍后手动检查: curl http://localhost:1888/health"
        else
            echo "等待服务启动... ($i/10)"
            sleep 3
        fi
    fi
done

# 显示结果
SERVER_IP=$(hostname -I | awk '{print $1}' || echo "115.190.192.248")
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}📌 访问地址:${NC}"
echo "   本地: http://localhost:1888"
echo "   外网: http://${SERVER_IP}:1888"
echo ""
echo -e "${BLUE}📝 常用命令:${NC}"
echo "   查看日志: cd $PROJECT_DIR && docker-compose logs -f"
echo "   重启服务: cd $PROJECT_DIR && docker-compose restart"
echo "   停止服务: cd $PROJECT_DIR && docker-compose stop"
echo "   更新代码: cd $PROJECT_DIR && git pull && docker-compose up -d --build"
echo ""
echo -e "${YELLOW}⚠️  如果无法访问，请检查：${NC}"
echo "   1. 防火墙: ufw status"
echo "   2. 服务状态: cd $PROJECT_DIR && docker-compose ps"
echo "   3. 查看日志: cd $PROJECT_DIR && docker-compose logs"
echo ""
