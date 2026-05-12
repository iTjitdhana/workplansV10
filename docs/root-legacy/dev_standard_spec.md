# 🧭 DEV STANDARD – มาตรฐานการพัฒนาโครงการทั้งหมด

## 1. ภาพรวมแนวคิด
โปรเจกต์ทั้งหมดที่พัฒนาโดยทีมนี้ต้องยึดแนวทางเดียวกันเพื่อความสม่ำเสมอ, ปลอดภัย, และสามารถ rollback ได้ทุกเวอร์ชัน  
**ไม่มีการ Hardcode ค่าหรือ URL ในโค้ดโดยตรง**  
ทุกค่าควรถูกกำหนดจาก Environment Variables (`.env`) เท่านั้น

---

## 2. โครงสร้าง Environment

### 🔹 การแยกสภาพแวดล้อม
ทุกโปรเจกต์ต้องมี Environment File อย่างน้อย 2 ชุด:
```
frontend/
  ├─ .env.development
  └─ .env.production
backend/
  ├─ .env.development
  └─ .env.production
```

### 🔹 กฎสำคัญ
- **ห้าม hardcode** ค่า เช่น URL, Secret, Password, API Key, Token ในโค้ดโดยตรง  
- ทุกค่าต้องมาจาก `.env` ผ่านตัวแปร เช่น:
  ```ts
  const apiUrl = import.meta.env.VITE_API_BASE_URL;
  const jwtSecret = process.env.JWT_SECRET;
  ```
- ตัวแปรทั้งหมดต้องขึ้นต้นด้วย `VITE_` หากใช้ใน React (Vite)
- ไฟล์ `.env.*` ห้าม commit ลง Git (ใส่ใน `.gitignore`)
- Commit เฉพาะ `.env.example` เพื่อให้เห็นโครงสร้างตัวแปรที่ต้องใช้

### 🔹 ตัวอย่าง `.env.example`
```bash
# Frontend
VITE_API_BASE_URL=http://localhost:3000/api
VITE_APP_ENV=development

# Backend
PORT=3000
NODE_ENV=development
DATABASE_URL=mysql://user:password@localhost:3306/appdb
JWT_SECRET=replace_me
CORS_ORIGIN=http://localhost:5173
```

---

## 3. Version Control (Git Workflow)

### 🔹 หลักการสำคัญ
- ใช้ **Git + Tag เวอร์ชัน** เพื่อควบคุมการปล่อยระบบ  
- ห้ามสร้างโฟลเดอร์ใหม่หรือโปรเจกต์ใหม่เมื่ออัปเดตเวอร์ชัน (ใช้ tag แทน)
- ทุกครั้งที่มีการ deploy ให้ tag เวอร์ชันเสมอ เช่น:
  ```bash
  git add .
  git commit -m "feat: เพิ่มระบบจัดการผู้ใช้"
  git tag v1.4.0
  git push && git push --tags
  ```
- การ rollback ทำได้ง่าย ๆ ด้วย:
  ```bash
  git checkout v1.3.1
  docker compose up -d --build
  ```
  หรือใน PM2:
  ```bash
  git checkout v1.3.1
  pnpm build
  pm2 restart api
  ```

### 🔹 Tag Format
| ประเภท | ตัวอย่าง | ความหมาย |
|----------|-----------|------------|
| Major | v2.0.0 | เปลี่ยนโครงสร้างระบบ / breaking change |
| Minor | v1.3.0 | เพิ่มฟีเจอร์ใหม่ |
| Patch | v1.3.1 | แก้บั๊ก / ปรับปรุงเล็กน้อย |

---

## 4. Environment Mapping

| Environment | Frontend ENV | Backend ENV | URL ตัวอย่าง |
|--------------|---------------|---------------|----------------|
| Development | `.env.development` | `.env.development` | http://localhost:5173 |
| Staging/Test | `.env.staging` (ถ้ามี) | `.env.staging` | https://staging.domain.com |
| Production | `.env.production` | `.env.production` | https://app.domain.com |

---

## 5. การ Deploy และ Rollback

### 🔹 การ Deploy
1. ตรวจสอบว่า tag ใหม่ล่าสุดอยู่ที่ branch main
2. รันคำสั่งบน server:
   ```bash
   git fetch --all
   git checkout v1.4.0
   docker compose -f docker-compose.prod.yml up -d --build
   docker compose exec api pnpm prisma migrate deploy
   ```

