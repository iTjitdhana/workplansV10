const mysql = require('mysql2/promise');

async function checkAllWorkPlans() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || '192.168.0.96',
      user: process.env.DB_USER || 'jitdhana',
      password: process.env.DB_PASSWORD || '<REDACTED_PASSWORD>$',
      database: process.env.DB_NAME || 'manufacturing_system_dev'
    });

    console.log('\n📊 ตรวจสอบข้อมูลจากตาราง work_plans\n');
    
    // 1. สรุปงานที่ไม่ใช่ A, B, C, D แยกตาม workflow_status
    const [summaryRows] = await connection.execute(
      'SELECT COUNT(*) as total, workflow_status FROM work_plans WHERE job_code NOT IN (?, ?, ?, ?) GROUP BY workflow_status',
      ['A', 'B', 'C', 'D']
    );

    console.log('📋 สรุปงานที่ไม่ใช่ A, B, C, D แยกตาม workflow_status:');
    summaryRows.forEach(r => {
      console.log(`  ${r.workflow_status || 'NULL'}: ${r.total} jobs`);
    });

    // 2. งานที่ไม่ใช่ A, B, C, D และไม่ใช่ draft
    const [nonDraftRows] = await connection.execute(
      `SELECT id, job_code, job_name, production_date, workflow_status, is_special, status_id 
       FROM work_plans 
       WHERE job_code NOT IN (?, ?, ?, ?) 
         AND (workflow_status IS NULL OR workflow_status != 'draft')
         AND (is_special IS NULL OR is_special = 0)
         AND (status_id IS NULL OR status_id != 10)
       ORDER BY production_date DESC, id DESC 
       LIMIT 20`,
      ['A', 'B', 'C', 'D']
    );

    console.log(`\n✅ งานปกติ (ไม่ใช่ draft, ไม่ใช่ special): ${nonDraftRows.length} รายการ\n`);
    if (nonDraftRows.length > 0) {
      nonDraftRows.forEach(r => {
        console.log(`Date: ${r.production_date}, Code: ${r.job_code}, Name: ${r.job_name}, Status: ${r.workflow_status}`);
      });
    }

    // 3. งานที่ไม่ใช่ A, B, C, D ในช่วงวันที่ 2026-01-20 ถึง 2026-01-25
    const [recentRows] = await connection.execute(
      `SELECT id, job_code, job_name, production_date, workflow_status, is_special, status_id 
       FROM work_plans 
       WHERE production_date BETWEEN ? AND ? 
         AND job_code NOT IN (?, ?, ?, ?)
       ORDER BY production_date DESC, id DESC 
       LIMIT 30`,
      ['2026-01-20', '2026-01-25', 'A', 'B', 'C', 'D']
    );

    console.log(`\n📅 งานในช่วง 2026-01-20 ถึง 2026-01-25 (ไม่ใช่ A, B, C, D): ${recentRows.length} รายการ\n`);
    if (recentRows.length > 0) {
      recentRows.forEach(r => {
        console.log(`Date: ${r.production_date}, Code: ${r.job_code}, Name: ${r.job_name}, Status: ${r.workflow_status}, Special: ${r.is_special}`);
      });
    } else {
      console.log('  ⚠️  ไม่พบงานในช่วงวันที่นี้');
    }

    // 4. ตรวจสอบวันที่ 2026-01-23 โดยเฉพาะ
    const [date23Rows] = await connection.execute(
      'SELECT id, job_code, job_name, workflow_status, is_special, status_id FROM work_plans WHERE production_date = ? AND job_code NOT IN (?, ?, ?, ?)',
      ['2026-01-23', 'A', 'B', 'C', 'D']
    );

    console.log(`\n📅 วันที่ 2026-01-23 (ไม่ใช่ A, B, C, D): ${date23Rows.length} รายการ\n`);
    if (date23Rows.length > 0) {
      date23Rows.forEach(r => {
        console.log(`ID: ${r.id}, Code: ${r.job_code}, Name: ${r.job_name}, Status: ${r.workflow_status}, Special: ${r.is_special}`);
      });
    } else {
      console.log('  ⚠️  ไม่พบงานที่ไม่ใช่ A, B, C, D ในวันที่ 2026-01-23');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Error code:', error.code);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkAllWorkPlans();
