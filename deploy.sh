#!/bin/bash

# 跨境电商工作流部署脚本
# 使用方法: ./deploy.sh [docker|pm2|manual]

set -e

DEPLOY_METHOD=${1:-docker}

echo "🚀 开始部署跨境电商工作流..."
echo "部署方式: $DEPLOY_METHOD"

# 检查 Node.js 版本
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "✅ Node.js 版本: $NODE_VERSION"
else
    echo "❌ 未检测到 Node.js，请先安装 Node.js 20+"
    exit 1
fi

case $DEPLOY_METHOD in
    docker)
        echo "📦 使用 Docker 部署..."
        
        # 检查 Docker
        if ! command -v docker &> /dev/null; then
            echo "❌ 未检测到 Docker，请先安装 Docker"
            exit 1
        fi
        
        if ! command -v docker-compose &> /dev/null; then
            echo "❌ 未检测到 docker-compose，请先安装 docker-compose"
            exit 1
        fi
        
        # 创建必要的目录
        mkdir -p data uploads logs
        
        # 构建并启动容器
        docker-compose down
        docker-compose build
        docker-compose up -d
        
        echo "✅ Docker 部署完成！"
        echo "应用运行在: http://localhost:1888"
        echo "查看日志: docker-compose logs -f"
        ;;
        
    pm2)
        echo "📦 使用 PM2 部署..."
        
        # 检查 PM2
        if ! command -v pm2 &> /dev/null; then
            echo "📥 安装 PM2..."
            npm install -g pm2
        fi
        
        # 创建必要的目录
        mkdir -p data uploads logs
        
        # 安装依赖
        echo "📥 安装后端依赖..."
        cd backend
        npm install
        
        echo "🔨 构建后端..."
        npm run build
        
        cd ../frontend
        echo "📥 安装前端依赖..."
        npm install
        
        echo "🔨 构建前端..."
        npm run build
        
        cd ..
        
        # 启动 PM2
        echo "🚀 启动应用..."
        pm2 delete cross-border-workflow 2>/dev/null || true
        pm2 start ecosystem.config.js
        pm2 save
        
        echo "✅ PM2 部署完成！"
        echo "应用运行在: http://localhost:1888"
        echo "查看状态: pm2 status"
        echo "查看日志: pm2 logs cross-border-workflow"
        ;;
        
    manual)
        echo "📦 手动部署..."
        
        # 创建必要的目录
        mkdir -p data uploads logs
        
        # 安装后端依赖
        echo "📥 安装后端依赖..."
        cd backend
        npm install
        
        echo "🔨 构建后端..."
        npm run build
        
        cd ../frontend
        echo "📥 安装前端依赖..."
        npm install
        
        echo "🔨 构建前端..."
        npm run build
        
        cd ..
        
        echo "✅ 构建完成！"
        echo "手动启动: cd backend && npm start"
        echo "应用将运行在: http://localhost:1888"
        ;;
        
    *)
        echo "❌ 未知的部署方式: $DEPLOY_METHOD"
        echo "可用方式: docker, pm2, manual"
        exit 1
        ;;
esac

echo ""
echo "🎉 部署完成！"
