import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// 数据库连接配置
const dbConfig = {
  host: process.env.mysql_host || '47.107.151.172',
  port: parseInt(process.env.mysql_port || '9030'),
  user: process.env.mysql_user || 'yihang',
  password: process.env.mysql_password || '@yihang888',
  database: process.env.mysql_database || 'ai_db',
};

const pool = mysql.createPool(dbConfig);

// 1. 获取商品列表 (POST /api/products/list)
app.post('/api/products/list', async (req, res) => {
  try {
    const { 
      page = 1, 
      page_size = 20, 
      keyword, 
      filters = {}, 
      sort_by = 'release_date', 
      sort_order = 'desc' 
    } = req.body;

    const limit = Math.min(Number(page_size), 100);
    const offset = (Number(page) - 1) * limit;
    
    let query = 'SELECT * FROM ai_product_app_v1';
    let countQuery = 'SELECT COUNT(*) as total FROM ai_product_app_v1';
    const params = [];
    const whereConditions = [];

    // 关键词搜索
    if (keyword) {
      whereConditions.push('(name LIKE ? OR code LIKE ?)');
      const searchStr = `%${keyword}%`;
      params.push(searchStr, searchStr);
    }

    // 过滤器处理
    if (filters && typeof filters === 'object') {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (key === 'weight' && typeof value === 'string' && value.includes('-')) {
            const [min, max] = value.split('-').map(Number);
            whereConditions.push('weight BETWEEN ? AND ?');
            params.push(min, max);
          } else {
            whereConditions.push(`\`${key}\` LIKE ?`);
            params.push(`%${value}%`);
          }
        }
      });
    }

    if (whereConditions.length > 0) {
      const whereClause = ' WHERE ' + whereConditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    // 排序
    const validSortOrder = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    query += ` ORDER BY \`${sort_by}\` ${validSortOrder} LIMIT ? OFFSET ?`;
    
    const [rows] = await pool.execute(query, [...params, String(limit), String(offset)]);
    const [totalRows] = await pool.execute(countQuery, params);

    const total = totalRows[0].total;
    const total_pages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: {
        list: rows,
        pagination: {
          page: Number(page),
          page_size: limit,
          total: total,
          total_pages: total_pages
        }
      }
    });
  } catch (error) {
    console.error('Fetch products error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. 商品编辑 (PUT /api/products/:code)
app.put('/api/products/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const updates = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Missing product code' });
    }

    const keys = Object.keys(updates).filter(key => key !== 'code');
    if (keys.length === 0) {
      return res.json({ success: true, message: 'No updates provided' });
    }

    const setClause = keys.map(key => `\`${key}\` = ?`).join(', ');
    const values = keys.map(key => updates[key]);
    
    const query = `UPDATE ai_product_app_v1 SET ${setClause} WHERE code = ?`;
    await pool.execute(query, [...values, code]);

    res.json({ success: true, message: 'Update successful' });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

const PORT = process.env.ADMIN_API_PORT || 8013;
app.listen(PORT, () => {
  console.log(`Admin API server running on port ${PORT}`);
});
