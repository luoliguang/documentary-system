# 🚀 跟单系统部署包

> **一键部署到阿里云 ECS，30分钟上线！**  
> **支持标准部署和宝塔面板部署**

---

## 🎯 部署方式选择

- **标准部署**: 使用 `server-setup.sh` + `deploy.sh`（适合纯净服务器）
- **宝塔面板部署**: 使用 `server-setup-baota.sh` + `deploy-baota.sh`（适合已有宝塔面板的服务器，**不影响其他项目**）

---

## 📁 文件结构

```
deploy/
├── README.md                    # 本文件
├── DEPLOYMENT.md                # 完整部署文档（标准版）
├── 宝塔面板部署指南.md          # 宝塔面板部署文档
├── QUICK_START.md              # 快速开始指南
├── 宝塔面板快速部署.txt         # 宝塔面板快速命令
├── server-setup.sh             # 服务器环境准备脚本（标准版）
├── server-setup-baota.sh       # 服务器环境准备脚本（宝塔版）
├── deploy.sh                   # 一键部署脚本（标准版）
├── deploy-baota.sh             # 一键部署脚本（宝塔版）
├── env.example                 # 环境变量示例
├── database/
│   ├── setup-db.sh            # 数据库初始化脚本
│   └── init-database.sh       # 表结构初始化脚本
├── nginx/
│   ├── fangdu.conf            # Nginx 配置文件（标准版）
│   └── baota-reverse-proxy.conf # 宝塔面板反向代理配置
├── pm2/
│   └── ecosystem.config.js    # PM2 配置文件
└── scripts/
    ├── install-ssl.sh         # SSL 证书安装脚本
    ├── update-code.sh         # 代码更新脚本
    └── health-check.sh         # 健康检查脚本
```

---

## ⚡ 快速开始

### 🎯 方式一：宝塔面板部署（推荐，不影响其他项目）

```bash
# 1. 上传代码到 /www/wwwroot/fangdu-system
cd /www/wwwroot
git clone https://github.com/your-repo/fangdu-website-follow.git fangdu-system
cd fangdu-system

# 2. 执行环境准备
chmod +x deploy/server-setup-baota.sh
./deploy/server-setup-baota.sh

# 3. 配置环境变量
cp deploy/env.example .env
nano .env  # 编辑配置

# 4. 在宝塔面板创建数据库，然后初始化
cd deploy/database
chmod +x setup-db.sh init-database.sh
./setup-db.sh
./init-database.sh

# 5. 一键部署
cd /www/wwwroot/fangdu-system
chmod +x deploy/deploy-baota.sh
./deploy/deploy-baota.sh

# 6. 在宝塔面板配置站点和反向代理（详见 宝塔面板部署指南.md）
```

### 🎯 方式二：标准部署（纯净服务器）

```bash
# 1. 登录服务器后执行
chmod +x server-setup.sh
./server-setup.sh
```

### 2. 上传代码（5分钟）

```bash
# 方法1: Git
cd /var/www
git clone https://github.com/your-repo/fangdu-website-follow.git fangdu-system

# 方法2: SCP（在本地执行）
scp -r . root@your-server-ip:/var/www/fangdu-system
```

### 3. 配置环境（5分钟）

```bash
cd /var/www/fangdu-system
cp deploy/env.example .env
nano .env  # 编辑配置
```

### 4. 初始化数据库（5分钟）

```bash
cd deploy/database
chmod +x setup-db.sh init-database.sh
./setup-db.sh
./init-database.sh
```

### 5. 一键部署（5分钟）

```bash
cd /var/www/fangdu-system
chmod +x deploy/deploy.sh
./deploy/deploy.sh
```

### 6. 配置 Nginx 和 SSL（5分钟）

```bash
# 配置 Nginx
sudo cp deploy/nginx/fangdu.conf /etc/nginx/conf.d/fangdu.conf
sudo nano /etc/nginx/conf.d/fangdu.conf  # 修改域名
sudo nginx -t && sudo systemctl reload nginx

# 安装 SSL
cd deploy/scripts
chmod +x install-ssl.sh
./install-ssl.sh your-domain.com your-email@example.com
```

---

## 📚 详细文档

### 宝塔面板用户（推荐）
- **快速部署**: 查看 [宝塔面板快速部署.txt](./宝塔面板快速部署.txt)
- **完整指南**: 查看 [宝塔面板部署指南.md](./宝塔面板部署指南.md)

### 标准部署用户
- **快速开始**: 查看 [QUICK_START.md](./QUICK_START.md)
- **完整部署**: 查看 [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## 🔧 常用命令

```bash
# 查看服务状态
pm2 list

# 查看日志
pm2 logs fangdu-backend

# 重启服务
pm2 restart fangdu-backend

# 更新代码
./deploy/scripts/update-code.sh

# 测试 API
curl http://localhost:3006/health
```

---

## 🆘 遇到问题？

查看 [DEPLOYMENT.md](./DEPLOYMENT.md) 中的「常见问题排查」章节。

---

**祝部署顺利！🎉**

