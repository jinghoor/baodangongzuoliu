#!/bin/bash

# ============================================
# 一键部署脚本 - 首次部署到云服务器
# ============================================
# 使用方法：
# 1. 在本地运行此脚本：bash 一键部署到云服务器.sh
# 2. 脚本会自动连接到服务器并完成所有部署工作
# ============================================

set -e  # 遇到错误立即退出

# ========== 配置区域 ==========
# 请根据你的实际情况修改以下配置
SERVER_IP="206.119.175.36"
SERVER_PORT="64478"
SERVER_USER="root"
SERVER_HOSTNAME="cloud170685"
PROJECT_NAME="cross-border-workflow"
BACKEND_PORT="3000"  # 后端运行端口
FRONTEND_PORT="80"   # 前端访问端口（Nginx）

# GitHub仓库地址（如果还没有，需要先创建）
# 请先创建GitHub仓库，然后填写下面的地址
GITHUB_REPO="https://github.com/jinghoor/baodangongzuoliu.git"  # 例如: https://github.com/yourusername/your-repo.git

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

# 检查是否安装了ssh
if ! command -v ssh &> /dev/null; then
    print_error "未找到 ssh 命令，请先安装 OpenSSH"
    exit 1
fi

# 检查是否安装了git
if ! command -v git &> /dev/null; then
    print_error "未找到 git 命令，请先安装 Git"
    exit 1
fi

# 检查是否在git仓库中
if [ ! -d ".git" ]; then
    print_warn "当前目录不是Git仓库，正在初始化..."
    git init
    git add .
    git commit -m "Initial commit"
fi

# ========== 检查GitHub仓库 ==========
if [ -z "$GITHUB_REPO" ]; then
    print_warn "未配置GitHub仓库地址"
    print_info "请先创建GitHub仓库，然后："
    print_info "1. 在GitHub上创建一个新仓库"
    print_info "2. 运行以下命令："
    print_info "   git remote add origin <你的GitHub仓库地址>"
    print_info "   git push -u origin main"
    print_info ""
    read -p "是否已创建GitHub仓库并推送代码？(y/n): " has_repo
    if [ "$has_repo" != "y" ]; then
        print_error "请先创建GitHub仓库并推送代码"
        exit 1
    fi
    read -p "请输入你的GitHub仓库地址: " GITHUB_REPO
fi

# 确保代码已推送到GitHub
print_info "检查GitHub仓库连接..."
if ! git remote get-url origin &> /dev/null; then
    git remote add origin "$GITHUB_REPO"
fi

# 推送代码到GitHub
print_info "推送代码到GitHub..."
git add .
git commit -m "Deploy to server $(date +%Y%m%d_%H%M%S)" || true
git push -u origin main || git push -u origin master || true

# ========== 连接到服务器并执行部署 ==========
print_info "连接到服务器 ${SERVER_USER}@${SERVER_IP}:${SERVER_PORT}..."

