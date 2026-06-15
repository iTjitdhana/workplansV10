const express = require('express');
const ProcessStep = require('../models/ProcessStep');
const { pool } = require('../config/database');

const router = express.Router();
const FALLBACK_DB_NAME = process.env.DB_NAME || '';
const PRODUCTS_DB_NAME = process.env.PRODUCTS_DB_NAME || FALLBACK_DB_NAME;
const DB_NAME_PATTERN = /^[A-Za-z0-9_]+$/;

const getQualifiedProductsTable = () => {
  if (!PRODUCTS_DB_NAME || !DB_NAME_PATTERN.test(PRODUCTS_DB_NAME)) {
    console.warn('[process-steps/search] Invalid PRODUCTS_DB_NAME. Skip products lookup.', {
      productsDbName: PRODUCTS_DB_NAME
    });
    return null;
  }
  return `\`${PRODUCTS_DB_NAME}\`.\`products\``;
};

// GET /api/process-steps/search - ค้นหางานผลิต
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.json({
        success: true,
        data: []
      });
    }

    const normalizedQuery = String(query).trim();
    if (normalizedQuery.length === 0) {
      return res.json({
        success: true,
        data: []
      });
    }
    const searchTerm = `%${normalizedQuery}%`;
    const prefixTerm = `${normalizedQuery}%`;
    const sourcePriority = {
      fg: 1,
      process_steps: 2,
      products: 3
    };

    // 1. ค้นหาจาก process_steps (มีสูตร)
    const processStepsSql = `
      SELECT DISTINCT
        job_code,
        job_name,
        CASE
          WHEN job_code = ? OR job_name = ? THEN 1
          WHEN job_code LIKE ? OR job_name LIKE ? THEN 2
          ELSE 3
        END AS relevance_score
      FROM process_steps
      WHERE job_code LIKE ? OR job_name LIKE ?
      ORDER BY relevance_score ASC, CHAR_LENGTH(job_name) ASC, job_code ASC
      LIMIT 30
    `;
    const [processStepsRows] = await pool.execute(processStepsSql, [
      normalizedQuery,
      normalizedQuery,
      prefixTerm,
      prefixTerm,
      searchTerm,
      searchTerm
    ]);

    // 2. ค้นหาจาก fg table (ตารางสินค้าสำเร็จรูป - มีสูตรใน fg_bom)
    const fgSql = `
      SELECT DISTINCT
        FG_Code AS job_code,
        FG_Name AS job_name,
        CASE
          WHEN FG_Code = ? OR FG_Name = ? THEN 1
          WHEN FG_Code LIKE ? OR FG_Name LIKE ? THEN 2
          ELSE 3
        END AS relevance_score
      FROM fg
      WHERE FG_Code LIKE ? OR FG_Name LIKE ?
      ORDER BY relevance_score ASC, CHAR_LENGTH(FG_Name) ASC, FG_Code ASC
      LIMIT 30
    `;
    const [fgRows] = await pool.execute(fgSql, [
      normalizedQuery,
      normalizedQuery,
      prefixTerm,
      prefixTerm,
      searchTerm,
      searchTerm
    ]);

    // 3. ค้นหาจาก products table แบบข้ามฐานข้อมูล (product_code/product_name)
    let productRows = [];
    const qualifiedProductsTable = getQualifiedProductsTable();
    if (qualifiedProductsTable) {
      try {
        const productsSql = `
          SELECT DISTINCT
            product_code AS job_code,
            product_name AS job_name,
            CASE
              WHEN product_code = ? OR product_name = ? THEN 1
              WHEN product_code LIKE ? OR product_name LIKE ? THEN 2
              ELSE 3
            END AS relevance_score
          FROM ${qualifiedProductsTable}
          WHERE product_code LIKE ? OR product_name LIKE ?
          ORDER BY relevance_score ASC, CHAR_LENGTH(product_name) ASC, product_code ASC
          LIMIT 30
        `;
        const [rows] = await pool.execute(productsSql, [
          normalizedQuery,
          normalizedQuery,
          prefixTerm,
          prefixTerm,
          searchTerm,
          searchTerm
        ]);
        productRows = rows;
      } catch (productsError) {
        // graceful degradation: ถ้า products query ล้มเหลว ให้คืนผลจาก process_steps + fg ต่อ
        console.warn('[process-steps/search] Products lookup failed. Continue with main sources only.', {
          productsDbName: PRODUCTS_DB_NAME,
          message: productsError.message
        });
      }
    }

    const normalizeRows = (rows, source) => (
      Array.isArray(rows)
        ? rows
          .filter(row => row && row.job_code)
          .map(row => ({
            job_code: String(row.job_code).trim(),
            job_name: row.job_name ? String(row.job_name).trim() : '',
            relevance_score: Number(row.relevance_score) || 3,
            source
          }))
        : []
    );

    const candidates = [
      ...normalizeRows(processStepsRows, 'process_steps'),
      ...normalizeRows(fgRows, 'fg'),
      ...normalizeRows(productRows, 'products')
    ];

    const dedupedMap = new Map();
    for (const candidate of candidates) {
      const existing = dedupedMap.get(candidate.job_code);
      if (!existing) {
        dedupedMap.set(candidate.job_code, candidate);
        continue;
      }

      const existingPriority = sourcePriority[existing.source] || 0;
      const incomingPriority = sourcePriority[candidate.source] || 0;
      const hasNameConflict =
        existing.job_name &&
        candidate.job_name &&
        existing.job_name.toLowerCase() !== candidate.job_name.toLowerCase();

      if (hasNameConflict) {
        const selectedSource = incomingPriority > existingPriority ? candidate.source : existing.source;
        console.warn('[process-steps/search] job_name conflict by job_code', {
          job_code: candidate.job_code,
          existing: {
            source: existing.source,
            job_name: existing.job_name
          },
          incoming: {
            source: candidate.source,
            job_name: candidate.job_name
          },
          selected_source: selectedSource
        });
      }

      if (incomingPriority > existingPriority) {
        dedupedMap.set(candidate.job_code, candidate);
        continue;
      }

      if (incomingPriority === existingPriority) {
        const shouldReplace =
          candidate.relevance_score < existing.relevance_score ||
          (candidate.relevance_score === existing.relevance_score &&
            candidate.job_name.length < existing.job_name.length);

        if (shouldReplace) {
          dedupedMap.set(candidate.job_code, candidate);
        }
      }
    }

    const finalResults = Array.from(dedupedMap.values())
      .sort((a, b) => {
        if (a.relevance_score !== b.relevance_score) {
          return a.relevance_score - b.relevance_score;
        }
        if (a.job_name.length !== b.job_name.length) {
          return a.job_name.length - b.job_name.length;
        }
        return a.job_code.localeCompare(b.job_code);
      })
      .slice(0, 20)
      .map(({ relevance_score, ...row }) => row);
    
    res.json({
      success: true,
      data: finalResults
    });
  } catch (error) {
    console.error('Error searching process steps:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการค้นหางานผลิต'
    });
  }
});

// GET /api/process-steps?job_code=xxxx - ดึง process steps ตาม job_code
router.get('/', async (req, res) => {
  try {
    const { job_code } = req.query;
    if (!job_code) {
      return res.status(400).json({ success: false, message: 'กรุณาระบุ job_code' });
    }
    const steps = await ProcessStep.getByJobCode(job_code);
    res.json({ success: true, data: steps });
  } catch (error) {
    console.error('Error fetching process steps by job_code:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงขั้นตอนการผลิต' });
  }
});

// GET /api/process-steps/job-codes - ดึงรายการรหัสงานทั้งหมด
router.get('/job-codes', async (req, res) => {
  try {
    const jobCodes = await ProcessStep.getJobCodes();
    
    res.json({
      success: true,
      data: jobCodes
    });
  } catch (error) {
    console.error('Error fetching job codes:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงรายการรหัสงาน'
    });
  }
});

module.exports = router; 