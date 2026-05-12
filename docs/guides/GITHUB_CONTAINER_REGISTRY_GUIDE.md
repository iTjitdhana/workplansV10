# 🐳 GitHub Container Registry Guide สำหรับ WorkplanV6

คู่มือการ push และ pull WorkplanV6 ไปยัง/จาก GitHub Container Registry (GHCR)

## 📋 Prerequisites

1. **GitHub Account**: ต้องมี account ที่ GitHub
2. **GitHub Personal Access Token**: ต้องสร้าง Personal Access Token
3. **Docker Desktop**: ต้องติดตั้งและรัน Docker Desktop
4. **Repository**: ต้องมี repository ที่ https://github.com/iTjitdhana/WorkplanV6.git

## 🔑 สร้าง GitHub Personal Access Token

### 1. ไปที่ GitHub Settings
1. ไปที่ https://github.com/settings/tokens
2. คลิก "Generate new token (classic)"
3. เลือก "Generate new token (classic)"

### 2. ตั้งค่า Token
- **Note**: `WorkplanV6 Docker Access`
- **Expiration**: เลือกตามต้องการ (แนะนำ 90 days)
- **Scopes**: เลือก
  - ✅ `write:packages` (สำหรับ push)
  - ✅ `read:packages` (สำหรับ pull)
  - ✅ `delete:packages` (สำหรับลบ packages)

### 3. สร้าง Token
- คลิก "Generate token"
- **คัดลอก token ไว้** (จะไม่แสดงอีกครั้ง)

## 🚀 การ Push ไปยัง GitHub Container Registry

### วิธีที่ 1: ใช้ Script อัตโนมัติ (แนะนำ)

```cmd
push-to-github.bat
```

### วิธีที่ 2: ใช้คำสั่ง Docker โดยตรง

```bash
# 1. Login to GitHub Container Registry
docker login ghcr.io -u your_github_username
# ใส่ Personal Access Token เมื่อถาม password

# 2. Build images
docker build -t workplanv6-frontend:latest .
docker build -t workplanv6-backend:latest ./backend

# 3. Tag images สำหรับ GHCR
docker tag workplanv6-frontend:latest ghcr.io/your_username/workplanv6-frontend:latest
docker tag workplanv6-backend:latest ghcr.io/your_username/workplanv6-backend:latest

# 4. Push images
docker push ghcr.io/your_username/workplanv6-frontend:latest
docker push ghcr.io/your_username/workplanv6-backend:latest
```

## 📥 การ Pull และ Run จาก GitHub Container Registry

### วิธีที่ 1: ใช้ Script อัตโนมัติ (แนะนำ)

```cmd
pull-from-github.bat
```

### วิธีที่ 2: ใช้คำสั่ง Docker โดยตรง

```bash
# 1. Pull images
docker pull ghcr.io/your_username/workplanv6-frontend:latest
docker pull ghcr.io/your_username/workplanv6-backend:latest

# 2. Run backend
docker run -d \
  --name workplanv6-backend \
  -p 3101:3101 \
  -e NODE_ENV=production \
  -e DB_HOST=192.168.0.94 \
  -e DB_USER=jitdhana \
  -e DB_PASSWORD=<REDACTED_PASSWORD> \
  -e DB_NAME=esp_tracker \
  -e DB_PORT=3306 \
  --restart unless-stopped \
  ghcr.io/your_username/workplanv6-backend:latest

# 3. Run frontend
docker run -d \
  --name workplanv6-frontend \
  -p 3011:3011 \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_API_URL=http://192.168.0.94:3101 \
  -e BACKEND_URL=http://backend:3101 \
  --restart unless-stopped \
  ghcr.io/your_username/workplanv6-frontend:latest
```

### วิธีที่ 3: ใช้ Docker Compose

```bash
# 1. Set environment variables
export GITHUB_USERNAME=your_username
export VERSION=latest

# 2. Run with docker-compose
docker-compose -f docker-compose.github.yml up -d
```

