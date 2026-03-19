<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a7049ed6" />
</div>

# 销售助手 - AI智能商品推荐系统

基于 AI 技术的纺织面料销售助手，支持自然语言搜索商品、智能推荐、素材查询等功能。

## 项目概述

销售助手是一个面向纺织面料行业的 AI 智能推荐系统，通过自然语言处理技术，帮助销售人员快速查找和推荐合适的面料产品。系统集成了 N8N 工作流、前端 React 应用和后端 Python FastAPI 服务。

## 功能特性

### 🤖 AI 智能对话
- 自然语言商品搜索（如"200克左右的纯棉面料"）
- 智能意图识别和参数提取
- 多轮对话支持，可追问和筛选
- 流式响应，实时显示处理步骤

### 📦 商品管理
- 商品详情查看（规格、价格、图片、证书）
- 图片轮播和缩放预览
- PDF 检测报告在线预览
- 商品分组展示和列表查看

### 🎨 素材查询
- 支持关键词搜索素材图片
-  AND/OR 逻辑组合查询（如"6228+样衣图"）
- 图片缩略图和全屏预览

### ⚙️ 搜索偏好配置
- 每组推荐商品数量设置（3-7个）
- 商品类型筛选（2/3/6/7/9系列）
- 搜索模式选择（精准/推理）

### 👤 企业微信集成
- 自动获取企业微信用户信息
- 支持多企业主体登录（rc/rs）
- 用户身份识别和权限管理

### 📝 管理后台
- **问答记录**：查看用户与AI的对话历史
- **反馈记录**：收集用户对推荐结果的反馈
- **商品管理**：编辑商品属性、批量筛选
- **规则录入**：配置AI Agent的提示词规则

## 技术架构

### 前端技术栈
- **框架**: React 19 + TypeScript
- **构建工具**: Vite 6
- **样式**: Tailwind CSS 4
- **路由**: React Router DOM 7
- **图标**: Lucide React
- **PDF预览**: react-pdf
- **Markdown**: react-markdown

### 后端技术栈
- **框架**: FastAPI (Python)
- **数据库**: MySQL/StarRocks (通过 PyMySQL)
- **连接池**: dbutils PooledDB
- **认证**: 企业微信 OAuth
- **缓存**: 内存缓存（SimpleCache）

### N8N 工作流
- **AI Agent**: 销售助手智能体
- **Webhook**: 接收前端对话请求
- **工具调用**: 产品搜索、素材查询
- **工作流文件**: `销售助手n8n.json`

## 项目结构

```
├── src/                          # 前端源码
│   ├── App.tsx                   # 主应用组件（聊天界面）
│   ├── main.tsx                  # 入口文件
│   ├── index.css                 # 全局样式
│   ├── db.ts                     # 数据库类型定义
│   ├── components/               # 组件目录
│   │   └── ProductList.tsx       # 商品列表组件
│   └── pages/                    # 页面目录
│       ├── ProductDetailPage.tsx # 商品详情页
│       ├── ProductListPage.tsx   # 商品列表页
│       └── AdminPage.tsx         # 管理后台
├── backend/                      # 后端源码
│   ├── api_server.py             # FastAPI 主服务
│   ├── WeChat.py                 # 企业微信认证
│   ├── requirements.txt          # Python 依赖
│   └── up_api.sh                 # 启动脚本
├── dist/                         # 构建输出目录
├── 销售助手n8n.json              # N8N 工作流配置
├── package.json                  # Node 依赖
├── vite.config.ts                # Vite 配置
├── tsconfig.json                 # TypeScript 配置
└── .env                          # 环境变量
```

## 部署教程

### 环境要求
- Node.js 18+
- Python 3.9+
- MySQL/StarRocks 数据库
- N8N 工作流引擎（可选）

### 1. 前端部署

```bash
# 安装依赖
npm install

# 开发环境运行
npm run dev

# 生产构建
npm run build
```

### 2. 后端部署

```bash
# 进入后端目录
cd backend

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# 或 venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt

# 启动服务
python api_server.py
# 或使用脚本
bash up_api.sh
```

### 3. 环境变量配置

创建 `.env` 文件：

```env
# 数据库配置
mysql_host=your_db_host
mysql_port=9030
mysql_user=your_username
mysql_password=your_password
mysql_database=ai_db

# 图片基础URL
IMAGE_BASE_URL=https://your-image-domain.com

# API URL（前端使用）
VITE_API_URL=https://your-api-domain.com

# 企业微信配置（可选）
WECHAT_CORP_ID=your_corp_id
WECHAT_AGENT_ID=your_agent_id
WECHAT_SECRET=your_secret
```

