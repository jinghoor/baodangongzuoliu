# 🔍 Vercel 环境变量检查指南

## ❌ 当前错误分析

你遇到的错误：
1. **"保存失败: 保存失败"** - 前端无法保存数据到后端
2. **"加载失败: Unexpected token '<', "<!doctype "... is not valid JSON"** - 前端期望 JSON，但收到了 HTML

这通常意味着：**前端无法连接到后端 API**

## 🔍 问题原因

最可能的原因是：**Vercel 环境变量 `VITE_API_BASE_URL` 没有正确设置**

## ✅ 解决方法

### 步骤 1：检查 Vercel 环境变量

1. **进入 Vercel 项目页面**
   - 访问：https://vercel.com
   - 登录并找到你的项目 `gongzuoliu123`

2. **打开项目设置**
   - 点击项目名称进入项目详情
   - 点击顶部 **"Settings"** 标签

3. **找到 Environment Variables**
   - 在左侧菜单中找到 **"Environment Variables"**
   - 或直接向下滚动找到 **"Environment Variables"** 部分

4. **检查变量是否存在**
   - 查找变量名：`VITE_API_BASE_URL`
   - 如果不存在，需要添加
   - 如果存在，检查值是否正确

### 步骤 2：添加或修改环境变量

#### 如果变量不存在：

1. 点击 **"Add New"** 或 **"Add Variable"** 按钮

2. 填写：
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: 你的 Railway 后端 URL
     ```
     例如：https://xxx-production.up.railway.app
     ```
   - **Environment**: 勾选所有三个选项：
     - ✅ Production
     - ✅ Preview
     - ✅ Development

3. 点击 **"Save"**

#### 如果变量已存在但值不正确：

1. 点击变量旁边的 **"Edit"** 或 **"..."** 菜单
2. 修改 **Value** 为正确的 Railway 后端 URL
3. 点击 **"Save"**

### 步骤 3：重新部署

环境变量修改后，需要重新部署：

1. **自动重新部署**（推荐）
   - Vercel 通常会自动检测到环境变量变化
   - 等待几秒钟，应该会自动触发重新部署

2. **手动触发重新部署**
   - 在项目页面，点击 **"Deployments"** 标签
   - 找到最新的部署，点击 **"..."** 菜单
   - 选择 **"Redeploy"**

### 步骤 4：验证修复

1. **等待部署完成**（通常 1-3 分钟）

2. **访问你的应用**
   - 打开 Vercel 给你的 URL
   - 打开浏览器开发者工具（F12）

3. **检查 Network 标签**
   - 查看 API 请求是否成功
   - 确认请求的 URL 是正确的后端地址

4. **检查 Console 标签**
   - 应该没有 CORS 错误
   - 应该没有连接错误

## 📝 正确的环境变量配置

### 变量名
```
VITE_API_BASE_URL
```

### 变量值
```
https://你的railway后端URL.railway.app
```

⚠️ **重要**：
- 值应该以 `https://` 开头
- 值应该以 `.railway.app` 结尾
- **不要**包含末尾的斜杠 `/`
- **不要**包含路径，只要域名

### 示例

✅ **正确**：
```
https://cross-border-workflow-production.up.railway.app
```

❌ **错误**：
```
https://cross-border-workflow-production.up.railway.app/  (末尾有斜杠)
https://cross-border-workflow-production.up.railway.app/api  (包含路径)
http://cross-border-workflow-production.up.railway.app  (使用 http 而不是 https)
```

## 🔍 如何获取 Railway 后端 URL

如果你还没有后端 URL：

1. **进入 Railway 项目**
   - 访问：https://railway.app
   - 进入你的后端服务

2. **获取 Public Domain**
   - 点击 **"Settings"** 标签
   - 找到 **"Networking"** 部分
   - 复制 **"Public Domain"** 的 URL

## 🐛 其他可能的问题

### 问题 1：后端 URL 不可访问

**检查方法**：
- 在浏览器中直接打开你的 Railway 后端 URL
- 应该能看到 JSON 响应：`{"status":"ok",...}`

**解决方法**：
- 确认 Railway 服务正常运行
- 检查 Railway 部署日志

### 问题 2：CORS 错误

**检查方法**：
- 打开浏览器 Console（F12）
- 查看是否有 CORS 相关错误

**解决方法**：
- 后端已配置 CORS，通常不会有问题
- 如果还有问题，检查后端日志

### 问题 3：环境变量没有生效

**检查方法**：
- 在浏览器 Console 中执行：
  ```javascript
  console.log(import.meta.env.VITE_API_BASE_URL)
  ```
- 应该显示你的后端 URL

**解决方法**：
- 确认环境变量已保存
- 确认已重新部署
- 清除浏览器缓存

## 📋 检查清单

- [ ] Vercel 环境变量 `VITE_API_BASE_URL` 已添加
- [ ] 变量值是正确的 Railway 后端 URL
- [ ] 环境变量已应用到所有环境（Production, Preview, Development）
- [ ] Vercel 已重新部署
- [ ] Railway 后端可以访问（在浏览器中打开后端 URL）
- [ ] 浏览器 Console 没有错误
- [ ] Network 标签显示 API 请求成功

---

**修复环境变量后，应用应该就能正常工作了！** 🎉
