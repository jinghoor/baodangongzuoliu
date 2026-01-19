# 🌐 Vercel 自定义域名配置指南

## 📋 前置要求

1. ✅ 拥有一个域名（例如：`example.com`）
2. ✅ 能够访问域名管理面板（DNS 设置）
3. ✅ Vercel 账号已登录

## 🚀 配置步骤

### 步骤 1：进入 Vercel 项目设置

1. **访问 Vercel**
   - 打开：https://vercel.com
   - 登录你的账号

2. **进入项目**
   - 找到你的项目 `gongzuoliu123`
   - 点击项目名称进入项目详情

3. **打开域名设置**
   - 点击顶部 **"Settings"** 标签
   - 在左侧菜单中找到 **"Domains"**
   - 或直接访问项目 Settings → Domains

### 步骤 2：添加域名

1. **输入域名**
   - 在 "Domains" 页面，找到输入框
   - 输入你的域名，例如：
     - `example.com`（主域名）
     - `www.example.com`（带 www）
     - `app.example.com`（子域名）

2. **添加域名**
   - 点击 **"Add"** 或 **"Add Domain"** 按钮

3. **选择配置类型**
   - Vercel 会显示配置选项
   - 通常选择自动配置（推荐）

### 步骤 3：配置 DNS 记录

Vercel 会显示需要添加的 DNS 记录，有两种方式：

#### 方式一：A 记录（推荐，简单）

1. **获取 IP 地址**
   - Vercel 会显示一个 IP 地址（例如：`76.76.21.21`）
   - 或显示一个 CNAME 目标（例如：`cname.vercel-dns.com`）

2. **在域名管理面板添加记录**
   - 登录你的域名注册商（例如：阿里云、腾讯云、GoDaddy、Namecheap 等）
   - 进入 DNS 设置
   - 添加以下记录：

   **对于主域名（example.com）：**
   ```
   类型: A
   主机记录: @（或留空）
   记录值: 76.76.21.21（Vercel 提供的 IP）
   TTL: 3600（或默认）
   ```

   **对于 www 子域名（www.example.com）：**
   ```
   类型: CNAME
   主机记录: www
   记录值: cname.vercel-dns.com（Vercel 提供的 CNAME）
   TTL: 3600（或默认）
   ```

#### 方式二：CNAME 记录

如果 Vercel 提供 CNAME 方式：

```
类型: CNAME
主机记录: @（对于主域名，某些 DNS 提供商不支持）
记录值: cname.vercel-dns.com（Vercel 提供的 CNAME）
TTL: 3600
```

**注意**：某些 DNS 提供商不支持主域名使用 CNAME，只能使用 A 记录。

### 步骤 4：等待 DNS 生效

1. **DNS 传播时间**
   - 通常需要 **5 分钟到 48 小时**
   - 大多数情况下在 **15-30 分钟内**生效

2. **检查 DNS 生效**
   - 在 Vercel 的 Domains 页面，可以看到域名状态
   - 显示 **"Valid Configuration"** 表示配置成功
   - 显示 **"Invalid Configuration"** 需要检查 DNS 设置

3. **使用工具检查**
   - 可以使用在线工具检查：
     - https://dnschecker.org
     - https://www.whatsmydns.net
   - 输入你的域名，检查 DNS 记录是否正确传播

### 步骤 5：SSL 证书自动配置

1. **自动 HTTPS**
   - Vercel 会自动为你的域名配置 SSL 证书
   - 使用 Let's Encrypt，完全免费
   - 通常在 DNS 生效后几分钟内自动配置

2. **验证 HTTPS**
   - DNS 生效后，访问 `https://你的域名.com`
   - 应该能看到锁图标，表示 SSL 证书已配置

## 📝 常见域名提供商配置示例

### 阿里云（万网）

1. 登录阿里云控制台
2. 进入 "域名" → "域名解析"
3. 找到你的域名，点击 "解析设置"
4. 添加记录：
   - 类型：A
   - 主机记录：@
   - 记录值：Vercel 提供的 IP
   - TTL：10分钟

### 腾讯云

1. 登录腾讯云控制台
2. 进入 "域名注册" → "我的域名"
3. 点击域名，进入 "解析" 标签
4. 添加记录：
   - 记录类型：A
   - 主机记录：@
   - 记录值：Vercel 提供的 IP

### GoDaddy

1. 登录 GoDaddy 账号
2. 进入 "My Products" → "DNS"
3. 找到你的域名，点击 "Manage DNS"
4. 在 "Records" 部分添加：
   - Type: A
   - Name: @
   - Value: Vercel 提供的 IP
   - TTL: 1 Hour

### Cloudflare

1. 登录 Cloudflare 控制台
2. 选择你的域名
3. 进入 "DNS" 设置
4. 添加记录：
   - Type: A
   - Name: @（或 www）
   - Content: Vercel 提供的 IP
   - Proxy status: DNS only（灰色云图标）

**注意**：如果使用 Cloudflare 代理（橙色云图标），需要额外配置。

## 🔧 高级配置

### 配置多个域名

你可以为同一个项目配置多个域名：

1. **主域名**：`example.com`
2. **WWW 域名**：`www.example.com`
3. **子域名**：`app.example.com`、`staging.example.com` 等

只需在 Vercel Domains 页面重复添加即可。

### 域名重定向

在 Vercel 中可以配置域名重定向：

1. 进入 Settings → Domains
2. 找到要重定向的域名
3. 配置重定向规则（例如：`www.example.com` → `example.com`）

### 自定义 SSL 证书

如果需要使用自己的 SSL 证书：

1. 进入 Settings → Domains
2. 找到你的域名
3. 配置自定义证书（高级选项）

## 🐛 常见问题

### 问题 1：DNS 不生效

**症状**：添加 DNS 记录后，域名仍无法访问

**解决方法**：
1. 检查 DNS 记录是否正确添加
2. 等待更长时间（最多 48 小时）
3. 清除本地 DNS 缓存：
   ```bash
   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   
   # Windows
   ipconfig /flushdns
   ```

### 问题 2：SSL 证书未配置

**症状**：DNS 生效但 HTTPS 不工作

**解决方法**：
1. 等待几分钟，Vercel 会自动配置
2. 检查域名是否正确指向 Vercel
3. 在 Vercel Domains 页面检查证书状态

### 问题 3：主域名无法使用 CNAME

**症状**：某些 DNS 提供商不支持主域名 CNAME

**解决方法**：
- 使用 A 记录（推荐）
- 或联系 DNS 提供商支持 ALIAS/ANAME 记录

### 问题 4：Cloudflare 代理问题

**症状**：使用 Cloudflare 代理后无法访问

**解决方法**：
1. 将 Cloudflare 代理状态改为 **DNS only**（灰色云）
2. 或配置 Cloudflare SSL 为 Full 模式

## ✅ 配置完成检查清单

- [ ] 在 Vercel 添加了域名
- [ ] 在 DNS 提供商添加了 A 或 CNAME 记录
- [ ] 等待 DNS 传播（15 分钟 - 48 小时）
- [ ] Vercel 显示 "Valid Configuration"
- [ ] 可以访问 `http://你的域名.com`
- [ ] SSL 证书已自动配置
- [ ] 可以访问 `https://你的域名.com`

## 📚 参考资源

- Vercel 域名文档：https://vercel.com/docs/concepts/projects/domains
- DNS 检查工具：https://dnschecker.org
- SSL 测试工具：https://www.ssllabs.com/ssltest/

---

**配置完成后，你就可以使用自己的域名访问应用了！** 🎉
