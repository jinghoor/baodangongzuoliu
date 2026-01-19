#!/bin/bash

# 远程部署脚本（在你的本地电脑上执行）
# 会自动连接到服务器并完成部署
# 使用方法: bash 远程部署.sh

set -e

# 服务器信息
SERVER_IP="115.190.192.248"
SERVER_USER="root"
SERVER_PORT="22"
SERVER_PASS="n2QSD=_2,fYMVzz"

echo "🚀 开始远程部署..."
echo "服务器: ${SERVER_USER}@${SERVER_IP}:${SERVER_PORT}"
echo "=================================="

# 检查是否安装了 sshpass
if ! command -v sshpass &> /dev/null; then
    echo "📦 安装 sshpass..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if ! command -v brew &> /dev/null; then
            echo "❌ 需要先安装 Homebrew"
            echo "请访问: https://brew.sh"
            exit 1
        fi
        brew install hudochenkov/sshpass/sshpass
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        sudo apt-get update
        sudo apt-get install -y sshpass
    else
        echo "❌ 不支持的操作系统"
        exit 1
    fi
fi

# 部署脚本内容
DEPLOY_SCRIPT=$(cat << 'DEPLOY_EOF'
#!/bin/bash
set -e

echo "🚀 开始一键部署..."
echo "=================================="

# 安装 Docker
echo ""
echo "📦 安装 Docker..."
apt update
apt install -y docker.io docker-compose

echo "启动 Docker..."
systemctl start docker
systemctl enable docker

echo "✅ Docker 安装完成"
docker --version
docker-compose --version

# 配置镜像加速器
echo ""
echo "⚙️  配置 Docker 镜像加速器..."
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
echo "✅ 镜像加速器配置完成"

# 创建项目目录
echo ""
echo "📁 创建项目目录..."
mkdir -p /opt/workflow
cd /opt/workflow

# 克隆项目
echo ""
echo "📥 克隆项目..."
if [ -d ".git" ]; then
    echo "更新代码..."
    git pull || {
        echo "更新失败，重新克隆..."
        cd ..
        rm -rf /opt/workflow
        mkdir -p /opt/workflow
        cd /opt/workflow
        git clone https://github.com/jinghoor/gongzuoliu123.git . || \
        git clone https://ghproxy.com/https://github.com/jinghoor/gongzuoliu123.git .
    }
else
    echo "克隆代码..."
    git clone https://github.com/jinghoor/gongzuoliu123.git . || \
    git clone https://ghproxy.com/https://github.com/jinghoor/gongzuoliu123.git .
fi

# 创建数据目录
echo ""
echo "📁 创建数据目录..."
mkdir -p data uploads logs
chmod 755 data uploads logs

# 配置环境变量
echo ""
echo "⚙️  配置环境变量..."
if [ ! -f .env ]; then
    cat > .env << 'EOF'
PORT=1888
NODE_ENV=production
DOUBAO_API_KEY=09484874-9519-4aa3-9cd4-f84ef0c6d44e
EOF
    chmod 600 .env
    echo "✅ 环境变量配置完成"
fi

# 配置防火墙
echo ""
echo "🔥 配置防火墙..."
ufw allow 22/tcp 2>/dev/null || true
ufw allow 1888/tcp 2>/dev/null || true
echo "✅ 防火墙规则已配置"

# 启动服务
echo ""
echo "🔨 构建并启动服务..."
echo "这可能需要几分钟，请耐心等待..."
docker-compose down 2>/dev/null || true
docker-compose build
docker-compose up -d

# 等待服务启动
echo ""
echo "⏳ 等待服务启动..."
sleep 20

# 验证部署
echo ""
echo "🔍 验证部署..."
if docker-compose ps | grep -q "Up"; then
    echo "✅ 服务已启动！"
else
    echo "⚠️  服务可能正在启动中..."
fi

# 测试健康检查
echo ""
echo "🏥 测试健康检查..."
sleep 5
for i in {1..5}; do
    if curl -f http://localhost:1888/health > /dev/null 2>&1; then
        echo "✅ 应用运行正常！"
        break
    else
        if [ $i -eq 5 ]; then
            echo "⚠️  健康检查失败，但服务可能正在启动中"
        else
            echo "等待服务启动... ($i/5)"
            sleep 3
        fi
    fi
done

echo ""
echo "═══════════════════════════════════════"
echo "🎉 部署完成！"
echo "═══════════════════════════════════════"
echo ""
echo "📌 访问地址:"
echo "   本地: http://localhost:1888"
echo "   外网: http://115.190.192.248:1888"
echo ""
DEPLOY_EOF
)

# 连接到服务器并执行部署脚本
echo "📡 连接到服务器..."
echo ""

# 使用 sshpass 执行部署脚本
sshpass -p "${SERVER_PASS}" ssh -o StrictHostKeyChecking=no -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_IP} "bash -s" <<< "${DEPLOY_SCRIPT}"

echo ""
echo "✅ 远程部署完成！"
echo ""
echo "📌 现在可以访问: http://115.190.192.248:1888"
echo ""
