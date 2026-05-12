const { pool } = require('../config/database');
const { formatDateForDatabase } = require('../utils/dateUtils');

class WorkPlan {
  // Get all work plans with operators (optimized version)
  static async getAll(date = null, page = 1, limit = 50, filters = {}) {
    try {
      console.log('🔍 WorkPlan.getAll called with date:', date);
      console.log('🔍 Date type:', typeof date);
      
      // Step 1: ดึงข้อมูล work plans พื้นฐานก่อน (เร็วกว่า) - Optimized fields
      let mainQuery = `
        SELECT 
          wp.id,
          DATE_FORMAT(wp.production_date, '%Y-%m-%d') as production_date,
          wp.job_code,
          wp.job_name,
          wp.job_type,
          wp.workflow_status,
          wp.is_printed,
          wp.start_time,
          wp.end_time,
          wp.machine_id,
          wp.production_room_id,
          wp.notes,
          COALESCE(wp.status_id, 1) as status_id,
          COALESCE(ps.name, 'รอดำเนินการ') as status_name,
          COALESCE(ps.color, '#FF6B6B') as status_color,
          ff.is_finished,
          wp.is_special
        FROM work_plans wp
        LEFT JOIN production_statuses ps ON wp.status_id = ps.id
        LEFT JOIN finished_flags ff ON wp.id = ff.work_plan_id
      `;
      
      const params = [];
      const conditions = [];
      
      if (date) {
        // ตรวจสอบรูปแบบวันที่และแปลงให้ถูกต้อง
        let formattedDate = date;
        if (typeof date === 'string') {
          // ถ้าเป็น ISO string ให้ตัดเอาเฉพาะส่วนวันที่
          if (date.includes('T')) {
            formattedDate = date.split('T')[0];
          }
          // ตรวจสอบรูปแบบ YYYY-MM-DD
          if (!/^\d{4}-\d{2}-\d{2}$/.test(formattedDate)) {
            console.error('❌ Invalid date format:', date);
            throw new Error('Invalid date format. Expected YYYY-MM-DD');
          }
        }
        
        // ใช้การเปรียบเทียบวันที่ที่ยืดหยุ่นมากขึ้น
        conditions.push('(DATE(wp.production_date) = ? OR wp.production_date = ?)');
        params.push(formattedDate, formattedDate);
        
        console.log('🔍 Formatted date:', formattedDate);
        console.log('🔍 SQL Query:', mainQuery);
        console.log('🔍 Params:', params);
      } else {
        console.log('⚠️ No date parameter provided, will return all work plans');
      }
      
      // เพิ่ม filters อื่นๆ
      if (filters.search) {
        conditions.push('(wp.job_name LIKE ? OR wp.job_code LIKE ?)');
        params.push(`%${filters.search}%`, `%${filters.search}%`);
      }
      
      if (filters.status) {
        conditions.push('wp.status_id = ?');
        params.push(filters.status);
      }
      
      if (filters.job_code) {
        conditions.push('wp.job_code LIKE ?');
        params.push(`%${filters.job_code}%`);
      }
      
      // เพิ่ม WHERE clause ถ้ามี conditions
      if (conditions.length > 0) {
        mainQuery += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      // เรียงลำดับ: default (ABCD) -> regular -> special, แล้วเรียงตามเวลาสร้าง
      mainQuery += ` ORDER BY 
        CASE wp.job_type
          WHEN 'default' THEN 1
          WHEN 'regular' THEN 2
          WHEN 'special' THEN 3
          ELSE 4
        END ASC,
        wp.id ASC`;
      
      // เพิ่ม pagination
      if (limit && limit > 0) {
        const offset = (page - 1) * limit;
        mainQuery += ` LIMIT ${limit} OFFSET ${offset}`;
      }
      
      const [rows] = await pool.execute(mainQuery, params);
      
      // Step 2: ดึงข้อมูล operators แยกต่างหาก (เฉพาะ work plans ที่ได้)
      if (rows.length > 0) {
        const workPlanIds = rows.map(row => row.id);
        
        // ดึงข้อมูล operators
        const operatorsQuery = `
          SELECT 
            wpo.work_plan_id,
            GROUP_CONCAT(
              DISTINCT COALESCE(u.name, wpo.id_code)
              ORDER BY wpo.id ASC
              SEPARATOR ', '
            ) AS operators_from_join,
            GROUP_CONCAT(
              DISTINCT wpo.id_code
              ORDER BY wpo.id ASC
              SEPARATOR ', '
            ) AS operator_codes
          FROM work_plan_operators wpo
          LEFT JOIN users u ON wpo.user_id = u.id OR wpo.id_code = u.id_code
          WHERE wpo.work_plan_id IN (${workPlanIds.map(() => '?').join(',')})
          GROUP BY wpo.work_plan_id
        `;
        
        const [operatorsData] = await pool.execute(operatorsQuery, workPlanIds);
        
        // ดึงข้อมูล rooms และ machines
        const roomsQuery = `SELECT id, room_name FROM production_rooms WHERE id IN (${rows.map(r => r.production_room_id).filter(Boolean).map(() => '?').join(',') || '0'})`;
        const machinesQuery = `SELECT id, machine_name FROM machines WHERE id IN (${rows.map(r => r.machine_id).filter(Boolean).map(() => '?').join(',') || '0'})`;
        
        const roomIds = rows.map(r => r.production_room_id).filter(Boolean);
        const machineIds = rows.map(r => r.machine_id).filter(Boolean);
        
        const [roomsData] = roomIds.length > 0 ? await pool.execute(roomsQuery, roomIds) : [[]];
        const [machinesData] = machineIds.length > 0 ? await pool.execute(machinesQuery, machineIds) : [[]];
        
        // รวมข้อมูลเข้าด้วยกัน
        const operatorsMap = new Map(operatorsData.map(op => [op.work_plan_id, op]));
        const roomsMap = new Map(roomsData.map(room => [room.id, room.room_name]));
        const machinesMap = new Map(machinesData.map(machine => [machine.id, machine.machine_name]));
        
        // เพิ่มข้อมูลที่ดึงมาใส่ในผลลัพธ์
        rows.forEach(row => {
          const operators = operatorsMap.get(row.id);
          if (operators) {
            row.operators = operators.operators_from_join || ''; // ✅ ใช้ชื่อคอลัมน์ที่ Frontend คาดหวัง
            row.operators_from_join = operators.operators_from_join;
            row.operator_codes = operators.operator_codes;
          } else {
            row.operators = ''; // ✅ ไม่มีผู้ปฏิบัติงาน
          }
          
          row.production_room_name = roomsMap.get(row.production_room_id) || null;
          row.machine_name = machinesMap.get(row.machine_id) || null;
        });
      }
      console.log('✅ Found work plans:', rows.length);
      
      if (rows.length > 0) {
        console.log('📊 Sample work plan:', rows[0]);
        console.log('📊 All production dates found:', rows.map(r => r.production_date));
        
        // ✅ Debug: ตรวจสอบ operators สำหรับงาน A, B, C, D
        const abcdPlans = rows.filter(r => ['A', 'B', 'C', 'D'].includes(r.job_code));
        if (abcdPlans.length > 0) {
          console.log('🔍 [DEBUG] A, B, C, D work plans operators:');
          abcdPlans.forEach(plan => {
            console.log(`  - ${plan.job_code}: operators="${plan.operators || ''}"`, 
              `operators_from_join="${plan.operators_from_join || ''}"`);
          });
        }
      } else {
        console.log('⚠️ No work plans found for date:', date);
      }
      
      return rows;
    } catch (error) {
      console.error('❌ Error in WorkPlan.getAll:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState
      });
      
      // ส่งกลับ empty array แทนการ throw error เพื่อให้ frontend ยังทำงานได้
      console.log('🔄 Returning empty array due to error');
      return [];
      // Fallback query if status_id column doesn't exist
      console.log('⚠️ Status column not found, using fallback query');
      let fallbackQuery = `
        SELECT 
          wp.id,
          DATE_FORMAT(wp.production_date, '%Y-%m-%d') as production_date,
          wp.job_code,
          wp.job_name,
          wp.start_time,
          wp.end_time,
          wp.notes,
          1 as status_id,
          'รอดำเนินการ' as status_name,
          '#FF6B6B' as status_color,
          ff.is_finished,
          ff.updated_at as finished_at,
          GROUP_CONCAT(
            DISTINCT COALESCE(u.name, wpo.id_code)
            ORDER BY wpo.id ASC
            SEPARATOR ', '
          ) as operators_from_join,
          GROUP_CONCAT(
            DISTINCT wpo.id_code
            ORDER BY wpo.id ASC
            SEPARATOR ', '
          ) as operator_codes,
          pr.room_name as production_room_name,
          m.machine_name as machine_name
        FROM work_plans wp
        LEFT JOIN finished_flags ff ON wp.id = ff.work_plan_id
        LEFT JOIN work_plan_operators wpo ON wp.id = wpo.work_plan_id
        LEFT JOIN users u ON wpo.user_id = u.id OR wpo.id_code = u.id_code
        LEFT JOIN production_rooms pr ON wp.production_room_id = pr.id
        LEFT JOIN machines m ON wp.machine_id = m.id
      `;
      
      const params = [];
      if (date) {
        fallbackQuery += ' WHERE DATE(CONVERT_TZ(wp.production_date, "UTC", "Asia/Bangkok")) = ?';
        params.push(date);
      }
      
      fallbackQuery += ` GROUP BY wp.id, wp.production_date, wp.job_code, wp.job_name, wp.start_time, wp.end_time, wp.notes, ff.is_finished, ff.updated_at, pr.room_name, m.machine_name
                         ORDER BY 
                         CASE 
                           WHEN COALESCE(wp.status_id, 1) = 10 THEN 2  -- งานพิเศษ (status_id = 10) อยู่ล่างสุด
                           ELSE 1  -- งานปกติอยู่บนสุด
                         END ASC,
                         wp.start_time ASC, 
                         CASE 
                           WHEN GROUP_CONCAT(DISTINCT COALESCE(u.name, wpo.id_code) ORDER BY wpo.id ASC) LIKE 'อ%' THEN 0 
                           ELSE 1 
                         END ASC,
                         GROUP_CONCAT(DISTINCT COALESCE(u.name, wpo.id_code) ORDER BY wpo.id ASC) ASC`;
      
      const [rows] = await pool.execute(fallbackQuery, params);
      console.log('📊 Fallback query results:', rows.length, 'rows');
      return rows;
    }
  }