### 🔹 การ Rollback (เมื่อระบบมีปัญหา)
1. ดู tag ที่เคย deploy:
   ```bash
   git tag
   ```
2. กลับไป tag ก่อนหน้า:
   ```bash
   git checkout v1.3.1
   docker compose -f docker-compose.prod.yml up -d --build
   ```

---

## 6. การตั้งชื่อ Branch
- `main` → ใช้สำหรับ release ที่พร้อม deploy  
- `develop` → รวมงานก่อนปล่อยจริง  
- `feature/<ชื่อฟีเจอร์>` → งานย่อย เช่น `feature/add-login-page`  
- `fix/<ชื่อบั๊ก>` → แก้บั๊ก เช่น `fix/temperature-sensor-crash`

---

## 7. การจัดการ Database
- ใช้ **Prisma** หรือ Migration Tool เสมอในการเปลี่ยนแปลงสคีม่า
- ห้ามแก้ DB โดยตรงใน Production
- ทุกครั้งที่ deploy ต้องรัน migration
  ```bash
  pnpm prisma migrate deploy
  ```
- ถ้ามี seed ให้รัน:
  ```bash
  pnpm prisma db seed
  ```

---

## 8. การตั้งค่า CI/CD (แนวทางเบื้องต้น)
- เมื่อมีการ push ไป branch `main`:
  1. รัน lint, typecheck, test
  2. Build Docker image
  3. Deploy ไป staging หรือ production
- เมื่อเกิดปัญหา สามารถ checkout tag ก่อนหน้าเพื่อ rollback ได้ทันที

---

## 9. การเขียนโค้ด
- ห้าม hardcode path, URL, token, หรือ password
- ต้องใช้ config ผ่าน `.env`
- ทุก module ควรมีโครงสร้างแยกชัด:
  ```
  modules/
    users/
      users.controller.ts
      users.service.ts
      users.repo.ts
      users.schema.ts
  ```
- Frontend ควรใช้ config เดียวกันจาก `import.meta.env.*`
- ควรมี README และ DEV_STANDARD.md ทุกโปรเจกต์

---

## 10. สรุปแนวทางสำคัญ (TL;DR)
✅ ไม่มี hardcode ใด ๆ ในโค้ด  
✅ ใช้ `.env` แยก dev/staging/prod  
✅ ใช้ tag (v1.0.0, v1.0.1, …) ทุกครั้งที่ deploy  
✅ rollback ได้ด้วย `git checkout <tag>`  
✅ ใช้ Docker Compose หรือ PM2 จัดการรันระบบ  
✅ Prisma migrate ทุกครั้งก่อน deploy  
✅ โค้ดอยู่ใน repo เดียว ใช้ branch/PR จัดการเวอร์ชัน  
✅ Cursor ต้องอ่านไฟล์นี้เพื่อรู้มาตรฐาน dev ทุกงาน  

---

## 11. Project Structure Standard
```
root/
├─ frontend/
│   ├─ src/
│   │   ├─ components/
│   │   ├─ features/
│   │   ├─ lib/
│   │   └─ pages/
│   ├─ .env.development
│   └─ .env.production
│
├─ backend/
│   ├─ src/
│   │   ├─ modules/
│   │   ├─ db/
│   │   ├─ common/
│   │   └─ server.ts
│   ├─ prisma/
│   └─ .env.production
│
├─ infra/
│   ├─ docker-compose.dev.yml
│   ├─ docker-compose.prod.yml
│   └─ nginx.conf
│
├─ DEV_STANDARD.md
├─ README.md
└─ package.json
```

---

## 12. Code Review & Pull Request Rules
- ทุกการเปลี่ยนแปลงต้องผ่าน Pull Request (PR)
- PR ต้องมีชื่อสั้น + อธิบายสรุป เช่น `feat: เพิ่มระบบ export CSV`
- ห้าม merge ตรงเข้า main โดยไม่ review
- ต้องมี commit message แบบ Conventional Commit เช่น:
  - `feat:` สำหรับฟีเจอร์ใหม่
  - `fix:` สำหรับการแก้บั๊ก
  - `chore:` สำหรับ config หรือ dependency
  - `docs:` สำหรับเอกสาร
