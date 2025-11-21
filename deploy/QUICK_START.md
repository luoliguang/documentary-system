# ⚡ 快速部署指南（30分钟上线）

> **适合**: 第一次部署，按步骤执行即可

---

## 🚀 第一步：服务器准备（5分钟）

```bash
# 1. 登录服务器
ssh root@your-server-ip

# 2. 执行准备脚本
wget https://raw.githubusercontent.com/your-repo/fangdu-website-follow/master/deploy/server-setup.sh
chmod +x server-setup.sh
./server-setup.sh
```

**或者手动执行：**

```bash
# 更新系统
sudo yum update -y

# 安装 Node.js 18
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs git

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
```

---

## 📦 第二步：上传代码（5分钟）

```bash
# 在服务器上
cd /var/www
sudo git clone https://github.com/your-username/fangdu-website-follow.git fangdu-system
sudo chown -R $USER:$USER fangdu-system
cd fangdu-system
```

**如果没有 Git，用 SCP：**

```bash
# 在本地执行
scp -r . root@your-server-ip:/var/www/fangdu-system
```

---

## ⚙️ 第三步：配置环境（5分钟）

```bash
cd /var/www/fangdu-system

# 1. 创建 .env 文件
cp deploy/.env.example .env

# 2. 编辑 .env（必须修改 JWT_SECRET 和数据库密码）
nano .env

# 3. 生成 JWT_SECRET
openssl rand -base64 32
# 复制生成的字符串到 .env 的 JWT_SECRET
```

**最小配置（.env）：**

```env
NODE_ENV=production
PORT=3006
JWT_SECRET=生成的随机字符串
CORS_ORIGIN=https://your-domain.com
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fangdu_db
DB_USER=fangdu_user
DB_PASSWORD=你的密码
```

---

## 🗄️ 第四步：初始化数据库（5分钟）

```bash
cd /var/www/fangdu-system/deploy/database

# 1. 创建数据库和用户
chmod +x setup-db.sh
./setup-db.sh

# 2. 初始化表结构
chmod +x init-database.sh
./init-database.sh
```

---

## 🚀 第五步：一键部署（5分钟）

```bash
cd /var/www/fangdu-system
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

**等待脚本执行完成，应该看到：**

```
✅ 部署完成！
📊 服务状态：
[PM2] fangdu-backend: online
```

---

## 🌐 第六步：配置 Nginx 和域名（5分钟）

```bash
# 1. 复制 Nginx 配置
sudo cp deploy/nginx/fangdu.conf /etc/nginx/conf.d/fangdu.conf

# 2. 编辑配置，修改域名
sudo nano /etc/nginx/conf.d/fangdu.conf
# 将所有 your-domain.com 替换为你的实际域名

# 3. 测试配置
sudo nginx -t

# 4. 重载 Nginx
sudo systemctl reload nginx
```

---

## 🔒 第七步：安装 SSL 证书（5分钟）

```bash
cd /var/www/fangdu-system/deploy/scripts
chmod +x install-ssl.sh
./install-ssl.sh your-domain.com your-email@example.com
```

**或者手动安装：**

```bash
sudo yum install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## ✅ 验证部署

```bash
# 1. 检查服务
pm2 list

# 2. 测试 API
curl http://localhost:3006/health

# 3. 查看日志
pm2 logs fangdu-backend
```

**浏览器访问：** `https://your-domain.com`

---

## 🆘 遇到问题？

### 502 Bad Gateway

```bash
pm2 restart fangdu-backend
pm2 logs fangdu-backend
```

### 数据库连接失败

```bash
sudo systemctl status postgresql-15
sudo systemctl start postgresql-15
```

### 端口被占用

```bash
sudo lsof -i :3006
sudo kill -9 <PID>
```

---

## 📝 后续更新代码

```bash
cd /var/www/fangdu-system
git pull
npm install
cd frontend && npm run build && cd ..
cd backend && npm run build && cd ..
pm2 restart fangdu-backend
```

**或使用更新脚本：**

```bash
./deploy/scripts/update-code.sh
```

---

**完成！🎉 现在可以通过域名访问系统了！**

