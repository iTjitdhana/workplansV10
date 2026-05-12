# Master Overview - WorkplanV6

ระบบวางแผนการผลิตและติดตามสถานะงาน (WorkplanV6) ประกอบด้วย Frontend (Next.js 14 + TypeScript) และ Backend (Node.js + Express + MySQL) โดย Frontend ใช้ App Router พร้อม API Routes ทำหน้าที่เป็น proxy เรียก Backend API และแสดงผลผ่านหน้าต่างๆ

## 🔭 Architecture

- Frontend: Next.js App Router (TypeScript, Tailwind, shadcn/ui)
- Backend: Express.js, mysql2/promise, CORS, Helmet, Rate Limit, Compression
- Database: MySQL
- Integrations: Google Sheets proxy API

```mermaid
flowchart LR
  U[User] -->|UI/pages| FE[Next.js Frontend]
  FE -->|/app/api/* (server actions)| FEAPI[Next API Routes]
  FEAPI -->|HTTP REST| BE[Express Backend /api/*]
  BE --> DB[(MySQL)]
  BE --> GS[Google Sheets]
```

## 📦 Core Domains & Models

- WorkPlan, DraftWorkPlan: แผนการผลิตจริง/ฉบับร่าง
- ProductionLog: บันทึกการผลิต (input/output/operator/machine/room/times)
- ProcessStep: ขั้นตอนการผลิต (ตาม job_code/job_name)
- Machine, ProductionRoom, ProductionStatus
- User
- Log: Event/process status per work plan (start/stop/summary)

## 🔌 Backend API (Express)
Base URL: `/api`

- Logs (`/api/logs`)
  - GET `/` - query logs (work_plan_id, date, status)
  - GET `/:id`
  - GET `/work-plan/:workPlanId`
  - GET `/work-plan/:workPlanId/status`
  - GET `/work-plans/status?workPlanIds=1,2,3`
  - GET `/summary/:date`
  - POST `/` (validation)
  - POST `/start`
  - POST `/stop`
  - PUT `/:id` (validation)
  - DELETE `/:id`

- Production Logs (`/api/production-logs`)
  - GET `/latest`
  - GET `/` (filters: production_date, job_code, job_name, status, operator_name, limit)
  - GET `/:id`
  - POST `/`
  - PUT `/:id`
  - DELETE `/:id`
  - GET `/stats/summary`
  - GET `/stats/yield-analysis`
  - GET `/dashboard/data`

- Work Plans (`/api/work-plans`)
  - Drafts
    - GET `/drafts`
    - GET `/drafts/:id`
    - POST `/drafts`
    - PUT `/drafts/:id`
    - DELETE `/drafts/:id`
    - POST `/sync-drafts-to-plans`
  - Main
    - GET `/search?code=&name=`
    - GET `/` (optional `date`)
    - GET `/:id`
    - POST `/` (validation)
    - PUT `/:id` (validation)
    - DELETE `/:id` (ปัจจุบันตอบ 403 เสมอ ตามข้อกำหนดหลัง 18:00 แต่ยังไม่มีเงื่อนไขเวลา)
    - PATCH `/:id/finish`
    - PATCH `/:id/unfinish`
    - PATCH `/:id/cancel`
    - PATCH `/:id/status`

- New Jobs (`/api/new-jobs`)
  - GET `/` (งานที่ job_code = NEW)
  - GET `/process-steps?job_code=&job_name=`
  - PUT `/:work_plan_id` (update job_code/job_name + steps, ใช้ transaction)
  - DELETE `/:work_plan_id` (ลบ NEW + steps, ใช้ transaction)

- Process Steps (`/api/process-steps`)
  - GET `/` (query)
  - GET `/search?query=`
  - GET `/job-codes`
  - POST `/`

- Machines (`/api/machines`)
  - GET `/`
  - GET `/status/:status`
  - GET `/:id`
  - POST `/`
  - PUT `/:id`
  - DELETE `/:id`

- Production Rooms (`/api/production-rooms`)
  - GET `/`
  - GET `/type/:type`
  - GET `/status/:status`
  - GET `/:id`
  - POST `/`
  - PUT `/:id`
  - DELETE `/:id`

- Production Status (`/api/production-status` ใน server.js)
  - GET `/`
  - GET `/active`
  - GET `/:id`
  - POST `/`
  - PUT `/:id`
  - DELETE `/:id`

