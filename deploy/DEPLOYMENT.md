# 🚀 跟单系统 - 阿里云 ECS 部署完整指南

> **目标**: 30分钟内完成部署，让系统通过域名访问

---

## 📋 目录

1. [服务器准备阶段](#1-服务器准备阶段)
2. [项目上传和启动](#2-项目上传和启动)
3. [一键部署脚本](#3-一键部署脚本)
4. [Nginx 反向代理配置](#4-nginx-反向代理配置)
5. [环境变量配置](#5-环境变量配置)
6. [常见问题排查](#6-常见问题排查)
7. [上线后验证](#7-上线后验证)
8. [自动更新代码](#8-自动更新代码)

---

## 1. 服务器准备阶段

### 1.1 登录服务器

```bash
ssh root@your-server-ip
# 或
ssh your-username@your-server-ip
```

### 1.2 执行服务器准备脚本

```bash
# 下载或上传 server-setup.sh 到服务器
chmod +x server-setup.sh
./server-setup.sh
```

**或者手动执行以下命令：**

```bash
# 更新系统
sudo yum update -y

# 安装基础工具
sudo yum install -y git wget curl

# 安装 Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs

# 验证安装
node -v  # 应该显示 v18.x.x
npm -v

# 安装 PM2
sudo npm install -g pm2

# 安装 PostgreSQL
sudo yum install -y postgresql15-server postgresql15
sudo /usr/pgsql-15/bin/postgresql-15-setup initdb
sudo systemctl enable postgresql-15
sudo systemctl start postgresql-15

# 安装 Nginx
sudo yum install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# 配置防火墙（如果使用 firewalld）
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --add-port=3006/tcp
sudo firewall-cmd --reload
```

### 1.3 阿里云安全组配置

**在阿里云控制台配置：**

1. 登录 [阿里云控制台](https://ecs.console.aliyun.com/)
2. 进入 **云服务器 ECS** → **网络与安全** → **安全组**
3. 选择你的安全组，点击 **配置规则**
4. 添加以下规则：

| 规则方向 | 授权策略 | 协议类型 | 端口范围 | 授权对象 |
|---------|---------|---------|---------|---------|
| 入方向 | 允许 | TCP | 80 | 0.0.0.0/0 |
| 入方向 | 允许 | TCP | 443 | 0.0.0.0/0 |
| 入方向 | 允许 | TCP | 3006 | 0.0.0.0/0（或仅内网） |
| 入方向 | 允许 | TCP | 5432 | 内网IP（仅内网访问） |

---

## 2. 项目上传和启动

### 2.1 本地打包（可选）

```bash
# 在本地项目根目录
npm run build  # 构建前端
cd backend && npm run build && cd ..  # 构建后端
```

### 2.2 上传代码到服务器

**方法1: 使用 Git（推荐）**

```bash
# 在服务器上
cd /var/www
sudo git clone https://github.com/your-username/fangdu-website-follow.git fangdu-system
# 或使用 SSH
sudo git clone git@github.com:your-username/fangdu-website-follow.git fangdu-system

# 设置权限
sudo chown -R $USER:$USER fangdu-system
cd fangdu-system
```

**方法2: 使用 SCP（如果不用 Git）**

```bash
# 在本地执行
scp -r . root@your-server-ip:/var/www/fangdu-system
```

**方法3: 使用 rsync（推荐，支持增量同步）**

```bash
# 在本地执行
rsync -avz --exclude 'node_modules' --exclude '.git' \
  ./ root@your-server-ip:/var/www/fangdu-system/
```

### 2.3 配置环境变量

```bash
cd /var/www/fangdu-system

# 复制示例文件
cp deploy/.env.example .env

# 编辑 .env 文件
nano .env
# 或
vi .env
```

**必须配置的变量：**

```env
NODE_ENV=production
PORT=3006
JWT_SECRET=生成一个随机字符串（至少32位）
CORS_ORIGIN=https://your-domain.com
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fangdu_db
DB_USER=fangdu_user
DB_PASSWORD=你的数据库密码
```

### 2.4 初始化数据库

```bash
# 创建数据库和用户
cd deploy/database
chmod +x setup-db.sh
./setup-db.sh

# 初始化表结构
chmod +x init-database.sh
./init-database.sh
```

---

## 3. 一键部署脚本

### 3.1 执行部署脚本

```bash
cd /var/www/fangdu-system
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

**脚本会自动：**
- ✅ 拉取最新代码
- ✅ 安装依赖
- ✅ 构建前后端
- ✅ 初始化数据库
- ✅ 启动 PM2 服务
- ✅ 配置开机自启

### 3.2 验证服务

```bash
# 查看 PM2 服务状态
pm2 list

# 查看日志
pm2 logs fangdu-backend

# 测试后端 API
curl http://localhost:3006/health
```

---

## 4. Nginx 反向代理配置

### 4.1 配置 Nginx

```bash
# 复制配置文件
sudo cp deploy/nginx/fangdu.conf /etc/nginx/conf.d/fangdu.conf

# 编辑配置文件，修改域名
sudo nano /etc/nginx/conf.d/fangdu.conf
# 将 your-domain.com 替换为你的实际域名

# 测试配置
sudo nginx -t

# 重新加载 Nginx
sudo systemctl reload nginx
```

### 4.2 安装 SSL 证书（Let's Encrypt）

```bash
# 使用自动安装脚本
cd deploy/scripts
chmod +x install-ssl.sh
./install-ssl.sh your-domain.com your-email@example.com

# 或手动安装
sudo yum install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

**证书会自动续期，无需手动操作。**

---

## 5. 环境变量配置

### 5.1 完整 .env 示例

```env
# 应用配置
NODE_ENV=production
PORT=3006

# JWT 配置（必须修改！）
JWT_SECRET=生成一个至少32位的随机字符串
JWT_EXPIRES_IN=7d

# CORS 配置
CORS_ORIGIN=https://your-domain.com

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fangdu_db
DB_USER=fangdu_user
DB_PASSWORD=你的强密码

# 阿里云 OSS 配置（图片存储）
OSS_REGION=oss-cn-guangzhou
OSS_ACCESS_KEY_ID=你的AccessKeyId
OSS_ACCESS_KEY_SECRET=你的AccessKeySecret
OSS_BUCKET=fangdu-order-image
OSS_ENDPOINT=
OSS_BUCKET_URL=
OSS_SECURE=true
OSS_ACL=private
OSS_USE_PUBLIC_URL=false
```

### 5.2 生成 JWT_SECRET

```bash
# 方法1: 使用 openssl
openssl rand -base64 32

# 方法2: 使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## 6. 常见问题排查

### 6.1 502 Bad Gateway

**原因**: 后端服务未启动或端口不对

**排查步骤：**

```bash
# 1. 检查 PM2 服务状态
pm2 list

# 2. 检查后端日志
pm2 logs fangdu-backend

# 3. 检查端口是否被占用
sudo netstat -tlnp | grep 3006

# 4. 手动测试后端
curl http://localhost:3006/health

# 5. 检查 Nginx 配置
sudo nginx -t
sudo tail -f /var/log/nginx/fangdu-error.log
```

**解决方案：**

```bash
# 重启后端服务
pm2 restart fangdu-backend

# 如果服务未启动
cd /var/www/fangdu-system/backend
pm2 start dist/index.js --name fangdu-backend
```

### 6.2 数据库连接拒绝

**排查步骤：**

```bash
# 1. 检查 PostgreSQL 服务状态
sudo systemctl status postgresql-15

# 2. 检查数据库是否运行
sudo -u postgres psql -c "SELECT version();"

# 3. 测试连接
psql -h localhost -U fangdu_user -d fangdu_db

# 4. 检查 .env 配置
cat .env | grep DB_
```

**解决方案：**

```bash
# 启动 PostgreSQL
sudo systemctl start postgresql-15

# 检查防火墙
sudo firewall-cmd --list-all

# 检查 pg_hba.conf（如果需要远程连接）
sudo nano /var/lib/pgsql/15/data/pg_hba.conf
```

### 6.3 端口被占用

```bash
# 查看端口占用
sudo lsof -i :3006
sudo netstat -tlnp | grep 3006

# 杀死占用进程
sudo kill -9 <PID>

# 或修改 .env 中的 PORT
```

### 6.4 PM2 启动失败

```bash
# 查看详细错误
pm2 logs fangdu-backend --lines 100

# 检查环境变量
pm2 env fangdu-backend

# 手动启动测试
cd /var/www/fangdu-system/backend
node dist/index.js

# 检查构建文件
ls -la dist/
```

### 6.5 前端页面空白

```bash
# 1. 检查前端构建文件
ls -la frontend/dist/

# 2. 检查 Nginx 配置
sudo nginx -t
sudo tail -f /var/log/nginx/fangdu-error.log

# 3. 检查浏览器控制台错误
# 打开浏览器开发者工具查看

# 4. 检查 API 代理
curl https://your-domain.com/api/health
```

### 6.6 文件上传失败

```bash
# 检查上传目录权限
ls -la backend/uploads/
sudo chown -R $USER:$USER backend/uploads/

# 检查 Nginx 上传大小限制
# 在 nginx.conf 中设置: client_max_body_size 50M;
```

---

## 7. 上线后验证

### 7.1 服务状态检查

```bash
# PM2 服务列表
pm2 list

# 应该看到：
# ┌─────┬──────────────────┬─────────┬─────────┬──────────┐
# │ id  │ name             │ status  │ restart │ uptime   │
# ├─────┼──────────────────┼─────────┼─────────┼──────────┤
# │ 0   │ fangdu-backend   │ online  │ 0       │ 5m       │
# └─────┴──────────────────┴─────────┴─────────┴──────────┘
```

### 7.2 日志检查

```bash
# 实时查看日志
pm2 logs fangdu-backend

# 查看最近100行
pm2 logs fangdu-backend --lines 100

# 查看错误日志
pm2 logs fangdu-backend --err
```

### 7.3 API 健康检查

```bash
# 本地测试
curl http://localhost:3006/health

# 通过域名测试
curl https://your-domain.com/api/health

# 应该返回 JSON 响应
```

### 7.4 前端访问测试

1. 打开浏览器访问: `https://your-domain.com`
2. 检查是否能正常加载页面
3. 尝试登录功能
4. 检查 API 请求是否正常

### 7.5 数据库连接测试

```bash
# 连接数据库
psql -h localhost -U fangdu_user -d fangdu_db

# 查看表
\dt

# 查看用户表
SELECT id, username, role FROM users LIMIT 5;

# 退出
\q
```

---

## 8. 自动更新代码

### 8.1 手动更新（推荐用于测试）

```bash
# 使用更新脚本
cd /var/www/fangdu-system
chmod +x deploy/scripts/update-code.sh
./deploy/scripts/update-code.sh
```

### 8.2 Git Hook 自动部署（推荐用于生产）

**在服务器上创建 Git Hook：**

```bash
cd /var/www/fangdu-system/.git/hooks
cat > post-receive << 'EOF'
#!/bin/bash
cd /var/www/fangdu-system
git pull origin master
npm install
cd frontend && npm install && npm run build && cd ..
cd backend && npm install && npm run build && cd ..
pm2 restart fangdu-backend
EOF

chmod +x post-receive
```

**在本地配置远程仓库：**

```bash
# 添加服务器为远程仓库
git remote add production root@your-server-ip:/var/www/fangdu-system/.git

# 推送代码（会自动触发部署）
git push production master
```

### 8.3 GitHub Webhook 自动部署

**1. 在服务器上创建 Webhook 接收脚本：**

```bash
sudo mkdir -p /var/www/webhooks
sudo nano /var/www/webhooks/fangdu-webhook.sh
```

**脚本内容：**

```bash
#!/bin/bash
cd /var/www/fangdu-system
git pull origin master
npm install
cd frontend && npm install && npm run build && cd ..
cd backend && npm install && npm run build && cd ..
pm2 restart fangdu-backend
echo "Deployment completed at $(date)"
```

```bash
chmod +x /var/www/webhooks/fangdu-webhook.sh
```

**2. 安装 webhook 服务器（可选，使用 nodejs-webhook）：**

```bash
npm install -g nodejs-webhook
webhook -p 9000 -s /var/www/webhooks/fangdu-webhook.sh
```

**3. 在 GitHub 仓库设置 Webhook：**

- Settings → Webhooks → Add webhook
- Payload URL: `http://your-server-ip:9000/webhook`
- Content type: `application/json`
- Events: `Just the push event`

---

## 📝 快速命令参考

```bash
# 查看服务状态
pm2 list

# 查看日志
pm2 logs fangdu-backend

# 重启服务
pm2 restart fangdu-backend

# 停止服务
pm2 stop fangdu-backend

# 重新加载 Nginx
sudo systemctl reload nginx

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/fangdu-error.log

# 测试后端 API
curl http://localhost:3006/health

# 更新代码
cd /var/www/fangdu-system && git pull && npm install && cd frontend && npm run build && cd ../backend && npm run build && pm2 restart fangdu-backend
```

---

## ✅ 部署检查清单

- [ ] 服务器环境准备完成（Node.js, PM2, Nginx, PostgreSQL）
- [ ] 安全组端口已开放（80, 443, 3006）
- [ ] 代码已上传到服务器
- [ ] .env 文件已配置
- [ ] 数据库已初始化
- [ ] PM2 服务已启动
- [ ] Nginx 已配置并重载
- [ ] SSL 证书已安装
- [ ] 域名已解析到服务器 IP
- [ ] 前端页面可以访问
- [ ] API 接口可以访问
- [ ] 登录功能正常
- [ ] 文件上传功能正常

---

## 🆘 紧急联系

如果遇到问题：

1. 查看日志: `pm2 logs fangdu-backend`
2. 检查服务: `pm2 list`
3. 测试 API: `curl http://localhost:3006/health`
4. 查看 Nginx 错误: `sudo tail -f /var/log/nginx/fangdu-error.log`

---

**祝部署顺利！🎉**

