# 🎯 คู่มือการใช้งาน Database ใหม่ (manufacturing_system)

**อัพเดท:** 2025-10-20

---

## ✅ สิ่งที่ทำเสร็จแล้ว

1. ✅ แก้ไข `backend/config/database.js` ให้รองรับ 2 Database พร้อมกัน
2. ✅ รองรับตัวแปร `NEW_*` ที่คุณสร้างใน `.env.development`
3. ✅ สร้างไฟล์ทดสอบ connection
4. ✅ Export pool ทั้ง 2 สำหรับใช้งาน

---

## 📝 ตัวแปรใน .env.development

คุณมีตัวแปรชุดใหม่:
```bash
# Database ใหม่ (manufacturing_system)
NEW_HOST=192.168.0.94
NEW_USER=jitdhana  
NEW_PASSWORD=<REDACTED_PASSWORD>
NEW_NAME=manufacturing_system
NEW_PORT=3306

# Database เก่า (esp_tracker) - ยังใช้ได้
DB_HOST=192.168.0.94
DB_USER=jitdhana
DB_PASSWORD=<REDACTED_PASSWORD>
DB_NAME=esp_tracker
DB_PORT=3306
```

---

## 🔌 Connection Pools ที่มี

```javascript
// backend/config/database.js export 2 pools:

const { pool, newPool } = require('./config/database');

// pool      = esp_tracker (เก่า)
// newPool   = manufacturing_system (ใหม่)
```

---

## 🧪 การทดสอบ Connection

### 1. ทดสอบ Database ใหม่อย่างเดียว
```bash
cd backend
node test-new-db-connection.js
```

**ผลลัพธ์ที่คาดหวัง:**
```
🔍 Testing NEW database connection (manufacturing_system)...
✅ New Database connected successfully
🏠 Connected to host: 192.168.0.94
👤 Connected as user: jitdhana
📊 Database: manufacturing_system
🧪 Database query test: PASSED
📋 Tables found: 20
```

### 2. ทดสอบทั้ง 2 Database พร้อมกัน
```bash
cd backend
node test-both-db-connections.js
```

**ผลลัพธ์ที่คาดหวัง:**
```
========================================
🔌 Testing All Database Connections
========================================

🔍 Testing OLD database connection (esp_tracker)...
✅ Old Database connected successfully
📊 Database: esp_tracker

---

🔍 Testing NEW database connection (manufacturing_system)...
✅ New Database connected successfully
📊 Database: manufacturing_system
📋 Tables found: 20

========================================
✅ Connection Tests Complete
========================================

📊 Data Comparison:
👥 Users:
   Old DB: 21 records
   New DB: 21 records
   Status: ✅ Same
```

---

## 💻 วิธีใช้งานใน Code

### ตัวอย่างที่ 1: ใช้ Database เก่า (esp_tracker)

```javascript
// controllers/someController.js
const { pool } = require('../config/database');

async function getOldData(req, res) {
  try {
    const [rows] = await pool.query('SELECT * FROM fg LIMIT 10');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### ตัวอย่างที่ 2: ใช้ Database ใหม่ (manufacturing_system)

```javascript
// controllers/newController.js
const { newPool } = require('../config/database');