- ทุก PR ต้องผ่าน lint + test ก่อน merge

---

## 13. AI Assistant Behavior
Cursor หรือ AI ที่ช่วยพัฒนาโค้ดในโปรเจกต์นี้ต้อง:
✅ ใช้ตัวแปรจาก .env เท่านั้น  
✅ ห้าม hardcode URL, key, หรือ secret ใด ๆ  
✅ ต้องสร้างโครงสร้างโค้ดตามมาตรฐานนี้เท่านั้น  
✅ ต้องเพิ่ม commit message และ tag ทุกครั้งที่ deploy  
✅ ต้องตรวจสอบก่อนว่า branch อยู่บน `feature/` หรือ `fix/`  
✅ ต้องเพิ่ม test (ถ้ามี logic ใหม่)

---

## 14. Security Standard
- JWT_SECRET ต้องไม่ซ้ำกับ environment อื่น
- ห้ามเปิด CORS เป็น `*`
- ทุก API ต้องใช้ HTTPS เมื่ออยู่ใน Production
- ต้องมี Helmet middleware เปิด security headers
- ต้องเปิด rate limit ที่ backend
- ต้องตรวจสอบ input ทุกครั้งด้วย schema (Zod หรือ Joi)
- ห้ามเก็บรหัสผ่านแบบ plaintext (ต้องใช้ bcrypt หรือ argon2)

---

## 15. Logging & Monitoring
- Backend ต้องใช้ logger กลาง (Pino หรือ Winston)
- ทุก request ต้องมี trace id
- Error ต้อง log ลงไฟล์หรือส่งไป Sentry
- มี endpoint `/health` สำหรับตรวจสถานะระบบ
- ควรมีระบบสำรองข้อมูล (Backup DB รายวัน)

---

## 16. Example Workflow
1. เริ่มงานใหม่ → `git checkout -b feature/add-dashboard`
2. พัฒนาและทดสอบบน localhost (env dev)
3. Commit และ push → เปิด Pull Request
4. เมื่อผ่านการตรวจ → Merge เข้า `main`
5. Tag version → `git tag v1.4.0` → `git push --tags`
6. Deploy บน server ด้วย Docker Compose
7. ถ้ามีปัญหา → Rollback → `git checkout v1.3.1`

---

## 17. Deployment Summary
- ใช้ Docker Compose สำหรับ Production
- ใช้ไฟล์ `.env.production` แยก frontend / backend
- ใช้ Nginx หรือ Caddy เป็น reverse proxy
- คำสั่งหลัก:
  ```bash
  git fetch --all
  git checkout v1.4.0
  docker compose -f infra/docker-compose.prod.yml up -d --build
  docker compose -f infra/docker-compose.prod.yml exec api pnpm prisma migrate deploy
  ```
- Rollback:
  ```bash
  git checkout v1.3.1
  docker compose -f infra/docker-compose.prod.yml up -d --build
  ```

---

> ✳️ **หมายเหตุ:**  
> ถ้า Cursor หรือ AI Agent ทำงานในโปรเจกต์นี้ ให้ถือว่า `DEV_STANDARD.md` คือสัญญาหลักของระบบ  
> ทุกฟีเจอร์ใหม่ต้องยึดตามแนวทางในไฟล์นี้เท่านั้น

---

## 18. Database Environment Configuration

### 🔹 มาตรฐานการตั้งค่า Database (.env)
เพื่อความปลอดภัยและความยืดหยุ่นในการย้ายระบบ ทุกค่าการเชื่อมต่อฐานข้อมูลต้องอยู่ในไฟล์ `.env` เท่านั้น ห้าม hardcode ค่าเชื่อมต่อภายในโค้ด

#### ✅ ตัวอย่างที่ถูกต้อง (MySQL)
```bash
# .env.development
DB_HOST=192.168.0.96
DB_PORT=3306
DB_USER=jitdhana
DB_PASS=<REDACTED_PASSWORD>
DB_NAME=jdnsystem
```

ในโค้ด Node.js:
```js
import mysql from 'mysql2/promise';

const db = await mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});
```

> 💡 ใช้ connection pool แทน connection เดี่ยวเสมอ เพื่อให้ระบบรองรับหลาย request ได้ดีขึ้น

