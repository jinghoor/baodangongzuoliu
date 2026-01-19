#!/bin/bash

# 本地一键更新脚本 - 修改代码后推送并部署到云服务器

set -e

echo "=========================================="
echo "  本地一键更新并部署"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 获取当前分支
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "main" ]; then
    echo -e "${YELLOW}当前分支: $CURRENT_BRANCH${NC}"
    echo -e "${YELLOW}建议切换到 main 分支进行部署${NC}"
    read -p "是否继续? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo -e "${BLUE}开始更新流程...${NC}"
echo ""

# 步骤 1: 检查本地更改
echo -e "${YELLOW}[步骤 1/5] 检查本地更改...${NC}"
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${GREEN}没有本地更改${NC}"
else
    echo -e "${YELLOW}检测到本地更改：${NC}"
    git status --short
    echo ""

    # 步骤 2: 添加更改
    echo -e "${YELLOW}[步骤 2/5] 添加更改到暂存区...${NC}"
    git add .

    # 步骤 3: 提交更改
    echo -e "${YELLOW}[步骤 3/5] 提交更改...${NC}"
    read -p "请输入提交信息: " COMMIT_MESSAGE
    if [ -z "$COMMIT_MESSAGE" ]; then
        COMMIT_MESSAGE="Update code $(date '+%Y-%m-%d %H:%M:%S')"
    fi
    git commit -m "$COMMIT_MESSAGE"
fi

# 步骤 4: 推送到 GitHub
echo -e "${YELLOW}[步骤 4/5] 推送到 GitHub...${NC}"
git push origin main

# 步骤 5: 触发 GitHub Actions 部署
echo -e "${YELLOW}[步骤 5/5] 触发自动部署...${NC}"
echo -e "${GREEN}代码已推送到 GitHub，GitHub Actions 将自动部署到服务器${NC}"
echo ""
echo -e "${BLUE}查看部署状态:${NC}"
echo "  https://github.com/jinghoor/baodangongzuoliu/actions"
echo ""
echo -e "${BLUE}访问网站:${NC}"
echo "  http://206.119.175.36"
echo ""
echo "=========================================="
echo -e "${GREEN}推送成功！${NC}"
echo "=========================================="