  // Get work plan by ID
  static async getById(id) {
    try {
      const query = `
        SELECT 
          wp.id,
          DATE_FORMAT(wp.production_date, '%Y-%m-%d') as production_date,
          wp.job_code,
          wp.job_name,
          wp.job_type,
          wp.workflow_status,
          wp.status_id,
          wp.is_printed,
          wp.start_time,
          wp.end_time,
          wp.notes,
          ff.is_finished,
          ff.updated_at as finished_at
        FROM work_plans wp
        LEFT JOIN finished_flags ff ON wp.id = ff.work_plan_id
        WHERE wp.id = ?
      `;
      
      const [rows] = await pool.execute(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      const workPlan = rows[0];
      
      // Get operators
      const operatorQuery = `
        SELECT 
          wpo.id,
          wpo.user_id,
          wpo.id_code,
          u.name
        FROM work_plan_operators wpo
        LEFT JOIN users u ON wpo.user_id = u.id OR wpo.id_code = u.id_code
        WHERE wpo.work_plan_id = ?
      `;
      
      const [operators] = await pool.execute(operatorQuery, [id]);
      // ✅ แปลง operators array เป็น string
      workPlan.operators = operators.map(op => op.name || op.id_code).filter(Boolean).join(', ');
      
      return workPlan;
    } catch (error) {
      throw new Error(`Error fetching work plan: ${error.message}`);
    }
  }

  // ดึงข้อมูลงานล่าสุดตาม job_code หรือ job_name เพื่อใช้ auto-fill
  static async getLatestByJob(jobCode = null, jobName = null) {
    try {
      if (!jobCode && !jobName) {
        return null;
      }

      let query = `
        SELECT 
          wp.id,
          DATE_FORMAT(wp.production_date, '%Y-%m-%d') as production_date,
          wp.job_code,
          wp.job_name,
          TIME_FORMAT(wp.start_time, '%H:%i') as start_time,
          TIME_FORMAT(wp.end_time, '%H:%i') as end_time,
          wp.machine_id,
          wp.production_room_id,
          pr.room_code,
          pr.room_name,
          m.machine_code,
          m.machine_name
        FROM work_plans wp
        LEFT JOIN production_rooms pr ON wp.production_room_id = pr.id
        LEFT JOIN machines m ON wp.machine_id = m.id
        WHERE 1=1
      `;
      
      const params = [];
      
      if (jobCode) {
        query += ` AND wp.job_code = ?`;
        params.push(jobCode);
      }
      
      if (jobName) {
        query += ` AND wp.job_name = ?`;
        params.push(jobName);
      }
      
      // เรียงตามวันที่ล่าสุด และ id ล่าสุด
      query += ` ORDER BY wp.production_date DESC, wp.id DESC LIMIT 1`;
      
      const [rows] = await pool.execute(query, params);
      
      if (rows.length === 0) {
        return null;
      }
      
      const workPlan = rows[0];
      
      // ดึงข้อมูล operators
      const operatorQuery = `
        SELECT 
          wpo.id,
          wpo.user_id,
          wpo.id_code,
          u.name
        FROM work_plan_operators wpo
        LEFT JOIN users u ON wpo.user_id = u.id OR wpo.id_code = u.id_code
        WHERE wpo.work_plan_id = ?
        ORDER BY wpo.id ASC
      `;
      
      const [operators] = await pool.execute(operatorQuery, [workPlan.id]);
      
      // แปลง operators เป็น array ของชื่อทั้งหมด
      workPlan.operators = operators.map(op => op.name || op.id_code).filter(Boolean);
      
      // ถ้าแผนล่าสุดไม่มีข้อมูลห้องผลิต ให้ดึงจากแผนที่มีข้อมูลห้องผลิตล่าสุด
      if (!workPlan.room_code && !workPlan.room_name && workPlan.production_room_id === null) {
        let roomQuery = `
          SELECT 
            pr.room_code,
            pr.room_name,
            wp.production_room_id
          FROM work_plans wp
          LEFT JOIN production_rooms pr ON wp.production_room_id = pr.id
          WHERE wp.production_room_id IS NOT NULL
        `;
        
        const roomParams = [];
        
        if (jobCode) {
          roomQuery += ` AND wp.job_code = ?`;
          roomParams.push(jobCode);
        }
        
        if (jobName) {
          roomQuery += ` AND wp.job_name = ?`;
          roomParams.push(jobName);
        }
        
        roomQuery += ` ORDER BY wp.production_date DESC, wp.id DESC LIMIT 1`;
        
        const [roomRows] = await pool.execute(roomQuery, roomParams);
        
        if (roomRows.length > 0 && roomRows[0].room_code) {
          workPlan.room_code = roomRows[0].room_code;
          workPlan.room_name = roomRows[0].room_name;
          workPlan.production_room_id = roomRows[0].production_room_id;
        }
      }
      
      return workPlan;
    } catch (error) {
      throw new Error(`Error fetching latest work plan: ${error.message}`);
    }
  }

  // Helper function to format time
  static formatTime(timeString) {
    if (!timeString || timeString === '' || timeString === null) return null;
    
    // If already in HH:MM:SS format, return as is
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(timeString)) {
      return timeString;
    }
    
    // If in HH:MM format, add :00 seconds
    if (/^\d{1,2}:\d{2}$/.test(timeString)) {
      return timeString + ':00';
    }
    
    // If single number (like 9), convert to 09:00:00
    if (/^\d{1,2}$/.test(timeString)) {
      const hour = timeString.padStart(2, '0');
      return `${hour}:00:00`;
    }
    
    return timeString;
  }

