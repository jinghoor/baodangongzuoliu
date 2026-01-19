#!/bin/bash

# 推送到 GitHub 的辅助脚本

echo "🚀 准备推送到 GitHub..."
echo ""

# 检查是否已配置远程仓库
if git remote get-url origin &> /dev/null; then
    echo "✅ 已配置远程仓库:"
    git remote get-url origin
    echo ""
    read -p "是否要推送到这个仓库？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "📤 正在推送..."
        git branch -M main
        git push -u origin main
        echo ""
        echo "✅ 推送完成！"
    else
        echo "❌ 已取消"
    fi
else
    echo "⚠️  还没有配置远程仓库"
    echo ""
    echo "请先执行以下步骤："
    echo "1. 在 GitHub 创建新仓库：https://github.com/new"
    echo "2. 复制仓库 URL（例如：https://github.com/你的用户名/仓库名.git）"
    echo "3. 然后运行以下命令："
    echo ""
    echo "   git remote add origin <你的仓库URL>"
    echo "   git branch -M main"
    echo "   git push -u origin main"
    echo ""
    read -p "如果你已经有仓库 URL，请输入（或按 Enter 跳过）: " repo_url
    if [ ! -z "$repo_url" ]; then
        git remote add origin "$repo_url"
        git branch -M main
        echo "📤 正在推送..."
        git push -u origin main
        echo ""
        echo "✅ 推送完成！"
    fi
fi
