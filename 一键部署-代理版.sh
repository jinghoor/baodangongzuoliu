#!/bin/bash
#===============================================================================
# 一键部署脚本（通过 SOCKS5 代理）
# 代理信息：103.219.103.199:28826:14affc5de9939:e40b81193e
#===============================================================================

set -e

SERVER_IP="206.119.175.36"
SERVER_PORT="64478"
SERVER_USER="root"
GITHUB_REPO="https://github.com/jinghoor/baodangongzuoliu.git"
PROJECT_DIR="/root/baodangongzuoliu"

# SOCKS5 代理配置
PROXY_HOST="103.219.103.199"
PROXY_PORT="28826"
PROXY_USER="14affc5de9939"
PROXY_PASS="e40b81193e"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "======================================"
echo "  跨境电商工作流 - 一键部署（代理版）"
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

# 检查并安装 proxychains（如果需要）
setup_proxychains() {
    if ! command -v proxychains4 &> /dev/null && ! command -v proxychains &> /dev/null; then
        echo -e "${YELLOW}未找到 proxychains，尝试使用其他方法...${NC}"
        # 检查是否有 nc (netcat)
        if command -v nc &> /dev/null; then
            echo -e "${GREEN}使用 netcat 通过代理连接${NC}"
            return 0
        else
            echo -e "${YELLOW}建议安装 proxychains 以获得更好的代理支持：${NC}"
            echo "  macOS: brew install proxychains-ng"
            echo "  Ubuntu: sudo apt-get install proxychains4"
            return 1
        fi
    fi
    return 0
}

# 构建通过代理的 SSH 命令
build_ssh_cmd() {
    local cmd="$1"
    
    # 方法1：使用 proxychains（如果可用）
    if command -v proxychains4 &> /dev/null || command -v proxychains &> /dev/null; then
        local proxychains_cmd=$(command -v proxychains4 2>/dev/null || command -v proxychains)
        echo "$proxychains_cmd ssh -p $SERVER_PORT -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP \"$cmd\""
        return 0
    fi
    
    # 方法2：使用 ssh 的 ProxyCommand（需要支持 SOCKS5 的 netcat）
    if command -v nc &> /dev/null; then
        # 注意：标准 nc 可能不支持 SOCKS5 认证，这里使用基本方式
        # 对于带认证的 SOCKS5，建议使用 proxychains
        echo "ssh -p $SERVER_PORT -o StrictHostKeyChecking=no -o ProxyCommand=\"nc -X 5 -x $PROXY_HOST:$PROXY_PORT %h %p\" $SERVER_USER@$SERVER_IP \"$cmd\""
        return 0
    fi
    
    # 方法3：直接使用 ssh（如果代理已配置在系统级别）
    echo "ssh -p $SERVER_PORT -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP \"$cmd\""
}

# 配置 proxychains（如果使用）
configure_proxychains() {
    local config_file=""
    if [ -f ~/.proxychains/proxychains.conf ]; then
        config_file=~/.proxychains/proxychains.conf
    elif [ -f /etc/proxychains.conf ]; then
        config_file=/etc/proxychains.conf
    else
        # 创建临时配置文件
        config_file=$(mktemp)
        cat > "$config_file" << EOF
strict_chain
proxy_dns
remote_dns_subnet 224
tcp_read_time_out 15000
tcp_connect_time_out 8000
[ProxyList]
socks5 $PROXY_HOST $PROXY_PORT $PROXY_USER $PROXY_PASS
EOF
        echo "$config_file"
        return 0
    fi
    
    # 备份原配置
    if [ ! -f "${config_file}.bak" ]; then
        cp "$config_file" "${config_file}.bak"
    fi
    
    # 检查是否已配置
    if ! grep -q "socks5 $PROXY_HOST $PROXY_PORT" "$config_file"; then
        # 添加代理配置
        sed -i.bak "/^\[ProxyList\]/a\\
socks5 $PROXY_HOST $PROXY_PORT $PROXY_USER $PROXY_PASS
" "$config_file"
    fi
    
    echo "$config_file"
}

ACTION=${1:-"help"}

