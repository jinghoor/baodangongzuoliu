#!/bin/bash
#===============================================================================
# 一键部署脚本（令牌认证版）
# 支持通过 GitHub Token 和服务器密码/令牌进行部署
#===============================================================================

set -e

# 配置（可通过环境变量覆盖）
SERVER_IP="${SERVER_IP:-206.119.175.36}"
SERVER_PORT="${SERVER_PORT:-64478}"
SERVER_USER="${SERVER_USER:-root}"
GITHUB_REPO="${GITHUB_REPO:-https://github.com/jinghoor/baodangongzuoliu.git}"
PROJECT_DIR="${PROJECT_DIR:-/root/baodangongzuoliu}"

# 认证信息（从环境变量读取，如果未设置则提示输入）
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
SERVER_PASSWORD="${SERVER_PASSWORD:-}"
SSH_KEY_PATH="${SSH_KEY_PATH:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "======================================"
echo "  跨境电商工作流 - 一键部署（令牌版）"
echo "======================================"
echo ""

# 检查必要的工具
check_command() {
    if ! command -v $1 &> /dev/null; then
        echo -e "${RED}错误：未安装 $1${NC}"
        echo "请先安装：$2"
        exit 1
    fi
}

check_command "ssh" "OpenSSH 客户端"
check_command "sshpass" "sshpass（用于密码认证）或配置 SSH 密钥"

# 获取认证信息
get_auth_info() {
    # 如果未设置 SSH 密钥路径，尝试使用默认密钥
    if [ -z "$SSH_KEY_PATH" ] && [ -f "$HOME/.ssh/id_rsa" ]; then
        SSH_KEY_PATH="$HOME/.ssh/id_rsa"
    fi
    
    # 如果既没有 SSH 密钥也没有密码，提示输入
    if [ -z "$SSH_KEY_PATH" ] && [ -z "$SERVER_PASSWORD" ]; then
        echo -e "${YELLOW}需要服务器认证信息：${NC}"
        echo "1. 使用 SSH 密钥（推荐）"
        echo "2. 使用密码"
        read -p "请选择 (1/2): " auth_choice
        
        if [ "$auth_choice" = "1" ]; then
            read -p "SSH 密钥路径 [$HOME/.ssh/id_rsa]: " key_path
            SSH_KEY_PATH="${key_path:-$HOME/.ssh/id_rsa}"
            if [ ! -f "$SSH_KEY_PATH" ]; then
                echo -e "${RED}错误：密钥文件不存在${NC}"
                exit 1
            fi
        else
            read -sp "服务器密码: " SERVER_PASSWORD
            echo
        fi
    fi
    
    # 如果使用 GitHub Token，需要设置
    if [ -z "$GITHUB_TOKEN" ]; then
        echo -e "${YELLOW}提示：设置 GITHUB_TOKEN 环境变量可避免每次输入密码${NC}"
        read -sp "GitHub Personal Access Token（可选，按 Enter 跳过）: " token
        echo
        if [ ! -z "$token" ]; then
            GITHUB_TOKEN="$token"
        fi
    fi
}

# 构建 SSH 命令
build_ssh_cmd() {
    local cmd="$1"
    local ssh_cmd="ssh"
    
    # 添加端口
    ssh_cmd="$ssh_cmd -p $SERVER_PORT"
    
    # 添加密钥或使用 sshpass
    if [ ! -z "$SSH_KEY_PATH" ] && [ -f "$SSH_KEY_PATH" ]; then
        ssh_cmd="$ssh_cmd -i $SSH_KEY_PATH"
        ssh_cmd="$ssh_cmd -o StrictHostKeyChecking=no"
    elif [ ! -z "$SERVER_PASSWORD" ]; then
        if ! command -v sshpass &> /dev/null; then
            echo -e "${RED}错误：使用密码认证需要安装 sshpass${NC}"
            echo "安装方法："
            echo "  macOS: brew install sshpass"
            echo "  Ubuntu: sudo apt-get install sshpass"
            exit 1
        fi
        ssh_cmd="sshpass -p '$SERVER_PASSWORD' $ssh_cmd"
        ssh_cmd="$ssh_cmd -o StrictHostKeyChecking=no"
    else
        echo -e "${RED}错误：需要 SSH 密钥或密码${NC}"
        exit 1
    fi
    
    # 执行命令
    eval "$ssh_cmd $SERVER_USER@$SERVER_IP \"$cmd\""
}

