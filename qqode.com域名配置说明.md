# 🌐 qqode.com 域名 DNS 配置说明

## 📋 需要添加的 DNS 记录

根据 Vercel 的提示，你需要添加以下两条 DNS 记录：

### 记录 1：主域名（qqode.com）

```
类型: A
主机记录: @（或留空）
记录值: 216.198.79.1
TTL: 3600（或默认值）
```

### 记录 2：WWW 子域名（www.qqode.com）

```
类型: CNAME
主机记录: www
记录值: 9b748c18aff8cc00.vercel-dns-017.com.
TTL: 3600（或默认值）
```

**注意**：CNAME 记录值末尾有一个点 `.`，有些 DNS 提供商会自动添加，有些需要手动输入。

---

## 🔧 不同域名提供商的配置方法

### 阿里云（万网）

1. **登录阿里云控制台**
   - 访问：https://ecs.console.aliyun.com
   - 登录你的账号

2. **进入域名解析**
   - 点击顶部菜单 "产品与服务" → "域名"
   - 或直接访问：https://dns.console.aliyun.com
   - 找到 `qqode.com` 域名，点击 "解析设置"

3. **添加 A 记录（主域名）**
   - 点击 "添加记录"
   - 填写：
     - **记录类型**：选择 `A`
     - **主机记录**：输入 `@` 或留空
     - **记录值**：`216.198.79.1`
     - **TTL**：`600`（10分钟）或默认值
   - 点击 "确认"

4. **添加 CNAME 记录（www）**
   - 再次点击 "添加记录"
   - 填写：
     - **记录类型**：选择 `CNAME`
     - **主机记录**：输入 `www`
     - **记录值**：`9b748c18aff8cc00.vercel-dns-017.com.`（注意末尾的点）
     - **TTL**：`600` 或默认值
   - 点击 "确认"

### 腾讯云

1. **登录腾讯云控制台**
   - 访问：https://console.cloud.tencent.com
   - 登录你的账号

2. **进入域名解析**
   - 点击 "产品" → "域名与网站" → "域名注册"
   - 或直接访问：https://console.cloud.tencent.com/domain
   - 找到 `qqode.com`，点击 "解析"

3. **添加 A 记录**
   - 点击 "添加记录"
   - 填写：
     - **主机记录**：`@`
     - **记录类型**：`A`
     - **线路类型**：`默认`
     - **记录值**：`216.198.79.1`
     - **TTL**：`600`
   - 点击 "保存"

4. **添加 CNAME 记录**
   - 再次点击 "添加记录"
   - 填写：
     - **主机记录**：`www`
     - **记录类型**：`CNAME`
     - **线路类型**：`默认`
     - **记录值**：`9b748c18aff8cc00.vercel-dns-017.com.`
     - **TTL**：`600`
   - 点击 "保存"

### GoDaddy

1. **登录 GoDaddy**
   - 访问：https://www.godaddy.com
   - 登录你的账号

2. **进入 DNS 管理**
   - 点击 "My Products"
   - 找到 `qqode.com`，点击 "DNS"

3. **添加 A 记录**
   - 在 "Records" 部分，点击 "Add"
   - 填写：
     - **Type**：`A`
     - **Name**：`@` 或留空
     - **Value**：`216.198.79.1`
     - **TTL**：`1 Hour`
   - 点击 "Save"

4. **添加 CNAME 记录**
   - 再次点击 "Add"
   - 填写：
     - **Type**：`CNAME`
     - **Name**：`www`
     - **Value**：`9b748c18aff8cc00.vercel-dns-017.com.`
     - **TTL**：`1 Hour`
   - 点击 "Save"

### Cloudflare

1. **登录 Cloudflare**
   - 访问：https://dash.cloudflare.com
   - 登录你的账号

2. **选择域名**
   - 在左侧菜单选择 `qqode.com`

3. **进入 DNS 设置**
   - 点击顶部 "DNS" 标签

4. **添加 A 记录**
   - 点击 "Add record"
   - 填写：
     - **Type**：`A`
     - **Name**：`@` 或 `qqode.com`
     - **IPv4 address**：`216.198.79.1`
     - **Proxy status**：选择 **DNS only**（灰色云图标，不要橙色云）
     - **TTL**：`Auto`
   - 点击 "Save"

