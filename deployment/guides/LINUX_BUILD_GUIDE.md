# 🐧 คู่มือการ Build ระบบ WorkplanV6 บน Linux

**วันที่:** 23 กันยายน 2567  
**ระบบ:** WorkplanV6 Production Tracking System  
**เซิร์ฟเวอร์:** Linux Server (Ubuntu/Debian)

---

## 📋 ข้อกำหนดเบื้องต้น

- **Linux Server**: Ubuntu 20.04+ หรือ Debian 10+
- **RAM**: อย่างน้อย 4GB
- **Storage**: อย่างน้อย 20GB
- **Network**: เชื่อมต่อกับ Database Server (192.168.0.94)

---

## 🚀 ขั้นตอนการ Build ระบบ

### 1. **SSH เข้า Linux Server**
```bash
ssh itjitdhana@192.168.0.96
# password: <REDACTED_PASSWORD>
```

### 2. **สร้างโฟลเดอร์โปรเจค**
```bash
# สร้างโฟลเดอร์สำหรับโปรเจค
sudo mkdir -p /opt/workplanv6
sudo chown itjitdhana:itjitdhana /opt/workplanv6
cd /opt/workplanv6
```

### 3. **Clone Repository จาก GitHub**
```bash
# Clone โปรเจคจาก GitHub
git clone https://github.com/iTjitdhana/WorkplanV6linux.git .

# ตรวจสอบว่าได้ไฟล์ครบ
ls -la
```

### 4. **ติดตั้ง Docker และ Docker Compose**

#### วิธีที่ 1: ใช้ Script (แนะนำ)
```bash
# ใช้ script ที่มีอยู่แล้ว
chmod +x install-docker.sh
./install-docker.sh

# logout และ login ใหม่
exit
# login ใหม่
ssh itjitdhana@192.168.0.96
cd /opt/workplanv6
```

#### วิธีที่ 2: ติดตั้งด้วยมือ
```bash
# อัพเดท package list
sudo apt update

# ติดตั้ง Docker
sudo apt install -y docker.io docker-compose-plugin

# เพิ่ม user เข้า docker group
sudo usermod -aG docker $USER
newgrp docker

# ตรวจสอบการติดตั้ง
docker --version
docker compose version
```

### 5. **สร้างไฟล์ Environment**

#### สร้างไฟล์ `.env` สำหรับ Backend
```bash
# สร้างโฟลเดอร์ backend
mkdir -p backend

# สร้างไฟล์ .env
cat > backend/.env << 'EOF'
NODE_ENV=production
PORT=3101
DB_HOST=192.168.0.94
DB_USER=jitdhana
DB_PASSWORD=<REDACTED_PASSWORD>
DB_NAME=esp_tracker
DB_PORT=3306
LOGS_DB_HOST=192.168.0.93
LOGS_DB_USER=it.jitdhana
LOGS_DB_PASSWORD=<REDACTED_PASSWORD>
LOGS_DB_NAME=esp_tracker
LOGS_DB_PORT=3306
JWT_SECRET=<REDACTED_JWT_SECRET>
SESSION_SECRET=<REDACTED_SESSION_SECRET>
CORS_ORIGIN=http://192.168.0.96:3012
EOF
```

#### สร้างไฟล์ `.env.local` สำหรับ Frontend
```bash
# สร้างโฟลเดอร์ frontend
mkdir -p frontend

# สร้างไฟล์ .env.local
cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://backend:3101
BACKEND_URL=http://backend:3101
EOF
```

### 6. **Build และรันระบบ**

#### วิธีที่ 1: ใช้ Docker Compose (แนะนำ)
```bash
# เข้าโฟลเดอร์โปรเจค
cd /opt/workplanv6

# ตรวจสอบไฟล์ docker-compose.linux.yml
cat docker-compose.linux.yml

# Build และรันระบบ
docker compose -f docker-compose.linux.yml up --build -d

# ตรวจสอบสถานะ
docker compose -f docker-compose.linux.yml ps
```

#### วิธีที่ 2: ใช้ Script
```bash
# เข้าโฟลเดอร์โปรเจค
cd /opt/workplanv6

# ใช้ script ที่มีอยู่แล้ว
chmod +x deploy-from-github.sh
./deploy-from-github.sh
```

### 7. **ตรวจสอบการทำงาน**

#### ตรวจสอบสถานะ Containers
```bash
# ดูสถานะ containers
docker compose -f docker-compose.linux.yml ps

# ดู logs
docker compose -f docker-compose.linux.yml logs -f frontend
docker compose -f docker-compose.linux.yml logs -f backend
```

