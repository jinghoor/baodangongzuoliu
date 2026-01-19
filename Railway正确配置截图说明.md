# 📸 Railway 正确配置说明

## 🎯 需要修改的地方

在 Railway 服务 Settings 中，找到 **Build Command**，确保是：

```
npm install && npm run build
```

**不要包含** `cd ../frontend` 部分！

## ❌ 错误的配置

```
npm install && npm run build && cd ../frontend && npm install && npm run build
```

## ✅ 正确的配置

```
npm install && npm run build
```

## 📋 完整配置清单

在 Railway Settings → Build & Deploy 部分：

| 配置项 | 值 |
|--------|-----|
| **Root Directory** | `backend` |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `npm start` |

在 Variables 部分：

| 变量名 | 值 |
|--------|-----|
| **NODE_ENV** | `production` |

## 🔍 如何找到 Build Command

1. 进入你的 Railway 服务
2. 点击 **"Settings"** 标签
3. 向下滚动，找到 **"Build & Deploy"** 部分（或类似名称）
4. 找到 **"Build Command"** 输入框
5. 修改为正确的命令

## 💡 提示

- 如果找不到 Build Command，可能在不同的标签页
- 有些版本的 Railway 界面可能叫 "Deploy" 或 "Configuration"
- 确保保存修改（点击 "Save" 按钮）
