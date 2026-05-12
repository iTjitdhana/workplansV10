# 🚀 Quick Start - Development Mode

## ขั้นตอนการรัน Development (ครั้งแรก)

### 1️⃣ ติดตั้ง Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd frontend
npm install
```

### 2️⃣ ตรวจสอบไฟล์ .env

**ไฟล์ที่ต้องมี:**
- ✅ `backend/.env.development`
- ✅ `frontend/.env.development`

**ถ้าไม่มี ให้สร้างจาก template:**
```bash
# Backend
cd backend
copy .env.example .env.development

# Frontend
cd frontend
copy .env.example .env.development
```

**แก้ไขค่าใน .env.development ให้ถูกต้อง:**
```bash
# backend/.env.development
DB_HOST=192.168.0.94
DB_USER=jitdhana
DB_PASSWORD=<REDACTED_PASSWORD>
DB_NAME=esp_tracker

# frontend/.env.development
NEXT_PUBLIC_API_URL=http://localhost:3101
```

### 3️⃣ รัน Development Server

**เปิด 2 Terminal:**

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

คุณจะเห็น:
```
🚀 Starting Backend Server...
📊 Environment: development
🔌 Port: 3101
✅ Database connected successfully
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

คุณจะเห็น:
```
- ready started server on 0.0.0.0:3012
- Local:   http://localhost:3012
```

### 4️⃣ เข้าใช้งาน

- 🌐 **Frontend:** http://localhost:3012
- 🔧 **Backend API:** http://localhost:3101
- ❤️ **Health Check:** http://localhost:3101/health

---

## 🔄 การรันครั้งถัดไป (ไม่ต้อง install แล้ว)

```bash
# Terminal 1: Backend
cd C:\WorkplanV6\backend
npm run dev

# Terminal 2: Frontend
cd C:\WorkplanV6\frontend
npm run dev
```

---

## 🛑 หยุดการทำงาน

กด `Ctrl + C` ใน terminal ที่รัน backend และ frontend

---

## ⚡ Scripts ที่มีประโยชน์

### Backend Scripts
```bash
npm run dev          # Development mode (nodemon auto-reload)
npm run start        # Production mode
npm run lint         # ตรวจสอบ code
npm run lint:fix     # แก้ไข linting issues
```

### Frontend Scripts
```bash
npm run dev          # Development mode (hot reload)
npm run build        # Build for production
npm run start        # Run production build
npm run lint         # ตรวจสอบ code
npm run type-check   # ตรวจสอบ TypeScript
```

---

## 🐛 Troubleshooting

### ปัญหา: Port already in use

**Backend (3101) ถูกใช้:**
```bash
# Windows
netstat -ano | findstr :3101
taskkill /PID <PID> /F

# หรือเปลี่ยนพอร์ตใน backend/.env.development
PORT=3103
```

**Frontend (3012) ถูกใช้:**
```bash
# Windows
netstat -ano | findstr :3012
taskkill /PID <PID> /F

# หรือรันพอร์ตอื่น
npm run dev -- -p 3013
```

### ปัญหา: Database connection failed

**ตรวจสอบ:**
1. MySQL service กำลังรันอยู่หรือไม่
2. ข้อมูลใน `backend/.env.development` ถูกต้องหรือไม่
3. Database `esp_tracker` มีอยู่หรือไม่

```bash
# Test connection
mysql -h 192.168.0.94 -u jitdhana -p esp_tracker
```

### ปัญหา: Module not found

```bash
# ลบและติดตั้งใหม่
rm -rf node_modules package-lock.json
npm install
```

---

## 📦 Docker Alternative (ถ้าไม่อยากรัน 2 terminal)

```bash
# รันทั้งหมดด้วย Docker Compose
docker compose -f docker-compose.dev.yml up

# รันใน background
docker compose -f docker-compose.dev.yml up -d

# ดู logs
docker compose logs -f

# หยุด
docker compose down
```

---

## 📝 Environment Variables

### Backend (.env.development)
```env
NODE_ENV=development
PORT=3101
DB_HOST=192.168.0.94
DB_USER=jitdhana
DB_PASSWORD=<REDACTED_PASSWORD>
DB_NAME=esp_tracker
DB_PORT=3306
JWT_SECRET=workplan_jwt_secret_dev_2024_key_v6_do_not_use_in_production
CORS_ORIGIN=http://localhost:3012
LOG_LEVEL=debug
```

### Frontend (.env.development)
```env
NEXT_PUBLIC_API_URL=http://localhost:3101
NEXT_PUBLIC_BACKEND_URL=http://localhost:3101
NEXT_PUBLIC_APP_ENV=development
```

---

## ✅ Checklist ก่อนเริ่มงาน

- [ ] MySQL service กำลังรันอยู่
- [ ] มีไฟล์ `.env.development` ทั้ง backend และ frontend
- [ ] `npm install` เสร็จแล้วทั้ง backend และ frontend
- [ ] Port 3101 และ 3012 ว่าง
- [ ] ทดสอบเข้า http://localhost:3012 ได้

---

**Happy Coding! 🚀**

