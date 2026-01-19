#!/bin/bash

# ============================================
# 一键更新脚本 - 更新云服务器上的代码
# ============================================
# 使用方法：
# 1. 在本地修改代码
# 2. 运行此脚本：bash 一键更新.sh
# 3. 脚本会自动推送代码到GitHub并更新服务器
# ============================================

set -e  # 遇到错误立即退出

# ========== 配置区域 ==========
# 请根据你的实际情况修改以下配置
SERVER_IP="206.119.175.36"
SERVER_PORT="64478"
SERVER_USER="root"
PROJECT_NAME="cross-border-workflow"
BACKEND_PORT="3000"
APP_DIR="/opt/$PROJECT_NAME"

# ========== 颜色输出 ==========
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ========== 检查本地环境 ==========
print_info "检查本地环境..."

# 检查是否在git仓库中
if [ ! -d ".git" ]; then
    print_error "当前目录不是Git仓库"
    exit 1
fi

# 检查是否有未提交的更改
if [ -n "$(git status --porcelain)" ]; then
    print_warn "检测到未提交的更改"
    read -p "是否提交这些更改？(y/n): " commit_changes
    if [ "$commit_changes" = "y" ]; then
        read -p "请输入提交信息: " commit_msg
        if [ -z "$commit_msg" ]; then
            commit_msg="Update $(date +%Y%m%d_%H%M%S)"
        fi
        git add .
        git commit -m "$commit_msg"
    else
        print_error "请先提交或暂存更改"
        exit 1
    fi
fi

# ========== 推送到GitHub ==========
print_info "推送代码到GitHub..."
git push origin main || git push origin master

# ========== 更新服务器 ==========
print_info "连接到服务器 ${SERVER_USER}@${SERVER_IP}:${SERVER_PORT}..."

# 创建远程更新脚本
REMOTE_SCRIPT=$(cat <<'REMOTE_SCRIPT_EOF'
#!/bin/bash
set -e

PROJECT_NAME="cross-border-workflow"
BACKEND_PORT="3000"
APP_DIR="/opt/$PROJECT_NAME"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info "开始更新 $PROJECT_NAME..."

cd $APP_DIR

# 1. 拉取最新代码
print_info "拉取最新代码..."
git pull origin main || git pull origin master

# 2. 更新后端依赖
print_info "更新后端依赖..."
cd $APP_DIR/backend
npm install --production

# 3. 重新构建后端
print_info "重新构建后端..."
npm run build

# 4. 更新前端依赖
print_info "更新前端依赖..."
cd $APP_DIR/frontend
npm install

# 5. 重新构建前端
print_info "重新构建前端..."
npm run build

# 6. 重启后端服务
print_info "重启后端服务..."
pm2 restart $PROJECT_NAME || pm2 start dist/index.js --name $PROJECT_NAME --env production

# 7. 重新加载Nginx（无需重启，只需重新加载配置）
print_info "重新加载Nginx..."
systemctl reload nginx

print_info "============================================"
print_info "更新完成！"
print_info "============================================"
print_info "网站已更新: http://${SERVER_IP}"
print_info ""
print_info "查看后端日志: pm2 logs $PROJECT_NAME"
print_info "============================================"
REMOTE_SCRIPT_EOF
)

# 执行远程脚本
print_info "执行远程更新..."
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP "bash -s" <<EOF
$REMOTE_SCRIPT
EOF

print_info ""
print_info "============================================"
print_info "更新完成！"
print_info "============================================"
print_info "你的网站已更新: http://${SERVER_IP}"
print_info "============================================"
