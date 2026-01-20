# HTTPS配置说明

## 为什么当前是HTTP？

当前部署使用的是**Docker直接暴露80端口**，没有配置SSL证书，所以只能使用HTTP。

## 启用HTTPS的前提条件

⚠️ **重要**：要启用HTTPS，**必须要有域名**，不能只用IP地址。

原因：
- Let's Encrypt（免费SSL证书）需要验证域名所有权
- 只能为域名颁发证书，不能为IP地址颁发证书

## 配置HTTPS的步骤

### 方法一：使用自动配置脚本（推荐）

如果你已经有域名：

```bash
# 1. 确保域名已解析到服务器IP: 206.119.175.36
# 2. 运行配置脚本
./配置HTTPS.sh your-domain.com
```

脚本会自动：
- 安装Nginx
- 安装Certbot
- 获取Let's Encrypt免费SSL证书
- 配置HTTPS自动重定向
- 设置证书自动续期

### 方法二：手动配置

#### 1. 安装Nginx

```bash
ssh -p 64478 root@206.119.175.36
yum install -y nginx
systemctl enable nginx
systemctl start nginx
```

#### 2. 安装Certbot

```bash
yum install -y epel-release
yum install -y certbot python3-certbot-nginx
```

#### 3. 配置Nginx（临时HTTP配置）

```bash
# 创建配置文件
cat > /etc/nginx/conf.d/workflow.conf << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # 替换为你的域名
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

mkdir -p /var/www/certbot
nginx -t
systemctl restart nginx
```

#### 4. 获取SSL证书

```bash
certbot --nginx -d your-domain.com --non-interactive --agree-tos --email your-email@example.com --redirect
```

#### 5. 测试自动续期

```bash
certbot renew --dry-run
```

## 配置后的效果

- ✅ HTTP自动重定向到HTTPS
- ✅ 浏览器显示绿色锁图标
- ✅ 证书自动续期（90天有效期）
- ✅ 更安全的连接

## 如果只有IP地址怎么办？

如果你**只有IP地址，没有域名**，有以下选择：

### 选项1：购买域名（推荐）
- 购买一个便宜的域名（如 .xyz 域名约 $1/年）
- 将域名解析到服务器IP
- 然后使用上面的方法配置HTTPS

### 选项2：使用自签名证书（不推荐）
- 可以生成自签名证书
- 但浏览器会显示"不安全"警告
- 不适合生产环境

### 选项3：继续使用HTTP
- 如果只是内部使用，可以继续使用HTTP
- 但某些Web API功能会受限（如剪贴板API）

## 常见问题

### Q: 为什么Let's Encrypt需要域名？
A: Let's Encrypt通过验证域名所有权来颁发证书，这是安全标准。IP地址无法证明所有权。

### Q: 证书会过期吗？
A: Let's Encrypt证书有效期90天，但配置了自动续期，无需手动更新。

### Q: 配置HTTPS后，Docker容器需要修改吗？
A: 不需要。Nginx作为反向代理，容器内部仍然使用HTTP（localhost:3000），Nginx负责SSL终止。

### Q: 如何检查证书状态？
```bash
certbot certificates
```

### Q: 如何手动续期证书？
```bash
certbot renew
```

## 当前状态

- **当前协议**: HTTP
- **当前端口**: 80
- **SSL证书**: 未配置
- **访问地址**: http://206.119.175.36

## 配置HTTPS后

- **协议**: HTTPS
- **端口**: 443（HTTP自动重定向）
- **SSL证书**: Let's Encrypt（自动续期）
- **访问地址**: https://your-domain.com

---

**总结**：要启用HTTPS，你需要一个域名。如果没有域名，可以购买一个便宜的域名，然后使用提供的脚本自动配置。
