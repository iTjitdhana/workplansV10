# ระบบจัดการ Logs การผลิต

## 📋 รายละเอียดระบบ

ระบบจัดการ Logs การผลิตที่เชื่อมต่อกับ MySQL database จริง พร้อมหน้าตาเหมือน mockup ที่ให้มา

### 🎯 คุณสมบัติหลัก

- **แสดงข้อมูลจริง**: เชื่อมต่อกับ database `esp_tracker_empty` table `logs`
- **รูปแบบวันที่**: แสดงเป็น DD/MM/YYYY
- **รูปแบบเวลา**: แสดงเป็น HH:MM (24 ชั่วโมง)
- **การค้นหา**: ค้นหาด้วยชื่องาน, Job Code
- **การแก้ไข**: แก้ไขข้อมูลการผลิตได้
- **การลบ**: ลบรายการที่ไม่ต้องการ
- **สถิติภาพรวม**: แสดงจำนวนงานทั้งหมด, งานที่เสร็จแล้ว, ประสิทธิภาพ

### 🗄️ โครงสร้าง Database

```sql
CREATE TABLE logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  work_plan_id INT DEFAULT 0,
  production_date DATE NOT NULL,
  job_code VARCHAR(100) NOT NULL,
  job_name VARCHAR(255) NOT NULL,
  input_material_quantity DECIMAL(10,2) DEFAULT 0,
  input_material_unit VARCHAR(50) DEFAULT '',
  output_quantity DECIMAL(10,2) DEFAULT 0,
  output_unit VARCHAR(50) DEFAULT '',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_production_date (production_date),
  INDEX idx_job_code (job_code),
  INDEX idx_work_plan_id (work_plan_id)
);
```

### 🔧 การติดตั้ง

#### 1. ติดตั้ง Dependencies
```bash
cd frontend
npm install mysql2
```

#### 2. สร้างตารางใน Database
รัน SQL script ใน `create-logs-table.sql` หรือใช้คำสั่ง SQL ข้างต้น

#### 3. รันระบบ

**แบบ Development:**
```bash
.\start-logs-system.bat
```

**แบบ Docker:**
```bash
.\start-logs-docker.bat
```

### 🌐 การเข้าถึง

- **หน้า Logs**: http://localhost:3011/logs
- **API Logs**: http://localhost:3011/api/logs

### 📊 API Endpoints

#### GET /api/logs
ดึงข้อมูล logs ทั้งหมด

#### POST /api/logs
สร้าง log ใหม่

#### PUT /api/logs/[id]
แก้ไข log ตาม ID

#### DELETE /api/logs/[id]
ลบ log ตาม ID

### 🔧 การแก้ไขปัญหา

#### Port Conflict
```bash
.\fix-port-conflict.bat
```

#### Docker Issues
```bash
.\fix-docker-build.bat
```

### 📝 ข้อมูลตัวอย่าง

ระบบจะแสดงข้อมูลตัวอย่างในตาราง:
- Oyakodon (คัดไก่)
- ลูกรอก
- ลาบหมูนึ่ง 6 ชิ้น
- ปลาช่อนทอด
- แกงเขียวหวานไก่

### 🎨 UI Features

- **Overview Cards**: แสดงสถิติภาพรวม
- **Search & Filter**: ค้นหาและกรองข้อมูล
- **Edit Dialog**: แก้ไขข้อมูลในรูปแบบ modal
- **Responsive Design**: รองรับทุกขนาดหน้าจอ
- **Loading States**: แสดงสถานะการโหลด
- **Error Handling**: จัดการข้อผิดพลาด

### 🔒 การเชื่อมต่อ Database

```javascript
const connection = await mysql.createConnection({
  host: '192.168.0.94',
  user: 'jitdhana',
  password: '<REDACTED_PASSWORD>',
  database: 'esp_tracker_empty'
});
```

### 📈 Performance

- **Database Indexing**: มี index สำหรับการค้นหาที่รวดเร็ว
- **Connection Pooling**: ใช้ mysql2 สำหรับประสิทธิภาพที่ดี
- **Caching**: ใช้ Next.js caching
- **Optimization**: Bundle splitting และ code splitting

### 🚀 การ Deploy

#### Development
```bash
npm run dev
```

#### Production
```bash
npm run build
npm run start
```

#### Docker
```bash
docker-compose up -d
```

---

**หมายเหตุ**: ระบบนี้เชื่อมต่อกับ database จริงที่ `192.168.0.94` ใช้ database `esp_tracker_empty` และ table `logs` 