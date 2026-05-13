# Linux Deployment Files

ไฟล์และสคริปต์สำหรับการ deploy ฝั่ง Linux โดยกำหนดให้มี source of truth เดียวสำหรับ production compose

## Source Of Truth

- Canonical compose (ใน repo): `tools/docker/docker-compose.prod.yml`
- Legacy path ที่คำสั่งเดิมเรียก: `deployment/linux/docker-compose.prod.yml`
- แนวทางที่ใช้: ทำ symlink จาก legacy path ไป canonical path เพื่อลด config drift
- Canonical compose ปัจจุบันตั้งเป็น `build` mode (`linux-frontend`, `linux-backend`) เพื่อให้รันได้ใน production ที่ไม่ใช้ private registry

## ไฟล์สำคัญในโฟลเดอร์นี้

- `docker-compose.linux.yml`: ชุด compose สำหรับ local/linux legacy flow
- `deploy-from-github.sh`: สคริปต์ deploy แบบเก่า
- `start-production.sh`: สคริปต์ run แบบ non-docker legacy
- `cutover-compose-source.sh`: สคริปต์ cutover ไปใช้ canonical compose พร้อม backup + verify
- `rollback-compose-source.sh`: สคริปต์ rollback กลับไฟล์ compose เดิมจาก backup

## Cutover ไปใช้ canonical compose

รันบน server:

```bash
cd /opt/workplansV10-1/deployment/linux
chmod +x cutover-compose-source.sh rollback-compose-source.sh
docker compose -p linux -f /opt/workplansV10-1/tools/docker/docker-compose.prod.yml config
./cutover-compose-source.sh
```

สิ่งที่สคริปต์ทำ:

1. pre-check stack ที่ใช้งานจริง
2. verify ว่า canonical compose มี `PRODUCTS_DB_NAME`
3. validate canonical runtime readiness (กันเคส image placeholder)
4. backup `deployment/linux/docker-compose.prod.yml`
5. ตั้งค่า `PRODUCTS_DB_NAME` ใน `deployment/linux/.env` ถ้ายังไม่มี
6. เปลี่ยนไฟล์ legacy เป็น symlink ไป canonical compose
7. recreate `backend` และตรวจ smoke test API

## Rollback

```bash
cd /opt/workplansV10-1/deployment/linux
./rollback-compose-source.sh
```

สคริปต์จะ restore จากไฟล์ backup ล่าสุด แล้ว recreate backend ให้กลับสภาพเดิม
