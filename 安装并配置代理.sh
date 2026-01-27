#!/bin/bash
#===============================================================================
# 安装 proxychains 并配置 SOCKS5 代理
#===============================================================================

set -e

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
echo "  安装并配置 proxychains 代理"
echo "======================================"
echo ""

# 检测操作系统
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macOS"
    INSTALL_CMD="brew install proxychains-ng"
    CONFIG_FILE="$HOME/.proxychains/proxychains.conf"
    ALTERNATIVE_CONFIG="/usr/local/etc/proxychains.conf"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="Linux"
    INSTALL_CMD="sudo apt-get install -y proxychains4"
    CONFIG_FILE="/etc/proxychains.conf"
    ALTERNATIVE_CONFIG=""
else
    echo -e "${RED}不支持的操作系统：$OSTYPE${NC}"
    exit 1
fi

echo -e "${BLUE}检测到操作系统：$OS${NC}"
echo ""

# 检查是否已安装
if command -v proxychains4 &> /dev/null || command -v proxychains &> /dev/null; then
    echo -e "${GREEN}proxychains 已安装${NC}"
    PROXYCHAINS_CMD=$(command -v proxychains4 2>/dev/null || command -v proxychains)
    echo "  路径: $PROXYCHAINS_CMD"
else
    echo -e "${YELLOW}未安装 proxychains，正在安装...${NC}"
    echo "执行: $INSTALL_CMD"
    echo ""
    read -p "是否现在安装？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        eval $INSTALL_CMD
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}安装成功！${NC}"
            PROXYCHAINS_CMD=$(command -v proxychains4 2>/dev/null || command -v proxychains)
        else
            echo -e "${RED}安装失败，请手动执行：$INSTALL_CMD${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}已跳过安装${NC}"
        exit 0
    fi
fi

echo ""

# 查找配置文件
FOUND_CONFIG=""
if [ -f "$CONFIG_FILE" ]; then
    FOUND_CONFIG="$CONFIG_FILE"
elif [ -n "$ALTERNATIVE_CONFIG" ] && [ -f "$ALTERNATIVE_CONFIG" ]; then
    FOUND_CONFIG="$ALTERNATIVE_CONFIG"
else
    # 创建配置目录和文件
    if [[ "$OS" == "macOS" ]]; then
        mkdir -p "$HOME/.proxychains"
        FOUND_CONFIG="$HOME/.proxychains/proxychains.conf"
    else
        echo -e "${YELLOW}未找到配置文件，需要手动创建${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}配置文件：$FOUND_CONFIG${NC}"

# 备份原配置
if [ -f "$FOUND_CONFIG" ] && [ ! -f "${FOUND_CONFIG}.bak" ]; then
    cp "$FOUND_CONFIG" "${FOUND_CONFIG}.bak"
    echo -e "${GREEN}已备份原配置到 ${FOUND_CONFIG}.bak${NC}"
fi

# 检查是否已配置代理
if grep -q "socks5 $PROXY_HOST $PROXY_PORT" "$FOUND_CONFIG" 2>/dev/null; then
    echo -e "${GREEN}代理已配置${NC}"
else
    echo -e "${YELLOW}正在配置代理...${NC}"
    
    # 如果文件不存在，创建基本配置
    if [ ! -f "$FOUND_CONFIG" ]; then
        cat > "$FOUND_CONFIG" << 'EOF'
strict_chain
proxy_dns
remote_dns_subnet 224
tcp_read_time_out 15000
tcp_connect_time_out 8000

[ProxyList]
EOF
    fi
    
    # 添加代理配置
    if ! grep -q "^\[ProxyList\]" "$FOUND_CONFIG"; then
        echo "" >> "$FOUND_CONFIG"
        echo "[ProxyList]" >> "$FOUND_CONFIG"
    fi
    
    # 添加代理行（如果不存在）
    if ! grep -q "socks5 $PROXY_HOST $PROXY_PORT" "$FOUND_CONFIG"; then
        sed -i.bak "/^\[ProxyList\]/a\\
socks5 $PROXY_HOST $PROXY_PORT $PROXY_USER $PROXY_PASS
" "$FOUND_CONFIG" 2>/dev/null || \
        echo "socks5 $PROXY_HOST $PROXY_PORT $PROXY_USER $PROXY_PASS" >> "$FOUND_CONFIG"
        echo -e "${GREEN}代理配置已添加${NC}"
    fi
fi

echo ""
echo -e "${GREEN}配置完成！${NC}"
echo ""
echo -e "${BLUE}测试连接：${NC}"
echo "proxychains4 ssh -p 64478 root@206.119.175.36 \"echo '连接成功'\""
echo ""
echo -e "${BLUE}执行部署：${NC}"
echo "./一键部署-代理版.sh update"
echo ""
