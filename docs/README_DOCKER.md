# คู่มือการใช้งาน Docker WorkplanV6

## ข้อกำหนดเบื้องต้น
- Docker และ Docker Compose ติดตั้งแล้ว
- MySQL Database ทำงานที่ `192.168.0.94:3306`
- Database: `esp_tracker`
- User: `jitdhana`
- Password: `<REDACTED_PASSWORD>`

## การใช้งาน

### 1. Build และ Run ระบบ (Development)
```bash
# ใช้ script อัตโนมัติ
./docker-build.sh

# หรือใช้คำสั่ง Docker Compose โดยตรง
docker-compose up -d --build
```

### 2. Push ขึ้น Docker Hub
```bash
# Push images ขึ้น Docker Hub
./docker-push.sh

# ต้อง login Docker Hub ก่อน
docker login -u itjitdhana
```

### 3. Deploy จาก Docker Hub (Production)
```bash
# Deploy จาก Docker Hub
./docker-deploy.sh

# หรือใช้คำสั่ง Docker Compose โดยตรง
docker-compose -f docker-compose.prod.yml up -d
```

### 4. ตรวจสอบสถานะ
```bash
# ดูสถานะ containers
docker-compose ps
# หรือ
docker-compose -f docker-compose.prod.yml ps

# ดู logs
docker-compose logs -f
# หรือ
docker-compose -f docker-compose.prod.yml logs -f

# ดู logs เฉพาะ service
docker-compose logs -f frontend
docker-compose logs -f backend
```

### 5. หยุดระบบ
```bash
# Development
docker-compose down

# Production
docker-compose -f docker-compose.prod.yml down
```

### 6. รีสตาร์ทระบบ
```bash
# Development
docker-compose restart

# Production
docker-compose -f docker-compose.prod.yml restart
```

### 7. ลบและสร้างใหม่
```bash
# Development
docker-compose down --rmi all
docker-compose up -d --build

# Production
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

## Ports ที่ใช้
- **Frontend**: `http://localhost:3011`
- **Backend**: `http://localhost:3101`

## Docker Hub Images
- **Frontend**: `itjitdhana/workplanv6.4-frontend:latest`
- **Backend**: `itjitdhana/workplanv6.4-backend:latest`

## โครงสร้างไฟล์
```
WorkplanV6/
├── Dockerfile                 # Frontend Dockerfile
├── docker-compose.yml         # Docker Compose (Development)
├── docker-compose.prod.yml    # Docker Compose (Production)
├── .dockerignore             # Files to ignore in Docker build
├── docker-build.sh           # Build script
├── docker-push.sh            # Push to Docker Hub script
├── docker-deploy.sh          # Deploy from Docker Hub script
├── frontend/                 # Frontend application
│   ├── Dockerfile           # Frontend Dockerfile (not used)
│   ├── package.json
│   └── next.config.mjs
└── backend/                  # Backend application
    ├── Dockerfile           # Backend Dockerfile
    ├── package.json
    └── .dockerignore
```

## การแก้ไขปัญหา

### 1. Build ไม่สำเร็จ
```bash
# ลบ cache และ build ใหม่
docker system prune -a
docker-compose build --no-cache
```

### 2. Push ไม่สำเร็จ
```bash
# ตรวจสอบ Docker Hub login
docker login -u itjitdhana

# ตรวจสอบ network connection
ping hub.docker.com
```

### 3. Port ถูกใช้งาน
```bash
# ตรวจสอบ port ที่ใช้งาน
netstat -tulpn | grep :3011
netstat -tulpn | grep :3101

# หยุด process ที่ใช้ port
sudo kill -9 <PID>
```

### 4. Database Connection Error
- ตรวจสอบว่า MySQL ทำงานที่ `192.168.0.94:3306`
- ตรวจสอบ credentials ใน `docker-compose.yml`
- ตรวจสอบ firewall settings

### 5. npm install errors
- ระบบใช้ `npm install --legacy-peer-deps` เพื่อแก้ปัญหา dependency conflicts
- หากยังมีปัญหา ให้ลบ `node_modules` และ `package-lock.json` แล้ว build ใหม่

## การอัปเดตระบบ

### Development
```bash
# Pull code ใหม่
git pull

# Build และ deploy
./docker-build.sh
```

### Production
```bash
# Pull code ใหม่
git pull

# Build และ push
./docker-build.sh
./docker-push.sh

# Deploy บน production server
./docker-deploy.sh
```

## การสำรองข้อมูล
```bash
# สำรอง database
docker exec -it <mysql_container> mysqldump -u jitdhana -p esp_tracker > backup.sql

# Restore database
docker exec -i <mysql_container> mysql -u jitdhana -p esp_tracker < backup.sql
```

## การ Monitor ระบบ
```bash
# ดูการใช้ทรัพยากร
docker stats

# ดู disk usage
docker system df

# Clean up unused resources
docker system prune
```

## Workflow การ Deploy

### 1. Development Workflow
```bash
# 1. Build และ test ในเครื่อง local
./docker-build.sh

# 2. Test ระบบ
# เข้าไปที่ http://localhost:3011

# 3. หาก OK ให้ push ขึ้น Docker Hub
./docker-push.sh
```

### 2. Production Workflow
```bash
# 1. Deploy จาก Docker Hub
./docker-deploy.sh

# 2. ตรวจสอบ logs
docker-compose -f docker-compose.prod.yml logs -f

# 3. ตรวจสอบระบบ
# เข้าไปที่ http://localhost:3011
```
