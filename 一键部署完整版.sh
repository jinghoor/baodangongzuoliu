#!/bin/bash

# 一键部署完整版（适用于中国大陆服务器）
# 使用方法: 直接复制整个脚本内容到服务器执行，或下载后执行

set -e

echo "🚀 开始一键部署..."
echo "=================================="

# 检查是否为 root
if [ "$EUID" -ne 0 ]; then 
    echo "⚠️  需要 root 权限，使用 sudo 运行"
    exec sudo bash "$0" "$@"
fi

# 第一步：安装 Docker
echo ""
echo "📦 第一步：安装 Docker..."
apt update
apt install -y docker.io docker-compose

echo "启动 Docker..."
systemctl start docker
systemctl enable docker

echo "✅ Docker 安装完成"
docker --version
docker-compose --version

# 第二步：配置镜像加速器
echo ""
echo "⚙️  第二步：配置 Docker 镜像加速器..."
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

# 第三步：创建项目目录
echo ""
echo "📁 第三步：创建项目目录..."
mkdir -p /opt/workflow
cd /opt/workflow

# 第四步：克隆项目
echo ""
echo "📥 第四步：克隆项目..."
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

# 第五步：创建数据目录
echo ""
echo "📁 第五步：创建数据目录..."
mkdir -p data uploads logs
chmod 755 data uploads logs

# 第六步：配置环境变量
echo ""
echo "⚙️  第六步：配置环境变量..."
if [ ! -f .env ]; then
    cat > .env << 'EOF'
PORT=1888
NODE_ENV=production
DOUBAO_API_KEY=09484874-9519-4aa3-9cd4-f84ef0c6d44e
EOF
    chmod 600 .env
    echo "✅ 环境变量配置完成"
else
    echo "✅ 环境变量文件已存在"
fi

# 第七步：配置防火墙
echo ""
echo "🔥 第七步：配置防火墙..."
ufw allow 22/tcp 2>/dev/null || true
ufw allow 1888/tcp 2>/dev/null || true
echo "✅ 防火墙规则已配置"

# 第八步：启动服务
echo ""
echo "🔨 第八步：构建并启动服务..."
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

# 显示结果
echo ""
echo "═══════════════════════════════════════"
echo "🎉 部署完成！"
echo "═══════════════════════════════════════"
echo ""
echo "📌 访问地址:"
echo "   本地: http://localhost:1888"
echo "   外网: http://115.190.192.248:1888"
echo ""
echo "📝 常用命令:"
echo "   查看日志: cd /opt/workflow && docker-compose logs -f"
echo "   重启服务: cd /opt/workflow && docker-compose restart"
echo "   停止服务: cd /opt/workflow && docker-compose stop"
echo ""
echo "如果无法访问，请检查:"
echo "   1. 防火墙: ufw status"
echo "   2. 服务状态: cd /opt/workflow && docker-compose ps"
echo "   3. 查看日志: cd /opt/workflow && docker-compose logs"
echo ""