  // สร้างงาน Default (ABCD) อัตโนมัติ
  // ✅ ปรับปรุง: เช็คทีละ job_code แทนการเช็ครวม (ละเอียดและแม่นยำกว่า)
  static async createDefaultTasks(production_date) {
    const connection = await pool.getConnection();
    let lockName = '';
    let hasNamedLock = false;
    let transactionStarted = false;
    try {
      const formattedDate = formatDateForDatabase(production_date);
      if (!formattedDate) {
        throw new Error('Invalid production_date format');
      }

      // Lock per-day creation to prevent duplicate inserts from concurrent requests.
      lockName = `work_plans_default_${formattedDate}`;
      const [lockRows] = await connection.execute(
        'SELECT GET_LOCK(?, 10) AS acquired',
        [lockName]
      );
      hasNamedLock = Number(lockRows?.[0]?.acquired) === 1;
      if (!hasNamedLock) {
        throw new Error(`Could not acquire default-task lock for ${formattedDate}`);
      }

      await connection.beginTransaction();
      transactionStarted = true;
      
      console.log('🔍 Checking existing default tasks for:', formattedDate);
      
      // เช็คจาก job_code โดยตรง (ไม่จำกัด job_type) เพื่อกันงานซ้ำจากข้อมูลเก่า/ข้อมูลผิดรูป
      const [existing] = await connection.execute(`
        SELECT job_code
        FROM work_plans 
        WHERE DATE(production_date) = ? 
          AND job_code IN ('A', 'B', 'C', 'D')
      `, [formattedDate]);
      
      const existingCodes = new Set(
        existing.map(row => String(row.job_code || '').toUpperCase())
      );
      console.log('📋 Existing default tasks:', Array.from(existingCodes));
      
      // สร้างงาน ABCD
      const defaultTasks = [
        { code: 'A', name: 'เบิกของส่งสาขา-ผัก' },
        { code: 'B', name: 'เบิกของส่งสาขา-สด' },
        { code: 'C', name: 'เบิกของส่งสาขา-แห้ง' },
        { code: 'D', name: 'ตวงสูตร' }
      ];
      
      const createdIds = [];
      const skippedCodes = [];
      
      // ✅ สร้างเฉพาะงานที่ยังไม่มี
      for (const task of defaultTasks) {
        if (existingCodes.has(task.code)) {
          console.log(`⏭️  Skipping ${task.code} - ${task.name} (already exists)`);
          skippedCodes.push(task.code);
          continue;
        }
        
        console.log(`🆕 Creating ${task.code} - ${task.name}...`);
        const [result] = await connection.execute(`
          INSERT INTO work_plans 
          (production_date, job_code, job_name, job_type, workflow_status, status_id, is_printed, start_time, end_time)
          VALUES (?, ?, ?, 'default', 'draft', 1, 0, '08:00:00', '09:00:00')
        `, [formattedDate, task.code, task.name]);
        
        createdIds.push(result.insertId);
        console.log(`✅ Created: ${task.code} - ${task.name} (ID: ${result.insertId}) - Time: 08:00-09:00`);
      }
      
      await connection.commit();
      
      // สรุปผลลัพธ์
      const totalCreated = createdIds.length;
      const totalSkipped = skippedCodes.length;
      
      console.log(`🎉 Completed: Created ${totalCreated} tasks, Skipped ${totalSkipped} tasks`);
      
      if (totalCreated === 0 && totalSkipped > 0) {
        return { 
          success: true, 
          message: `All default tasks already exist (${totalSkipped} tasks)`,
          created: false,
          createdCount: 0,
          skippedCount: totalSkipped,
          skippedCodes: skippedCodes,
          createdIds: []
        };
      }
      
      return { 
        success: true, 
        message: `Default tasks processed: ${totalCreated} created, ${totalSkipped} skipped`,
        created: totalCreated > 0,
        createdCount: totalCreated,
        skippedCount: totalSkipped,
        skippedCodes: skippedCodes,
        ids: createdIds 
      };
      
    } catch (error) {
      if (transactionStarted) {
        await connection.rollback();
      }
      console.error('❌ Error creating default tasks:', error);
      throw new Error(`Error creating default tasks: ${error.message}`);
    } finally {
      if (hasNamedLock && lockName) {
        try {
          await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
        } catch (releaseError) {
          console.error('⚠️ Failed to release lock:', releaseError);
        }
      }
      connection.release();
    }
  }

  // Create new work plan
  static async create(workPlanData) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const { 
        production_date, job_code, job_name, start_time, end_time, notes, operators,
        workflow_status, machine_id, production_room_id
      } = workPlanData;
      
      console.log('🗄️ Database insert - production_date:', production_date);
      console.log('🗄️ Database insert - production_date type:', typeof production_date);
      
      // แปลงวันที่ให้เป็นรูปแบบที่ถูกต้อง
      let formattedDate = formatDateForDatabase(production_date);
      console.log('🗄️ Formatted date for database:', formattedDate);
      
      // เช็คว่าพิมพ์ใบงานไปแล้วหรือยัง
      const [syncLog] = await connection.execute(`
        SELECT COUNT(*) as count 
        FROM workplan_sync_log 
        WHERE DATE(production_date) = ?
      `, [formattedDate]);
      
      const isPrinted = syncLog[0].count > 0;
      // Backend เป็นแหล่งความจริงกำหนดชนิดงาน
      // ถ้าเป็นงาน A/B/C/D ให้ถือเป็น default เสมอ (กันความผิดพลาดจาก client)
      const defaultCodes = ['A', 'B', 'C', 'D'];
      let job_type;
      if (job_code && defaultCodes.includes(String(job_code).toUpperCase())) {
        job_type = 'default';
      } else {
        job_type = isPrinted ? 'special' : 'regular';
      }
      
      console.log('🖨️ Is printed?', isPrinted, '-> job_type:', job_type);
      
      // Format times
      const formattedStartTime = this.formatTime(start_time);
      const formattedEndTime = this.formatTime(end_time);
      
      console.log('🕐 Original start_time:', start_time, '-> Formatted:', formattedStartTime);
      console.log('🕐 Original end_time:', end_time, '-> Formatted:', formattedEndTime);
      
      // Insert work plan
      const insertQuery = `
        INSERT INTO work_plans 
        (production_date, job_code, job_name, job_type, workflow_status, 
         start_time, end_time, machine_id, production_room_id, notes, 
         status_id, is_printed, operators)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?)
      `;
      
      const [result] = await connection.execute(insertQuery, [
        formattedDate,
        job_code,
        job_name,
        job_type,
        workflow_status || 'draft',
        formattedStartTime || null,
        formattedEndTime || null,
        machine_id || null,
        production_room_id || null,
        notes || null,
        operators ? JSON.stringify(operators) : '[]'
      ]);
      
      const workPlanId = result.insertId;
      
      console.log('✅ Work plan created with ID:', workPlanId);
      
      // Insert operators if provided
      if (operators && operators.length > 0) {
        const operatorQuery = `
          INSERT INTO work_plan_operators (work_plan_id, user_id, id_code)
          VALUES (?, ?, ?)
        `;
        
        for (const operator of operators) {
          await connection.execute(operatorQuery, [
            workPlanId,
            operator.user_id || null,
            operator.id_code || null
          ]);
        }
        
        console.log('👥 Inserted', operators.length, 'operators');
      }
      