#### 🚫 ตัวอย่างที่ไม่ควรใช้
```js
// ❌ ห้ามเขียนแบบนี้
const db = mysql.createConnection({
  host: '192.168.0.96',
  user: 'jitdhana',
  password: '<REDACTED_PASSWORD>',
  database: 'jdnsystem'
});
```

---

### 🔹 การใช้ Connection String (ตัวเลือกเสริม)
บาง library เช่น Knex, Sequelize รองรับ connection string แบบเดียวกับ Prisma ได้:
```bash
DATABASE_URL=mysql://jitdhana:iT12345%24@192.168.0.96:3306/jdnsystem
```
> ⚠️ ต้อง escape อักขระพิเศษในรหัสผ่าน เช่น `$` → `%24`, `@` → `%40`

---

### 🔹 การแยก Environment
| Environment | ไฟล์ | ตัวอย่างค่า | หมายเหตุ |
|--------------|------|---------------|-----------|
| Development | `.env.development` | host: 192.168.0.96 | ใช้เชื่อมต่อเครื่องทดสอบภายใน |
| Production | `.env.production` | host: localhost / mysql | ใช้เชื่อมต่อฐานข้อมูลจริง (ห้ามใช้รหัสเดียวกับ dev) |

---

### 🔹 ตัวอย่างใน Docker Compose (Production)
```yaml
services:
  api:
    image: jitdhana-api:latest
    environment:
      DB_HOST: mysql
      DB_PORT: 3306
      DB_USER: app
      DB_PASS: ${MYSQL_PASSWORD}
      DB_NAME: jdnsystem
```

และไฟล์ `.env.production` จะเก็บค่าจริง:
```bash
MYSQL_PASSWORD=StrongPassHere!@2025
```

---

### 🔹 แนวทางความปลอดภัยเพิ่มเติม
- อย่า commit `.env` ลง Git ให้ใส่ชื่อไฟล์ `.env*` ใน `.gitignore`
- ใช้รหัสผ่านที่แตกต่างระหว่าง dev / prod
- ตั้งสิทธิ์ user บน MySQL ให้เหมาะสม เช่น `jitdhana@192.168.%` ไม่ควรใช้ root
- หากเป็นระบบใหญ่ ควรใช้ Secrets Manager (เช่น AWS Secret Manager, Docker secrets)
- ตั้ง firewall ให้ MySQL เปิดเฉพาะ IP ที่จำเป็น (เช่น Server 192.168.0.x)

---

> ✅ ผลลัพธ์ของการใช้มาตรฐานนี้:
> - ระบบ dev/prod แยกกันชัดเจน
> - ปลอดภัยจากการรั่วของรหัสผ่านใน GitHub
> - ย้ายเครื่อง server หรือเปลี่ยนฐานข้อมูลได้ง่ายโดยไม่ต้องแก้โค้ด
> - Cursor เข้าใจวิธีอ่านตัวแปร DB โดยไม่ hardcode
---

## 19. Docker Deployment & Network Standard (Finalized)

### 🔹 Network Mode (Default = bridge)
- ✅ ใช้ **bridge network** เป็นค่าเริ่มต้นสำหรับทุก service
- ✅ ให้ MySQL อนุญาต IP ของเครื่องเซิร์ฟเวอร์ (เพราะ container จะ NAT ออกเป็น IP โฮสต์)
- ⚠️ ใช้ `network_mode: "host"` เฉพาะกรณีจำเป็นจริง เช่น latency ต่ำมาก, protocol พิเศษ หรือ multicast
- ❌ ไม่ควรตั้งเป็นค่า default เพราะ:
  - ลดความปลอดภัย (ไม่มี isolation)
  - เสี่ยงพอร์ตชนกับ host
  - ทำให้ไม่สามารถพกพาระบบข้าม OS (Windows / macOS) ได้

ตัวอย่าง (Production):
```yaml
services:
  backend:
    build: ./backend
    env_file: ./backend/.env.production
    ports:
      - "${API_PORT:-3000}:3000"
    restart: always
    networks:
      - app_network

  frontend:
    build: ./frontend
    env_file: ./frontend/.env.production
    ports:
      - "${WEB_PORT:-5173}:5173"
    depends_on:
      - backend
    networks:
      - app_network

networks:
  app_network:
    driver: bridge
```

---

## 20. Dependencies & Security Library Standard