# 构建带 GitHub Token 的 git clone 命令
build_git_clone_cmd() {
    if [ ! -z "$GITHUB_TOKEN" ]; then
        # 使用 Token 进行认证
        local repo_url="$GITHUB_REPO"
        if [[ "$repo_url" == https://github.com/* ]]; then
            repo_url="https://${GITHUB_TOKEN}@${repo_url#https://}"
        fi
        echo "git clone $repo_url $PROJECT_DIR"
    else
        echo "git clone $GITHUB_REPO $PROJECT_DIR"
    fi
}

ACTION=${1:-"help"}

case $ACTION in
    "init")
        get_auth_info
        
        echo -e "${GREEN}[1/4]${NC} 安装/升级 Docker..."
        build_ssh_cmd << 'ENDSSH'
            # 检查 Docker 版本，如果太旧则升级
            NEED_INSTALL=false
            if command -v docker &> /dev/null; then
                DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
                MAJOR_VERSION=$(echo $DOCKER_VERSION | cut -d. -f1)
                if [ "$MAJOR_VERSION" -lt "20" ]; then
                    echo "Docker 版本太旧 ($DOCKER_VERSION)，需要升级..."
                    systemctl stop docker 2>/dev/null || true
                    yum remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
                    NEED_INSTALL=true
                else
                    echo "Docker 版本正常: $DOCKER_VERSION"
                fi
            else
                NEED_INSTALL=true
            fi
            
            if [ "$NEED_INSTALL" = true ]; then
                echo "安装最新版 Docker..."
                yum install -y yum-utils
                yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
                yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
                systemctl start docker
                systemctl enable docker
            fi
            
            firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true
            firewall-cmd --reload 2>/dev/null || true
            
            echo "Docker: $(docker --version)"
            echo "Docker Compose: $(docker compose version)"
ENDSSH

        echo -e "${GREEN}[2/4]${NC} 克隆代码..."
        GIT_CLONE_CMD=$(build_git_clone_cmd)
        build_ssh_cmd "rm -rf $PROJECT_DIR && $GIT_CLONE_CMD"

        echo -e "${GREEN}[3/4]${NC} 构建镜像..."
        build_ssh_cmd "cd $PROJECT_DIR && docker compose build"

        echo -e "${GREEN}[4/4]${NC} 启动服务..."
        build_ssh_cmd "cd $PROJECT_DIR && docker compose up -d"

        echo ""
        echo -e "${GREEN}部署完成！${NC}"
        echo "访问地址: http://$SERVER_IP"
        ;;

    "update"|"deploy")
        get_auth_info
        
        echo -e "${YELLOW}更新部署...${NC}"
        
        # 构建 git pull 命令
        if [ ! -z "$GITHUB_TOKEN" ]; then
            GIT_PULL_CMD="cd $PROJECT_DIR && git config --global credential.helper store && echo 'https://${GITHUB_TOKEN}@github.com' > ~/.git-credentials && git pull origin main"
        else
            GIT_PULL_CMD="cd $PROJECT_DIR && git fetch origin main && git reset --hard origin/main"
        fi
        
        build_ssh_cmd "$GIT_PULL_CMD && docker compose down && docker compose build --no-cache && docker compose up -d"
        
        echo -e "${GREEN}更新完成！${NC}"
        ;;

    "status")
        get_auth_info
        build_ssh_cmd "cd $PROJECT_DIR && docker compose ps"
        ;;

    "logs")
        get_auth_info
        build_ssh_cmd "cd $PROJECT_DIR && docker compose logs -f"
        ;;

    "restart")
        get_auth_info
        build_ssh_cmd "cd $PROJECT_DIR && docker compose restart"
        echo -e "${GREEN}重启完成！${NC}"
        ;;

    "stop")
        get_auth_info
        build_ssh_cmd "cd $PROJECT_DIR && docker compose down"
        echo -e "${GREEN}已停止！${NC}"
        ;;

    "ssh")
        get_auth_info
        if [ ! -z "$SSH_KEY_PATH" ] && [ -f "$SSH_KEY_PATH" ]; then
            ssh -i "$SSH_KEY_PATH" -p $SERVER_PORT -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP
        elif [ ! -z "$SERVER_PASSWORD" ]; then
            sshpass -p "$SERVER_PASSWORD" ssh -p $SERVER_PORT -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP
        else
            ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP
        fi
        ;;

    *)
        echo "用法: ./一键部署-令牌版.sh [命令]"
        echo ""
        echo "命令:"
        echo "  init     首次部署（安装Docker、克隆代码、启动）"
        echo "  update   更新部署（拉取最新代码并重启）"
        echo "  status   查看服务状态"
        echo "  logs     查看日志"
        echo "  restart  重启服务"
        echo "  stop     停止服务"
        echo "  ssh      连接到服务器"
        echo ""
        echo "环境变量（可选）:"
        echo "  SERVER_IP        服务器 IP（默认：206.119.175.36）"
        echo "  SERVER_PORT      SSH 端口（默认：64478）"
        echo "  SERVER_USER      用户名（默认：root）"
        echo "  GITHUB_TOKEN     GitHub Personal Access Token"
        echo "  SERVER_PASSWORD  服务器密码"
        echo "  SSH_KEY_PATH     SSH 密钥路径"
        echo ""
        echo "示例:"
        echo "  # 使用环境变量"
        echo "  export GITHUB_TOKEN=ghp_xxxxx"
        echo "  export SERVER_PASSWORD=your_password"
        echo "  ./一键部署-令牌版.sh update"
        echo ""
        echo "  # 使用 SSH 密钥"
        echo "  export SSH_KEY_PATH=~/.ssh/id_rsa"
        echo "  ./一键部署-令牌版.sh update"
        ;;
esac
