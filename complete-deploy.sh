#!/bin/bash

# 完整部署脚本（包含 Docker 修复）
# 使用方法: bash complete-deploy.sh

set -e

echo "🚀 完整部署脚本（包含 Docker 修复）"
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

# 第一步：安装 Docker
echo -e "${BLUE}📦 第一步：安装 Docker...${NC}"

if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker 已安装: $(docker --version)${NC}"
else
    echo "安装 Docker..."
    
    # 卸载旧版本
    apt remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
    
    # 安装依赖
    apt update
    apt install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # 方法1: 使用官方安装脚本（最可靠）
    echo "使用官方安装脚本..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    if bash get-docker.sh; then
        echo -e "${GREEN}✅ Docker 安装成功${NC}"
        rm -f get-docker.sh
    else
        echo -e "${YELLOW}⚠️  官方脚本失败，尝试备用方法...${NC}"
        rm -f get-docker.sh
        
        # 备用方法：手动安装
        mkdir -p /etc/apt/keyrings
        curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
        chmod a+r /etc/apt/keyrings/docker.gpg
        
        echo \
          "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
          $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
        
        apt update
        apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    fi
    
    # 启动 Docker
    systemctl start docker
    systemctl enable docker
fi

# 第二步：安装 Docker Compose
echo -e "${BLUE}📦 第二步：安装 Docker Compose...${NC}"

if command -v docker-compose &> /dev/null; then
    echo -e "${GREEN}✅ Docker Compose 已安装: $(docker-compose --version)${NC}"
else
    # 尝试多个版本
    VERSIONS=("v2.24.5" "v2.23.3" "v2.21.0")
    
    for VERSION in "${VERSIONS[@]}"; do
        echo "尝试下载 Docker Compose ${VERSION}..."
        if curl -L "https://github.com/docker/compose/releases/download/${VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose 2>/dev/null; then
            chmod +x /usr/local/bin/docker-compose
            ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
            echo -e "${GREEN}✅ Docker Compose 安装成功${NC}"
            break
        fi
    done
    
    # 如果都失败，使用 apt
    if ! command -v docker-compose &> /dev/null; then
        echo "使用 apt 安装 Docker Compose..."
        apt install -y docker-compose || {
            echo -e "${RED}❌ Docker Compose 安装失败${NC}"
            exit 1
        }
    fi
fi

# 第三步：创建项目目录
echo -e "${BLUE}📁 第三步：创建项目目录...${NC}"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# 第四步：克隆项目
echo -e "${BLUE}📥 第四步：克隆项目...${NC}"
if [ -d ".git" ]; then
    echo "更新代码..."
    git pull || {
        echo "更新失败，重新克隆..."
        cd ..
        rm -rf $PROJECT_DIR
        mkdir -p $PROJECT_DIR
        cd $PROJECT_DIR
        git clone $REPO_URL .
    }
else
    echo "克隆代码..."
    git clone $REPO_URL .
fi

# 第五步：创建数据目录
echo -e "${BLUE}📁 第五步：创建数据目录...${NC}"
mkdir -p data uploads logs
chmod 755 data uploads logs

# 第六步：配置环境变量
echo -e "${BLUE}⚙️  第六步：配置环境变量...${NC}"
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

# 第七步：配置防火墙
echo -e "${BLUE}🔥 第七步：配置防火墙...${NC}"
ufw allow 22/tcp 2>/dev/null || true
ufw allow 1888/tcp 2>/dev/null || true
echo -e "${GREEN}✅ 防火墙规则已配置${NC}"

# 第八步：构建并启动
echo -e "${BLUE}🔨 第八步：构建并启动服务...${NC}"
docker-compose down 2>/dev/null || true
docker-compose build
docker-compose up -d

# 第九步：等待服务启动
echo -e "${BLUE}⏳ 等待服务启动...${NC}"
sleep 15

# 第十步：验证部署
echo -e "${BLUE}🔍 验证部署...${NC}"
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ 服务已启动！${NC}"
else
    echo -e "${RED}❌ 服务启动失败${NC}"
    echo "查看日志:"
    docker-compose logs
    exit 1
fi

# 测试健康检查
echo -e "${BLUE}🏥 测试健康检查...${NC}"
sleep 5
for i in {1..5}; do
    if curl -f http://localhost:1888/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ 应用运行正常！${NC}"
        break
    else
        if [ $i -eq 5 ]; then
            echo -e "${YELLOW}⚠️  健康检查失败，但服务可能正在启动中${NC}"
        else
            echo "等待服务启动... ($i/5)"
            sleep 3
        fi
    fi
done

# 显示结果
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
echo ""
echo -e "${YELLOW}⚠️  如果无法访问，请检查：${NC}"
echo "   1. 防火墙: ufw status"
echo "   2. 服务状态: cd $PROJECT_DIR && docker-compose ps"
echo "   3. 查看日志: cd $PROJECT_DIR && docker-compose logs"
echo ""
