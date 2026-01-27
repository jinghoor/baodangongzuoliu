# 手动配置 SSH 密钥

## 问题
`ssh-copy-id` 连接被服务器关闭，需要手动配置 SSH 密钥。

## 解决方案

### 方法 1：手动复制公钥（推荐）

1. **获取公钥内容**：
```bash
cat ~/.ssh/id_rsa.pub
```

2. **使用密码登录服务器**：
```bash
ssh -p 64478 root@206.119.175.36
```

3. **在服务器上执行**（如果 `.ssh` 目录不存在，先创建）：
```bash
mkdir -p ~/.ssh
chmod 700 ~/.ssh
```

4. **将公钥添加到 authorized_keys**：
```bash
# 方法 A：使用 echo 追加（替换 YOUR_PUBLIC_KEY 为实际的公钥内容）
echo "YOUR_PUBLIC_KEY" >> ~/.ssh/authorized_keys

# 方法 B：使用编辑器
nano ~/.ssh/authorized_keys
# 然后粘贴公钥内容，保存退出
```

5. **设置正确的权限**：
```bash
chmod 600 ~/.ssh/authorized_keys
```

6. **退出服务器**：
```bash
exit
```

7. **测试免密登录**：
```bash
ssh -p 64478 root@206.119.175.36
```

### 方法 2：使用 sshpass（如果已安装）

```bash
# 安装 sshpass（macOS）
brew install sshpass

# 使用密码复制公钥
sshpass -p '你的密码' ssh-copy-id -p 64478 root@206.119.175.36
```

### 方法 3：使用 expect 脚本

创建一个脚本自动输入密码：

```bash
#!/usr/bin/expect
set timeout 30
spawn ssh-copy-id -p 64478 root@206.119.175.36
expect {
    "password:" {
        send "你的密码\r"
        exp_continue
    }
    eof
}
```

## 公钥内容

您的公钥路径：`~/.ssh/id_rsa.pub`

查看公钥：
```bash
cat ~/.ssh/id_rsa.pub
```

## 配置完成后

配置成功后，执行部署：

```bash
./一键部署.sh update
```
