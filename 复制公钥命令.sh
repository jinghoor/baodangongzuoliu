#!/bin/bash
#===============================================================================
# 生成复制公钥的命令
# 由于 ssh-copy-id 连接被拒绝，需要手动配置
#===============================================================================

echo ""
echo "======================================"
echo "  SSH 公钥配置命令"
echo "======================================"
echo ""

PUBLIC_KEY=$(cat ~/.ssh/id_rsa.pub)

echo "您的公钥内容："
echo "--------------------------------------"
echo "$PUBLIC_KEY"
echo "--------------------------------------"
echo ""

echo "请按照以下步骤手动配置："
echo ""
echo "1. 使用其他方式登录服务器（如云服务商控制台、VNC等）"
echo "2. 在服务器上执行以下命令："
echo ""
echo "   mkdir -p ~/.ssh"
echo "   chmod 700 ~/.ssh"
echo "   echo '$PUBLIC_KEY' >> ~/.ssh/authorized_keys"
echo "   chmod 600 ~/.ssh/authorized_keys"
echo ""
echo "3. 或者使用编辑器："
echo "   nano ~/.ssh/authorized_keys"
echo "   然后粘贴上面的公钥内容，保存退出"
echo ""
echo "4. 配置完成后，测试连接："
echo "   ssh -p 64478 root@206.119.175.36"
echo ""
echo "5. 如果连接成功，执行部署："
echo "   ./一键部署.sh update"
echo ""