- Users (`/api/users`)
  - GET `/`
  - GET `/:id`
  - POST `/`
  - PUT `/:id`
  - DELETE `/:id`

- Reports (`/api/reports`)
  - GET `/` (query)
  - POST `/`
  - GET `/production-analysis`
  - POST `/export`

- Settings (`/api/settings`)
  - GET `/`
  - PUT `/`
  - POST `/backup`
  - GET `/test-db`
  - POST `/test-db`

- Monitoring (`/api/monitoring`)
  - GET `/stats`
  - GET `/alerts`
  - POST `/start`
  - POST `/stop`
  - DELETE `/alerts`
  - POST `/health`

- Google Sheets (`/api/send-to-google-sheet`)
  - POST `/`

- Misc
  - GET `/health` (root) และ `/api/health` (router)

Security/Infra (server.js)
- Helmet (CSP off), Compression, Rate Limit 100 req/15m on `/api/*`
- CORS: production origins = `http://192.168.0.94:3011`, `http://localhost:3011`; dev = `*`

## 🌐 Frontend API Routes (Next.js proxy)
Path prefix: `/app/api/*` → `export async function GET/POST/PUT/DELETE`

- work-plans: list, get by id, search, drafts CRUD, sync, status update, sync-work-order
- new-jobs: list, process-steps, update by id, delete by id
- production-logs: list, by id, latest, stats/summary, stats/yield-analysis
- users: list, by id, CRUD
- machines: list, create
- production-rooms: list, create
- process-steps: list, search, create
- settings: get/put, backup, test-db
- reports: list, export, production-analysis
- send-to-google-sheet: post

หมายเหตุ: พบการเรียก Backend ผ่าน env (`NEXT_PUBLIC_API_URL`/`API_BASE_URL`/`BACKEND_URL`) ปนกับการ hardcode URL ในบางไฟล์ (รายละเอียดใน Known Issues)

## 🧭 Application Flow (หลักๆ ตามหน้าใน Frontend)

- Dashboard (`/dashboard`) [ถ้ามีการใช้ข้อมูล dashboard]
  - เรียก `/api/production-logs/latest`, `/stats/summary`, `/stats/yield-analysis`

- Weekly View (`/`, `WeekilyView.tsx`)
  - โหลด `GET /api/work-plans` และ `GET /api/work-plans/drafts` เพื่อแสดงตารางงาน

- Tracker (`/tracker`)
  - โหลด work plans ตามวันที่, โหลด process steps ของงานที่เลือก
  - ใช้ Logs API: `GET /api/logs/work-plan/:id`, `POST /api/logs` สำหรับบันทึก, และตรวจสถานะ process

- Manage New Jobs (`/manage-new-jobs`)
  - `GET /api/new-jobs`, `GET /api/new-jobs/process-steps`
  - `PUT /api/new-jobs/:id` (update NEW → รหัสงานจริง พร้อมเพิ่ม steps)
  - `DELETE /api/new-jobs/:id`
  - ค้นหา `GET /api/work-plans/search`

- Production Logs (`/production-logs`)
  - `GET /api/production-logs` (filters), รายการ/แก้ไข/ลบ logs

- Reports (`/reports`)
  - `GET /api/reports/production-analysis`
  - `POST /api/reports/export`

- Settings (`/settings`)
  - `GET/PUT /api/settings`, `POST /api/settings/backup`, `POST /api/settings/test-db`

- Users (`/users`)
  - `GET/POST /api/users`, `PUT/DELETE /api/users/:id`

- Monitoring (`/monitoring`)
  - `GET /api/monitoring/stats`, `GET/DELETE /api/monitoring/alerts`, `POST start/stop/health`

## ⚙️ Database & Config

- Connection (backend/config/database.js)
  - env: DB_HOST/USER/PASSWORD/NAME/PORT, NODE_ENV
  - mysql2 pool, test connection on startup logs details
  - มี log ค่าคอนฟิกชัดเจน (รวม user/database/host)

## 🚨 Known Issues & Risks (พร้อมข้อเสนอแนะ)

