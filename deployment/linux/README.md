# Linux Deployment

ไฟล์ในโฟลเดอร์นี้คือ production source of truth สำหรับ Linux server

## Source Of Truth

- `docker-compose.prod.yml`: compose หลักสำหรับ production
- `nginx.prod.conf`: reverse proxy สำหรับ internal ingress
- `.env.prod.example`: template ค่าที่ต้องกำหนดบน server
- `deploy-from-github.sh`: script สำหรับ clone/update + start แบบปลอดภัย
- `start-production.sh`: script สำหรับ start/restart/health check

## First-Time Setup

```bash
cd deployment/linux
cp .env.prod.example .env
# แก้ค่า .env ให้เป็นค่าจริงบน server
```

## Start / Update

```bash
# start ครั้งแรกหรืออัปเดตหลัง pull
docker compose --env-file .env -f docker-compose.prod.yml up -d --build

# ตรวจสถานะ
docker compose --env-file .env -f docker-compose.prod.yml ps

# logs
docker compose --env-file .env -f docker-compose.prod.yml logs -f
```

## Internal-Only Access (Required)

- เปิดรับจากภายนอกเฉพาะ Nginx ingress (`80`) ตาม network policy
- ไม่เปิด port ของ `frontend` และ `backend` ออกตรงๆ
- จำกัดการเข้าถึงด้วย LAN/VPN/allowlist ตามนโยบายองค์กร
