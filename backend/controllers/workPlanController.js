const { WorkPlan, DraftWorkPlan } = require('../models/WorkPlan');
const { validationResult } = require('express-validator');
const { pool } = require('../config/database');

class WorkPlanController {
  // ค้นหางานในระบบ
  static async searchWorkPlans(req, res) {
    try {
      const { code, name } = req.query;
      
      let query = `
        SELECT DISTINCT wp.id, wp.job_code, wp.job_name, wp.production_date
        FROM work_plans wp
        WHERE 1=1
      `;
      const params = [];

      if (code) {
        query += ` AND wp.job_code LIKE ?`;
        params.push(`%${code}%`);
      }

      if (name) {
        query += ` AND wp.job_name LIKE ?`;
        params.push(`%${name}%`);
      }

      query += ` ORDER BY wp.production_date DESC, wp.id DESC LIMIT 20`;

      const [rows] = await pool.query(query, params);
      
      res.json({
        success: true,
        data: rows,
        message: 'ค้นหางานสำเร็จ'
      });
    } catch (error) {
      console.error('Error searching work plans:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการค้นหา'
      });
    }
  }

  // ดึงรายการงานทั้งหมด
  static async getAllWorkPlans(req, res) {
    try {
      const { date, page = 1, limit = 50, search, status, job_code } = req.query;
      console.log('🔍 getAllWorkPlans called');
      console.log('📅 Requested date:', date);
      console.log('📄 Page:', page, 'Limit:', limit);
      console.log('🔗 Query parameters:', req.query);
      console.log('🌐 Full request URL:', req.url);
      console.log('📋 Request headers:', req.headers);
      
      // ตรวจสอบการเชื่อมต่อฐานข้อมูลก่อน
      if (!req.app.locals.dbConnected) {
        console.error('❌ Database not connected');
        return res.status(503).json({
          success: false,
          message: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้',
          error: 'Database connection not available'
        });
      }
      
      // ตรวจสอบรูปแบบวันที่
      if (date && typeof date === 'string') {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
          console.error('❌ Invalid date format:', date);
          return res.status(400).json({
            success: false,
            message: 'รูปแบบวันที่ไม่ถูกต้อง ต้องเป็น YYYY-MM-DD',
            error: 'Invalid date format'
          });
        }
      }
      
      console.log('🔄 Calling WorkPlan.getAll...');
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 50;
      
      // เพิ่ม filters object
      const filters = {
        date,
        search,
        status,
        job_code
      };
      
      const workPlans = await WorkPlan.getAll(date, pageNum, limitNum, filters);
      console.log('✅ Found work plans:', workPlans.length);
      
      if (workPlans.length > 0) {
        console.log('📊 Sample work plan:', workPlans[0]);
        console.log('📊 All production dates:', workPlans.map(wp => wp.production_date));
      } else {
        console.log('⚠️ No work plans found for date:', date);
      }
      
      res.json({
        success: true,
        data: workPlans || [],
        message: workPlans.length > 0 ? 'ดึงข้อมูลงานสำเร็จ' : 'ไม่พบข้อมูลงานในวันที่เลือก',
        count: workPlans.length,
        requestedDate: date
      });
    } catch (error) {
      console.error('❌ Error fetching work plans:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        stack: error.stack
      });
      
      // ส่ง error response ที่ชัดเจน
      const statusCode = error.code === 'ECONNREFUSED' ? 503 : 500;
      const errorMessage = error.code === 'ECONNREFUSED' 
        ? 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้' 
        : 'เกิดข้อผิดพลาดในการดึงข้อมูล';
        
      res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: error.message,
        code: error.code
      });
    }
  }

  // Get all work plans (original method for compatibility)
  static async getAll(req, res) {
    try {
      const { date } = req.query;
      console.log('Requested date:', date);
      console.log('Date type:', typeof date);
      console.log('Query parameters:', req.query);
      console.log('Full request URL:', req.url);
      console.log('Request headers:', req.headers);
      
      const pageNum = parseInt(req.query.page) || 1;
      const limitNum = parseInt(req.query.limit) || 50;
      const workPlans = await WorkPlan.getAll(date, pageNum, limitNum);
      console.log('Found work plans:', workPlans.length);
      console.log('Work plans data:', workPlans);
      
      // ดึงจำนวนทั้งหมดสำหรับ pagination info
      const totalQuery = date ? 
        `SELECT COUNT(*) as total FROM work_plans WHERE DATE(production_date) = ? OR production_date = ?` :
        `SELECT COUNT(*) as total FROM work_plans`;
      const totalParams = date ? [date, date] : [];
      
      let total = 0;
      try {
        const { pool } = require('../config/database');
        const [totalResult] = await pool.execute(totalQuery, totalParams);
        total = totalResult[0].total;
      } catch (error) {
        console.error('Error getting total count:', error);
        total = workPlans.length; // fallback
      }

      // Optimize response data - ส่งเฉพาะฟิลด์ที่จำเป็น
      const optimizedWorkPlans = workPlans.map(wp => ({
        id: wp.id,
        production_date: wp.production_date,
        job_code: wp.job_code,
        job_name: wp.job_name,
        start_time: wp.start_time,
        end_time: wp.end_time,
        operators: wp.operators,
        status_id: wp.status_id,
        status_name: wp.status_name,
        status_color: wp.status_color,
        is_finished: wp.is_finished,
        // เพิ่มเฉพาะข้อมูลที่ frontend ใช้จริง
        ...(wp.operators_from_join && { operators_from_join: wp.operators_from_join }),
        ...(wp.production_room_name && { production_room_name: wp.production_room_name }),
        ...(wp.machine_name && { machine_name: wp.machine_name })
      }));

      res.json({
        success: true,
        data: optimizedWorkPlans,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: total,
          totalPages: Math.ceil(total / limitNum),
          hasNextPage: pageNum * limitNum < total,
          hasPrevPage: pageNum > 1
        },
        message: `พบงานทั้งหมด ${workPlans.length} รายการ (หน้า ${pageNum}/${Math.ceil(total / limitNum)})${date ? ` สำหรับวันที่ ${date}` : ''}`,
        _meta: {
          timestamp: new Date().toISOString(),
          responseSize: JSON.stringify(optimizedWorkPlans).length
        }
      });
    } catch (error) {
      console.error('Error in getAll:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get work plan by ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const workPlan = await WorkPlan.getById(id);
      
      if (!workPlan) {
        return res.status(404).json({
          success: false,
          message: 'Work plan not found'
        });
      }
      
      res.json({
        success: true,
        data: workPlan
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Create new work plan
  static async create(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      console.log('📝 Creating work plan with data:', req.body);
      console.log('📅 Production date from request:', req.body.production_date);
      console.log('📅 Production date type:', typeof req.body.production_date);

      const workPlan = await WorkPlan.create(req.body);
      
      res.status(201).json({
        success: true,
        data: workPlan,
        message: 'Work plan created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update work plan
  static async update(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const { id } = req.params;
      const workPlan = await WorkPlan.update(id, req.body);
      
      if (!workPlan) {
        return res.status(404).json({
          success: false,
          message: 'Work plan not found'
        });
      }
      
      res.json({
        success: true,
        data: workPlan,
        message: 'Work plan updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Delete work plan
  static async delete(req, res) {
    try {
      const { id } = req.params;
      
      // ตรวจสอบว่า work plan มีอยู่หรือไม่
      const workPlan = await WorkPlan.findById(id);
      if (!workPlan) {
        return res.status(404).json({
          success: false,
          message: 'Work plan not found'
        });
      }
      
      // อนุญาตให้ลบเมื่อเป็นงานแบบร่าง/บันทึกเสร็จสิ้น
      // รองรับข้อมูลเก่าที่ workflow_status อาจว่าง แต่ status_id ยังถูกต้อง
      const status = String(workPlan.workflow_status || '').toLowerCase();
      const statusId = Number(workPlan.status_id);
      const isPrinted = Number(workPlan.is_printed) === 1;
      const canDeleteByStatus =
        status === 'draft' ||
        status === 'completed' ||
        statusId === 1 ||
        statusId === 2;

      if (canDeleteByStatus && !isPrinted) {
        const deleted = await WorkPlan.delete(id);
        if (deleted) {
          return res.json({ success: true, message: 'Draft work plan deleted successfully' });
        }
        return res.status(400).json({ success: false, message: 'Failed to delete work plan' });
      }
      
      // กรณีไม่ใช่ draft ให้บล็อคการลบ และแนะนำให้ใช้ "ยกเลิกการผลิต"
      return res.status(403).json({
        success: false,
        message: 'ไม่สามารถลบงานผลิตที่พิมพ์แล้วได้ กรุณาใช้ "ยกเลิกการผลิต" แทน'
      });
      
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Mark work plan as finished
  static async markAsFinished(req, res) {
    try {
      const { id } = req.params;
      await WorkPlan.markAsFinished(id);
      
      res.json({
        success: true,
        message: 'Work plan marked as finished'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Mark work plan as unfinished
  static async markAsUnfinished(req, res) {
    try {
      const { id } = req.params;
      await WorkPlan.markAsUnfinished(id);
      
      res.json({
        success: true,
        message: 'Work plan marked as unfinished'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Cancel production (ยกเลิกการผลิต)
  static async cancelProduction(req, res) {
    try {
      console.log('🔴 [DEBUG] cancelProduction called');
      const { id } = req.params;
      console.log('🔴 [DEBUG] Work plan ID:', id);
      
      // ตรวจสอบว่า work plan มีอยู่หรือไม่
      const workPlan = await WorkPlan.findById(id);
      console.log('🔴 [DEBUG] Found work plan:', workPlan);
      
      if (!workPlan) {
        console.log('🔴 [DEBUG] Work plan not found');
        return res.status(404).json({
          success: false,
          message: 'ไม่พบแผนการผลิตที่ระบุ'
        });
      }
      
      // อัพเดทสถานะเป็น "ยกเลิกการผลิต" (status_id = 9)
      console.log('🔴 [DEBUG] Updating status to 9 (ยกเลิกการผลิต)');
      const updated = await WorkPlan.updateStatus(id, 9);
      console.log('🔴 [DEBUG] Update result:', updated);
      
      if (updated) {
        console.log('🔴 [DEBUG] Cancel successful');
        res.json({
          success: true,
          message: 'ยกเลิกการผลิตสำเร็จ'
        });
      } else {
        console.log('🔴 [DEBUG] Cancel failed');
        res.status(400).json({
          success: false,
          message: 'ไม่สามารถยกเลิกการผลิตได้'
        });
      }
    } catch (error) {
      console.error('🔴 [DEBUG] Error in cancelProduction:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update work plan status
  static async updateStatus(req, res) {
    try {
      console.log('🔄 [DEBUG] updateStatus called');
      const { id } = req.params;
      const { status_id } = req.body;
      
      console.log('🔄 [DEBUG] Work plan ID:', id);
      console.log('🔄 [DEBUG] New status ID:', status_id);
      
      if (!status_id) {
        return res.status(400).json({
          success: false,
          message: 'status_id is required'
        });
      }
      
      const workPlan = await WorkPlan.findById(id);
      if (!workPlan) {
        console.log('🔄 [DEBUG] Work plan not found');
        return res.status(404).json({
          success: false,
          message: 'Work plan not found'
        });
      }
      
      console.log('🔄 [DEBUG] Found work plan:', workPlan);
      console.log('🔄 [DEBUG] Updating status to', status_id);
      
      const updated = await WorkPlan.updateStatus(id, status_id);
      console.log('🔄 [DEBUG] Update result:', updated);
      
      // ถ้าสถานะใหม่คือ 4 (จบงานผลิตแล้ว) ให้บันทึกธง finished_flags ด้วย
      if (updated && Number(status_id) === 4) {
        try {
          await WorkPlan.markAsFinished(id);
          console.log('✅ [DEBUG] finished_flags updated (is_finished = 1) for work_plan_id:', id);
        } catch (e) {
          console.error('⚠️ [DEBUG] Failed to update finished_flags:', e);
          // ไม่ต้อง throw ต่อ เพื่อไม่ให้ล้มทั้งคำขอ ถ้าบันทึกธงล้มเหลว
        }
      }
      
      if (!updated) {
        console.log('🔄 [DEBUG] Update failed');
        return res.status(500).json({
          success: false,
          message: 'Failed to update work plan status'
        });
      }
      
      console.log('🔄 [DEBUG] Successfully updated status');
      res.json({
        success: true,
        message: 'Work plan status updated successfully'
      });
    } catch (error) {
      console.error('🔄 [DEBUG] Error in updateStatus:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // สร้างงาน Default (ABCD) อัตโนมัติ
  static async createDefaultTasks(req, res) {
    try {
      const { production_date } = req.body;
      
      console.log('🆕 Creating default tasks for:', production_date);
      
      if (!production_date) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุวันที่ผลิต (production_date)'
        });
      }
      
      const result = await WorkPlan.createDefaultTasks(production_date);
      
      res.json(result);
      
    } catch (error) {
      console.error('❌ Error creating default tasks:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // พิมพ์ใบงานผลิต
  static async printWorkPlan(req, res) {
    try {
      const { production_date } = req.body;
      
      console.log('🖨️ Printing work plan for:', production_date);
      
      if (!production_date) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุวันที่ผลิต (production_date)'
        });
      }
      
      const result = await WorkPlan.printWorkPlan(production_date);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
      
    } catch (error) {
      console.error('❌ Error printing work plan:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getPrintData(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุรหัสงาน (id)'
        });
      }

      const data = await WorkPlan.getPrintDetails(id);

      if (!data) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบข้อมูลงานที่ต้องการพิมพ์'
        });
      }

      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('❌ Error fetching print data:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getPrintDataByDate(req, res) {
    try {
      const { date } = req.query;

      if (!date) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุวันที่ผลิต (date)'
        });
      }

      const data = await WorkPlan.getPrintDetailsByDate(date);

      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('❌ Error fetching print data by date:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  static async getPrintDataByJobCode(req, res) {
    try {
      let { jobCode, jobName } = req.query;

      if (!jobCode && !jobName) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุรหัสงานหรือชื่องาน'
        });
      }

      if (!jobCode && jobName) {
        const foundCode = await WorkPlan.findJobCodeByName(jobName);
        jobCode = foundCode;
      }

      if (!jobCode) {
        return res.status(404).json({
          success: false,
          message: 'ไม่พบรหัสงานที่ต้องการ'
        });
      }

      const data = await WorkPlan.getPrintDetailsByJobCode(jobCode, { jobName });

      res.json({
        success: true,
        data
      });
    } catch (error) {
      console.error('❌ Error fetching print data by job code:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // ดึงข้อมูลงานที่ทำบ่อยเพื่อใช้เป็น Template
  static async getFrequentJobs(req, res) {
    try {
      const minFrequency = parseInt(req.query.minFrequency) || 3;
      const limit = parseInt(req.query.limit) || 50;
      
      console.log('🔍 getFrequentJobs called with:', { minFrequency, limit });
      
      // Query 1: ดึงงานที่ทำบ่อย (มากกว่า minFrequency ครั้ง) พร้อมข้อมูลสรุป
      const frequentJobsQuery = `
        SELECT 
          wp.job_code,
          wp.job_name,
          COUNT(*) as frequency,
          MIN(wp.production_date) as first_date,
          MAX(wp.production_date) as last_date,
          -- เวลาที่ใช้บ่อยที่สุด
          (
            SELECT CONCAT(start_time, '-', end_time)
            FROM work_plans wp2
            WHERE wp2.job_code = wp.job_code 
              AND wp2.start_time IS NOT NULL 
              AND wp2.end_time IS NOT NULL
            GROUP BY CONCAT(start_time, '-', end_time)
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) as most_common_time,
          -- ห้องผลิตที่ใช้บ่อยที่สุด
          (
            SELECT pr.room_code
            FROM work_plans wp2
            JOIN production_rooms pr ON wp2.production_room_id = pr.id
            WHERE wp2.job_code = wp.job_code 
              AND wp2.production_room_id IS NOT NULL
            GROUP BY pr.room_code
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) as most_common_room,
          -- เครื่องจักรที่ใช้บ่อยที่สุด
          (
            SELECT m.machine_code
            FROM work_plans wp2
            JOIN machines m ON wp2.machine_id = m.id
            WHERE wp2.job_code = wp.job_code 
              AND wp2.machine_id IS NOT NULL
            GROUP BY m.machine_code
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ) as most_common_machine
        FROM work_plans wp
        WHERE wp.job_code IS NOT NULL 
          AND wp.job_code != ''
          AND wp.job_code != 'NEW'
          AND wp.job_code NOT IN ('A','B','C','D')
          AND (wp.job_type IS NULL OR wp.job_type != 'default')
          AND wp.job_name IS NOT NULL
          AND wp.job_name != ''
        GROUP BY wp.job_code, wp.job_name
        HAVING COUNT(*) >= ?
        ORDER BY frequency DESC
        LIMIT ${parseInt(limit) || 50}
      `;

      console.log('🔍 Executing query with params:', { minFrequency, limit: parseInt(limit) || 50 });
      const [frequentJobs] = await pool.execute(frequentJobsQuery, [minFrequency]);
      
      // Query 2: ดึงข้อมูลรายละเอียดสำหรับแต่ละงาน (งานล่าสุด 3 งาน)
      const jobsWithDetails = await Promise.all(
        frequentJobs.map(async (job) => {
          const detailQuery = `
            SELECT 
              wp.id,
              wp.production_date,
              wp.start_time,
              wp.end_time,
              wp.notes,
              pr.room_code,
              pr.room_name,
              m.machine_code,
              m.machine_name,
              GROUP_CONCAT(DISTINCT u.name ORDER BY u.name SEPARATOR ', ') as operators
            FROM work_plans wp
            LEFT JOIN production_rooms pr ON wp.production_room_id = pr.id
            LEFT JOIN machines m ON wp.machine_id = m.id
            LEFT JOIN work_plan_operators wpo ON wp.id = wpo.work_plan_id
            LEFT JOIN users u ON wpo.user_id = u.id OR wpo.id_code = u.id_code
            WHERE wp.job_code = ?
            GROUP BY wp.id, wp.production_date, wp.start_time, wp.end_time, wp.notes, pr.room_code, pr.room_name, m.machine_code, m.machine_name
            ORDER BY wp.production_date DESC, wp.id DESC
            LIMIT 3
          `;
          
          const [details] = await pool.execute(detailQuery, [job.job_code]);
          
          return {
            ...job,
            recentWorkPlans: details.map(detail => ({
              id: detail.id,
              production_date: detail.production_date,
              start_time: detail.start_time,
              end_time: detail.end_time,
              notes: detail.notes,
              room: detail.room_name ? {
                code: detail.room_code,
                name: detail.room_name
              } : null,
              machine: detail.machine_name ? {
                code: detail.machine_code,
                name: detail.machine_name
              } : null,
              operators: detail.operators ? detail.operators.split(', ') : []
            }))
          };
        })
      );

      // Query 3: สรุปสถิติ
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT job_code) as total_unique_jobs,
          SUM(cnt) as total_work_plans,
          SUM(CASE WHEN cnt >= 10 THEN 1 ELSE 0 END) as jobs_10plus,
          SUM(CASE WHEN cnt >= 5 AND cnt < 10 THEN 1 ELSE 0 END) as jobs_5to9,
          SUM(CASE WHEN cnt >= 3 AND cnt < 5 THEN 1 ELSE 0 END) as jobs_3to4
        FROM (
          SELECT job_code, COUNT(*) as cnt
          FROM work_plans
          WHERE job_code IS NOT NULL 
            AND job_code != '' 
            AND job_code != 'NEW'
            AND job_code NOT IN ('A','B','C','D')
            AND (job_type IS NULL OR job_type != 'default')
          GROUP BY job_code
        ) as job_counts
      `;
      
      const [stats] = await pool.execute(statsQuery);
      
      res.json({
        success: true,
        data: {
          jobs: jobsWithDetails,
          statistics: {
            total_unique_jobs: stats[0].total_unique_jobs,
            total_work_plans: stats[0].total_work_plans,
            jobs_10plus: stats[0].jobs_10plus,
            jobs_5to9: stats[0].jobs_5to9,
            jobs_3to4: stats[0].jobs_3to4
          }
        },
        message: `พบงานที่ทำบ่อย ${jobsWithDetails.length} งาน`
      });
    } catch (error) {
      console.error('Error getting frequent jobs:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลงานที่ทำบ่อย: ' + error.message
      });
    }
  }

  // ดึงข้อมูลงานล่าสุดตาม job_code หรือ job_name เพื่อใช้ auto-fill
  static async getLatestByJob(req, res) {
    try {
      const { job_code, job_name } = req.query;
      
      if (!job_code && !job_name) {
        return res.status(400).json({
          success: false,
          message: 'กรุณาระบุ job_code หรือ job_name'
        });
      }

      const latestWorkPlan = await WorkPlan.getLatestByJob(job_code, job_name);
      
      if (!latestWorkPlan) {
        return res.json({
          success: true,
          data: null,
          message: 'ไม่พบข้อมูลงานล่าสุด'
        });
      }

      res.json({
        success: true,
        data: latestWorkPlan,
        message: 'ดึงข้อมูลงานล่าสุดสำเร็จ'
      });
    } catch (error) {
      console.error('Error getting latest work plan by job:', error);
      res.status(500).json({
        success: false,
        message: 'เกิดข้อผิดพลาดในการดึงข้อมูลงานล่าสุด: ' + error.message
      });
    }
  }
}

// เพิ่ม controller สำหรับ draft
class DraftWorkPlanController {
  static async getAll(req, res) {
    const { date } = req.query; // ✅ รับ date parameter
    console.log('📅 Getting drafts for date:', date);
    const drafts = await DraftWorkPlan.getAll(date); // ส่ง date ไปยัง Model
    console.log('📅 Retrieved drafts:', drafts.length);
    res.json({ success: true, data: drafts });
  }
  static async getById(req, res) {
    const draft = await DraftWorkPlan.getById(req.params.id);
    if (!draft) return res.status(404).json({ success: false, message: 'Draft not found' });
    res.json({ success: true, data: draft });
  }
  static async create(req, res) {
    console.log('📅 Creating draft with data:', req.body);
    console.log('📅 production_date:', req.body.production_date);
    console.log('📅 production_date type:', typeof req.body.production_date);
    
    const draft = await DraftWorkPlan.create(req.body);
    console.log('📅 Created draft:', draft);
    
    res.status(201).json({ success: true, data: draft });
  }
  static async update(req, res) {
    console.log('📝 Updating draft with ID:', req.params.id);
    console.log('📝 Request body:', req.body);
    console.log('📝 workflow_status_id:', req.body.workflow_status_id);
    
    const draft = await DraftWorkPlan.update(req.params.id, req.body);
    console.log('📝 Updated draft:', draft);
    
    res.json({ success: true, data: draft });
  }
  static async delete(req, res) {
    await DraftWorkPlan.delete(req.params.id);
    res.json({ success: true });
  }
  static async syncDraftsToPlans(req, res) {
    try {
      console.log('🔄 [DEBUG] syncDraftsToPlans called');
      const { targetDate } = req.body; // รับวันที่จาก request body
      if (!targetDate) {
        console.log('🔄 [DEBUG] targetDate is missing in request body:', req.body);
      } else {
        console.log('🔄 [DEBUG] targetDate:', targetDate);
      }
      
      const result = await DraftWorkPlan.syncDraftsToPlans(targetDate);
      
      console.log('🔄 [DEBUG] Sync result:', result);
      
      // ปรับ message ตามว่ามีการระบุวันที่หรือไม่
      let message = result.message;
      if (targetDate) {
        message = `Sync สำเร็จ ${result.synced} รายการสำหรับวันที่ ${targetDate}`;
      }
      
      console.log('🔄 [DEBUG] Final message:', message);
      
      res.json({
        success: true,
        data: result,
        message: message
      });
    } catch (error) {
      console.error('Error in syncDraftsToPlans:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = { WorkPlanController, DraftWorkPlanController }; 