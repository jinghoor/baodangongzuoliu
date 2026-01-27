#!/bin/bash
#===============================================================================
# 配置 SSH 密钥并部署到服务器
#===============================================================================

set -e

SERVER_IP="206.119.175.36"
SERVER_PORT="64478"
SERVER_USER="root"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "======================================"
echo "  配置 SSH 密钥并部署"
echo "======================================"
echo ""

# 检查 SSH 密钥
if [ ! -f ~/.ssh/id_rsa ]; then
    echo -e "${YELLOW}未找到 SSH 密钥，正在生成...${NC}"
    ssh-keygen -t rsa -b 4096 -C "deploy@$(hostname)" -f ~/.ssh/id_rsa -N ""
    echo -e "${GREEN}SSH 密钥已生成${NC}"
fi

# 检查公钥是否存在
if [ ! -f ~/.ssh/id_rsa.pub ]; then
    echo -e "${RED}错误：未找到公钥文件${NC}"
    exit 1
fi

echo -e "${YELLOW}正在配置 SSH 免密登录...${NC}"
echo "请在弹出的提示中输入服务器密码（如果需要）"
echo ""

# 尝试上传公钥
ssh-copy-id -p $SERVER_PORT $SERVER_USER@$SERVER_IP 2>&1 || {
    echo -e "${YELLOW}自动配置失败，请手动执行：${NC}"
    echo "ssh-copy-id -p $SERVER_PORT $SERVER_USER@$SERVER_IP"
    echo ""
    read -p "是否已手动配置 SSH 密钥？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}已取消${NC}"
        exit 1
    fi
}

# 测试连接
echo -e "${GREEN}测试 SSH 连接...${NC}"
ssh -i ~/.ssh/id_rsa -p $SERVER_PORT -o StrictHostKeyChecking=no -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP "echo 'SSH连接成功'" || {
    echo -e "${RED}SSH 连接失败！${NC}"
    echo "请检查："
    echo "1. 服务器 IP 和端口是否正确"
    echo "2. SSH 密钥是否已正确配置"
    echo "3. 服务器防火墙是否开放相应端口"
    exit 1
}

echo -e "${GREEN}SSH 连接成功！${NC}"
echo ""

# 执行部署
echo -e "${GREEN}开始部署...${NC}"
cd "$(dirname "$0")"
./一键部署.sh update