## 🔧 การจัดการ Containers

### ดู Status
```bash
docker ps --filter "name=workplanv6"
```

### ดู Logs
```bash
# Frontend logs
docker logs workplanv6-frontend

# Backend logs
docker logs workplanv6-backend

# Follow logs
docker logs -f workplanv6-frontend
```

### หยุด Containers
```bash
docker stop workplanv6-frontend workplanv6-backend
```

### ลบ Containers
```bash
docker rm workplanv6-frontend workplanv6-backend
```

### Restart Containers
```bash
docker restart workplanv6-frontend workplanv6-backend
```

## 🌐 URLs

หลังจากรัน containers สำเร็จ:

- **Frontend**: http://localhost:3011
- **Backend API**: http://localhost:3101
- **GitHub Packages**: https://github.com/your_username?tab=packages

## 📝 Environment Variables

### Frontend Environment Variables
- `NODE_ENV`: production
- `NEXT_PUBLIC_API_URL`: URL ของ backend API
- `BACKEND_URL`: URL ของ backend service

### Backend Environment Variables
- `NODE_ENV`: production
- `DB_HOST`: Database host (192.168.0.94)
- `DB_USER`: Database username (jitdhana)
- `DB_PASSWORD`: Database password (<REDACTED_PASSWORD>)
- `DB_NAME`: Database name (esp_tracker)
- `DB_PORT`: Database port (3306)

## 🔍 Troubleshooting

### ปัญหาที่พบบ่อย

1. **Docker ไม่ได้ทำงาน**
   ```bash
   # ตรวจสอบ Docker status
   docker info
   ```

2. **Login ไม่สำเร็จ**
   ```bash
   # ลอง login ใหม่
   docker logout ghcr.io
   docker login ghcr.io -u your_username
   # ใส่ Personal Access Token
   ```

3. **Port ถูกใช้งาน**
   ```bash
   # ตรวจสอบ port ที่ใช้งาน
   netstat -tulpn | grep :3011
   netstat -tulpn | grep :3101
   ```

4. **Database Connection Error**
   - ตรวจสอบว่า MySQL server ทำงานอยู่
   - ตรวจสอบ IP address และ credentials

### คำสั่ง Debug

```bash
# ตรวจสอบ Docker images
docker images | grep workplanv6

# ตรวจสอบ Docker containers
docker ps -a | grep workplanv6

# ตรวจสอบ Docker networks
docker network ls

# ตรวจสอบ Docker volumes
docker volume ls
```

## 🆚 เปรียบเทียบ GitHub Container Registry vs Docker Hub

| Feature | GitHub Container Registry | Docker Hub |
|---------|---------------------------|------------|
| **Cost** | ฟรีสำหรับ public | ฟรีสำหรับ public |
| **Storage** | ไม่จำกัดสำหรับ public | จำกัด |
| **Security** | Vulnerability scanning | Basic scanning |
| **Integration** | GitHub Actions | Docker Hub Actions |
| **Authentication** | Personal Access Token | Username/Password |
| **Repository** | เชื่อมต่อกับ GitHub repo | แยกจาก GitHub |

## 📚 เพิ่มเติม

- [GitHub Container Registry Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [GitHub Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker CLI Reference](https://docs.docker.com/engine/reference/commandline/cli/)

## 🎯 ข้อดีของ GitHub Container Registry

1. **ฟรีและไม่มีข้อจำกัด** สำหรับ public repositories
2. **เชื่อมต่อกับ GitHub** ที่คุณใช้อยู่แล้ว
3. **Security ดีกว่า** มี vulnerability scanning
4. **Integration ดีกว่า** กับ GitHub Actions
5. **Version control** เชื่อมต่อกับ Git tags
6. **Collaboration** ง่ายกว่าเมื่อทำงานเป็นทีม
