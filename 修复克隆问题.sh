#!/bin/bash

# 修复克隆问题并完成部署
# 使用方法: bash 修复克隆问题.sh

set -e

SERVER_IP="115.190.192.248"
SERVER_USER="root"
SERVER_PORT="22"
SERVER_PASS="n2QSD=_2,fYMVzz"

echo "🔧 修复克隆问题并完成部署..."
echo ""

# 修复脚本
FIX_SCRIPT=$(cat << 'FIX_EOF'
#!/bin/bash
set -e

cd /opt/workflow

# 尝试多个 GitHub 代理
echo "尝试使用不同的方式克隆项目..."

# 方法1: 使用 fastgit
git clone https://hub.fastgit.xyz/jinghoor/gongzuoliu123.git . 2>/dev/null && echo "✅ 使用 fastgit 克隆成功" && exit 0

# 方法2: 使用 gitclone
git clone https://gitclone.com/github.com/jinghoor/gongzuoliu123.git . 2>/dev/null && echo "✅ 使用 gitclone 克隆成功" && exit 0

# 方法3: 使用镜像站
git clone https://mirror.ghproxy.com/https://github.com/jinghoor/gongzuoliu123.git . 2>/dev/null && echo "✅ 使用镜像站克隆成功" && exit 0

# 方法4: 如果都失败，创建基本结构
echo "⚠️  所有克隆方法都失败，创建基本项目结构..."

rm -rf /opt/workflow
mkdir -p /opt/workflow
cd /opt/workflow

# 创建基本的 docker-compose.yml
cat > docker-compose.yml << 'COMPOSE_EOF'
version: '3.8'

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
      - PORT=${PORT:-1888}
      - NODE_ENV=${NODE_ENV:-production}
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

# 创建 .env
cat > .env << 'ENV_EOF'
PORT=1888
NODE_ENV=production
DOUBAO_API_KEY=09484874-9519-4aa3-9cd4-f84ef0c6d44e
ENV_EOF

# 创建数据目录
mkdir -p data uploads logs

echo "✅ 基本结构创建完成"
echo "⚠️  需要手动上传项目文件或使用其他方式获取代码"
FIX_EOF
)

# 执行修复脚本
sshpass -p "${SERVER_PASS}" ssh -o StrictHostKeyChecking=no -p ${SERVER_PORT} ${SERVER_USER}@${SERVER_IP} "bash -s" <<< "${FIX_SCRIPT}"

echo ""
echo "✅ 修复脚本执行完成"
echo ""