### 🔹 Password Hashing
- ✅ ใช้ **Argon2** หรือ **bcrypt** สำหรับรหัสผ่านเท่านั้น
- ❌ ห้ามใช้ `crypto.createHash()` สำหรับ password hashing (ไม่ปลอดภัย)

### 🔹 UUID / ID
- ✅ ใช้ `crypto.randomUUID()` ได้ถ้า Node >= 16
- ถ้าใช้ CommonJS ให้ล็อก `uuid@8` เพื่อความเข้ากันได้

### 🔹 ก่อนติดตั้ง Library ใหม่ ให้ตรวจสอบว่า:
1. จำเป็นจริง ๆ หรือใช้ built-in แทนได้
2. เข้ากับระบบโมดูล (ESM / CJS)
3. ไม่มี dependency chain ที่ใหญ่เกินจำเป็น
4. มีการบำรุงรักษา (ล่าสุดไม่เกิน 12 เดือน)
5. ตรวจสอบ License ให้แน่ชัด (MIT / Apache / BSD เท่านั้น)

---

## 21. Port Management Standard

### 🔹 การกำหนดพอร์ต
- ระบุพอร์ตทั้งหมดผ่าน `.env` เช่น:
```bash
API_PORT=3000
WEB_PORT=5173
```

- ใน `docker-compose.yml` ให้ map ตามค่าจาก `.env`:
```yaml
services:
  backend:
    ports:
      - "${API_PORT}:3000"
  frontend:
    ports:
      - "${WEB_PORT}:5173"
```

- ห้าม hardcode port ในโค้ด เช่น `app.listen(3000)` → ให้ใช้ `app.listen(process.env.PORT)`

### 🔹 ข้อควรระวัง
- หลีกเลี่ยงการ expose พอร์ตฐานข้อมูล (MySQL/Redis) ออกภายนอกโดยตรง
- ถ้าจำเป็น ต้อง firewall allow เฉพาะ IP ที่ใช้งานจริง
- ทุก service ต้องใช้พอร์ตไม่ซ้ำกันในระบบเดียวกัน

---

## 22. Database Access & Permission Standard

### 🔹 การเชื่อมต่อ
- ใช้ **mysql2/promise** + Connection Pool สำหรับ production
- แนะนำ connection limit = 10–20 ตามโหลดระบบ

ตัวอย่าง:
```js
import mysql from 'mysql2/promise';
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT || 3306),
  connectionLimit: 10,
  waitForConnections: true,
});
```

### 🔹 การกำหนดสิทธิ์ผู้ใช้ MySQL
- ห้ามใช้ root account สำหรับแอปพลิเคชัน
- กำหนดสิทธิ์เท่าที่จำเป็น (SELECT, INSERT, UPDATE, DELETE)
- ระบุ host ของผู้ใช้ MySQL ให้ชัดเจน เช่น:
```sql
CREATE USER 'jitdhana'@'192.168.%' IDENTIFIED BY 'StrongPassHere!';
GRANT SELECT, INSERT, UPDATE, DELETE ON jdnsystem.* TO 'jitdhana'@'192.168.%';
FLUSH PRIVILEGES;
```

### 🔹 Connection String
- ถ้ารหัสผ่านมีอักขระพิเศษ (เช่น `$`, `@`) ให้ **encode** ก่อน เช่น:
  - `$` → `%24`
  - `@` → `%40`

ตัวอย่าง:
```bash
DATABASE_URL=mysql://jitdhana:iT12345%24@192.168.0.96:3306/jdnsystem
```

### 🔹 ความปลอดภัยเพิ่มเติม
- ใช้ SSL/TLS ถ้าเชื่อมต่อ DB ข้ามเครื่อง
- สำรองข้อมูล DB รายวัน (auto backup)
- จำกัดการเข้าถึง DB ด้วย firewall (allow IP เฉพาะ server)

---

## ✅ บทสรุป
- ใช้ **bridge network** เป็นค่าเริ่มต้นเสมอ
- ใช้ **Argon2 / bcrypt** สำหรับ password hashing
- ระบุพอร์ตผ่าน `.env` และ map ผ่าน `docker-compose.yml`
- ใช้ connection pool และสิทธิ์ DB เฉพาะงาน
- ปลอดภัยกว่า, พกพาได้, และแก้ไขง่ายในอนาคต
