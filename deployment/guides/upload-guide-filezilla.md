# 📤 วิธีอัพโหลดไฟล์ด้วย FileZilla

## 1. ดาวน์โหลดและติดตั้ง FileZilla

1. ไปที่: https://filezilla-project.org/download.php?type=client
2. ดาวน์โหลด FileZilla Client
3. ติดตั้งตามขั้นตอน

## 2. เชื่อมต่อ Linux Server

1. เปิด FileZilla
2. กรอกข้อมูลในแถบด้านบน:
   - **Host**: sftp://192.168.0.96
   - **Username**: user
   - **Password**: <REDACTED_PASSWORD>
   - **Port**: 22
3. คลิก **Quickconnect**

## 3. อัพโหลดไฟล์

1. ด้านซ้าย (Local): ไปที่ `C:\WorkplanV6`
2. ด้านขวา (Remote): ไปที่ `/opt/workplanv6`
3. สร้างโฟลเดอร์ `/opt/workplanv6` ถ้าไม่มี
4. เลือกไฟล์ทั้งหมดในโฟลเดอร์ WorkplanV6
5. ลากไปวางที่ด้านขวา

## 4. ตั้งค่า Permission

1. คลิกขวาที่ไฟล์ `.sh` บน Remote site
2. เลือก **File permissions**
3. ติ๊ก **Executable** สำหรับ Owner, Group, Public
4. คลิก **OK**

## 5. เชื่อมต่อ SSH

1. ไปที่ **Edit** → **Settings**
2. เลือก **Connection** → **SFTP**
3. เพิ่ม SSH key หรือใช้ password
4. เปิด **Terminal** (Ctrl+T)
5. รันคำสั่ง:
   ```bash
   cd /opt/workplanv6
   chmod +x *.sh
   ./deploy-linux.sh
   ```