case $ACTION in
    "init")
        echo -e "${GREEN}[1/4]${NC} 安装/升级 Docker..."
        # 使用代理连接
        if command -v proxychains4 &> /dev/null || command -v proxychains &> /dev/null; then
            config_file=$(configure_proxychains)
            export PROXYCHAINS_CONF_FILE="$config_file"
            proxychains_cmd=$(command -v proxychains4 2>/dev/null || command -v proxychains)
            $proxychains_cmd ssh -p $SERVER_PORT -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP << 'ENDSSH'
                # Docker 安装/升级逻辑
                NEED_INSTALL=false
                if command -v docker &> /dev/null; then
                    DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
                    MAJOR_VERSION=$(echo $DOCKER_VERSION | cut -d. -f1)
                    if [ "$MAJOR_VERSION" -lt "20" ]; then
                        echo "Docker 版本太旧，需要升级..."
                        systemctl stop docker 2>/dev/null || true
                        yum remove -y docker docker-client docker-client-latest docker-common docker-latest docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
                        NEED_INSTALL=true
                    fi
                else
                    NEED_INSTALL=true
                fi
                
                if [ "$NEED_INSTALL" = true ]; then
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
        else
            echo -e "${YELLOW}请先安装 proxychains：brew install proxychains-ng${NC}"
            exit 1
        fi

        echo -e "${GREEN}[2/4]${NC} 克隆代码..."
        $proxychains_cmd ssh -p $SERVER_PORT -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP "rm -rf $PROJECT_DIR && git clone $GITHUB_REPO $PROJECT_DIR"

        echo -e "${GREEN}[3/4]${NC} 构建镜像..."
        $proxychains_cmd ssh -p $SERVER_PORT -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP "cd $PROJECT_DIR && docker compose build"

        echo -e "${GREEN}[4/4]${NC} 启动服务..."
        $proxychains_cmd ssh -p $SERVER_PORT -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP "cd $PROJECT_DIR && docker compose up -d"

        echo ""
        echo -e "${GREEN}部署完成！${NC}"
        echo "访问地址: http://$SERVER_IP"
        ;;

    "update"|"deploy")
        echo -e "${YELLOW}更新部署（通过代理）...${NC}"
        
        if command -v proxychains4 &> /dev/null || command -v proxychains &> /dev/null; then
            config_file=$(configure_proxychains)
            export PROXYCHAINS_CONF_FILE="$config_file"
            proxychains_cmd=$(command -v proxychains4 2>/dev/null || command -v proxychains)
            
            $proxychains_cmd ssh -p $SERVER_PORT -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP << ENDSSH
                cd $PROJECT_DIR
                git fetch origin main
                git reset --hard origin/main
                docker compose down
                docker compose build --no-cache
                docker compose up -d
                docker compose ps
ENDSSH
            echo -e "${GREEN}更新完成！${NC}"
        else
            echo -e "${RED}错误：需要安装 proxychains${NC}"
            echo "安装方法："
            echo "  macOS: brew install proxychains-ng"
            echo "  Ubuntu: sudo apt-get install proxychains4"
            exit 1
        fi
        ;;

    "test")
        echo -e "${BLUE}测试代理连接...${NC}"
        if command -v proxychains4 &> /dev/null || command -v proxychains &> /dev/null; then
            config_file=$(configure_proxychains)
            export PROXYCHAINS_CONF_FILE="$config_file"
            proxychains_cmd=$(command -v proxychains4 2>/dev/null || command -v proxychains)
            $proxychains_cmd ssh -p $SERVER_PORT -o StrictHostKeyChecking=no -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP "echo '代理连接成功！' && hostname"
        else
            echo -e "${RED}请先安装 proxychains${NC}"
            exit 1
        fi
        ;;

    *)
        echo "用法: ./一键部署-代理版.sh [命令]"
        echo ""
        echo "命令:"
        echo "  test    测试代理连接"
        echo "  init    首次部署"
        echo "  update  更新部署"
        echo ""
        echo "代理信息:"
        echo "  SOCKS5: $PROXY_HOST:$PROXY_PORT"
        echo "  用户: $PROXY_USER"
        echo ""
        echo "注意：需要先安装 proxychains"
        echo "  macOS: brew install proxychains-ng"
        echo "  Ubuntu: sudo apt-get install proxychains4"
        ;;
esac
