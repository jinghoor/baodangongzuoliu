# ⚡ 快速开始部署

## ✅ 已完成
- ✅ Git 仓库已初始化
- ✅ 代码已提交到本地
- ✅ 部署配置文件已创建

## 📝 下一步操作

### 步骤 1：推送到 GitHub（5分钟）

1. **在 GitHub 创建新仓库**
   - 访问：https://github.com/new
   - 仓库名：`cross-border-workflow`（或你喜欢的名字）
   - 选择 **Public**
   - ⚠️ **不要**勾选 "Initialize with README"
   - 点击 "Create repository"

2. **复制仓库 URL**（创建后会显示）
   ```
   https://github.com/你的用户名/仓库名.git
   ```

3. **在终端执行以下命令**（替换为你的仓库 URL）：
   ```bash
   cd "/Users/maxj/Documents/Python项目/项目91-跨境电商工作流"
   git remote add origin https://github.com/你的用户名/仓库名.git
   git branch -M main
   git push -u origin main
   ```
   
   ⚠️ 如果提示需要认证，请：
   - 使用 GitHub Personal Access Token（推荐）
   - 或使用 GitHub CLI：`gh auth login`

---

### 步骤 2：部署后端到 Railway（10分钟）

1. **访问 Railway**
   - 打开：https://railway.app
   - 点击 "Login with GitHub"

2. **创建项目**
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 选择你的仓库

3. **配置服务**
   - 点击服务 → Settings
   - **Root Directory**: `backend`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`

4. **添加环境变量**
   - Variables 标签
   - 添加：`NODE_ENV` = `production`

5. **获取后端 URL**
   - 等待部署完成（2-5分钟）
   - 在 Settings → Networking 找到 URL
   - **复制这个 URL！** 📝

---

### 步骤 3：部署前端到 Vercel（10分钟）

1. **访问 Vercel**
   - 打开：https://vercel.com
   - 点击 "Sign Up" → "Continue with GitHub"

2. **导入项目**
   - 点击 "Add New Project"
   - 选择你的仓库
   - 点击 "Import"

3. **配置项目**
   - **Root Directory**: `frontend`
   - **Framework**: Vite（自动检测）
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

4. **添加环境变量** ⚠️ 重要！
   - 在 Environment Variables 部分
   - 添加：
     - **Name**: `VITE_API_BASE_URL`
     - **Value**: 你的 Railway 后端 URL（步骤2获取的）
     - **Environment**: 全选（Production, Preview, Development）

5. **部署**
   - 点击 "Deploy"
   - 等待完成（1-3分钟）
   - **获得你的应用 URL！** 🎉

---

## 🎉 完成！

访问 Vercel 给你的 URL，你的应用就可以使用了！

## 📚 详细说明

如果需要更详细的步骤，请查看：`DEPLOY_STEPS.md`

## 🐛 遇到问题？

1. 查看构建日志
2. 检查环境变量是否正确
3. 确认后端 URL 可访问
4. 查看浏览器 Console 错误