### 4. Nginx 配置示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    # 前端静态文件
    location / {
        root /www/wwwroot/sale/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # 后端 API 代理
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 后端接口文档

### 1. 商品搜索
```
POST /api/product_search
```

请求示例：
```json
{
  "tool_call": [
    {
      "code": "6228",
      "elem": "棉",
      "weight": "200-250"
    }
  ],
  "codeStart": ["6", "7", "9"],
  "topN": 3
}
```

响应示例：
```json
{
  "title": "商品推荐",
  "query": {"款号": "6228", "成分": "棉"},
  "total": 15,
  "list": [
    {
      "code": "6228A",
      "name": "纯棉针织面料",
      "weight": 220,
      "price": 45.5,
      "image_urls": ["image1.jpg", "image2.jpg"]
    }
  ]
}
```

### 2. 商品详情
```
GET /api/get_product_detail?code={code}
```

响应示例：
```json
{
  "success": true,
  "data": {
    "basic": {"code": "6228", "name": "..."},
    "specs": {"weight": 220, "width": "180cm", ...},
    "price": {"taxmprice": 45.5, ...}
  }
}
```

### 3. 素材查询
```
POST /api/search_source
```

请求示例：
```json
{
  "keywords": "6228+样衣图",
  "type": "image"
}
```

### 4. 用户认证
```
GET /api/wechat/auth_url?login_type=rc
GET /api/wechat_login?code={code}&type={type}
GET /api/get_user_info?user_id={user_id}
```

### 5. 反馈记录
```
POST /api/ai_agent_feedback
GET /api/ai_agent_feedbacks?page=1&page_size=20
```

### 6. 问答记录
```
POST /api/save_chat_record
GET /api/chat_records?page=1&page_size=20
```

## N8N 工作流配置

### 导入工作流

1. 打开 N8N 控制台
2. 选择 "Workflow" → "Import from File"
3. 上传 `销售助手n8n.json` 文件
4. 配置 Webhook URL 和环境变量

### 工作流节点说明

1. **Webhook 节点**: 接收前端对话请求
2. **AI Agent 节点**: 处理自然语言理解
3. **工具调用节点**:
   - `product_search`: 商品搜索
   - `search_source`: 素材查询
4. **代码节点**: 数据格式转换和过滤

## 搜索语法

### 商品搜索
- **成分筛选**: `棉`, `棉+氨纶`, `棉/涤纶`
- **规格范围**: `weight: 200-250`, `price: <50`
- **款号查询**: `code: 6228`, `code: 6228A`
- **组合条件**: `棉+氨纶 weight:200-250`

### 素材搜索
- **AND 查询**: `6228+样衣图`（同时包含两个关键词）
- **OR 查询**: `关键词1/关键词2`（满足任一关键词）
- **混合查询**: `6228+样衣图/色卡`

## 数据库表结构

### ai_product_app_v1（商品主表）
- `code`: 款号（主键）
- `name`: 品名
- `elem`: 成分
- `weight`: 克重
- `width`: 幅宽
- `price`: 价格
- `image_urls`: 图片URL列表
- `report_urls`: 检测报告URL列表
- 更多字段...

### ai_source_app_v1（素材表）
- `name`: 素材名称（关联款号）
- `file_type`: 文件类型（image/pdf/video）
- `pic_url`: 图片URL
- `tags`: 标签

### ai_agent_feedback（反馈表）
- `agent`: 智能体标识
- `people`: 用户ID
- `question`: 用户问题
- `feedbackContent`: 反馈内容
- `productData`: 推荐商品数据

### ai_chat_record（问答记录表）
- `agent`: 智能体标识
- `people`: 用户ID
- `question`: 问题
- `answer`: 回答
- `chattime`: 对话时间

## 开发指南

### 前端开发
```bash
# 启动开发服务器
npm run dev

# TypeScript 检查
npm run lint
```

### 后端开发
```bash
# 进入后端目录
cd backend

# 启动开发服务器（热重载）
uvicorn api_server:app --reload --port 8000
```

### 添加新字段

1. 在 `backend/api_server.py` 的 `FIELD_MAPPING` 中添加字段映射
2. 在 `DEFAULT_RETURN_FIELDS` 中配置默认返回字段
3. 前端 `Product` 类型定义中添加对应字段

## 常见问题

### Q: 企业微信登录失败？
A: 检查以下配置：
- 确认 `WECHAT_CORP_ID`、`WECHAT_AGENT_ID`、`WECHAT_SECRET` 正确
- 确认域名已添加到企业微信应用的可信域名
- 检查登录类型参数（rc/rs）

### Q: 图片无法显示？
A: 
- 检查 `IMAGE_BASE_URL` 环境变量配置
- 确认图片URL格式正确（支持 `名称:URL` 格式）
- 检查图片域名 CORS 设置

### Q: 搜索结果不准确？
A:
- 检查 AI Agent 的提示词配置
- 确认数据库索引已创建
- 调整搜索偏好的商品类型设置

## 更新日志

### v1.0.0
- ✨ 初始版本发布
- 🤖 AI 智能对话功能
- 📦 商品搜索和详情查看
- 🎨 素材查询功能
- 👤 企业微信登录集成
- 📝 管理后台功能

## License

MIT License

## 联系方式

如有问题或建议，请提交 Issue 或联系项目维护者。
