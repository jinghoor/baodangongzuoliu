#!/bin/bash

# 下载项目 ZIP 并完成部署
# 使用方法: bash 下载并部署.sh

set -e

SERVER_IP="115.190.192.248"
SERVER_USER="root"
SERVER_PORT="22"
SERVER_PASS="n2QSD=_2,fYMVzz"

echo "🔧 下载项目并完成部署..."
echo ""

# 部署脚本
DEPLOY_SCRIPT=$(cat << 'DEPLOY_EOF'
#!/bin/bash
set -e

cd /opt

# 清理旧目录
rm -rf workflow workflow-main

# 尝试多个方式下载项目
echo "📥 尝试下载项目..."

# 方法1: 直接下载 ZIP（GitHub）
if wget -O workflow.zip "https://github.com/jinghoor/gongzuoliu123/archive/refs/heads/main.zip" 2>/dev/null; then
    echo "✅ 下载成功（GitHub）"
    unzip -q workflow.zip
    mv gongzuoliu123-main workflow
    rm workflow.zip
# 方法2: 使用代理下载
elif wget -O workflow.zip "https://ghproxy.com/https://github.com/jinghoor/gongzuoliu123/archive/refs/heads/main.zip" 2>/dev/null; then
    echo "✅ 下载成功（代理）"
    unzip -q workflow.zip
    mv gongzuoliu123-main workflow
    rm workflow.zip
# 方法3: 使用镜像站
elif wget -O workflow.zip "https://hub.fastgit.xyz/jinghoor/gongzuoliu123/archive/refs/heads/main.zip" 2>/dev/null; then
    echo "✅ 下载成功（镜像站）"
    unzip -q workflow.zip
    mv gongzuoliu123-main workflow
    rm workflow.zip
else
    echo "❌ 所有下载方式都失败"
    echo "请手动上传项目文件到 /opt/workflow"
    exit 1
fi

cd /opt/workflow

# 创建数据目录
mkdir -p data uploads logs
chmod 755 data uploads logs

# 配置环境变量
if [ ! -f .env ]; then
    cat > .env << 'ENV_EOF'
PORT=1888
NODE_ENV=production
DOUBAO_API_KEY=09484874-9519-4aa3-9cd4-f84ef0c6d44e
ENV_EOF
    chmod 600 .env
    echo "✅ 环境变量配置完成"
fi

# 配置防火墙
ufw allow 22/tcp 2>/dev/null || true
ufw allow 1888/tcp 2>/dev/null || true

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
echo "📌 访问地址: http://115.190.192.248:1888"
echo ""
DEPLOY_EOF
)

# 执行部署脚本
sshpass -p "${SERVER_PASS}" ssh -o StrictHostKeyChecking=no -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_IP} "bash -s" <<< "${DEPLOY_SCRIPT}"

echo ""
echo "✅ 部署完成！"
echo ""
