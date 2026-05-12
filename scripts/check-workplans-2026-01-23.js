const mysql = require('mysql2/promise');

async function checkWorkPlans() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: '192.168.0.96',
      user: 'jitdhana',
      password: '<REDACTED_PASSWORD>$',
      database: 'manufacturing_system_dev'
    });

    const date = '2026-01-23';
    
    // ตรวจสอบงานทั้งหมดของวันที่
    const [allRows] = await connection.execute(
      'SELECT id, job_code, job_name, production_date, workflow_status, is_special, is_draft, status_id FROM work_plans WHERE production_date = ? ORDER BY job_code',
      [date]
    );

    console.log(`\n📊 งานทั้งหมดวันที่ ${date}: ${allRows.length} รายการ\n`);
    
    allRows.forEach(r => {
      console.log(`ID: ${r.id}, Code: ${r.job_code}, Name: ${r.job_name}`);
      console.log(`  Status: ${r.workflow_status}, Special: ${r.is_special}, Draft: ${r.is_draft}, StatusID: ${r.status_id}`);
    });

    // ตรวจสอบงานที่ไม่ใช่ A, B, C, D
    const [nonDefaultRows] = await connection.execute(
      'SELECT id, job_code, job_name, production_date, workflow_status, is_special, is_draft, status_id FROM work_plans WHERE production_date = ? AND job_code NOT IN (?, ?, ?, ?) ORDER BY id',
      [date, 'A', 'B', 'C', 'D']
    );

    console.log(`\n📋 งานที่ไม่ใช่ A, B, C, D: ${nonDefaultRows.length} รายการ\n`);
    
    nonDefaultRows.forEach(r => {
      console.log(`ID: ${r.id}, Code: ${r.job_code}, Name: ${r.job_name}`);
      console.log(`  Status: ${r.workflow_status}, Special: ${r.is_special}, Draft: ${r.is_draft}, StatusID: ${r.status_id}`);
      
      // ตรวจสอบว่าทำไมไม่แสดงในงานปกติ
      const isSpecial = r.is_special === 1 || r.status_id === 10;
      const isDraft = r.is_draft === 1 || r.workflow_status === 'draft';
      const isDefault = ['A', 'B', 'C', 'D'].includes(r.job_code);
      
      console.log(`  ⚠️  กรองออกเพราะ: ${isDefault ? 'Default' : ''} ${isSpecial ? 'Special' : ''} ${isDraft ? 'Draft' : ''}`);
    });

    // ตรวจสอบงานปกติ (ไม่ใช่ default, ไม่ใช่ special, ไม่ใช่ draft)
    const [normalRows] = await connection.execute(
      `SELECT id, job_code, job_name, production_date, workflow_status, is_special, is_draft, status_id 
       FROM work_plans 
       WHERE production_date = ? 
         AND job_code NOT IN (?, ?, ?, ?)
         AND (is_special IS NULL OR is_special = 0)
         AND (status_id IS NULL OR status_id != 10)
         AND (is_draft IS NULL OR is_draft = 0)
         AND (workflow_status IS NULL OR workflow_status != 'draft')
       ORDER BY id`,
      [date, 'A', 'B', 'C', 'D']
    );

    console.log(`\n✅ งานปกติที่ควรแสดง: ${normalRows.length} รายการ\n`);
    
    normalRows.forEach(r => {
      console.log(`ID: ${r.id}, Code: ${r.job_code}, Name: ${r.job_name}`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkWorkPlans();
