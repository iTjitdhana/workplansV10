# 📤 วิธีอัพโหลดไฟล์ด้วย WinSCP

## 1. ดาวน์โหลดและติดตั้ง WinSCP

1. ไปที่: https://winscp.net/eng/download.php
2. ดาวน์โหลด WinSCP
3. ติดตั้งตามขั้นตอน

## 2. เชื่อมต่อ Linux Server

1. เปิด WinSCP
2. กรอกข้อมูล:
   - **File protocol**: SFTP
   - **Host name**: 192.168.0.96
   - **User name**: user (หรือ username ที่ใช้)
   - **Password**: <REDACTED_PASSWORD>
3. คลิก **Login**

## 3. อัพโหลดไฟล์

1. ด้านซ้าย: เลือกโฟลเดอร์ `C:\WorkplanV6`
2. ด้านขวา: ไปที่ `/opt/workplanv6` (สร้างใหม่ถ้าไม่มี)
3. เลือกไฟล์ทั้งหมดในโฟลเดอร์ WorkplanV6
4. ลากไปวางที่ด้านขวา หรือคลิก **Upload**

## 4. ไฟล์ที่ต้องอัพโหลด

- ✅ `docker-compose.linux.yml`
- ✅ `deploy-linux.sh`
- ✅ `install-docker.sh`
- ✅ `README-Linux-Deploy.md`
- ✅ โฟลเดอร์ `frontend/`
- ✅ โฟลเดอร์ `backend/`
- ✅ ไฟล์อื่นๆ ทั้งหมด

## 5. ตั้งค่า Permission

หลังจากอัพโหลดเสร็จ:
1. คลิกขวาที่ไฟล์ `.sh`
2. เลือก **Properties**
3. ติ๊ก **Executable**
4. คลิก **OK**

## 6. เชื่อมต่อ SSH

1. ใน WinSCP คลิก **New Session**
2. เลือก **SSH**
3. กรอกข้อมูลเหมือนเดิม
4. คลิก **Login**
5. เปิด **Terminal** (Ctrl+T)
6. รันคำสั่ง:
   ```bash
   cd /opt/workplanv6
   chmod +x *.sh
   ./deploy-linux.sh
   ```
