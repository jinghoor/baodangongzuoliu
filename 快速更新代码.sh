#!/bin/bash

# 快速更新代码并推送到 GitHub 的脚本

echo "🚀 准备更新代码..."
echo ""

# 检查是否有未提交的更改
if [ -z "$(git status --porcelain)" ]; then
    echo "⚠️  没有检测到更改"
    echo "请先修改代码，然后再运行此脚本"
    exit 0
fi

# 显示更改的文件
echo "📝 检测到以下更改："
git status --short
echo ""

# 询问提交信息
read -p "请输入提交信息（描述你的更改）: " commit_message

if [ -z "$commit_message" ]; then
    commit_message="更新代码"
    echo "使用默认提交信息: $commit_message"
fi

echo ""
echo "📤 正在提交并推送..."

# 添加所有更改
git add .

# 提交
git commit -m "$commit_message"

# 推送
git push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ 代码已推送到 GitHub！"
    echo ""
    echo "🔄 自动部署中..."
    echo "   - Railway 后端：约 2-5 分钟"
    echo "   - Vercel 前端：约 1-3 分钟"
    echo ""
    echo "💡 提示："
    echo "   可以在 Railway 和 Vercel 的 Deployments 页面查看部署进度"
else
    echo ""
    echo "❌ 推送失败，请检查错误信息"
    exit 1
fi