      await connection.commit();
      return { id: workPlanId, ...workPlanData, job_type, workflow_status: workflow_status || 'draft' };
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error creating work plan:', error);
      throw new Error(`Error creating work plan: ${error.message}`);
    } finally {
      connection.release();
    }
  }

  // Update work plan
  static async update(id, workPlanData) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const { 
        production_date, job_code, job_name, start_time, end_time, notes, operators,
        workflow_status, machine_id, production_room_id
      } = workPlanData;
      
      console.log('🔄 Updating work plan:', id, 'with workflow_status:', workflow_status);
      
      // แปลงวันที่ให้เป็นรูปแบบที่ถูกต้อง
      let formattedDate = production_date ? formatDateForDatabase(production_date) : null;
      
      // Format times (เฉพาะเมื่อส่งมา)
      let formattedStartTime = null;
      let formattedEndTime = null;
      if (start_time !== undefined && start_time !== null) {
        formattedStartTime = this.formatTime(start_time);
      }
      if (end_time !== undefined && end_time !== null) {
        formattedEndTime = this.formatTime(end_time);
      }
      
      // Update work plan
      const updateQuery = `
        UPDATE work_plans 
        SET 
          production_date = COALESCE(?, production_date),
          job_code = COALESCE(?, job_code),
          job_name = COALESCE(?, job_name),
          start_time = COALESCE(?, start_time),
          end_time = COALESCE(?, end_time),
          machine_id = COALESCE(?, machine_id),
          production_room_id = COALESCE(?, production_room_id),
          notes = COALESCE(?, notes),
          workflow_status = COALESCE(?, workflow_status),
          operators = COALESCE(?, operators)
        WHERE id = ?
      `;
      
      await connection.execute(updateQuery, [
        formattedDate,
        job_code || null,
        job_name || null,
        formattedStartTime,
        formattedEndTime,
        machine_id || null,
        production_room_id || null,
        notes || null,
        workflow_status || null,
        operators !== undefined && operators !== null ? JSON.stringify(operators) : null,
        id
      ]);
      
      console.log('✅ Updated work plan basic info');
      
      // Update operators (เฉพาะเมื่อส่งมา)
      if (operators !== undefined && operators !== null) {
        // Delete existing operators
        await connection.execute('DELETE FROM work_plan_operators WHERE work_plan_id = ?', [id]);
        
        console.log('🗑️ Deleted old operators');
        
        // Insert new operators
        if (Array.isArray(operators) && operators.length > 0) {
          const operatorQuery = `
            INSERT INTO work_plan_operators (work_plan_id, user_id, id_code)
            VALUES (?, ?, ?)
          `;
          
          for (const operator of operators) {
            await connection.execute(operatorQuery, [
              id,
              operator.user_id || null,
              operator.id_code || null
            ]);
          }
          
          console.log('👥 Inserted', operators.length, 'new operators');
        }
      }
      
      await connection.commit();
      
      console.log('🎉 Work plan updated successfully');
      
      return { id, ...workPlanData };
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error updating work plan:', error);
      throw new Error(`Error updating work plan: ${error.message}`);
    } finally {
      connection.release();
    }
  }

  // Delete work plan
  static async delete(id) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      // Delete related data first (foreign key constraints)
      await connection.execute('DELETE FROM finished_flags WHERE work_plan_id = ?', [id]);
      await connection.execute('DELETE FROM work_plan_operators WHERE work_plan_id = ?', [id]);
      
      // Delete the work plan
      const query = 'DELETE FROM work_plans WHERE id = ?';
      const [result] = await connection.execute(query, [id]);
      
      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error deleting work plan: ${error.message}`);
    } finally {
      connection.release();
    }
  }

  // Mark work plan as finished
  static async markAsFinished(id) {
    try {
      const query = `
        INSERT INTO finished_flags (work_plan_id, is_finished, updated_at)
        VALUES (?, 1, NOW())
        ON DUPLICATE KEY UPDATE is_finished = 1, updated_at = NOW()
      `;
      
      await pool.execute(query, [id]);
      return true;
    } catch (error) {
      throw new Error(`Error marking work plan as finished: ${error.message}`);
    }
  }

  // Mark work plan as unfinished
  static async markAsUnfinished(id) {
    try {
      const query = `
        INSERT INTO finished_flags (work_plan_id, is_finished, updated_at)
        VALUES (?, 0, NOW())
        ON DUPLICATE KEY UPDATE is_finished = 0, updated_at = NOW()
      `;
      
      await pool.execute(query, [id]);
      return true;
    } catch (error) {
      throw new Error(`Error marking work plan as unfinished: ${error.message}`);
    }
  }

  // Update work plan status
  static async updateStatus(id, statusId) {
    try {
      // ตรวจสอบว่ามีคอลัมน์ status_id หรือไม่
      const [columns] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'work_plans' 
        AND COLUMN_NAME = 'status_id'
      `);
      
      if (columns.length === 0) {
        console.log('⚠️ status_id column not found, skipping status update');
        return true; // Return true to avoid error
      }
      
      const query = 'UPDATE work_plans SET status_id = ? WHERE id = ?';
      const [result] = await pool.execute(query, [statusId, id]);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating work plan status:', error);
      return false;
    }
  }

  // Get work plan by ID (alias for getById)
  static async findById(id) {
    return this.getById(id);
  }

  // ฟังก์ชันค้นหา job_code จาก job_name
  static async findJobCodeByName(jobName) {
    if (!jobName || !jobName.trim()) return null;
    
    try {
      const searchTerm = `%${jobName.trim()}%`;
      
      // 1. ค้นหาจาก fg table (ตารางสินค้าสำเร็จรูป - มีสูตรใน fg_bom)
      const [fgRows] = await pool.execute(
        `
          SELECT FG_Code, FG_Name
          FROM fg
          WHERE FG_Name LIKE ? OR FG_Code LIKE ?
          ORDER BY 
            CASE WHEN FG_Name = ? THEN 1 ELSE 2 END,
            FG_Code
          LIMIT 5
        `,
        [searchTerm, searchTerm, jobName.trim()]
      );
      
      if (fgRows && fgRows.length > 0) {
        // หา exact match ก่อน
        const exactMatch = fgRows.find(row => 
          row.FG_Name && row.FG_Name.trim().toLowerCase() === jobName.trim().toLowerCase()
        );
        if (exactMatch && exactMatch.FG_Code) {
          return exactMatch.FG_Code.trim();
        }
        // ถ้าไม่มี exact match ให้ใช้ตัวแรก
        if (fgRows[0] && fgRows[0].FG_Code) {
          return fgRows[0].FG_Code.trim();
        }
      }
      
      // 2. ค้นหาจาก process_steps
      const [processRows] = await pool.execute(
        `
          SELECT DISTINCT job_code, job_name
          FROM process_steps
          WHERE job_name LIKE ? OR job_code LIKE ?
          ORDER BY 
            CASE WHEN job_name = ? THEN 1 ELSE 2 END,
            job_code
          LIMIT 5
        `,
        [searchTerm, searchTerm, jobName.trim()]
      );
      
      if (processRows && processRows.length > 0) {
        const exactMatch = processRows.find(row => 
          row.job_name && row.job_name.trim().toLowerCase() === jobName.trim().toLowerCase()
        );
        if (exactMatch && exactMatch.job_code) {
          return exactMatch.job_code.trim();
        }
        if (processRows[0] && processRows[0].job_code) {
          return processRows[0].job_code.trim();
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding job_code by name:', error);
      return null;
    }
  }

  static async getPrintDetails(id) {
    try {
      const [rows] = await pool.execute(
        `
          SELECT 
            wp.id,
            DATE_FORMAT(wp.production_date, '%Y-%m-%d') AS production_date,
            wp.job_code,
            wp.job_name,
            TIME_FORMAT(wp.start_time, '%H:%i') AS start_time,
            TIME_FORMAT(wp.end_time, '%H:%i') AS end_time,
            wp.notes,
            m.machine_name,
            pr.room_name,
            fg.FG_Name AS fg_name,
            fg.FG_Code AS fg_code,
            fg.FG_Unit AS fg_unit,
            fg.FG_Size AS fg_size,
            fg.base_unit AS fg_base_unit,
            fg.conversion_rate AS fg_conversion_rate,
            fg.conversion_description AS fg_conversion_description
          FROM work_plans wp
          LEFT JOIN fg ON fg.FG_Code = wp.job_code
          LEFT JOIN machines m ON wp.machine_id = m.id
          LEFT JOIN production_rooms pr ON wp.production_room_id = pr.id
          WHERE wp.id = ?
          LIMIT 1
        `,
        [id]
      );

      if (rows.length === 0) {
        return null;
      }

      const workPlan = rows[0];
      
      // ตรวจสอบและแก้ไข job_code ถ้าจำเป็น
      // ถ้า job_code เป็นตัวเลข (1, 2, 3...) หรือ 'NEW' หรือไม่มีสูตร ให้ค้นหาใหม่
      const isNumericJobCode = /^\d+$/.test(workPlan.job_code || '');
      const isInvalidJobCode = !workPlan.job_code || workPlan.job_code === 'NEW' || isNumericJobCode;
      
      let finalJobCode = workPlan.job_code;
      let shouldUpdateJobCode = false;
      
      if (isInvalidJobCode && workPlan.job_name) {
        // ค้นหา job_code ที่ถูกต้องจาก job_name
        const foundJobCode = await this.findJobCodeByName(workPlan.job_name);
        if (foundJobCode) {
          console.log(`🔍 [Print] Found correct job_code for "${workPlan.job_name}": ${foundJobCode} (was: ${workPlan.job_code})`);
          finalJobCode = foundJobCode;
          shouldUpdateJobCode = true;
        }
      }
      
      // ตรวจสอบว่ามีสูตรหรือไม่ ถ้าไม่มีสูตรและ job_code ไม่ถูกต้อง ให้ค้นหาใหม่
      if (finalJobCode && !isInvalidJobCode) {
        const [ingredientCheck] = await pool.execute(
          `SELECT COUNT(*) as count FROM fg_bom WHERE FG_Code = ?`,
          [finalJobCode]
        );
        if (ingredientCheck[0].count === 0 && workPlan.job_name) {
          // ไม่มีสูตร ให้ค้นหา job_code ใหม่
          const foundJobCode = await this.findJobCodeByName(workPlan.job_name);
          if (foundJobCode) {
            console.log(`🔍 [Print] No recipe found for job_code "${finalJobCode}", found correct one: ${foundJobCode}`);
            finalJobCode = foundJobCode;
            shouldUpdateJobCode = true;
          }
        }
      }
      
      // อัพเดท job_code ในฐานข้อมูลถ้าพบว่าไม่ถูกต้อง
      if (shouldUpdateJobCode && finalJobCode) {
        try {
          await pool.execute(
            `UPDATE work_plans SET job_code = ? WHERE id = ?`,
            [finalJobCode, workPlan.id]
          );
          console.log(`✅ [Print] Updated job_code for work_plan ${workPlan.id} from "${workPlan.job_code}" to "${finalJobCode}"`);
          // อัพเดท workPlan.job_code เพื่อใช้ในส่วนถัดไป
          workPlan.job_code = finalJobCode;
          
          // ดึงข้อมูล work_plan ใหม่เพื่อให้ได้ข้อมูลที่อัพเดทแล้ว (รวมถึง start_time, end_time)
          const [updatedRows] = await pool.execute(
            `
              SELECT 
                wp.id,
                DATE_FORMAT(wp.production_date, '%Y-%m-%d') AS production_date,
                wp.job_code,
                wp.job_name,
                TIME_FORMAT(wp.start_time, '%H:%i') AS start_time,
                TIME_FORMAT(wp.end_time, '%H:%i') AS end_time,
                wp.notes,
                m.machine_name,
                pr.room_name
              FROM work_plans wp
              LEFT JOIN machines m ON wp.machine_id = m.id
              LEFT JOIN production_rooms pr ON wp.production_room_id = pr.id
              WHERE wp.id = ?
              LIMIT 1
            `,
            [workPlan.id]
          );
          
          if (updatedRows && updatedRows.length > 0) {
            // อัพเดทข้อมูล workPlan ด้วยข้อมูลใหม่ (รวมถึง start_time, end_time)
            workPlan.start_time = updatedRows[0].start_time;
            workPlan.end_time = updatedRows[0].end_time;
            workPlan.notes = updatedRows[0].notes;
            workPlan.machine_name = updatedRows[0].machine_name;
            workPlan.room_name = updatedRows[0].room_name;
            console.log(`✅ [Print] Refreshed work_plan data after job_code update`);
          }
        } catch (updateError) {
          console.error('❌ [Print] Error updating job_code:', updateError);
          // ยังคงใช้ job_code ที่ค้นหาได้แม้ว่าจะอัพเดทไม่สำเร็จ
        }
      }
      
      // ดึงข้อมูล fg ใหม่ถ้า job_code ถูกแก้ไข
      let fgData = {
        fg_name: workPlan.fg_name,
        fg_code: workPlan.fg_code,
        fg_unit: workPlan.fg_unit,
        fg_size: workPlan.fg_size,
        fg_base_unit: workPlan.fg_base_unit,
        fg_conversion_rate: workPlan.fg_conversion_rate,
        fg_conversion_description: workPlan.fg_conversion_description
      };
      
      if (shouldUpdateJobCode && finalJobCode && finalJobCode !== workPlan.job_code) {
        // ดึงข้อมูล fg ใหม่ด้วย job_code ที่ถูกต้อง
        const [fgRows] = await pool.execute(
          `SELECT FG_Name, FG_Code, FG_Unit, FG_Size, base_unit, conversion_rate, conversion_description
           FROM fg WHERE FG_Code = ? LIMIT 1`,
          [finalJobCode]
        );
        if (fgRows && fgRows.length > 0) {
          fgData = {
            fg_name: fgRows[0].FG_Name,
            fg_code: fgRows[0].FG_Code,
            fg_unit: fgRows[0].FG_Unit,
            fg_size: fgRows[0].FG_Size,
            fg_base_unit: fgRows[0].base_unit,
            fg_conversion_rate: fgRows[0].conversion_rate,
            fg_conversion_description: fgRows[0].conversion_description
          };
        }
      }

      // ลำดับงานในวันเดียวกัน (1-based) - กรองงาน A, B, C, D ออกเพราะยังไม่เปิดให้พิมพ์
      const [orderRows] = await pool.execute(
        `
          SELECT id
          FROM work_plans
          WHERE DATE(production_date) = ?
            AND job_code NOT IN ('A','B','C','D')
          ORDER BY 
            start_time IS NULL,
            start_time,
            id
        `,
        [workPlan.production_date]
      );

      const orderIndex = orderRows.findIndex((row) => row.id === workPlan.id);
      const runningOrder = orderIndex >= 0 ? orderIndex + 1 : null;

      // รายชื่อผู้ปฏิบัติงาน
      const [operatorRows] = await pool.execute(
        `
          SELECT 
            COALESCE(u.name, wpo.id_code) AS name,
            wpo.role
          FROM work_plan_operators wpo
          LEFT JOIN users u 
            ON (wpo.user_id = u.id)
            OR (wpo.id_code IS NOT NULL AND wpo.id_code = u.id_code)
          WHERE wpo.work_plan_id = ?
          ORDER BY wpo.id ASC
        `,
        [workPlan.id]
      );

      const operatorNames = operatorRows
        .map((op) => op.name)
        .filter(Boolean);

      const operators = operatorRows
        .map((op) => ({
          name: op.name || '',
          role: op.role || 'operator'
        }))
        .filter((op) => op.name);

      // รายการวัตถุดิบตามสูตร (ใช้ finalJobCode ที่อาจถูกแก้ไขแล้ว)
      let ingredients = [];
      if (finalJobCode) {
        const [ingredientRows] = await pool.execute(
          `
            SELECT 
              fb.id,
              fb.Raw_Code AS material_code,
              fb.Raw_Qty AS quantity,
              fb.Raw_Unit AS unit,
              m.Mat_Name AS material_name
            FROM fg_bom fb
            LEFT JOIN material m ON m.Mat_Id = fb.Raw_Code
            WHERE fb.FG_Code = ?
            ORDER BY fb.id ASC
          `,
          [finalJobCode]
        );

        ingredients = ingredientRows.map((item, index) => ({
          rowNumber: index + 1,
          materialCode: item.material_code || '',
          materialName: item.material_name || '',
          quantity: item.quantity ?? null,
          unit: item.unit || ''
        }));
      }

      return {
        id: workPlan.id,
        jobCode: finalJobCode || workPlan.job_code,
        jobName: workPlan.job_name,
        productionDate: workPlan.production_date,
        order: runningOrder,
        planTime: {
          start: workPlan.start_time || null,
          end: workPlan.end_time || null
        },
        operatorsFull: operatorNames,
        notes: workPlan.notes || '',
        machineName: workPlan.machine_name || null,
        roomName: workPlan.room_name || null,
        fgSummary: {
          code: fgData.fg_code || null,
          name: fgData.fg_name || null,
          unit: fgData.fg_unit || null,
          size: fgData.fg_size || null,
          baseUnit: fgData.fg_base_unit || null,
          conversionRate: fgData.fg_conversion_rate || null,
          conversionDescription: fgData.fg_conversion_description || null
        },
        operators,
        ingredients
      };
    } catch (error) {
      throw new Error(`Error fetching print data: ${error.message}`);
    }
  }

  static async getPrintDetailsByDate(production_date) {
    try {
      const formattedDate = formatDateForDatabase(production_date);

      if (!formattedDate) {
        throw new Error('Invalid production date');
      }

      const [workPlanRows] = await pool.execute(
        `
          SELECT id
          FROM work_plans
          WHERE DATE(production_date) = ?
            AND job_code NOT IN ('A','B','C','D')
          ORDER BY 
            start_time IS NULL,
            start_time,
            id
        `,
        [formattedDate]
      );

      if (workPlanRows.length === 0) {
        return [];
      }

      const details = await Promise.all(
        workPlanRows.map((row) => this.getPrintDetails(row.id))
      );

      // ใช้ลำดับที่คำนวณจาก getPrintDetails โดยตรง (ไม่ต้อง override ด้วย index + 1)
      // เพราะ getPrintDetails คำนวณลำดับจาก orderRows ที่กรอง A, B, C, D แล้ว
      return details.filter(Boolean);
    } catch (error) {
      throw new Error(`Error fetching print data by date: ${error.message}`);
    }
  }

  static async getPrintDetailsByJobCode(jobCode, options = {}) {
    try {
      if (!jobCode || !jobCode.trim()) {
        throw new Error('jobCode is required');
      }

      const finalJobCode = jobCode.trim();
      let jobName = options.jobName || null;

      // ดึงข้อมูล FG
      let fgData = {
        fg_name: null,
        fg_code: finalJobCode,
        fg_unit: null,
        fg_size: null,
        fg_base_unit: null,
        fg_conversion_rate: null,
        fg_conversion_description: null
      };

      const [fgRows] = await pool.execute(
        `SELECT FG_Name, FG_Code, FG_Unit, FG_Size, base_unit, conversion_rate, conversion_description
         FROM fg WHERE FG_Code = ? LIMIT 1`,
        [finalJobCode]
      );

      if (fgRows && fgRows.length > 0) {
        fgData = {
          fg_name: fgRows[0].FG_Name,
          fg_code: fgRows[0].FG_Code,
          fg_unit: fgRows[0].FG_Unit,
          fg_size: fgRows[0].FG_Size,
          fg_base_unit: fgRows[0].base_unit,
          fg_conversion_rate: fgRows[0].conversion_rate,
          fg_conversion_description: fgRows[0].conversion_description
        };
        jobName = jobName || fgRows[0].FG_Name;
      } else {
        // ลองดึงข้อมูลจาก process_steps ถ้าไม่เจอใน fg
        const [processRows] = await pool.execute(
          `SELECT job_name FROM process_steps WHERE job_code = ? LIMIT 1`,
          [finalJobCode]
        );
        if (processRows && processRows.length > 0) {
          jobName = jobName || processRows[0].job_name;
        }
      }

      // ดึงสูตรวัตถุดิบจาก fg_bom
      const [ingredientRows] = await pool.execute(
        `
          SELECT 
            fb.id,
            fb.Raw_Code AS material_code,
            fb.Raw_Qty AS quantity,
            fb.Raw_Unit AS unit,
            m.Mat_Name AS material_name
          FROM fg_bom fb
          LEFT JOIN material m ON m.Mat_Id = fb.Raw_Code
          WHERE fb.FG_Code = ?
          ORDER BY fb.id ASC
        `,
        [finalJobCode]
      );

      const ingredients = ingredientRows.map((item, index) => ({
        rowNumber: index + 1,
        materialCode: item.material_code || '',
        materialName: item.material_name || '',
        quantity: item.quantity ?? null,
        unit: item.unit || ''
      }));

      return {
        id: null,
        jobCode: finalJobCode,
        jobName: jobName || finalJobCode,
        productionDate: null,
        order: null,
        planTime: {
          start: null,
          end: null
        },
        operatorsFull: [],
        notes: '',
        machineName: null,
        roomName: null,
        fgSummary: {
          code: fgData.fg_code || finalJobCode,
          name: fgData.fg_name || jobName || null,
          unit: fgData.fg_unit || null,
          size: fgData.fg_size || null,
          baseUnit: fgData.fg_base_unit || null,
          conversionRate: fgData.fg_conversion_rate || null,
          conversionDescription: fgData.fg_conversion_description || null
        },
        operators: [],
        ingredients
      };
    } catch (error) {
      throw new Error(`Error fetching print data by job code: ${error.message}`);
    }
  }

  // พิมพ์ใบงานผลิต
  static async printWorkPlan(production_date) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      const formattedDate = formatDateForDatabase(production_date);
      
      console.log('🖨️ Printing work plan for:', formattedDate);
      
      // เช็คว่ามีงาน draft อยู่ไหม (regular เท่านั้น ไม่รวม default)
      const [draftCheck] = await connection.execute(`
        SELECT COUNT(*) as count
        FROM work_plans
        WHERE DATE(production_date) = ? 
          AND job_type = 'regular' 
          AND workflow_status = 'draft'
      `, [formattedDate]);
      
      if (draftCheck[0].count > 0) {
        console.log('⚠️ Found', draftCheck[0].count, 'draft tasks');
        await connection.rollback();
        return {
          success: false,
          message: 'กรุณาบันทึกงานให้เสร็จสิ้นทุกงานก่อนพิมพ์',
          draftCount: draftCheck[0].count
        };
      }
      
      // อัพเดทสถานะเป็น "พิมพ์แล้ว"
      const [updateResult] = await connection.execute(`
        UPDATE work_plans 
        SET 
          workflow_status = 'printed',
          is_printed = 1
        WHERE DATE(production_date) = ? 
          AND workflow_status IN ('draft', 'completed')
      `, [formattedDate]);
      
      console.log('✅ Updated', updateResult.affectedRows, 'work plans to printed');
      
      // บันทึก log การพิมพ์
      await connection.execute(`
        INSERT INTO workplan_sync_log (production_date, synced_at)
        VALUES (?, NOW())
      `, [formattedDate]);
      
      console.log('📝 Logged print action');
      
      await connection.commit();
      
      console.log('🎉 Print successful!');
      
      return { 
        success: true, 
        message: 'พิมพ์ใบงานสำเร็จ',
        updated: updateResult.affectedRows
      };
      
    } catch (error) {
      await connection.rollback();
      console.error('❌ Error printing work plan:', error);
      throw new Error(`Error printing work plan: ${error.message}`);
    } finally {
      connection.release();
    }
  }
}