5. **添加 CNAME 记录**
   - 再次点击 "Add record"
   - 填写：
     - **Type**：`CNAME`
     - **Name**：`www`
     - **Target**：`9b748c18aff8cc00.vercel-dns-017.com.`
     - **Proxy status**：选择 **DNS only**（灰色云）
     - **TTL**：`Auto`
   - 点击 "Save"

**重要**：Cloudflare 必须使用 **DNS only**（灰色云），不要开启代理（橙色云），否则 Vercel 无法正确验证。

### Namecheap

1. **登录 Namecheap**
   - 访问：https://www.namecheap.com
   - 登录你的账号

2. **进入域名列表**
   - 点击 "Domain List"
   - 找到 `qqode.com`，点击 "Manage"

3. **进入 DNS 设置**
   - 点击 "Advanced DNS" 标签

4. **添加 A 记录**
   - 在 "Host Records" 部分，点击 "Add New Record"
   - 填写：
     - **Type**：`A Record`
     - **Host**：`@`
     - **Value**：`216.198.79.1`
     - **TTL**：`Automatic`
   - 点击保存图标

5. **添加 CNAME 记录**
   - 再次点击 "Add New Record"
   - 填写：
     - **Type**：`CNAME Record`
     - **Host**：`www`
     - **Value**：`9b748c18aff8cc00.vercel-dns-017.com.`
     - **TTL**：`Automatic`
   - 点击保存图标

---

## ✅ 配置完成后的步骤

### 1. 等待 DNS 生效

- **时间**：通常 15 分钟 - 48 小时
- **大多数情况**：15-30 分钟内生效

### 2. 检查 DNS 传播

使用在线工具检查：

- **DNS Checker**：https://dnschecker.org
  - 输入 `qqode.com`
  - 选择记录类型 `A`
  - 检查是否显示 `216.198.79.1`

- **What's My DNS**：https://www.whatsmydns.net
  - 输入 `www.qqode.com`
  - 选择记录类型 `CNAME`
  - 检查是否显示正确的 CNAME 值

### 3. 在 Vercel 验证

1. **返回 Vercel Domains 页面**
   - 刷新页面
   - 等待状态从 "Invalid Configuration" 变为 "Valid Configuration"

2. **检查 SSL 证书**
   - DNS 生效后，Vercel 会自动配置 SSL 证书
   - 通常需要几分钟时间

3. **测试访问**
   - 访问 `https://qqode.com`
   - 访问 `https://www.qqode.com`
   - 应该都能正常访问你的应用

---

## 🐛 常见问题

### 问题 1：CNAME 记录值末尾的点

**问题**：有些 DNS 提供商需要末尾的点，有些不需要

**解决方法**：
- 先尝试带点的版本：`9b748c18aff8cc00.vercel-dns-017.com.`
- 如果保存失败，尝试不带点：`9b748c18aff8cc00.vercel-dns-017.com`
- 查看你的 DNS 提供商文档

### 问题 2：主域名无法使用 CNAME

**问题**：某些 DNS 提供商不支持主域名使用 CNAME

**解决方法**：
- 主域名使用 A 记录（你已经有了）
- 只有 www 子域名使用 CNAME

### 问题 3：DNS 不生效

**解决方法**：
1. 检查记录是否正确添加
2. 等待更长时间（最多 48 小时）
3. 清除本地 DNS 缓存：
   ```bash
   # macOS
   sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
   
   # Windows
   ipconfig /flushdns
   ```

### 问题 4：Vercel 仍显示 Invalid Configuration

**解决方法**：
1. 确认 DNS 记录已正确添加
2. 使用 DNS 检查工具验证记录已传播
3. 等待更长时间
4. 在 Vercel 点击 "Refresh" 或刷新页面

---

## 📋 配置检查清单

- [ ] 在 DNS 提供商添加了 A 记录：`@` → `216.198.79.1`
- [ ] 在 DNS 提供商添加了 CNAME 记录：`www` → `9b748c18aff8cc00.vercel-dns-017.com.`
- [ ] 等待 DNS 传播（15 分钟 - 48 小时）
- [ ] 使用 DNS 检查工具验证记录已生效
- [ ] Vercel 显示 "Valid Configuration"
- [ ] SSL 证书已自动配置
- [ ] 可以访问 `https://qqode.com`
- [ ] 可以访问 `https://www.qqode.com`

---

**配置完成后，你的域名就可以正常访问了！** 🎉
