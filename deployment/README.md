# Deployment Directory

โฟลเดอร์รวมไฟล์ deploy/runtime tooling ของโปรเจกต์

## Production Baseline (Linux)

ใช้เฉพาะไฟล์ใน `deployment/linux` เป็น source of truth:

- `deployment/linux/docker-compose.prod.yml`
- `deployment/linux/nginx.prod.conf`
- `deployment/linux/.env.prod.example`
- `deployment/linux/deploy-from-github.sh`
- `deployment/linux/start-production.sh`

ไฟล์เก่าตาม `infra/` และ compose อื่นๆ ยังเก็บไว้เพื่ออ้างอิงย้อนหลัง แต่ไม่ใช่ production baseline ใหม่

## Quick Start

```bash
cd deployment/linux
cp .env.prod.example .env
# แก้ .env ให้เป็นค่าจริง
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```