// เพิ่ม model สำหรับ work_plan_drafts
class DraftWorkPlan {
  static async getAll(date = null) {
    let query = `
      SELECT 
        wd.*,
        DATE_FORMAT(wd.production_date, "%Y-%m-%d") as production_date,
        pr.room_name as production_room_name,
        m.machine_name as machine_name
      FROM work_plan_drafts wd
      LEFT JOIN production_rooms pr ON wd.production_room_id = pr.id
      LEFT JOIN machines m ON wd.machine_id = m.id
    `;
    
    const params = [];
    
    // ✅ กรองตามวันที่ถ้ามี
    if (date) {
      query += ' WHERE DATE(wd.production_date) = ?';
      params.push(date);
    }
    
    query += ' ORDER BY wd.production_date DESC, wd.id DESC';
    
    const [rows] = await pool.execute(query, params);
    return rows;
  }
  static async getById(id) {
    const [rows] = await pool.execute(`
      SELECT 
        wd.*,
        pr.room_name as production_room_name,
        m.machine_name as machine_name
      FROM work_plan_drafts wd
      LEFT JOIN production_rooms pr ON wd.production_room_id = pr.id
      LEFT JOIN machines m ON wd.machine_id = m.id
      WHERE wd.id = ?
    `, [id]);
    return rows[0] || null;
  }
  static async create(data) {
    const { production_date, job_code, job_name, start_time, end_time, machine_id, production_room_id, notes, workflow_status_id, operators } = data;
    // เช็คซ้ำก่อน insert
    const [existing] = await pool.execute(
      'SELECT * FROM work_plan_drafts WHERE production_date = ? AND job_code = ? AND job_name = ? LIMIT 1',
      [production_date, job_code, job_name]
    );
    if (existing.length > 0) {
      return existing[0]; // ถ้ามีอยู่แล้ว return draft เดิม
    }
    const [result] = await pool.execute(
      'INSERT INTO work_plan_drafts (production_date, job_code, job_name, start_time, end_time, machine_id, production_room_id, notes, workflow_status_id, operators) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [production_date, job_code, job_name, start_time, end_time, machine_id, production_room_id, notes || '', workflow_status_id || 1, JSON.stringify(operators || [])]
    );
    return { id: result.insertId, ...data };
  }
  static async update(id, data) {
    const { production_date, job_code, job_name, start_time, end_time, machine_id, production_room_id, notes, workflow_status_id, operators } = data;
    
    // ตรวจสอบและจัดการ undefined values
    const safeProductionDate = production_date || null;
    const safeJobCode = job_code || null;
    const safeJobName = job_name || null;
    const safeStartTime = start_time || null;
    const safeEndTime = end_time || null;
    const safeMachineId = machine_id || null;
    const safeProductionRoomId = production_room_id || null;
    const safeNotes = notes || '';
    const safeWorkflowStatusId = workflow_status_id || 1;
    const safeOperators = operators || [];
    
    await pool.execute(
      'UPDATE work_plan_drafts SET production_date=?, job_code=?, job_name=?, start_time=?, end_time=?, machine_id=?, production_room_id=?, notes=?, workflow_status_id=?, operators=? WHERE id=?',
      [safeProductionDate, safeJobCode, safeJobName, safeStartTime, safeEndTime, safeMachineId, safeProductionRoomId, safeNotes, safeWorkflowStatusId, JSON.stringify(safeOperators), id]
    );
    return { id, ...data };
  }
  static async delete(id) {
    await pool.execute('DELETE FROM work_plan_drafts WHERE id = ?', [id]);
    return true;
  }
  static async syncDraftsToPlans(targetDate = null) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      
      let query = 'SELECT * FROM work_plan_drafts WHERE workflow_status_id = 2 AND job_code NOT IN (\'A\', \'B\', \'C\', \'D\')';
      let params = [];
      
