# 🐳 Docker Hub Guide สำหรับ WorkplanV6

คู่มือการ push และ pull WorkplanV6 ไปยัง/จาก Docker Hub

## 📋 Prerequisites

1. **Docker Hub Account**: ต้องมี account ที่ Docker Hub
2. **Docker Desktop**: ต้องติดตั้งและรัน Docker Desktop
3. **Docker Login**: ต้อง login เข้า Docker Hub ก่อน

## 🚀 การ Push ไปยัง Docker Hub

### วิธีที่ 1: ใช้ Script อัตโนมัติ (แนะนำ)

#### สำหรับ Linux/Mac:
```bash
./push-to-dockerhub.sh
```

#### สำหรับ Windows:
```cmd
push-to-dockerhub.bat
```

### วิธีที่ 2: ใช้คำสั่ง Docker โดยตรง

```bash
# 1. Login to Docker Hub
docker login -u your_username

# 2. Build images
docker build -t workplanv6-frontend:latest .
docker build -t workplanv6-backend:latest ./backend

# 3. Tag images
docker tag workplanv6-frontend:latest your_username/workplanv6-frontend:latest
docker tag workplanv6-backend:latest your_username/workplanv6-backend:latest

# 4. Push images
docker push your_username/workplanv6-frontend:latest
docker push your_username/workplanv6-backend:latest
```

## 📥 การ Pull และ Run จาก Docker Hub

### วิธีที่ 1: ใช้ Script อัตโนมัติ (แนะนำ)

#### สำหรับ Linux/Mac:
```bash
./pull-from-dockerhub.sh
```

#### สำหรับ Windows:
```cmd
pull-from-dockerhub.bat
```

### วิธีที่ 2: ใช้คำสั่ง Docker โดยตรง

```bash
# 1. Pull images
docker pull your_username/workplanv6-frontend:latest
docker pull your_username/workplanv6-backend:latest

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
  your_username/workplanv6-backend:latest

# 3. Run frontend
docker run -d \
  --name workplanv6-frontend \
  -p 3011:3011 \
  -e NODE_ENV=production \
  -e NEXT_PUBLIC_API_URL=http://192.168.0.94:3101 \
  -e BACKEND_URL=http://backend:3101 \
  --restart unless-stopped \
  your_username/workplanv6-frontend:latest
```

### วิธีที่ 3: ใช้ Docker Compose

```bash
# 1. Set environment variables
export DOCKER_USERNAME=your_username
export VERSION=latest

# 2. Run with docker-compose
docker-compose -f docker-compose.prod.yml up -d
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
   docker logout
   docker login -u your_username
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

## 📚 เพิ่มเติม

- [Docker Hub Documentation](https://docs.docker.com/docker-hub/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker CLI Reference](https://docs.docker.com/engine/reference/commandline/cli/)
