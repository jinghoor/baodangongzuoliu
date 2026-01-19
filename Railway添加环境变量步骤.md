# 📝 Railway 添加环境变量步骤

## 🎯 目标
添加环境变量：`NODE_ENV=production`

## 📋 详细步骤

### 步骤 1：进入服务页面
1. 打开浏览器，访问：https://railway.app
2. 登录你的账号
3. 找到你的项目 **"cross-border-workflow-backend"**（或类似名称）
4. 点击服务卡片进入服务详情页

### 步骤 2：打开 Variables 标签
1. 在服务页面顶部，你会看到几个标签：
   - **Deployments**（部署）
   - **Variables**（变量）← 点击这个
   - **Metrics**（指标）
   - **Settings**（设置）

2. 点击 **"Variables"** 标签

### 步骤 3：添加环境变量
1. 在 Variables 页面，你会看到：
   - 一个表格显示现有的环境变量（如果有的话）
   - 一个 **"New Variable"** 或 **"Add Variable"** 按钮

2. 点击 **"New Variable"** 或 **"Add Variable"** 按钮

3. 在弹出的对话框中填写：
   - **Name（名称）**: `NODE_ENV`
   - **Value（值）**: `production`
   - **Environment（环境）**: 通常选择 **"All"** 或 **"Production"**

4. 点击 **"Add"** 或 **"Save"** 按钮

### 步骤 4：确认添加成功
1. 添加后，你应该能在变量列表中看到：
   ```
   NODE_ENV = production
   ```

2. Railway 会自动重新部署服务（通常几秒钟内）

## 🎨 界面说明

### Variables 页面布局
```
┌─────────────────────────────────────┐
│  Variables                          │
├─────────────────────────────────────┤
│  Name          Value      Actions   │
│  ─────────────────────────────────  │
│  NODE_ENV      production  [Edit]   │
│                                     │
│  [+ New Variable]                   │
└─────────────────────────────────────┘
```

### 添加变量对话框
```
┌─────────────────────────────┐
│  Add Variable               │
├─────────────────────────────┤
│  Name:  [NODE_ENV      ]    │
│  Value: [production    ]    │
│  Environment: [All ▼]      │
│                             │
│  [Cancel]  [Add]            │
└─────────────────────────────┘
```

## ⚠️ 注意事项

1. **变量名大小写敏感**
   - ✅ 正确：`NODE_ENV`
   - ❌ 错误：`node_env` 或 `Node_Env`

2. **值不需要引号**
   - ✅ 正确：`production`
   - ❌ 错误：`"production"` 或 `'production'`

3. **自动重新部署**
   - 添加或修改环境变量后，Railway 会自动触发重新部署
   - 不需要手动点击部署按钮

4. **环境选择**
   - 通常选择 **"All"** 表示所有环境都使用这个变量
   - 也可以选择特定的环境（Production、Preview、Development）

## 🔍 验证环境变量

添加后，你可以通过以下方式验证：

1. **查看部署日志**
   - 在 **Deployments** 标签中查看最新部署
   - 日志中应该显示应用使用了 `NODE_ENV=production`

2. **检查应用行为**
   - 如果应用有日志输出，应该能看到生产模式的标志

## 📝 其他可能需要的环境变量

根据你的应用，可能还需要添加：

- `PORT` - Railway 会自动设置，通常不需要手动添加
- `NODE_ENV` - 我们刚添加的
- 其他自定义变量（如果有的话）

## 🆘 如果找不到 Variables 标签

如果界面不同，可以尝试：

1. **在 Settings 中查找**
   - 点击 **"Settings"** 标签
   - 查找 **"Environment Variables"** 或 **"Variables"** 部分

2. **使用 Raw Editor**
   - 有些版本的 Railway 提供 **"Raw Editor"** 选项
   - 可以直接编辑 JSON 格式的变量

3. **查看文档**
   - Railway 的文档：https://docs.railway.app/develop/variables

---

**添加完成后，Railway 会自动重新部署，你的应用就会使用 `NODE_ENV=production` 了！** 🎉
