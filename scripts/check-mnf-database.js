const mysql = require('mysql2/promise');

async function checkMNFDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '192.168.0.96',
      user: process.env.DB_USER || 'jitdhana',
      password: process.env.DB_PASSWORD || '<REDACTED_PASSWORD>$',
      database: 'MNF_database411'
    });

    const date = '2026-01-23';
    
    console.log('\n📊 ตรวจสอบข้อมูลจากตาราง work_plans (database: MNF_database411)\n');
    console.log(`Database: MNF_database411`);
    console.log(`Host: ${process.env.DB_HOST || '192.168.0.96'}\n`);
    
    // 1. งานทั้งหมดของวันที่
    const [allRows] = await connection.execute(
      'SELECT id, job_code, job_name, production_date, workflow_status, is_special, status_id, job_type FROM work_plans WHERE production_date = ? ORDER BY job_code',
      [date]
    );

    console.log(`✅ งานทั้งหมดวันที่ ${date}: ${allRows.length} รายการ\n`);
    if (allRows.length > 0) {
      allRows.forEach(r => {
        console.log(`ID: ${r.id}, Code: ${r.job_code}, Name: ${r.job_name}`);
        console.log(`  Status: ${r.workflow_status}, Special: ${r.is_special}, StatusID: ${r.status_id}, Type: ${r.job_type}`);
      });
    } else {
      console.log('  ⚠️  ไม่พบงานในวันที่นี้');
    }

    // 2. งานที่ไม่ใช่ A, B, C, D
    const [nonDefaultRows] = await connection.execute(
      'SELECT id, job_code, job_name, workflow_status, is_special, status_id, job_type FROM work_plans WHERE production_date = ? AND job_code NOT IN (?, ?, ?, ?) ORDER BY id',
      [date, 'A', 'B', 'C', 'D']
    );

    console.log(`\n📋 งานที่ไม่ใช่ A, B, C, D: ${nonDefaultRows.length} รายการ\n`);
    
    if (nonDefaultRows.length > 0) {
      nonDefaultRows.forEach(r => {
        console.log(`ID: ${r.id}, Code: ${r.job_code}, Name: ${r.job_name}`);
        console.log(`  Status: ${r.workflow_status}, Special: ${r.is_special}, StatusID: ${r.status_id}, Type: ${r.job_type}`);
      });
    } else {
      console.log('  ⚠️  ไม่พบงานที่ไม่ใช่ A, B, C, D');
    }

    // 3. งานปกติ (ไม่ใช่ default, ไม่ใช่ special)
    const [normalRows] = await connection.execute(
      `SELECT id, job_code, job_name, workflow_status, is_special, status_id, job_type 
       FROM work_plans 
       WHERE production_date = ? 
         AND job_code NOT IN (?, ?, ?, ?)
         AND (is_special IS NULL OR is_special = 0)
         AND (status_id IS NULL OR status_id != 10)
       ORDER BY id`,
      [date, 'A', 'B', 'C', 'D']
    );

    console.log(`\n✅ งานปกติที่ควรแสดง (ไม่ใช่ special): ${normalRows.length} รายการ\n`);
    
    if (normalRows.length > 0) {
      normalRows.forEach(r => {
        console.log(`ID: ${r.id}, Code: ${r.job_code}, Name: ${r.job_name}, Status: ${r.workflow_status}`);
      });
    } else {
      console.log('  ⚠️  ไม่พบงานปกติ');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Error code:', error.code);
    console.error('SQL State:', error.sqlState);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkMNFDatabase();