async function getProducts(req, res) {
  try {
    // ใช้ newPool สำหรับ manufacturing_system
    const [rows] = await newPool.query(`
      SELECT * FROM products 
      WHERE is_active = 1 
      ORDER BY product_name 
      LIMIT 20
    `);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### ตัวอย่างที่ 3: ใช้ทั้ง 2 Database พร้อมกัน

```javascript
// controllers/migrationController.js
const { pool, newPool } = require('../config/database');

async function compareData(req, res) {
  try {
    // ดึงจาก Database เก่า
    const [oldUsers] = await pool.query('SELECT * FROM users');
    
    // ดึงจาก Database ใหม่
    const [newUsers] = await newPool.query('SELECT * FROM users');
    
    res.json({
      old: oldUsers.length,
      new: newUsers.length,
      status: oldUsers.length === newUsers.length ? 'synced' : 'different'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

### ตัวอย่างที่ 4: ใช้ View ใน manufacturing_system

```javascript
const { newPool } = require('../config/database');

async function getLatestTemplates(req, res) {
  try {
    // ใช้ View ที่มีในระบบใหม่
    const [templates] = await newPool.query(`
      SELECT * FROM v_latest_process_templates
      WHERE is_active = 1
      ORDER BY product_code, process_number
    `);
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

---

## 🔄 การ Migrate Controllers

### Before (ใช้ Database เก่า)
```javascript
// models/Product.js
const { pool } = require('../config/database');

class Product {
  static async getAll() {
    const [rows] = await pool.query('SELECT * FROM fg');
    return rows;
  }
}
```

### After (ใช้ Database ใหม่)
```javascript
// models/Product.js
const { newPool } = require('../config/database');

class Product {
  static async getAll() {
    // ใช้ newPool และเปลี่ยนชื่อตาราง
    const [rows] = await newPool.query('SELECT * FROM products WHERE is_active = 1');
    return rows;
  }
  
  // ใช้ View แทน JOIN ซับซ้อน
  static async getLatestTemplates(productCode) {
    const [rows] = await newPool.query(
      'SELECT * FROM v_latest_process_templates WHERE product_code = ?',
      [productCode]
    );
    return rows;
  }
}
```

---

## 🎯 Mapping ชื่อตาราง

| Old (esp_tracker) | New (manufacturing_system) | หมายเหตุ |
|-------------------|----------------------------|----------|
| `fg` | `products` | เปลี่ยนชื่อ + เพิ่ม field |
| `material` | `materials` | เปลี่ยนชื่อ field |
| `process_steps` | `process_templates` | แยกเป็น 2 ตาราง |
| - | `process_executions` | ตารางใหม่ (บันทึกการทำงานจริง) |
| `work_plans` | `work_plans` | เหมือนเดิม แต่เพิ่ม field |
| `production_batches` | `production_batches` | เปลี่ยน fg_code → product_code |

---

## 🎨 ตัวอย่าง Controller แบบเต็ม

สร้างไฟล์ใหม่: `backend/controllers/productController.js`

```javascript
const { newPool } = require('../config/database');

/**
 * Get all active products
 */
exports.getAllProducts = async (req, res) => {
  try {
    const [products] = await newPool.query(`
      SELECT 
        id,
        product_code,
        product_name,
        product_type,
        category,
        unit,
        is_active
      FROM products
      WHERE is_active = 1
      ORDER BY product_name
    `);
    
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get product with process templates
 */
exports.getProductWithTemplates = async (req, res) => {
  try {
    const { productCode } = req.params;
    
    // ใช้ View ที่มีในระบบ
    const [templates] = await newPool.query(`
      SELECT * FROM v_latest_process_templates
      WHERE product_code = ?
      ORDER BY process_number
    `, [productCode]);
    
    if (templates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or has no templates'
      });
    }
    
    res.json({
      success: true,
      product_code: productCode,
      product_name: templates[0].product_name,
      version: templates[0].version,
      templates: templates
    });
  } catch (error) {
    console.error('Error getting product templates:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * Get product statistics
 */
exports.getProductStats = async (req, res) => {
  try {
    const [stats] = await newPool.query(`
      SELECT * FROM v_product_process_statistics
      ORDER BY total_executions DESC
      LIMIT 20
    `);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting product stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
```

---

## 🚦 Routes ตัวอย่าง

สร้างไฟล์: `backend/routes/productRoutes.js`

```javascript
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// GET /api/products - ดึงสินค้าทั้งหมด
router.get('/', productController.getAllProducts);

// GET /api/products/:productCode - ดูรายละเอียดสินค้า + templates
router.get('/:productCode', productController.getProductWithTemplates);

// GET /api/products/stats - สถิติสินค้า
router.get('/stats', productController.getProductStats);

module.exports = router;
```

**เพิ่มใน `backend/server.js`:**
```javascript
// เพิ่มบรรทัดนี้
app.use('/api/products', require('./routes/productRoutes'));
```

---

## 🎯 Checklist สำหรับการใช้งาน

### ✅ เตรียมการ

- [x] สร้างตัวแปร NEW_* ใน `.env.development`
- [x] แก้ไข `backend/config/database.js`
- [ ] สร้าง Database `manufacturing_system`
- [ ] Import Structure จาก `database/sql/structure_manufacturing_system.sql`

### ✅ ทดสอบ

```bash
# 1. ทดสอบ connection Database ใหม่
cd backend
node test-new-db-connection.js

# 2. ทดสอบทั้ง 2 Database
node test-both-db-connections.js

# 3. รัน Backend
npm run dev

# 4. ทดสอบ API (ถ้ามี)
curl http://localhost:3101/api/products
```

---

## 📊 ตัวอย่างการใช้งานจริง

### Scenario 1: ดึงข้อมูลจาก Database เก่า
```javascript
const { pool } = require('./config/database');

// ดึง fg จาก esp_tracker
const [fg] = await pool.query('SELECT * FROM fg WHERE FG_Code = ?', ['FG001']);
```

### Scenario 2: ดึงข้อมูลจาก Database ใหม่
```javascript
const { newPool } = require('./config/database');

// ดึง products จาก manufacturing_system
const [products] = await newPool.query('SELECT * FROM products WHERE product_code = ?', ['FG001']);
```

### Scenario 3: Migrate ข้อมูล
```javascript
const { pool, newPool } = require('./config/database');

async function migrateProducts() {
  // 1. ดึงจาก Database เก่า
  const [oldProducts] = await pool.query('SELECT * FROM fg');
  
  // 2. แปลงและใส่ Database ใหม่
  for (const fg of oldProducts) {
    await newPool.query(`
      INSERT INTO products (product_code, product_name, product_type, unit)
      VALUES (?, ?, 'FG', ?)
      ON DUPLICATE KEY UPDATE product_name = VALUES(product_name)
    `, [fg.FG_Code, fg.FG_Name, fg.base_unit]);
  }
  
  console.log('✅ Migrated', oldProducts.length, 'products');
}
```

---

## 🔍 Debug Tips

### ตรวจสอบว่าใช้ Database ไหน
```javascript
const { pool, newPool } = require('./config/database');

// ตรวจสอบ config
console.log('Old DB:', pool.pool.config.connectionConfig.database);
console.log('New DB:', newPool.pool.config.connectionConfig.database);
```

### ตรวจสอบจำนวน Connections
```javascript
console.log('Old Pool - Active connections:', pool.pool._allConnections.length);
console.log('New Pool - Active connections:', newPool.pool._allConnections.length);
```

---

## 🚨 Troubleshooting

### ปัญหา: Access Denied
```
Error: Access denied for user 'jitdhana'@'%' to database 'manufacturing_system'
```

**แก้ไข:**
```sql
-- ให้สิทธิ์ผู้ใช้
GRANT ALL PRIVILEGES ON manufacturing_system.* TO 'jitdhana'@'%';
FLUSH PRIVILEGES;
```

### ปัญหา: Database doesn't exist
```
Error: Unknown database 'manufacturing_system'
```

**แก้ไข:**
```bash
# สร้าง Database
mysql -h 192.168.0.94 -u jitdhana -p -e "CREATE DATABASE manufacturing_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Import Structure
mysql -h 192.168.0.94 -u jitdhana -p manufacturing_system < database/sql/structure_manufacturing_system.sql
```

### ปัญหา: Table doesn't exist
```
Error: Table 'manufacturing_system.products' doesn't exist
```

**แก้ไข:**
```bash
# Import โครงสร้างใหม่
mysql -h 192.168.0.94 -u jitdhana -p manufacturing_system < database/sql/structure_manufacturing_system.sql
```

---

## 🎯 แนะนำการใช้งาน

### Phase 1: ใช้ทั้ง 2 Database พร้อมกัน (แนะนำ)
- ใช้ `pool` สำหรับ API เดิมที่ยังทำงาน (esp_tracker)
- ใช้ `newPool` สำหรับ API ใหม่ (manufacturing_system)
- ค่อยๆ Migrate ทีละส่วน

### Phase 2: Migrate API ทีละตัว
- เริ่มจาก API ที่ง่ายๆ เช่น `/api/products`
- Test ให้แน่ใจว่าทำงานถูกต้อง
- Migrate API ถัดไป

### Phase 3: ตัดการใช้งาน Database เก่า
- เมื่อ Migrate ครบทุก API แล้ว
- ตัด `pool` ออก ใช้ `newPool` เพียงอย่างเดียว

---

## 📁 ไฟล์ที่เกี่ยวข้อง

| ไฟล์ | ประโยชน์ |
|------|----------|
| `backend/config/database.js` | Config หลัก - export pool และ newPool |
| `backend/.env.development` | ตัวแปร NEW_* สำหรับ DB ใหม่ |
| `backend/test-new-db-connection.js` | ทดสอบ DB ใหม่ |
| `backend/test-both-db-connections.js` | ทดสอบทั้ง 2 DB |
| `docs/root-legacy/DATABASE_MIGRATION_GUIDE.md` | คู่มือ Migration |
| `docs/root-legacy/DATABASE_STRUCTURE.md` | โครงสร้าง manufacturing_system |

---

## ✅ Next Steps

1. **ทดสอบ Connection**
   ```bash
   cd backend
   node test-new-db-connection.js
   ```

2. **สร้าง/Import Database** (ถ้ายังไม่มี)
   ```bash
   mysql -h 192.168.0.94 -u jitdhana -p < database/sql/structure_manufacturing_system.sql
   ```

3. **รัน Backend และดู Console**
   ```bash
   npm run dev
   ```
   จะเห็นข้อมูล 2 Database พร้อมกัน

4. **เริ่ม Migrate API** (ทีละตัว)
   - สร้าง Controller ใหม่ใช้ `newPool`
   - Test ให้แน่ใจ
   - Deploy

---

**Happy Coding! 🚀**

