# 🚀 一步一步部署指南

本指南将帮助你完成整个部署过程。

## 📋 准备工作清单

在开始之前，请确保你有：
- ✅ GitHub 账号（如果没有，请先注册：https://github.com）
- ✅ 邮箱账号（用于注册部署平台）

---

## 第一步：准备代码并推送到 GitHub

### 1.1 初始化 Git 仓库（已完成 ✅）

代码已经准备好，现在需要推送到 GitHub。

### 1.2 在 GitHub 创建新仓库

1. 打开浏览器，访问 https://github.com
2. 登录你的 GitHub 账号
3. 点击右上角的 **"+"** → **"New repository"**
4. 填写仓库信息：
   - **Repository name**: `cross-border-workflow`（或你喜欢的名字）
   - **Description**: 跨境电商工作流系统（可选）
   - **Visibility**: 选择 **Public**（免费平台需要公开仓库）或 **Private**（如果使用付费功能）
   - ⚠️ **不要**勾选 "Initialize this repository with a README"
5. 点击 **"Create repository"**

### 1.3 复制仓库 URL

创建完成后，GitHub 会显示仓库 URL，类似：
```
https://github.com/你的用户名/cross-border-workflow.git
```
**请复制这个 URL，稍后会用到！**

### 1.4 推送代码到 GitHub

在终端执行以下命令（我会帮你执行）：

```bash
# 初始化 Git（如果还没初始化）
git init

# 添加所有文件
git add .

# 提交代码
git commit -m "Initial commit: 跨境电商工作流项目"

# 添加远程仓库（替换为你的仓库 URL）
git remote add origin https://github.com/你的用户名/cross-border-workflow.git

# 推送到 GitHub
git branch -M main
git push -u origin main
```

**⚠️ 注意**：执行 `git push` 时，GitHub 可能会要求你输入用户名和密码（或 Personal Access Token）。

---

## 第二步：部署后端到 Railway

### 2.1 注册 Railway 账号

1. 打开浏览器，访问 https://railway.app
2. 点击 **"Login"** 或 **"Start a New Project"**
3. 选择 **"Login with GitHub"**
4. 授权 Railway 访问你的 GitHub 账号

### 2.2 创建新项目

1. 登录后，点击 **"New Project"**
2. 选择 **"Deploy from GitHub repo"**
3. 在仓库列表中找到你的项目 `cross-border-workflow`
4. 点击项目，Railway 会自动开始部署

### 2.3 配置后端服务

Railway 可能会自动检测到项目，但我们需要手动配置：

1. 在项目页面，点击服务名称（或点击 **"Settings"**）
2. 找到 **"Source"** 部分，点击 **"Configure"** 或 **"Settings"**
3. 设置以下配置：
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

### 2.4 添加环境变量

1. 在服务页面，点击 **"Variables"** 标签
2. 添加以下环境变量：
   - `NODE_ENV` = `production`
   - `PORT` = `1888`（可选，Railway 会自动分配）

### 2.5 获取后端 URL

1. 等待部署完成（通常需要 2-5 分钟）
2. 部署成功后，在服务页面找到 **"Domains"** 或 **"Settings" → "Networking"**
3. 你会看到一个 URL，类似：`https://xxx-production.up.railway.app`
4. **复制这个 URL，这是你的后端地址！** 📝

### 2.6 测试后端

在浏览器中访问：`你的后端URL/`，应该能看到响应。

---

## 第三步：部署前端到 Vercel

### 3.1 注册 Vercel 账号

1. 打开浏览器，访问 https://vercel.com
2. 点击 **"Sign Up"**
3. 选择 **"Continue with GitHub"**
4. 授权 Vercel 访问你的 GitHub 账号

### 3.2 导入项目

1. 登录后，点击 **"Add New Project"** 或 **"Import Project"**
2. 在仓库列表中找到你的项目 `cross-border-workflow`
3. 点击 **"Import"**

### 3.3 配置前端项目

在配置页面，设置以下选项：

1. **Framework Preset**: 选择 **"Vite"**（Vercel 通常会自动检测）
2. **Root Directory**: 点击 **"Edit"**，设置为 `frontend`
3. **Build Command**: `npm run build`（通常已自动填充）
4. **Output Directory**: `dist`（通常已自动填充）
5. **Install Command**: `npm install`（通常已自动填充）

### 3.4 添加环境变量 ⚠️ 重要！

在配置页面的 **"Environment Variables"** 部分：

1. 点击 **"Add"** 或 **"Environment Variables"**
2. 添加以下变量：
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: 你的 Railway 后端 URL（第二步获取的）
   - **Environment**: 选择 **Production, Preview, Development**（全选）

例如：
```
VITE_API_BASE_URL = https://xxx-production.up.railway.app
```

### 3.5 部署

1. 点击 **"Deploy"** 按钮
2. 等待构建完成（通常需要 1-3 分钟）
3. 部署成功后，你会看到一个 URL，类似：`https://cross-border-workflow.vercel.app`
4. **这就是你的应用地址！** 🎉

### 3.6 测试应用

1. 在浏览器中访问 Vercel 给你的 URL
2. 打开浏览器开发者工具（F12），查看 Console
3. 确认没有 CORS 错误
4. 尝试创建或加载一个工作流，测试功能

---

## 第四步：验证部署

### 4.1 检查前端

- ✅ 访问 Vercel URL，页面正常加载
- ✅ 可以创建新工作流
- ✅ 可以保存和加载工作流

### 4.2 检查后端

- ✅ 在浏览器访问：`你的后端URL/workflows`，应该返回 JSON 数据
- ✅ 前端可以正常调用后端 API

### 4.3 常见问题排查

**问题 1：前端无法连接后端**
- 检查 Vercel 环境变量 `VITE_API_BASE_URL` 是否正确
- 检查后端 URL 是否可访问
- 查看浏览器 Console 的错误信息

**问题 2：CORS 错误**
- 后端已配置允许所有来源，通常不会有问题
- 如果还有问题，检查后端日志

**问题 3：数据丢失**
- Railway 免费层数据会持久化
- 如果数据丢失，检查 Railway 服务是否正常运行

---

## 🎉 完成！

恭喜！你的应用已经成功部署到云端了！

### 你的应用地址：
- **前端**: `https://你的项目名.vercel.app`
- **后端**: `https://你的项目名.railway.app`

### 后续操作：

1. **自定义域名**（可选）：
   - Vercel 支持免费自定义域名
   - 在 Vercel 项目设置中添加你的域名

2. **监控和日志**：
   - Railway: 在服务页面查看日志
   - Vercel: 在项目页面查看 Analytics

3. **更新代码**：
   - 修改代码后，推送到 GitHub
   - Railway 和 Vercel 会自动重新部署

---

## 📞 需要帮助？

如果遇到问题：
1. 查看各平台的文档
2. 检查构建日志
3. 查看浏览器 Console 错误
4. 检查环境变量配置

祝你部署顺利！🚀
