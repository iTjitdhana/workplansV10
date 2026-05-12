#!/usr/bin/env node

/**
 * สคริปต์ทดสอบปัญหาการดึงข้อมูลหน้า 3012/tracker บน Linux Server
 * วันที่: 23 กันยายน 2567
 */

const mysql = require('mysql2/promise');
const fetch = require('node-fetch');

// Configuration
const config = {
  // Database config
  db: {
    host: '192.168.0.94',
    user: 'jitdhana',
    password: '<REDACTED_PASSWORD>',
    database: 'esp_tracker',
    port: 3306
  },
  // API endpoints
  api: {
    baseUrl: 'http://192.168.0.96:3102',
    frontendUrl: 'http://192.168.0.96:3012'
  }
};

console.log('🔍 ตรวจสอบปัญหาการดึงข้อมูลหน้า 3012/tracker บน Linux Server');
console.log('=' .repeat(80));

async function testDatabaseConnection() {
  console.log('\n📊 1. ทดสอบการเชื่อมต่อฐานข้อมูล...');
  
  try {
    const connection = await mysql.createConnection(config.db);
    console.log('✅ เชื่อมต่อฐานข้อมูลสำเร็จ');
    
    // ทดสอบ query พื้นฐาน
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ ทดสอบ query พื้นฐานผ่าน');
    
    // ตรวจสอบตารางที่เกี่ยวข้องกับ tracker
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = 'esp_tracker' 
      AND TABLE_NAME IN ('work_plans', 'logs', 'process_steps', 'production_status')
      ORDER BY TABLE_NAME
    `);
    
    console.log('📋 ตารางที่เกี่ยวข้องกับ tracker:');
    tables.forEach(table => {
      console.log(`   - ${table.TABLE_NAME}`);
    });
    
    // ตรวจสอบข้อมูลในตาราง work_plans
    const [workPlans] = await connection.execute(`
      SELECT COUNT(*) as total, 
             COUNT(CASE WHEN production_date = CURDATE() THEN 1 END) as today_count
      FROM work_plans
    `);
    
    console.log(`📊 ข้อมูล work_plans: ทั้งหมด ${workPlans[0].total} รายการ, วันนี้ ${workPlans[0].today_count} รายการ`);
    
    // ตรวจสอบข้อมูลในตาราง logs
    const [logs] = await connection.execute(`
      SELECT COUNT(*) as total,
             COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_count
      FROM logs
    `);
    
    console.log(`📊 ข้อมูล logs: ทั้งหมด ${logs[0].total} รายการ, วันนี้ ${logs[0].today_count} รายการ`);
    
    await connection.end();
    return true;
  } catch (error) {
    console.log('❌ เชื่อมต่อฐานข้อมูลล้มเหลว:', error.message);
    console.log('🔍 รายละเอียดข้อผิดพลาด:');
    console.log(`   Code: ${error.code}`);
    console.log(`   Errno: ${error.errno}`);
    console.log(`   SQL State: ${error.sqlState}`);
    return false;
  }
}

async function testBackendAPI() {
  console.log('\n🌐 2. ทดสอบ Backend API...');
  
  try {
    // ทดสอบ health check
    console.log('🔍 ทดสอบ health check...');
    const healthResponse = await fetch(`${config.api.baseUrl}/health`);
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log('✅ Health check ผ่าน:', healthData.status);
    } else {
      console.log('❌ Health check ล้มเหลว:', healthResponse.status);
      return false;
    }
    
    // ทดสอบ API work-plans
    console.log('🔍 ทดสอบ API work-plans...');
    const today = new Date().toISOString().slice(0, 10);
    const workPlansResponse = await fetch(`${config.api.baseUrl}/api/work-plans?date=${today}`);
    
    if (workPlansResponse.ok) {
      const workPlansData = await workPlansResponse.json();
      console.log('✅ API work-plans ผ่าน');
      console.log(`📊 ข้อมูลที่ได้รับ: ${workPlansData.data ? workPlansData.data.length : 0} รายการ`);
      
      if (workPlansData.data && workPlansData.data.length > 0) {
        console.log('📋 ตัวอย่างข้อมูล:');
        console.log(`   - Job Code: ${workPlansData.data[0].job_code}`);
        console.log(`   - Job Name: ${workPlansData.data[0].job_name}`);
        console.log(`   - Production Date: ${workPlansData.data[0].production_date}`);
      }
    } else {
      console.log('❌ API work-plans ล้มเหลว:', workPlansResponse.status);
      const errorText = await workPlansResponse.text();
      console.log('🔍 ข้อความข้อผิดพลาด:', errorText);
      return false;
    }
    
    // ทดสอบ API logs
    console.log('🔍 ทดสอบ API logs...');
    const logsResponse = await fetch(`${config.api.baseUrl}/api/logs`);
    
    if (logsResponse.ok) {
      const logsData = await logsResponse.json();
      console.log('✅ API logs ผ่าน');
      console.log(`📊 ข้อมูลที่ได้รับ: ${logsData.data ? logsData.data.length : 0} รายการ`);
    } else {
      console.log('❌ API logs ล้มเหลว:', logsResponse.status);
      return false;
    }
    
    return true;
  } catch (error) {
    console.log('❌ ทดสอบ Backend API ล้มเหลว:', error.message);
    return false;
  }
}

async function testFrontendAccess() {
  console.log('\n🖥️ 3. ทดสอบการเข้าถึง Frontend...');
  
  try {
    // ทดสอบหน้า tracker
    console.log('🔍 ทดสอบหน้า tracker...');
    const trackerResponse = await fetch(`${config.api.frontendUrl}/tracker`);
    
    if (trackerResponse.ok) {
      console.log('✅ หน้า tracker เข้าถึงได้');
      console.log(`📊 Status Code: ${trackerResponse.status}`);
    } else {
      console.log('❌ หน้า tracker เข้าถึงไม่ได้:', trackerResponse.status);
      return false;
    }
    
    // ทดสอบหน้า dashboard
    console.log('🔍 ทดสอบหน้า dashboard...');
    const dashboardResponse = await fetch(`${config.api.frontendUrl}/dashboard`);
    
    if (dashboardResponse.ok) {
      console.log('✅ หน้า dashboard เข้าถึงได้');
    } else {
      console.log('❌ หน้า dashboard เข้าถึงไม่ได้:', dashboardResponse.status);
    }
    
    return true;
  } catch (error) {
    console.log('❌ ทดสอบ Frontend ล้มเหลว:', error.message);
    return false;
  }
}

async function testNetworkConnectivity() {
  console.log('\n🌐 4. ทดสอบการเชื่อมต่อเครือข่าย...');
  
  try {
    // ทดสอบการเชื่อมต่อไปยัง database server
    console.log('🔍 ทดสอบการเชื่อมต่อไปยัง database server (192.168.0.94:3306)...');
    const net = require('net');
    
    const dbConnection = new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = 5000;
      
      socket.setTimeout(timeout);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });
      socket.on('error', (err) => {
        socket.destroy();
        reject(err);
      });
      
      socket.connect(3306, '192.168.0.94');
    });
    
    await dbConnection;
    console.log('✅ เชื่อมต่อ database server ได้');
    
    // ทดสอบการเชื่อมต่อไปยัง backend server
    console.log('🔍 ทดสอบการเชื่อมต่อไปยัง backend server (192.168.0.96:3102)...');
    const backendConnection = new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = 5000;
      
      socket.setTimeout(timeout);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });
      socket.on('error', (err) => {
        socket.destroy();
        reject(err);
      });
      
      socket.connect(3102, '192.168.0.96');
    });
    
    await backendConnection;
    console.log('✅ เชื่อมต่อ backend server ได้');
    
    return true;
  } catch (error) {
    console.log('❌ ทดสอบการเชื่อมต่อเครือข่ายล้มเหลว:', error.message);
    return false;
  }
}

async function generateDiagnosticReport() {
  console.log('\n📋 5. สร้างรายงานการวินิจฉัย...');
  
  const results = {
    database: await testDatabaseConnection(),
    backend: await testBackendAPI(),
    frontend: await testFrontendAccess(),
    network: await testNetworkConnectivity()
  };
  
  console.log('\n' + '='.repeat(80));
  console.log('📊 สรุปผลการทดสอบ:');
  console.log('='.repeat(80));
  
  Object.entries(results).forEach(([test, passed]) => {
    const status = passed ? '✅ ผ่าน' : '❌ ล้มเหลว';
    console.log(`${test.toUpperCase()}: ${status}`);
  });
  
  const allPassed = Object.values(results).every(result => result);
  
  if (allPassed) {
    console.log('\n🎉 การทดสอบทั้งหมดผ่าน! ระบบควรทำงานได้ปกติ');
    console.log('\n💡 หากยังมีปัญหา ให้ตรวจสอบ:');
    console.log('   1. Browser cache และ cookies');
    console.log('   2. Network firewall settings');
    console.log('   3. Docker container logs');
  } else {
    console.log('\n⚠️ พบปัญหาบางส่วน ตรวจสอบรายละเอียดด้านบน');
    console.log('\n🔧 คำแนะนำการแก้ไข:');
    
    if (!results.database) {
      console.log('   - ตรวจสอบการเชื่อมต่อฐานข้อมูล MySQL');
      console.log('   - ตรวจสอบ user permissions และ firewall');
    }
    
    if (!results.backend) {
      console.log('   - ตรวจสอบ Backend API server');
      console.log('   - ตรวจสอบ Docker container status');
    }
    
    if (!results.frontend) {
      console.log('   - ตรวจสอบ Frontend server');
      console.log('   - ตรวจสอบ Next.js build และ deployment');
    }
    
    if (!results.network) {
      console.log('   - ตรวจสอบการเชื่อมต่อเครือข่าย');
      console.log('   - ตรวจสอบ firewall และ routing');
    }
  }
  
  console.log('\n📞 หากต้องการความช่วยเหลือเพิ่มเติม:');
  console.log('   - ตรวจสอบ logs: docker compose -f docker-compose.linux.yml logs -f');
  console.log('   - ตรวจสอบสถานะ: docker compose -f docker-compose.linux.yml ps');
  console.log('   - รีสตาร์ทระบบ: docker compose -f docker-compose.linux.yml restart');
}

// รันการทดสอบ
generateDiagnosticReport().catch(error => {
  console.error('❌ เกิดข้อผิดพลาดในการทดสอบ:', error.message);
  process.exit(1);
});

