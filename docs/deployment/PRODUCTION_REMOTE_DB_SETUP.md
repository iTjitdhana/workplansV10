# Production Setup with Remote Database

## ภาพรวมระบบ
- **Database Server**: 192.168.0.94 (MySQL)
- **Backend Server**: 192.168.0.161 (Node.js API)
- **Frontend Server**: 192.168.0.161 (Next.js)
- **Network Access**: เครื่องอื่นในเครือข่ายสามารถเข้าถึงได้ผ่าน 192.168.0.161

## ขั้นตอนการตั้งค่า

### 1. ตั้งค่า MySQL ให้ยอมรับการเชื่อมต่อระยะไกล

รัน script นี้บนเครื่อง 192.168.0.94 (Database Server):

```bash
setup-mysql-remote-access.bat
```

หรือทำตามขั้นตอนนี้:

1. **เข้าสู่ MySQL เป็น root**:
   ```sql
   mysql -u root -p
   ```

2. **ให้สิทธิ์ user jitdhana**:
   ```sql
   GRANT ALL PRIVILEGES ON esp_tracker.* TO 'jitdhana'@'%' IDENTIFIED BY '<REDACTED_PASSWORD>';
   GRANT ALL PRIVILEGES ON esp_tracker.* TO 'jitdhana'@'192.168.0.161' IDENTIFIED BY '<REDACTED_PASSWORD>';
   FLUSH PRIVILEGES;
   ```

3. **แก้ไข MySQL configuration**:
   - เปิดไฟล์ `C:\ProgramData\MySQL\MySQL Server 8.0\my.ini`
   - เปลี่ยน `bind-address = 127.0.0.1` เป็น `bind-address = 0.0.0.0`
   - Restart MySQL service

### 2. ทดสอบการเชื่อมต่อ Database

รัน script นี้บนเครื่อง 192.168.0.161 (Backend Server):

```bash
test-remote-database.bat
```

### 3. รันระบบ Production

#### วิธีที่ 1: รันทั้งระบบพร้อมกัน
```bash
start-full-production.bat
```

#### วิธีที่ 2: รันแยกกัน

**Backend Server**:
```bash
start-production-remote-db.bat
```

**Frontend Server**:
```bash
start-frontend-production.bat
```

## การเข้าถึงระบบ

### จากเครื่อง 192.168.0.161 (Server):
- Frontend: http://192.168.0.161:3011
- Backend API: http://192.168.0.161:3101

### จากเครื่องอื่นในเครือข่าย:
- Frontend: http://192.168.0.161:3011
- Backend API: http://192.168.0.161:3101

## การตั้งค่า Environment Variables

### Backend (.env หรือ ecosystem.config.js):
```env
NODE_ENV=production
DB_HOST=192.168.0.94
DB_USER=jitdhana
DB_PASSWORD=<REDACTED_PASSWORD>
DB_NAME=esp_tracker
DB_PORT=3306
PRODUCTION_HOST=192.168.0.161
PORT=3101
```

### Frontend (.env หรือ package.json):
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://192.168.0.161:3101
PORT=3011
```

## การแก้ไขปัญหา

### ปัญหา: Database connection failed
**สาเหตุ**: MySQL ไม่ยอมรับการเชื่อมต่อจาก IP อื่น
**วิธีแก้**:
1. ตรวจสอบ MySQL bind-address
2. ให้สิทธิ์ user จาก IP ที่ต้องการ
3. ตรวจสอบ Firewall

### ปัญหา: Frontend เข้าได้แต่เชื่อม API ไม่ได้
**สาเหตุ**: CORS configuration ไม่ถูกต้อง
**วิธีแก้**:
1. ตรวจสอบ CORS settings ใน server.js
2. ตรวจสอบ NEXT_PUBLIC_API_URL ใน frontend

### ปัญหา: เครื่องอื่นเข้าไม่ได้
**สาเหตุ**: Firewall หรือ Network configuration
**วิธีแก้**:
1. ตรวจสอบ Windows Firewall
2. ตรวจสอบ Network adapter settings
3. ตรวจสอบ Router configuration

## การตรวจสอบระบบ

### 1. ตรวจสอบ Database Connection:
```bash
mysql -h 192.168.0.94 -u jitdhana -p<REDACTED_PASSWORD> esp_tracker -e "SELECT 1 as test;"
```

### 2. ตรวจสอบ Backend API:
```bash
curl http://192.168.0.161:3101/api
```

### 3. ตรวจสอบ Frontend:
เปิดเบราว์เซอร์ไปที่ http://192.168.0.161:3011

## การ Monitor ระบบ

### ตรวจสอบ Logs:
- Backend logs: `backend/logs/`
- Frontend logs: `frontend/logs/`

### ตรวจสอบ Process:
```bash
# ตรวจสอบ Node.js processes
tasklist | findstr node

# ตรวจสอบ MySQL service
sc query mysql80
```

## การ Backup และ Restore

### Backup Database:
```bash
mysqldump -h 192.168.0.94 -u jitdhana -p<REDACTED_PASSWORD> esp_tracker > backup.sql
```

### Restore Database:
```bash
mysql -h 192.168.0.94 -u jitdhana -p<REDACTED_PASSWORD> esp_tracker < backup.sql
```

## การ Update ระบบ

### 1. Stop servers
### 2. Pull latest code
### 3. Install dependencies
### 4. Run database migrations (ถ้ามี)
### 5. Start servers

```bash
# Stop servers
taskkill /f /im node.exe

# Update code
git pull

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start servers
start-full-production.bat
``` 