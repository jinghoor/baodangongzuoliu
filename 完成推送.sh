#!/bin/bash

# 完成 GitHub 推送的脚本

echo "🚀 准备推送到 GitHub..."
echo ""

# 检查是否已登录 GitHub CLI
if gh auth status &>/dev/null; then
    echo "✅ GitHub CLI 已登录"
    echo "📤 正在推送代码..."
    cd "/Users/maxj/Documents/Python项目/项目91-跨境电商工作流"
    git push -u origin main
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ 推送成功！"
        echo "📝 仓库地址: https://github.com/jinghoor/gongzuoliu123"
        echo ""
        echo "🎉 现在可以继续部署到 Railway 和 Vercel 了！"
    else
        echo "❌ 推送失败，请检查错误信息"
    fi
else
    echo "⚠️  需要先登录 GitHub"
    echo ""
    echo "请选择认证方式："
    echo "1. 使用 GitHub CLI（推荐）"
    echo "2. 使用 Personal Access Token"
    echo ""
    read -p "请选择 (1 或 2): " choice
    
    if [ "$choice" = "1" ]; then
        echo ""
        echo "正在启动 GitHub CLI 登录..."
        echo "请按照提示在浏览器中完成认证"
        gh auth login --web
        if [ $? -eq 0 ]; then
            echo ""
            echo "✅ 登录成功！"
            echo "📤 正在推送代码..."
            cd "/Users/maxj/Documents/Python项目/项目91-跨境电商工作流"
            git push -u origin main
            if [ $? -eq 0 ]; then
                echo ""
                echo "✅ 推送成功！"
                echo "📝 仓库地址: https://github.com/jinghoor/gongzuoliu123"
            fi
        else
            echo "❌ 登录失败"
        fi
    elif [ "$choice" = "2" ]; then
        echo ""
        echo "请按照以下步骤操作："
        echo "1. 访问: https://github.com/settings/tokens"
        echo "2. 点击 'Generate new token' → 'Generate new token (classic)'"
        echo "3. 勾选 'repo' 权限"
        echo "4. 生成并复制 token"
        echo ""
        read -p "粘贴你的 token: " token
        if [ ! -z "$token" ]; then
            echo ""
            echo "📤 正在推送代码..."
            cd "/Users/maxj/Documents/Python项目/项目91-跨境电商工作流"
            git push -u origin main <<EOF
jinghoor
$token
EOF
            if [ $? -eq 0 ]; then
                echo ""
                echo "✅ 推送成功！"
            else
                echo "❌ 推送失败，请检查 token 是否正确"
            fi
        fi
    else
        echo "❌ 无效的选择"
    fi
fi
