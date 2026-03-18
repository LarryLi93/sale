// 数据库模块 - 用于服务端API
// 注意：此文件需要在服务端运行，使用mysql2连接Doris

import * as path from 'path';
import * as fs from 'fs';

// 读取.env文件
const envPath = path.resolve(process.cwd(), '.env');
let envContent = '';
try {
  envContent = fs.readFileSync(envPath, 'utf-8');
} catch (e) {
  console.log('No .env file found');
}

const envLines = envContent.split('\n').filter(line => line.trim());

export const DB_HOST = envLines[0]?.trim() || 'localhost';
export const DB_PORT = envLines[1]?.trim() || '9030';
export const DB_USER = envLines[2]?.trim() || 'root';
export const DB_PASSWORD = envLines[3]?.trim() || '';
export const DB_NAME = envLines[4]?.trim() || 'ai_db';

// 初始化反馈表的SQL语句
export const CREATE_FEEDBACK_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ai_agent_feedback (
  id BIGINT NOT NULL AUTO_INCREMENT,
  session_id VARCHAR(255) NOT NULL COMMENT '会话ID',
  message_id VARCHAR(255) NOT NULL COMMENT '消息ID',
  question TEXT COMMENT '用户问题',
  product_data JSON COMMENT '商品数据',
  feedback_content TEXT NOT NULL COMMENT '反馈内容',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
) ENGINE=OLAP
UNIQUE KEY(id)
DISTRIBUTED BY HASH(id) BUCKETS 10
PROPERTIES ("replication_num" = "1")
`;

// 备用MySQL语法
export const CREATE_FEEDBACK_TABLE_SQL_MYSQL = `
CREATE TABLE IF NOT EXISTS ai_agent_feedback (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  message_id VARCHAR(255) NOT NULL,
  question TEXT,
  product_data JSON,
  feedback_content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_session_id (session_id),
  INDEX idx_message_id (message_id),
  INDEX idx_created_at (created_at)
)
`;

// 反馈数据类型
export interface FeedbackData {
  sessionId: string;
  messageId: string;
  question: string;
  productData: any;
  feedbackContent: string;
}
