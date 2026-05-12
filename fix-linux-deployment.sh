#!/bin/bash

# สคริปต์แก้ไขปัญหาการ deploy บน Linux Server
# วันที่: 23 กันยายน 2567

echo "🔧 แก้ไขปัญหาการ deploy บน Linux Server"
echo "=============================================="

# ตรวจสอบว่าอยู่ในโฟลเดอร์ที่ถูกต้อง
if [ ! -f "README.md" ]; then
    echo "❌ ไม่พบไฟล์ README.md"
    echo "💡 กรุณาเข้าไปในโฟลเดอร์โปรเจคก่อน"
    exit 1
fi

echo "📋 ขั้นตอนการแก้ไข:"
echo ""

# 1. ดึงโค้ดล่าสุดจาก GitHub
echo "1️⃣ ดึงโค้ดล่าสุดจาก GitHub..."
git pull origin main

# 2. ตรวจสอบไฟล์ docker-compose.linux.yml
echo ""
echo "2️⃣ ตรวจสอบไฟล์ docker-compose.linux.yml..."
if [ -f "docker-compose.linux.yml" ]; then
    echo "✅ พบไฟล์ docker-compose.linux.yml ในโฟลเดอร์หลัก"
else
    echo "❌ ไม่พบไฟล์ docker-compose.linux.yml ในโฟลเดอร์หลัก"
    echo "🔄 คัดลอกไฟล์จาก deployment/linux/..."
    if [ -f "deployment/linux/docker-compose.linux.yml" ]; then
        cp deployment/linux/docker-compose.linux.yml .
        echo "✅ คัดลอกไฟล์สำเร็จ"
    else
        echo "❌ ไม่พบไฟล์ใน deployment/linux/"
        exit 1
    fi
fi

# 3. สร้างไฟล์ environment สำหรับ backend
echo ""
echo "3️⃣ สร้างไฟล์ environment สำหรับ backend..."
if [ ! -f "backend/.env" ]; then
    echo "📝 สร้างไฟล์ backend/.env..."
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
    echo "✅ สร้างไฟล์ backend/.env สำเร็จ"
else
    echo "✅ ไฟล์ backend/.env มีอยู่แล้ว"
fi

# 4. สร้างไฟล์ environment สำหรับ frontend
echo ""
echo "4️⃣ สร้างไฟล์ environment สำหรับ frontend..."
if [ ! -f "frontend/.env.local" ]; then
    echo "📝 สร้างไฟล์ frontend/.env.local..."
    cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://backend:3101
BACKEND_URL=http://backend:3101
EOF
    echo "✅ สร้างไฟล์ frontend/.env.local สำเร็จ"
else
    echo "✅ ไฟล์ frontend/.env.local มีอยู่แล้ว"
fi

# 5. ตรวจสอบ Docker
echo ""
echo "5️⃣ ตรวจสอบ Docker..."
if command -v docker &> /dev/null; then
    echo "✅ Docker ติดตั้งแล้ว"
    docker --version
else
    echo "❌ Docker ยังไม่ได้ติดตั้ง"
    echo "💡 ติดตั้ง Docker ก่อน:"
    echo "   curl -fsSL https://get.docker.com -o get-docker.sh"
    echo "   sudo sh get-docker.sh"
    echo "   sudo usermod -aG docker \$USER"
    exit 1
fi

if command -v docker-compose &> /dev/null || docker compose version &> /dev/null; then
    echo "✅ Docker Compose ติดตั้งแล้ว"
else
    echo "❌ Docker Compose ยังไม่ได้ติดตั้ง"
    echo "💡 ติดตั้ง Docker Compose:"
    echo "   sudo apt install -y docker-compose-plugin"
    exit 1
fi

# 6. หยุด containers เก่า (ถ้ามี)
echo ""
echo "6️⃣ หยุด containers เก่า..."
docker compose -f docker-compose.linux.yml down 2>/dev/null || true

# 7. Build และรัน containers
echo ""
echo "7️⃣ Build และรัน containers..."
echo "🔄 กำลัง build และรัน containers..."
docker compose -f docker-compose.linux.yml up --build -d

# 8. ตรวจสอบสถานะ
echo ""
echo "8️⃣ ตรวจสอบสถานะ containers..."
sleep 10
docker compose -f docker-compose.linux.yml ps

# 9. ทดสอบการเข้าถึง
echo ""
echo "9️⃣ ทดสอบการเข้าถึง..."
echo "🔍 ทดสอบ Backend API..."
if curl -s -f "http://192.168.0.96:3102/health" > /dev/null; then
    echo "✅ Backend API ทำงานได้"
else
    echo "❌ Backend API ไม่สามารถเข้าถึงได้"
fi

echo "🔍 ทดสอบ Frontend..."
if curl -s -f "http://192.168.0.96:3012" > /dev/null; then
    echo "✅ Frontend ทำงานได้"
else
    echo "❌ Frontend ไม่สามารถเข้าถึงได้"
fi

echo ""
echo "=============================================="
echo "📊 สรุปผลการแก้ไข:"
echo "=============================================="

# แสดงสถานะสุดท้าย
echo "🔍 สถานะ containers:"
docker compose -f docker-compose.linux.yml ps

echo ""
echo "🌐 URLs สำหรับการเข้าถึง:"
echo "   - Frontend: http://192.168.0.96:3012"
echo "   - Tracker: http://192.168.0.96:3012/tracker"
echo "   - Backend API: http://192.168.0.96:3102"
echo "   - Health Check: http://192.168.0.96:3102/health"

echo ""
echo "📋 คำสั่งที่มีประโยชน์:"
echo "   - ดู logs: docker compose -f docker-compose.linux.yml logs -f"
echo "   - ตรวจสอบสถานะ: docker compose -f docker-compose.linux.yml ps"
echo "   - รีสตาร์ท: docker compose -f docker-compose.linux.yml restart"
echo "   - หยุดระบบ: docker compose -f docker-compose.linux.yml down"

echo ""
echo "🎉 การแก้ไขเสร็จสิ้น!"
echo "💡 หากยังมีปัญหา ให้ตรวจสอบ logs:"
echo "   docker compose -f docker-compose.linux.yml logs -f"