      // ถ้ามีการระบุวันที่ ให้ sync เฉพาะวันที่นั้น
      if (targetDate) {
        // แปลงวันที่ให้เป็นรูปแบบที่ถูกต้อง
        const formattedDate = formatDateForDatabase(targetDate);
        query += ' AND DATE(production_date) = ?';
        params.push(formattedDate);
        console.log('🔄 [DEBUG] Formatted target date:', formattedDate);
      }
      
      query += ' ORDER BY production_date ASC, start_time ASC';
      
      console.log('🔄 Sync query:', query);
      console.log('🔄 Sync params:', params);
      console.log('🔄 [PROTECTION] กรองออกงาน A, B, C, D จาก sync');
      
      // ดึง drafts ที่มีสถานะ "บันทึกเสร็จสิ้น" (workflow_status_id = 2) และไม่ใช่ A, B, C, D
      const [drafts] = await connection.execute(query, params);
      
      console.log('🔄 Found drafts to sync:', drafts.length);
      drafts.forEach((draft, index) => {
        console.log(`🔄 Draft ${index + 1}:`, {
          id: draft.id,
          job_name: draft.job_name,
          production_date: draft.production_date,
          workflow_status_id: draft.workflow_status_id
        });
      });
      
      let syncedCount = 0;
      const syncedDrafts = [];
      
