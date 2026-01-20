#!/bin/bash
#===============================================================================
# 配置HTTPS脚本
# 注意：需要先有域名，不能只用IP地址
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
echo "  配置 HTTPS (SSL/TLS)"
echo "======================================"
echo ""

# 检查是否有域名参数
if [ -z "$1" ]; then
    echo -e "${RED}错误：需要提供域名${NC}"
    echo ""
    echo "用法: ./配置HTTPS.sh your-domain.com"
    echo ""
    echo "注意："
    echo "  1. 域名必须已经解析到服务器IP: $SERVER_IP"
    echo "  2. 确保域名可以正常访问（DNS已生效）"
    echo "  3. 需要开放80和443端口"
    echo ""
    exit 1
fi

DOMAIN=$1

echo -e "${YELLOW}配置域名: $DOMAIN${NC}"
echo -e "${YELLOW}服务器IP: $SERVER_IP${NC}"
echo ""

# 确认
read -p "确认域名已解析到此服务器IP？(y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 1
fi

echo ""
echo -e "${GREEN}[1/5]${NC} 安装 Nginx..."
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP << ENDSSH
    # 安装Nginx
    if ! command -v nginx &> /dev/null; then
        yum install -y nginx
        systemctl enable nginx
        systemctl start nginx
    fi
    
    # 开放端口
    firewall-cmd --permanent --add-service=http 2>/dev/null || true
    firewall-cmd --permanent --add-service=https 2>/dev/null || true
    firewall-cmd --permanent --add-port=80/tcp 2>/dev/null || true
    firewall-cmd --permanent --add-port=443/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    
    echo "Nginx已安装"
ENDSSH

echo -e "${GREEN}[2/5]${NC} 安装 Certbot..."
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP << ENDSSH
    # 安装Certbot
    yum install -y epel-release
    yum install -y certbot python3-certbot-nginx
    
    echo "Certbot已安装"
ENDSSH

echo -e "${GREEN}[3/5]${NC} 配置Nginx（临时HTTP配置）..."
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP << ENDSSH
    # 创建临时HTTP配置，用于Let's Encrypt验证
    cat > /etc/nginx/conf.d/workflow.conf << 'NGINX_EOF'
server {
    listen 80;
    server_name $DOMAIN;
    
    # Let's Encrypt验证
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # 临时代理到Docker容器
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX_EOF
    
    # 创建certbot目录
    mkdir -p /var/www/certbot
    
    # 测试配置
    nginx -t
    
    # 重启Nginx
    systemctl restart nginx
    
    echo "Nginx配置完成"
ENDSSH

echo -e "${GREEN}[4/5]${NC} 获取SSL证书..."
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP << ENDSSH
    # 获取SSL证书
    certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect
    
    echo "SSL证书已获取"
ENDSSH

echo -e "${GREEN}[5/5]${NC} 配置自动续期..."
ssh -p $SERVER_PORT $SERVER_USER@$SERVER_IP << ENDSSH
    # 测试续期
    certbot renew --dry-run
    
    echo "自动续期已配置"
ENDSSH

echo ""
echo -e "${GREEN}HTTPS配置完成！${NC}"
echo ""
echo "访问地址:"
echo "  HTTP:  http://$DOMAIN"
echo "  HTTPS: https://$DOMAIN"
echo ""
echo "注意："
echo "  - Let's Encrypt证书有效期为90天，会自动续期"
echo "  - 如果使用IP地址访问，将无法使用HTTPS（Let's Encrypt需要域名）"
echo ""