#### ทดสอบการเชื่อมต่อ
```bash
# ทดสอบ Backend API
curl http://192.168.0.96:3102/health

# ทดสอบ Frontend
curl -I http://192.168.0.96:3012
```

#### เปิดเว็บเบราว์เซอร์
- **Frontend**: http://192.168.0.96:3012
- **Backend API**: http://192.168.0.96:3102

---

## 🔧 การจัดการระบบ

### การอัปเดทระบบ
```bash
cd /opt/workplanv6

# ดึงโค้ดล่าสุด
git pull origin main

# Build และรันใหม่
docker compose -f docker-compose.linux.yml up --build -d
```

### การรีสตาร์ทระบบ
```bash
cd /opt/workplanv6

# รีสตาร์ททั้งระบบ
docker compose -f docker-compose.linux.yml restart

# รีสตาร์ทเฉพาะ service
docker compose -f docker-compose.linux.yml restart frontend
docker compose -f docker-compose.linux.yml restart backend
```

### การหยุดระบบ
```bash
cd /opt/workplanv6

# หยุดระบบ
docker compose -f docker-compose.linux.yml down

# หยุดและลบ volumes
docker compose -f docker-compose.linux.yml down -v
```

### การดู Logs
```bash
cd /opt/workplanv6

# ดู logs ทั้งหมด
docker compose -f docker-compose.linux.yml logs -f

# ดู logs เฉพาะ service
docker compose -f docker-compose.linux.yml logs -f frontend
docker compose -f docker-compose.linux.yml logs -f backend

# ดู logs ย้อนหลัง
docker compose -f docker-compose.linux.yml logs --tail=100
```

---

## 🛠️ การแก้ไขปัญหา

### ปัญหา Port ถูกใช้งานแล้ว
```bash
# หา process ที่ใช้ port
sudo lsof -i :3012
sudo lsof -i :3102

# Kill process
sudo kill -9 <PID>
```

### ปัญหา Docker Permission Denied
```bash
# เพิ่ม user เข้า docker group
sudo usermod -aG docker $USER
newgrp docker
```

### ปัญหา Database Connection Failed
```bash
# ทดสอบการเชื่อมต่อ database
telnet 192.168.0.94 3306

# ตรวจสอบ firewall
sudo ufw status
```

### ปัญหา Out of Memory
```bash
# ดู memory usage
free -h
docker stats

# เพิ่ม swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## 📁 โครงสร้างโฟลเดอร์

```
/opt/workplanv6/
├── backend/                 # Backend code
│   ├── .env                # Environment variables
│   ├── Dockerfile          # Backend Docker image
│   └── ...
├── frontend/               # Frontend code
│   ├── .env.local          # Frontend environment
│   ├── Dockerfile          # Frontend Docker image
│   └── ...
├── docker-compose.linux.yml # Docker Compose config
├── deploy-from-github.sh   # Deployment script
├── install-docker.sh       # Docker installation script
└── ...
```

---

## 🔒 Security

### เปิด Firewall Ports
```bash
# เปิด port ที่จำเป็น
sudo ufw allow 3012
sudo ufw allow 3102
sudo ufw allow 22  # SSH
sudo ufw enable
```

### ตั้งค่า SSL/HTTPS (แนะนำ)
```bash
# ติดตั้ง Nginx
sudo apt install nginx

# ติดตั้ง Certbot
sudo apt install certbot python3-certbot-nginx
```

---

## 📊 Monitoring

### ดู Resource Usage
```bash
# ดู Docker stats
docker stats

# ดู system resources
htop
iostat -x 1
```

### ดู Logs ขนาดใหญ่
```bash
# Archive logs
docker compose -f docker-compose.linux.yml logs > logs_$(date +%Y%m%d).log
```

---

## 🎯 Quick Commands

```bash
# เริ่มระบบ
cd /opt/workplanv6 && docker compose -f docker-compose.linux.yml up -d

# หยุดระบบ
cd /opt/workplanv6 && docker compose -f docker-compose.linux.yml down

# เริ่มใหม่
cd /opt/workplanv6 && docker compose -f docker-compose.linux.yml up --build -d

# ดู logs
cd /opt/workplanv6 && docker compose -f docker-compose.linux.yml logs -f

# ดู status
cd /opt/workplanv6 && docker compose -f docker-compose.linux.yml ps
```

---

## 📞 Support

**แผนกเทคโนโลยีสารสนเทศ**  
**บริษัท จิตต์ธนา จำกัด**

---

**🎉 ระบบ WorkplanV6 พร้อมใช้งานบน Linux Server!**

*อัปเดทล่าสุด: 23 กันยายน 2567*