      // 1. บันทึก log การ sync
      let syncLogId = null;
      // 2. ดึงเวลาซิงค์ล่าสุดของวันนั้น (ก่อน insert log ใหม่)
      let lastSyncTime = null;
      if (targetDate) {
        const formattedDate = formatDateForDatabase(targetDate);
        const [syncRows] = await connection.execute(
          'SELECT synced_at FROM workplan_sync_log WHERE DATE(production_date) = ? ORDER BY synced_at DESC LIMIT 1',
          [formattedDate]
        );
        if (syncRows.length > 0) {
          lastSyncTime = new Date(syncRows[0].synced_at);
          console.log(`[SYNC] Last sync time for ${formattedDate}:`, lastSyncTime);
        } else {
          console.log(`[SYNC] No previous sync found for ${formattedDate}`);
        }
      }
      
      for (const draft of drafts) {
        try {
          // แปลง operators จาก JSON string เป็น array (robust)
          let operators = [];
          try {
            if (typeof draft.operators === 'string' && (draft.operators.trim().startsWith('[') || draft.operators.trim().startsWith('{'))) {
              operators = JSON.parse(draft.operators);
            } else if (Array.isArray(draft.operators)) {
              operators = draft.operators;
            } else {
              operators = [];
            }
          } catch (e) {
            operators = [];
          }
          
          // ตรวจสอบว่ามีงานในวันนั้นอยู่แล้วหรือไม่ (เฉพาะที่ไม่ใช่ A, B, C, D)
          const defaultCodes = ['A', 'B', 'C', 'D'];
          const isDefaultJob = defaultCodes.includes(draft.job_code);
          // เช็คว่ามี A, B, C, D ใน workplans จริงของวันนั้นหรือยัง
          const [existingDefault] = await connection.execute(
            'SELECT COUNT(*) as count FROM work_plans WHERE DATE(production_date) = DATE(?) AND job_code = ?',
            [draft.production_date, draft.job_code]
          );
          const [existingPlans] = await connection.execute(
            'SELECT COUNT(*) as count FROM work_plans WHERE DATE(production_date) = DATE(?) AND job_code NOT IN (\'A\', \'B\', \'C\', \'D\')',
            [draft.production_date]
          );
          const isSpecialJob = existingPlans[0].count > 0 && !isDefaultJob;
          // 3. เช็คว่า draft นี้ถูกสร้างหลัง sync หรือไม่ (is_special)
          let isSpecialDraft = false;
          if (lastSyncTime && draft.created_at) {
            const draftCreatedAt = new Date(draft.created_at);
            isSpecialDraft = draftCreatedAt > lastSyncTime;
            console.log(`[SYNC] Draft ${draft.job_code} ${draft.job_name}:`, {
              draftCreatedAt: draftCreatedAt,
              lastSyncTime: lastSyncTime,
              isSpecialDraft: isSpecialDraft
            });
          } else {
            console.log(`[SYNC] Draft ${draft.job_code} ${draft.job_name}: No lastSyncTime or created_at, isSpecialDraft = false`);
          }
          // 4. ไม่เติม prefix งานพิเศษใน job_code/job_name
          let jobCode = draft.job_code;
          let jobName = draft.job_name;
          // log debug
          console.log(`[SYNC] draft: ${draft.job_code} ${draft.job_name}, isSpecialDraft: ${isSpecialDraft}`);
          // สร้าง work plan ใหม่
          let insertQuery, insertParams;
          // ตรวจสอบว่ามี status_id และ is_special column หรือไม่
          const [columns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'work_plans' 
            AND COLUMN_NAME IN ('status_id', 'is_special', 'machine_id', 'production_room_id')
          `);
          const hasStatusColumn = columns.some(col => col.COLUMN_NAME === 'status_id');
          const hasIsSpecialColumn = columns.some(col => col.COLUMN_NAME === 'is_special');
          const hasMachineIdColumn = columns.some(col => col.COLUMN_NAME === 'machine_id');
          const hasProductionRoomIdColumn = columns.some(col => col.COLUMN_NAME === 'production_room_id');
          console.log('🔄 Has status_id column:', hasStatusColumn, 'Has is_special column:', hasIsSpecialColumn);
          console.log('🔄 Has machine_id column:', hasMachineIdColumn, 'Has production_room_id column:', hasProductionRoomIdColumn);
          // ตรวจสอบว่ามี operators column หรือไม่
          const [operatorsColumns] = await connection.execute(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'work_plans' 
            AND COLUMN_NAME = 'operators'
          `);
          const hasOperatorsColumn = operatorsColumns.length > 0;
          console.log('🔄 Has operators column:', hasOperatorsColumn);
          
                    if (hasStatusColumn && hasIsSpecialColumn && hasOperatorsColumn && hasMachineIdColumn && hasProductionRoomIdColumn) {
            insertQuery = 'INSERT INTO work_plans (production_date, job_code, job_name, start_time, end_time, status_id, is_special, notes, operators, machine_id, production_room_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            insertParams = [
              draft.production_date,
              jobCode, 
              jobName, 
              draft.start_time, 
              draft.end_time,
              isSpecialDraft ? 10 : 3, // 10 = งานพิเศษ, 3 = พิมพ์แล้ว (สำหรับงานที่บันทึกเสร็จสิ้นแล้ว)
              isSpecialDraft ? 1 : 0,   // is_special
              draft.notes || null,      // notes
              JSON.stringify(operators), // operators
              draft.machine_id || null,  // machine_id
              draft.production_room_id || null // production_room_id
            ];
          } else if (hasStatusColumn && hasOperatorsColumn && hasMachineIdColumn && hasProductionRoomIdColumn) {
            insertQuery = 'INSERT INTO work_plans (production_date, job_code, job_name, start_time, end_time, status_id, notes, operators, machine_id, production_room_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            insertParams = [
              draft.production_date, 
              jobCode, 
              jobName, 
              draft.start_time, 
              draft.end_time,
              isSpecialDraft ? 10 : 3, // 10 = งานพิเศษ, 3 = พิมพ์แล้ว (สำหรับงานที่บันทึกเสร็จสิ้นแล้ว)
              draft.notes || null,     // notes
              JSON.stringify(operators), // operators
              draft.machine_id || null,  // machine_id
              draft.production_room_id || null // production_room_id
            ];
          } else if (hasStatusColumn && hasIsSpecialColumn && hasMachineIdColumn && hasProductionRoomIdColumn) {
            insertQuery = 'INSERT INTO work_plans (production_date, job_code, job_name, start_time, end_time, status_id, is_special, notes, machine_id, production_room_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            insertParams = [
              draft.production_date, 
              jobCode, 
              jobName, 
              draft.start_time, 
              draft.end_time,
              isSpecialDraft ? 10 : 3, // 10 = งานพิเศษ, 3 = พิมพ์แล้ว (สำหรับงานที่บันทึกเสร็จสิ้นแล้ว)
              isSpecialDraft ? 1 : 0,   // is_special
              draft.notes || null,      // notes
              draft.machine_id || null,  // machine_id
              draft.production_room_id || null // production_room_id
            ];
          } else if (hasStatusColumn && hasMachineIdColumn && hasProductionRoomIdColumn) {
            insertQuery = 'INSERT INTO work_plans (production_date, job_code, job_name, start_time, end_time, status_id, notes, machine_id, production_room_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
            insertParams = [
              draft.production_date, 
              jobCode, 
              jobName, 
              draft.start_time, 
              draft.end_time,
              isSpecialDraft ? 10 : 3, // 10 = งานพิเศษ, 3 = พิมพ์แล้ว (สำหรับงานที่บันทึกเสร็จสิ้นแล้ว)
              draft.notes || null,     // notes
              draft.machine_id || null,  // machine_id
              draft.production_room_id || null // production_room_id
            ];
          } else if (hasMachineIdColumn && hasProductionRoomIdColumn) {
            insertQuery = 'INSERT INTO work_plans (production_date, job_code, job_name, start_time, end_time, notes, machine_id, production_room_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
            insertParams = [
              draft.production_date, 
              jobCode, 
              jobName, 
              draft.start_time, 
              draft.end_time,
              draft.notes || null,     // notes
              draft.machine_id || null,  // machine_id
              draft.production_room_id || null // production_room_id
            ];
          } else if (hasStatusColumn && hasIsSpecialColumn && hasOperatorsColumn) {
            insertQuery = 'INSERT INTO work_plans (production_date, job_code, job_name, start_time, end_time, status_id, is_special, notes, operators) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
            insertParams = [
              draft.production_date,
              jobCode, 
              jobName, 
              draft.start_time, 
              draft.end_time,
              isSpecialDraft ? 10 : 3, // 10 = งานพิเศษ, 3 = พิมพ์แล้ว (สำหรับงานที่บันทึกเสร็จสิ้นแล้ว)
              isSpecialDraft ? 1 : 0,   // is_special
              draft.notes || null,      // notes
              JSON.stringify(operators) // operators
            ];
          } else if (hasStatusColumn && hasOperatorsColumn) {
            insertQuery = 'INSERT INTO work_plans (production_date, job_code, job_name, start_time, end_time, status_id, notes, operators) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
            insertParams = [
              draft.production_date, 
              jobCode, 
              jobName, 
              draft.start_time, 
              draft.end_time,
              isSpecialDraft ? 10 : 3, // 10 = งานพิเศษ, 3 = พิมพ์แล้ว (สำหรับงานที่บันทึกเสร็จสิ้นแล้ว)
              draft.notes || null,     // notes
              JSON.stringify(operators) // operators
            ];
          } else if (hasStatusColumn && hasIsSpecialColumn) {
            insertQuery = 'INSERT INTO work_plans (production_date, job_code, job_name, start_time, end_time, status_id, is_special, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
            insertParams = [
              draft.production_date, 
              jobCode, 
              jobName, 
              draft.start_time, 
              draft.end_time,
              isSpecialDraft ? 10 : 3, // 10 = งานพิเศษ, 3 = พิมพ์แล้ว (สำหรับงานที่บันทึกเสร็จสิ้นแล้ว)
              isSpecialDraft ? 1 : 0,   // is_special
              draft.notes || null       // notes
            ];
          } else if (hasStatusColumn) {
            insertQuery = 'INSERT INTO work_plans (production_date, job_code, job_name, start_time, end_time, status_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)';
            insertParams = [
              draft.production_date, 
              jobCode, 
              jobName, 
              draft.start_time, 
              draft.end_time,
              isSpecialDraft ? 10 : 3, // 10 = งานพิเศษ, 3 = พิมพ์แล้ว (สำหรับงานที่บันทึกเสร็จสิ้นแล้ว)
              draft.notes || null      // notes
            ];
          } else {
            insertQuery = 'INSERT INTO work_plans (production_date, job_code, job_name, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?)';
            insertParams = [
              draft.production_date, 
              jobCode, 
              jobName, 
              draft.start_time, 
              draft.end_time,
              draft.notes || null      // notes
            ];
          }
          console.log('🔄 Insert query:', insertQuery);
          console.log('🔄 Insert params:', insertParams);
          console.log('🔄 Machine ID from draft:', draft.machine_id, 'Production Room ID from draft:', draft.production_room_id);
          const [result] = await connection.execute(insertQuery, insertParams);
          const workPlanId = result.insertId;
          // เพิ่ม operators
          for (const operator of operators) {
            await connection.execute(
              'INSERT INTO work_plan_operators (work_plan_id, user_id, id_code) VALUES (?, ?, ?)',
              [workPlanId, operator.user_id || null, operator.id_code || null]
            );
          }
          // ลบ draft หลังจาก sync สำเร็จ
          console.log('🔄 Deleting draft ID:', draft.id);
          await connection.execute('DELETE FROM work_plan_drafts WHERE id = ?', [draft.id]);
          syncedCount++;
          syncedDrafts.push({ draftId: draft.id, workPlanId });
          console.log('🔄 Successfully synced draft:', {
            draft_id: draft.id,
            work_plan_id: workPlanId,
            job_name: jobName
          });
          
        } catch (err) {
          console.error(`Error syncing draft ${draft.id}:`, err);
          // ไม่ rollback ทั้งหมด แต่ข้าม draft ที่มีปัญหา
          continue;
        }
      }
      
      // 3. บันทึก log การ sync (ย้ายมาหลัง loop)
      if (targetDate) {
        const formattedDate = formatDateForDatabase(targetDate);
        const [syncLogResult] = await connection.execute(
          'INSERT INTO workplan_sync_log (production_date) VALUES (?)',
          [formattedDate]
        );
        syncLogId = syncLogResult.insertId;
        console.log(`[SYNC] Inserted sync log with ID: ${syncLogId}`);
      }
      
      console.log('🔄 Committing transaction...');
      await connection.commit();
      
      console.log('🔄 Sync completed. Total synced:', syncedCount);
      
      return {
        success: true,
        synced: syncedCount,
        drafts: syncedDrafts,
        message: `Sync สำเร็จ ${syncedCount} รายการ`
      };
      
    } catch (error) {
      await connection.rollback();
      throw new Error(`Error syncing drafts to plans: ${error.message}`);
    } finally {
      connection.release();
    }
  }
}

module.exports = { WorkPlan, DraftWorkPlan }; 