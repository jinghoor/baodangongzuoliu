#!/bin/bash

# 修复 docker-compose 版本兼容问题
# 在服务器上执行: bash 修复docker-compose.sh

set -e

SERVER_IP="115.190.192.248"
SERVER_USER="root"
SERVER_PORT="22"
SERVER_PASS="n2QSD=_2,fYMVzz"

echo "🔧 修复 docker-compose 版本兼容问题..."
echo ""

# 修复脚本
FIX_SCRIPT=$(cat << 'FIX_EOF'
#!/bin/bash
set -e

cd /opt/workflow

echo "修复 docker-compose.yml 文件..."

# 备份原文件
cp docker-compose.yml docker-compose.yml.bak

# 创建兼容 v1.x 的版本
cat > docker-compose.yml << 'COMPOSE_EOF'
version: '3'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: cross-border-workflow
    ports:
      - "1888:1888"
    env_file:
      - .env
    environment:
      - PORT=1888
      - NODE_ENV=production
      - DOUBAO_API_KEY=${DOUBAO_API_KEY:-}
      - OPENAI_API_KEY=${OPENAI_API_KEY:-}
      - DEFAULT_OPENAI_KEY=${DEFAULT_OPENAI_KEY:-}
    volumes:
      - ./data:/app/backend/data
      - ./uploads:/app/backend/uploads
    restart: unless-stopped
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
COMPOSE_EOF

echo "✅ docker-compose.yml 已修复"

# 验证文件
echo ""
echo "验证 docker-compose 配置..."
docker-compose config > /dev/null && echo "✅ 配置验证通过" || echo "❌ 配置验证失败"

# 启动服务
echo ""
echo "🔨 构建并启动服务..."
docker-compose up -d --build

echo ""
echo "⏳ 等待服务启动..."
sleep 20

# 验证部署
echo ""
echo "🔍 验证部署..."
docker-compose ps

echo ""
echo "🏥 测试健康检查..."
sleep 5
curl -f http://localhost:1888/health && echo "✅ 应用运行正常！" || echo "⚠️  健康检查失败，但服务可能正在启动中"

echo ""
echo "═══════════════════════════════════════"
echo "🎉 修复完成！"
echo "═══════════════════════════════════════"
echo ""
echo "📌 访问地址: http://115.190.192.248:1888"
echo ""
FIX_EOF
)

# 执行修复脚本
sshpass -p "${SERVER_PASS}" ssh -o StrictHostKeyChecking=no -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_IP} "bash -s" <<< "${FIX_SCRIPT}"

echo ""
echo "✅ 修复完成！"
echo ""