# 创建远程部署脚本
REMOTE_SCRIPT=$(cat <<'REMOTE_SCRIPT_EOF'
#!/bin/bash
set -e

PROJECT_NAME="cross-border-workflow"
BACKEND_PORT="3000"
FRONTEND_PORT="80"
GITHUB_REPO="$1"
SERVER_IP="$2"
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

print_info "开始部署 $PROJECT_NAME..."

# 1. 更新系统
print_info "更新系统包..."
yum update -y

# 2. 安装必要的软件
print_info "安装必要的软件..."

# 安装Node.js (使用NodeSource仓库)
if ! command -v node &> /dev/null; then
    print_info "安装 Node.js..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    yum install -y nodejs
else
    print_info "Node.js 已安装: $(node --version)"
fi

# 安装PM2
if ! command -v pm2 &> /dev/null; then
    print_info "安装 PM2..."
    npm install -g pm2
else
    print_info "PM2 已安装: $(pm2 --version)"
fi

# 安装Nginx
if ! command -v nginx &> /dev/null; then
    print_info "安装 Nginx..."
    yum install -y nginx
    systemctl enable nginx
else
    print_info "Nginx 已安装"
fi

# 安装Git
if ! command -v git &> /dev/null; then
    print_info "安装 Git..."
    yum install -y git
else
    print_info "Git 已安装: $(git --version)"
fi

# 3. 配置防火墙
print_info "配置防火墙..."
if command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-service=http
    firewall-cmd --permanent --add-service=https
    firewall-cmd --reload
fi

# 4. 创建应用目录
print_info "创建应用目录..."
mkdir -p $APP_DIR
cd $APP_DIR

# 5. 克隆或更新代码
if [ -d ".git" ]; then
    print_info "更新代码..."
    git pull origin main || git pull origin master
else
    print_info "克隆代码..."
    if [ -z "$GITHUB_REPO" ]; then
        print_error "GitHub仓库地址未提供"
        exit 1
    fi
    git clone "$GITHUB_REPO" .
fi

# 6. 安装后端依赖
print_info "安装后端依赖..."
cd $APP_DIR/backend
npm install --production

# 7. 构建后端
print_info "构建后端..."
npm run build

# 8. 安装前端依赖
print_info "安装前端依赖..."
cd $APP_DIR/frontend
npm install

# 9. 配置前端环境变量
print_info "配置前端环境变量..."
# 生产环境使用相对路径，通过Nginx代理访问API
cat > .env <<EOF
VITE_API_BASE_URL=/api
EOF

# 10. 构建前端
print_info "构建前端..."
npm run build

# 11. 创建数据目录
print_info "创建数据目录..."
mkdir -p $APP_DIR/backend/data
mkdir -p $APP_DIR/backend/uploads

# 12. 配置PM2
print_info "配置PM2..."
cd $APP_DIR/backend

# 停止旧进程
pm2 delete $PROJECT_NAME 2>/dev/null || true

# 启动新进程
pm2 start dist/index.js \
    --name $PROJECT_NAME \
    --env production \
    --update-env \
    -i 1

# 设置环境变量
pm2 set $PROJECT_NAME PORT $BACKEND_PORT

# 保存PM2配置
pm2 save
pm2 startup systemd -u root --hp /root

# 13. 配置Nginx
print_info "配置Nginx..."
cat > /etc/nginx/conf.d/$PROJECT_NAME.conf <<NGINX_EOF
server {
    listen $FRONTEND_PORT;
    server_name _;

    # 客户端最大上传文件大小
    client_max_body_size 30M;

    # 前端静态文件
    location / {
        root $APP_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        index index.html;
    }

    # API 代理
    location /api {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # 上传文件访问
    location /uploads {
        proxy_pass http://localhost:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
    }
}
NGINX_EOF

# 14. 测试Nginx配置
print_info "测试Nginx配置..."
nginx -t

# 15. 启动/重启Nginx
print_info "启动Nginx..."
systemctl restart nginx
systemctl status nginx --no-pager

# 16. 检查服务状态
print_info "检查服务状态..."
sleep 2
pm2 status
systemctl status nginx --no-pager | head -5

print_info "============================================"
print_info "部署完成！"
print_info "============================================"
print_info "前端访问地址: http://${SERVER_IP}"
print_info "后端API地址: http://${SERVER_IP}/api"
print_info ""
print_info "常用命令："
print_info "  查看后端日志: pm2 logs $PROJECT_NAME"
print_info "  重启后端: pm2 restart $PROJECT_NAME"
print_info "  查看Nginx日志: tail -f /var/log/nginx/error.log"
print_info "  重启Nginx: systemctl restart nginx"
print_info "============================================"
REMOTE_SCRIPT_EOF
)

# 执行远程脚本
print_info "执行远程部署..."
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP "bash -s" <<EOF
$REMOTE_SCRIPT
EOF "$GITHUB_REPO" "$SERVER_IP"

print_info ""
print_info "============================================"
print_info "部署完成！"
print_info "============================================"
print_info "你的网站已部署到: http://${SERVER_IP}"
print_info ""
print_info "下一步："
print_info "1. 访问 http://${SERVER_IP} 查看网站"
print_info "2. 使用 'bash 一键更新.sh' 来更新代码"
print_info "============================================"
