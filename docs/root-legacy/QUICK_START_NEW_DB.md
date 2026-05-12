# ⚡ Quick Start: ใช้งาน Database ใหม่ (manufacturing_system)

---

## 🎯 สรุปสั้นๆ

คุณมีตัวแปรในไฟล์ `backend/.env.development`:
```bash
NEW_HOST=192.168.0.94
NEW_USER=jitdhana
NEW_PASSWORD=<REDACTED_PASSWORD>
NEW_NAME=manufacturing_system
NEW_PORT=3306
```

ระบบจะใช้ตัวแปรเหล่านี้เชื่อมต่อ Database ใหม่ **พร้อมกับ** Database เก่า (esp_tracker)

---

## 🚀 ขั้นตอนการใช้งาน (5 นาที)

### 1️⃣ สร้าง Database ใหม่ (ถ้ายังไม่มี)

```bash
# เข้า MySQL
mysql -h 192.168.0.94 -u jitdhana -p

# สร้าง Database
CREATE DATABASE manufacturing_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit
```

### 2️⃣ Import Structure

```bash
# Import โครงสร้างตาราง
mysql -h 192.168.0.94 -u jitdhana -p manufacturing_system < database/sql/structure_manufacturing_system.sql
```

### 3️⃣ ทดสอบ Connection

```bash
cd backend
node test-new-db-connection.js
```

**ผลลัพธ์ที่ต้องเห็น:**
```
✅ New Database connected successfully
📊 Database: manufacturing_system
🧪 Database query test: PASSED
📋 Tables found: 20
```

### 4️⃣ รัน Backend

```bash
npm run dev
```

**Console จะแสดง:**
```
🔧 Database Configuration:
   📊 Old DB (esp_tracker):
      Database: esp_tracker
   🆕 New DB (manufacturing_system):
      Database: manufacturing_system
```

---

## 💻 วิธีใช้ใน Code

### Database เก่า (esp_tracker)
```javascript
const { pool } = require('./config/database');

// ใช้ตารางเดิม: fg, material, process_steps
const [data] = await pool.query('SELECT * FROM fg');
```

### Database ใหม่ (manufacturing_system)
```javascript
const { newPool } = require('./config/database');

// ใช้ตารางใหม่: products, materials, process_templates
const [data] = await newPool.query('SELECT * FROM products');
```

---

## 📋 ตาราง Mapping

| ตารางเก่า (esp_tracker) | ตารางใหม่ (manufacturing_system) |
|-------------------------|----------------------------------|
| `fg` | `products` |
| `material` | `materials` |
| `process_steps` | `process_templates` + `process_executions` |
| `work_plans` | `work_plans` (ปรับปรุงแล้ว) |
| `users` | `users` (เพิ่ม field) |

---

## 🎯 ตัวอย่าง Controller ใหม่

```javascript
// controllers/newProductController.js
const { newPool } = require('../config/database');

exports.getProducts = async (req, res) => {
  try {
    // Query จาก manufacturing_system
    const [products] = await newPool.query(`
      SELECT * FROM products 
      WHERE is_active = 1
      ORDER BY product_name
    `);
    
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProcessTemplates = async (req, res) => {
  try {
    // ใช้ View ที่มีในระบบใหม่
    const [templates] = await newPool.query(`
      SELECT * FROM v_latest_process_templates
      ORDER BY product_code, process_number
    `);
    
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

---

## ✅ Checklist

- [ ] สร้าง Database `manufacturing_system`
- [ ] Import Structure
- [ ] ทดสอบ `node test-new-db-connection.js`
- [ ] รัน `npm run dev` และตรวจสอบ console
- [ ] เริ่มใช้ `newPool` ใน Controllers ใหม่

---

## 📚 เอกสารเพิ่มเติม

- **docs/root-legacy/HOW_TO_USE_NEW_DATABASE.md** - คู่มือละเอียด พร้อมตัวอย่าง
- **docs/root-legacy/DATABASE_MIGRATION_GUIDE.md** - วิธี Migrate ข้อมูล
- **docs/root-legacy/DATABASE_STRUCTURE.md** - โครงสร้างตารางทั้งหมด

---

**ใช้เวลาแค่ 5 นาที ก็พร้อมใช้งานแล้ว! 🎉**