1) Hardcoded Backend URLs ใน Frontend API Routes
- พบที่ `frontend/app/api/new-jobs/[id]/route.ts` ใช้ `http://localhost:3101` ตายตัว
- เสี่ยงพังใน production และตอนเปลี่ยนพอร์ต/โดเมน
- แนะนำ: รวมเป็น util `getBackendUrl()` และใช้ env (`process.env.NEXT_PUBLIC_API_URL`) ให้สม่ำเสมอทุกไฟล์

2) Inconsistent Route Prefix ชื่อ production-status
- ใน `server.js` ใช้ `/api/production-status`; ใน `routes/index.js` ใช้ `/production-statuses`
- แม้ปัจจุบัน server.js ไม่ได้ใช้ `routes/index.js` ตรงๆ แต่ควรตั้งชื่อให้สอดคล้อง
- แนะนำ: มาตรฐานเดียว เช่น `/api/production-status`

3) Verbose Debug Logging ใน Controllers
- หลายจุด log request headers/body/urls (เช่น `workPlanController.getAllWorkPlans`)
- เสี่ยงข้อมูลส่วนตัว/รบกวน log ใน production
- แนะนำ: ใช้ logger ระดับ DEBUG ที่ควบคุมด้วย env, ปิดใน production

4) Database Config Logs มีข้อมูลอ่อนไหว + ค่า default ชัดเจน
- พิมพ์ user/database/คำสั่ง GRANT ที่เห็นพาส (แม้จะซ่อนในบางจุด)
- มี default password ในซอร์ส (`<REDACTED_PASSWORD>`)
- แนะนำ: ใช้ env จริง, ลด/ปิด log sensitive, ห้ามใส่ค่า default อ่อนไหวในโค้ด

5) CORS Production Origins จำกัดเฉพาะ 2 โฮสต์
- อาจบล็อคกรณีเข้าผ่านโดเมน/พอร์ตอื่นใน prod
- แนะนำ: อ่านค่าจาก env (เช่น CSV origins) หรือรองรับโดเมนองค์กร

6) WorkPlan DELETE ตอบ 403 เสมอ (บันทึกว่า “ตามข้อกำหนดหลัง 18:00” แต่ไม่มีเช็คเวลา)
- หากตั้งใจให้ลบได้ก่อน 18:00 ควรเพิ่มเช็คเวลา
- แนะนำ: หากห้ามลบถาวร ให้เปลี่ยนเป็น soft-delete หรือสถานะ “ยกเลิก” (ซึ่งมีแล้ว) และอธิบายในเอกสาร

7) ชื่อแปร/โค้ดซ้ำของ URL Base ใน Frontend (`API_BASE_URL`, `BACKEND_URL`)
- ปนกันหลายชื่อ ทำให้ยากต่อการบำรุงรักษา
- แนะนำ: รวมศูนย์ที่ helper เดียวและใช้ชื่อเดียว

8) Rate Limit คงที่ 100/15m ทุก endpoint
- อาจไม่เหมาะกับ internal calls/high-traffic endpoints
- แนะนำ: แยกกลุ่ม/เพิ่ม whitelist สำหรับ internal network หรือปรับตาม env

## 🛠️ แนวทางปรับปรุงเชิงโครงสร้าง (สั้นๆ)

- Frontend
  - รวมฟังก์ชัน backend URL + fetch wrapper พร้อม retry/error standard
  - ใช้ Zod/TypeScript types สำหรับ response schema สำคัญ
- Backend
  - เพิ่ม middleware logger ตามระดับ, ปิด PII logs ใน production
  - จัดทำ OpenAPI/Swagger สั้นๆ สำหรับ `/api/*`
  - รวม error handling และ response shape ให้สม่ำเสมอ
- DevOps
  - ย้าย CORS origins/rate-limit config ไป .env
  - ตรวจความปลอดภัย .env และหมุนพาสเวิร์ดที่ hardcoded เดิม

## 📚 เอกสารที่เกี่ยวข้อง
- โครงสร้างและคู่มือทั้งหมด: `docs/README.md`
- Deployment/Infra: `docs/deployment/README.md`
- Fixes: `docs/fixes/README.md`
- Updates: `docs/updates/README.md`
- System: `docs/system/README.md`

---
อัปเดตไฟล์นี้เมื่อมีการเพิ่ม/เปลี่ยน endpoint หรือ flow ใหม่ เพื่อให้ทีมพัฒนาเข้าใจภาพรวมและพัฒนาต่อได้รวดเร็ว
