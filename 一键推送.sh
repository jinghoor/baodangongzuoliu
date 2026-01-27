#!/bin/bash
#===============================================================================
# 一键推送到 GitHub 脚本
# 功能：自动检测更改、提交并推送到 GitHub
#===============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "======================================"
echo "  一键推送到 GitHub"
echo "======================================"
echo ""

# 检查是否在 Git 仓库中
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}错误：当前目录不是 Git 仓库${NC}"
    exit 1
fi

# 检查远程仓库配置
if ! git remote get-url origin > /dev/null 2>&1; then
    echo -e "${YELLOW}警告：未配置远程仓库${NC}"
    echo ""
    read -p "请输入 GitHub 仓库 URL（例如：https://github.com/用户名/仓库名.git）: " repo_url
    if [ -z "$repo_url" ]; then
        echo -e "${RED}错误：未提供仓库 URL${NC}"
        exit 1
    fi
    git remote add origin "$repo_url"
    echo -e "${GREEN}已添加远程仓库：$repo_url${NC}"
fi

# 获取提交信息
COMMIT_MSG="${1:-更新代码}"

# 如果提供了第二个参数且为 "auto"，则跳过确认
AUTO_MODE="${2:-}"

# 检查是否有更改
if [ -z "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}没有检测到更改，无需提交${NC}"
    
    # 检查是否需要推送
    LOCAL=$(git rev-parse @)
    REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")
    
    if [ -z "$REMOTE" ]; then
        echo -e "${YELLOW}未设置上游分支，尝试推送...${NC}"
        git branch -M main 2>/dev/null || true
        git push -u origin main || git push -u origin master
        echo -e "${GREEN}推送完成！${NC}"
    elif [ "$LOCAL" != "$REMOTE" ]; then
        echo -e "${YELLOW}本地分支与远程不同步，尝试推送...${NC}"
        git push
        echo -e "${GREEN}推送完成！${NC}"
    else
        echo -e "${GREEN}代码已是最新，无需推送${NC}"
    fi
    exit 0
fi

# 显示更改状态
echo -e "${BLUE}检测到以下更改：${NC}"
git status --short
echo ""

# 如果不是自动模式，询问确认
if [ "$AUTO_MODE" != "auto" ]; then
    read -p "是否提交并推送这些更改？(y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}已取消${NC}"
        exit 0
    fi
fi

# 添加所有更改
echo -e "${GREEN}[1/3]${NC} 添加更改到暂存区..."
git add .

# 提交更改
echo -e "${GREEN}[2/3]${NC} 提交更改..."
git commit -m "$COMMIT_MSG" || {
    echo -e "${YELLOW}提交失败，可能没有实际更改${NC}"
    exit 0
}

# 确保分支名称
git branch -M main 2>/dev/null || true

# 推送到远程
echo -e "${GREEN}[3/3]${NC} 推送到 GitHub..."
if git push -u origin main 2>/dev/null; then
    echo -e "${GREEN}✅ 推送成功！${NC}"
elif git push -u origin master 2>/dev/null; then
    echo -e "${GREEN}✅ 推送成功！${NC}"
else
    # 尝试强制推送（如果远程有冲突）
    echo -e "${YELLOW}常规推送失败，尝试拉取后推送...${NC}"
    git pull origin main --rebase 2>/dev/null || git pull origin master --rebase 2>/dev/null || true
    git push origin main 2>/dev/null || git push origin master 2>/dev/null || {
        echo -e "${RED}推送失败！请检查网络连接和权限${NC}"
        exit 1
    }
    echo -e "${GREEN}✅ 推送成功！${NC}"
fi

echo ""
echo -e "${GREEN}完成！代码已推送到 GitHub${NC}"
