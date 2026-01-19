#!/bin/bash

# 最简单的部署脚本（使用 apt 安装 Docker）
# 适用于网络受限的中国大陆服务器
# 使用方法: bash 简单部署.sh

set -e

echo "🚀 简单部署脚本（使用 apt 安装 Docker）"
echo "=================================="

# 颜色输出
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

# 第一步：安装 Docker（使用 apt）
echo -e "${BLUE}📦 第一步：安装 Docker...${NC}"

if command -v docker &> /dev/null; then
    echo -e "${GREEN}✅ Docker 已安装${NC}"
else
    echo "更新软件包列表..."
    apt update
    
    echo "安装 Docker（从 Ubuntu 仓库）..."
    apt install -y docker.io docker-compose
    
    echo "启动 Docker..."
    systemctl start docker
    systemctl enable docker
    
    echo -e "${GREEN}✅ Docker 安装完成${NC}"
fi

# 配置 Docker 镜像加速器
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
echo -e "${GREEN}✅ 镜像加速器配置完成${NC}"

# 第二步：创建项目目录
echo -e "${BLUE}📁 第二步：创建项目目录...${NC}"
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# 第三步：克隆项目
echo -e "${BLUE}📥 第三步：克隆项目...${NC}"
if [ -d ".git" ]; then
    echo "更新代码..."
    git pull || {
        echo "更新失败，重新克隆..."
        cd ..
        rm -rf $PROJECT_DIR
        mkdir -p $PROJECT_DIR
        cd $PROJECT_DIR
        git clone https://github.com/jinghoor/gongzuoliu123.git . || {
            echo "尝试使用代理..."
            git clone https://ghproxy.com/https://github.com/jinghoor/gongzuoliu123.git .
        }
    }
else
    echo "克隆代码..."
    git clone https://github.com/jinghoor/gongzuoliu123.git . || {
        echo "尝试使用代理..."
        git clone https://ghproxy.com/https://github.com/jinghoor/gongzuoliu123.git .
    }
fi

# 第四步：创建数据目录
echo -e "${BLUE}📁 第四步：创建数据目录...${NC}"
mkdir -p data uploads logs
chmod 755 data uploads logs

# 第五步：配置环境变量
echo -e "${BLUE}⚙️  第五步：配置环境变量...${NC}"
if [ ! -f .env ]; then
    cat > .env << 'EOF'
PORT=1888
NODE_ENV=production
DOUBAO_API_KEY=09484874-9519-4aa3-9cd4-f84ef0c6d44e
EOF
    chmod 600 .env
    echo -e "${GREEN}✅ 已创建 .env 文件${NC}"
fi

# 第六步：配置防火墙
echo -e "${BLUE}🔥 第六步：配置防火墙...${NC}"
ufw allow 22/tcp 2>/dev/null || true
ufw allow 1888/tcp 2>/dev/null || true

# 第七步：启动服务
echo -e "${BLUE}🔨 第七步：启动服务...${NC}"
docker-compose down 2>/dev/null || true
docker-compose build
docker-compose up -d

# 等待服务启动
echo -e "${BLUE}⏳ 等待服务启动...${NC}"
sleep 20

# 验证
echo -e "${BLUE}🔍 验证部署...${NC}"
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ 服务已启动！${NC}"
else
    echo -e "${YELLOW}⚠️  服务可能正在启动中，请稍后检查${NC}"
fi

# 显示结果
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "访问地址: http://115.190.192.248:1888"
echo ""
echo "常用命令:"
echo "  查看日志: cd $PROJECT_DIR && docker-compose logs -f"
echo "  重启服务: cd $PROJECT_DIR && docker-compose restart"
echo ""
