#!/bin/bash
#===============================================================================
# 配置 SSH 密钥并部署到服务器
# 根据 部署全过程.md 文档的步骤
#===============================================================================

set -e

SERVER_IP="206.119.175.36"
SERVER_PORT="64478"
SERVER_USER="root"
SSH_KEY_PATH="$HOME/.ssh/id_rsa"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "======================================"
echo "  配置 SSH 密钥并部署（根据部署文档）"
echo "======================================"
echo ""

# 检查 SSH 密钥是否存在
if [ ! -f "$SSH_KEY_PATH" ]; then
    echo -e "${YELLOW}未找到 SSH 密钥，正在生成...${NC}"
    echo -e "${BLUE}按照部署文档步骤 3.1：${NC}"
    ssh-keygen -t rsa -b 4096 -C "jinghooor@gmail.com" -f "$SSH_KEY_PATH" -N ""
    echo -e "${GREEN}SSH 密钥已生成：$SSH_KEY_PATH${NC}"
else
    echo -e "${GREEN}找到 SSH 密钥：$SSH_KEY_PATH${NC}"
fi

# 检查公钥
if [ ! -f "${SSH_KEY_PATH}.pub" ]; then
    echo -e "${RED}错误：未找到公钥文件${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}按照部署文档步骤 3.1 第2步：上传公钥到服务器${NC}"
echo -e "${YELLOW}请在弹出的提示中输入服务器密码${NC}"
echo ""

# 尝试上传公钥（按照文档的方法）
ssh-copy-id -p $SERVER_PORT $SERVER_USER@$SERVER_IP 2>&1 || {
    echo ""
    echo -e "${YELLOW}自动上传失败，请手动执行以下命令：${NC}"
    echo "ssh-copy-id -p $SERVER_PORT $SERVER_USER@$SERVER_IP"
    echo ""
    echo -e "${BLUE}或者手动复制公钥：${NC}"
    echo "cat ${SSH_KEY_PATH}.pub | ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP 'mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys'"
    echo ""
    read -p "是否已手动配置 SSH 密钥？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}已取消${NC}"
        exit 1
    fi
}

echo ""
echo -e "${BLUE}按照部署文档步骤 3.1 第3步：测试连接${NC}"
# 测试连接（使用指定的密钥文件）
ssh -i "$SSH_KEY_PATH" -p $SERVER_PORT -o StrictHostKeyChecking=no -o ConnectTimeout=10 $SERVER_USER@$SERVER_IP "echo 'SSH连接成功' && hostname" || {
    echo -e "${RED}SSH 连接失败！${NC}"
    echo ""
    echo -e "${YELLOW}可能的原因：${NC}"
    echo "1. SSH 密钥未正确配置到服务器"
    echo "2. 服务器 IP 或端口不正确"
    echo "3. 服务器防火墙限制"
    echo ""
    echo -e "${BLUE}请检查：${NC}"
    echo "1. 确保已执行：ssh-copy-id -p $SERVER_PORT $SERVER_USER@$SERVER_IP"
    echo "2. 手动测试：ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP"
    exit 1
}

echo -e "${GREEN}SSH 连接成功！${NC}"
echo ""

# 执行部署
echo -e "${GREEN}开始部署到服务器...${NC}"
cd "$(dirname "$0")"

# 使用指定的密钥文件执行部署
ssh -i "$SSH_KEY_PATH" -p $SERVER_PORT -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP << ENDSSH
    cd /root/baodangongzuoliu
    echo "拉取最新代码..."
    git fetch origin main
    git reset --hard origin/main
    echo "停止旧容器..."
    docker compose down
    echo "构建新镜像..."
    docker compose build --no-cache
    echo "启动服务..."
    docker compose up -d
    echo "检查服务状态..."
    docker compose ps
ENDSSH

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ 部署完成！${NC}"
    echo "访问地址: http://$SERVER_IP"
else
    echo -e "${RED}部署失败！${NC}"
    exit 1
fi
