import re
import pymysql
import datetime
import asyncio
import logging
import json
import time
import hashlib
from functools import lru_cache
from dbutils.pooled_db import PooledDB
from decimal import Decimal
from fastapi import FastAPI, Query, Body, Path, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from typing import Any, List, Dict, Optional

# 企业微信登陆
from WeChat import WeChat
wechat = None

import os
from dotenv import load_dotenv

# 加载根目录的 .env 文件
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(env_path)

# --- 简单内存缓存 ---
class SimpleCache:
    def __init__(self, default_ttl=60):
        self.cache = {}
        self.default_ttl = default_ttl
    
    def get(self, key):
        if key in self.cache:
            value, expire_time = self.cache[key]
            if time.time() < expire_time:
                return value
            else:
                del self.cache[key]
        return None
    
    def set(self, key, value, ttl=None):
        expire_time = time.time() + (ttl or self.default_ttl)
        self.cache[key] = (value, expire_time)
    
    def clear(self):
        self.cache.clear()

# 全局缓存实例
cache = SimpleCache(default_ttl=30)  # 默认30秒缓存

# --- 日志配置 ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("query.log", encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
from typing import Dict, Any, Optional, List, Tuple, Union
from fastapi import FastAPI, HTTPException, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
import uvicorn
from pydantic import BaseModel, Field, ConfigDict

app = FastAPI(title="Fabric Search API", description="纺织面料产品搜索服务")

# --- 跨域配置 ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有域名，生产环境建议指定具体域名
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有 HTTP 方法
    allow_headers=["*"],  # 允许所有请求头
)

# --- 数据库配置 ---
DB_CONFIG = {
    'host': os.getenv('mysql_host', '47.107.151.172'), 
    'port': int(os.getenv('mysql_port', 9030)),
    'user': os.getenv('mysql_user', 'yihang'), 
    'password': os.getenv('mysql_password', '@yihang888'),
    'db': os.getenv('mysql_database', 'ai_db'), 
    'cursorclass': pymysql.cursors.DictCursor,
    'charset': 'utf8mb4',
    'connect_timeout': 10,      # 连接超时10秒
    'read_timeout': 30,         # 读超时30秒
    'write_timeout': 30,        # 写超时30秒
    'autocommit': True          # 自动提交
}

# 初始化连接池 - 优化配置
pool = PooledDB(
    creator=pymysql,
    mincached=5,     # 初始化时，连接池中至少创建的空闲连接数（降低启动负担）
    maxcached=20,    # 连接池中最多闲置的连接数
    maxshared=10,    # 共享连接数
    maxconnections=50, # 连接池允许的最大连接数
    blocking=True,   # 连接池中如果没有可用连接后，是否阻塞等待
    maxusage=None,   # 单个连接最大使用次数，None表示不限制
    setsession=[],   # 会话设置
    ping=1,          # 每次获取连接时ping，确保连接有效
    **DB_CONFIG
)

def get_db_connection():
    return pool.connection()

def parse_code_start(value):
    """解析 codeStart 参数，支持字符串形式的 JSON 数组"""
    if value is None:
        return None
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        value = value.strip()
        if value.startswith('[') and value.endswith(']'):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                pass
        return value
    return value

# --- 字段定义 ---
# 默认返回字段
DEFAULT_RETURN_FIELDS = [
    'code', 'name', 'weight', 'width', 'taxkgprice', 'price', 'taxmprice', 'fewprice',
    'elem', 'inelem', 'fabric_structure_two', 'fabric_erp', 'emptyqty', 'papertubeqty', 'type_notes',
    'image_urls', 'report_urls', 'code_start', 'customizable_grade',
    'series', 'release_date','sale_num_year', 'production_process',
    'fun', 'silhouette', 'touch', 'dressing_occasion', 'applicable_crowd', 'style', 'season_marking'
]

# 字段名映射表 (中英文对照) - 仅供参考或特殊需求，目前主要返回英文键名
FIELD_MAPPING = {
    'code': 'code',
    'name': 'name',
    'ename': 'ename',
    'elem': 'elem',
    'inelem': 'inelem',
    'yarncount': 'yarncount',
    'weight': 'weight',
    'width': 'width',
    'twist': 'twist',
    'swzoomin': 'swzoomin',
    'shzoomin': 'shzoomin',
    'sph': 'sph',
    'unitqty': 'unitqty',
    'fewprice': 'fewprice',
    'unitid': 'unitid',
    'unitrate': 'unitrate',
    'fewunitid': 'fewunitid',
    'fewunitrate': 'fewunitrate',
    'emptyqty': 'emptyqty',
    'papertubeqty': 'papertubeqty',
    'makedate': 'makedate',
    'colorfastnotes': 'colorfastnotes',
    'unpilling': 'unpilling',
    'whitefiber': 'whitefiber',
    'wetrubfast': 'wetrubfast',
    'ldensity': 'ldensity',
    'hdensity': 'hdensity',
    'devproid': 'devproid',
    'category': 'category',
    'propinnum': 'propinnum',
    'dnumber': 'dnumber',
    'spinntype': 'spinntype',
    'foreignname': 'foreignname',
    'glosscommid': 'glosscommid',
    'price': 'price',
    'fiber_type': 'fiber_type',
    'yarn_type': 'yarn_type',
    'production_process': 'production_process',
    'quality_level': 'quality_level',
    'devtype': 'devtype',
    'notice': 'notice',
    'ennotice': 'ennotice',
    'introduce': 'introduce',
    'eintroduce': 'eintroduce',
    'dyeing_process': 'dyeing_process',
    'customizable_grade': 'customizable_grade',
    'season_new': 'season_new',
    'fabric_structure': 'fabric_structure',
    'has_rib': 'has_rib',
    'dyemethod': 'dyemethod',
    'className': 'className',
    'slogan': 'slogan',
    'fun_level': 'fun_level',
    'type_notes': 'type_notes',
    'stock_qty': 'stock_qty',
    'image_urls': 'image_urls',
    'makedate_year': 'makedate_year',
    'makedate_month': 'makedate_month',
    'code_start': 'code_start',
    'fabric_structure_two': 'fabric_structure_two',
    'fabric_erp': 'fabric_erp',
    'report_urls': 'report_urls',
    'release_date': 'release_date',
    'mprice': 'mprice',
    'yprice': 'yprice',
    'kgprice': 'kgprice',
    'taxmprice': 'taxmprice',
    'taxyprice': 'taxyprice', 
    'taxkgprice': 'taxkgprice',
    'sale_num_year': 'sale_num_year',
    'spring_color_fastness': 'spring_color_fastness',
    'dry_rubbing_fastness': 'dry_rubbing_fastness',
    'light_fastness': 'light_fastness',
    'fabe': 'fabe',
    'color_name': 'color_name',
    'series': 'series',
    'applicable_crowd': 'applicable_crowd',
    'fun': 'fun',
    'silhouette': 'silhouette',
    'touch': 'touch',
    'dressing_occasion': 'dressing_occasion',
    'style': 'style',
    'season_marking': 'season_marking'
}

DETAIL_CATEGORIES = {
    "basic": [
        "code", "name", "ename", "series", "release_date", "makedate_year", 
        "makedate_month", "devproid", "image_urls", "report_urls", "code_start"
    ],
    "specs": [
        "elem", "inelem", "yarncount", "dnumber", "weight", "width", 
        "ldensity", "hdensity", "propinnum", "fiber_type", "yarn_type", 
        "spinntype", "glosscommid", "fabric_structure_two", "fabric_erp", "fabric_structure", 
        "className", "has_rib"
    ],
    "quality": [
        "twist", "swzoomin", "shzoomin", "sph", "unpilling", "whitefiber", 
        "wetrubfast", "dry_rubbing_fastness", "spring_color_fastness", 
        "light_fastness", "quality_level", "customizable_grade", "fun_level", 
        "colorfastnotes"
    ],
    "process": [
        "production_process", "devtype", "dyemethod", "dyeing_process", 
        "category", "foreignname"
    ],
    "price": [
        "price", "unitid", "fewprice", "fewunitid", "fewunitrate", "mprice", 
        "yprice", "kgprice", "taxmprice", "taxyprice", "taxkgprice", 
        "unitqty", "emptyqty", "papertubeqty", "unitrate"
    ],
    "operation": [
        "type_notes", "stock_qty", "sale_num_year", "season_new", "fabe", 
        "notice", "ennotice", "introduce", "eintroduce", "slogan"
    ]
}

# 数值字段（允许范围查询）
NUMERIC_FIELDS = {
    'weight', 'width', 'price', 'taxkgprice', 'taxmprice', 'fewprice', 
    'emptyqty', 'papertubeqty', 'stock_qty', 'sale_num_year'
}

# 严格文本字段（不允许模糊匹配）
STRICT_TEXT_FIELDS = {
    'code', 'name', 'fabric_structure_two', 'fabric_erp', 'inelem', 'code_start',
    'devproid', 'customizable_grade',
    'spring_color_fastness', 'light_fastness', 'dry_rubbing_fastness',
    'image_urls', 'report_urls', 'type_notes', 
    'release_date','sale_num_year', 'series',
    'unpilling', 'ldensity', 'hdensity', 'propinnum', 'dnumber',
    'color_name', 'applicable_crowd',
    'category', 'dressing_occasion'
}

# 硬指标字段有效值定义
HARD_CODED_FIELDS = {
    'season_marking': {'春', '夏', '秋', '冬'},
    'season': {'春', '夏', '秋', '冬'},
    'fun': {'保暖', '凉感', '环保', '抗菌', '抗静电', '美颜', '抗皱', '抗起球', '拒水拒油', '吸湿排汗', 
            '防水防油', '防蚊', '芳香', '防晒', '防臭', '速干',
            # 带(定制)后缀的变体
            '水盾(定制)', '掩盖湿痕(定制)', '拒水(定制)', '拒油(定制)', '抗菌(定制)',
            '排汗(定制)', '导湿(定制)', '快干(定制)', '吸湿(定制)'},
    # 功能字段的映射关系（用于验证时统一处理）
    'fun_mapping': {
        '水盾': '水盾(定制)', '掩盖湿痕': '掩盖湿痕(定制)', '拒水': '拒水(定制)',
        '拒油': '拒油(定制)', '抗菌': '抗菌(定制)', '排汗': '排汗(定制)',
        '导湿': '导湿(定制)', '快干': '快干(定制)', '吸湿': '吸湿(定制)'
    },
    'silhouette': {'垂坠', '挺括', '塑形'},
    'touch': {'蓬松', '干爽', '丝滑', '爽滑', 'Q弹'},
    'dressing_occasion': {'打底', '时尚女装', '卫衣', 'T恤', '保暖内衣', '家居服', '裤料', '运动内衣', 
                          '瑜伽服', '连衣裙', '小件', '无尺码自由裁', '传统内衣', '骑行', '运动', 
                          '轻运动', '运动外套', '套装', '内衣', '半裙', '中间层', '外穿层'},
    'applicable_crowd': {'女款', '男款', '通用', '童装'},
    'style': {'休闲', '打底', '百搭', '淑女', '运动', '潮牌', '时尚', '商务', '正装'},
    'elem': {'人棉', '人棉（RC）', '人棉（粘胶纤维）', '棉', '棉（棉花）', '桑蚕丝', '桑蚕丝（真丝）', 
             '亚麻', '亚麻（麻）', '绵羊毛', '绵羊毛（羊毛）', '氨纶', '氨纶（莱卡）', '腈纶', 
             '腈纶（人造羊毛）', '腈纶（ACR）', '莱赛尔', '莱赛尔（天丝）', '聚酯纤维', '聚酯纤维（涤纶）', 
             '聚酰胺纤维', '聚酰胺纤维（尼龙）', '莫代尔', '粘纤', '粘纤（人造棉）', '强捻', '高捻', 
             'S捻', 'Z捻', '国产莱赛尔', '兰精天丝', '锦纶'},
    'fabric_structure_two': {'平纹', '平纹（平针织）', '珠地', '珠地（菠罗布）', '罗纹', '罗纹（坑条布）', 
                             '罗纹（1x1拉架）', '罗纹（2x2拉架）', '罗纹（拉架）', '盖丝', '健康布', 
                             '健康布（三明治网眼布）', '提花', '抽针', '抽针（挑孔）', '打鸡', '打鸡（打鸡布）', 
                             '双层', '抓绒', '抓绒（卫衣布）', '毛巾布', '空气层', '空气层（三明治）', 
                             '空气绒', '阶梯', '阶梯（楼梯布）', '肌理', '肌理（纹理布）'},
    'production_process': {'抓毛', '碱缩', '丝光', '食毛', '烧毛', '砂洗', '磨毛', '刷毛'},
    'series': {'天丝羊毛', '天丝麻', '羊毛', '羊绒', '慕斯绒', '麻', '棉麻', '新麻', '棉涤', '涤棉', 
               'ACR/RAC', 'RC', 'TC', '混纺', '纯纺', '棉捻', '棉莫', '棉莱', '棉混纺', '桑蚕丝', 
               '棉天丝', '莫代尔'}
}

# 软指标字段（模糊匹配）
SOFT_FIELDS = {'fabe', 'introduce'}
SIMPLE_SQL_TEXT_FIELDS = ['code', 'name', 'code_start']

# 查询参数字段中文映射
QUERY_PARAM_CN_MAPPING = {
    'sort': '排序',
    'sort_by': '排序',
    'fields': '返回字段',
    'name': '品名',
    'code': '款号',
    'weight': '克重',
    'width': '幅宽',
    'price': '大货价',
    'taxkgprice': '含税公斤价',
    'kgprice': '净布价',
    'taxmprice': '含税米价',
    'fewprice': '散剪价',
    'className': '布种',
    'elem': '成分',
    'inelem': '纱支',
    'series': '产品线',
    'emptyqty': '空差',
    'papertubeqty': '纸筒',
    'type_name': '运营分类',
    'season': '季节',
    'stock_qty': '库存',
    'image_urls': '色卡',
    'color_name': '颜色',
    'fabe': '销售话术',
    'devproid': '开发款号',
    'unpilling': '抗起毛起球',
    'spring_color_fastness': '搅浮色牢度',
    'light_fastness': '耐光色牢度',
    'dry_rubbing_fastness': '干摩擦牢度',
    'sale_num_year': '近一年销量',
    'report_urls': '检测报告',
    'customizable_grade': '可订等级',
    'release_date': '上架日期',
    'fabric_structure_two': '布种',
    'fabric_erp': 'ERP布种',
    'production_process': '工艺',
    'fun': '功能',
    'silhouette': '廓形',
    'touch': '手感',
    'dressing_occasion': '品类/用途',
    'applicable_crowd': '适用人群',
    'style': '风格',
    'season_marking': '季节',
    'code_start': '商品类型',
    'type_notes': '类型备注',
    'mode': '模式',
    'limit': '数量'
}

# --- Pydantic 模型 ---
class ProductSearchRequest(BaseModel):
    limit: int = Field(1000, description="返回条数限制")
    sort_by: Optional[str] = Field(None, description="排序字段")
    fields: List[str] = Field(default_factory=lambda: DEFAULT_RETURN_FIELDS, description="需要返回的字段列表")
    
    model_config = ConfigDict(extra="allow") 

def ensure_image_url(img_item: str) -> str:
    """确保图片 URL 有域名，如果没有则拼接默认域名
    
    支持格式:
    - 纯 URL: /path/to/img.jpg 或 path/to/img.jpg 或 https://xxx/img.jpg
    - 带名称: 名称.jpg:https://xxx/img.jpg 或 名称.jpg:/path/to/img.jpg
    """
    if not img_item:
        return img_item
    
    # 从环境变量获取图片基础URL，默认为 https://lobe.wyoooni.net
    image_base_url = os.getenv('IMAGE_BASE_URL', 'https://lobe.wyoooni.net')
    
    img_item = str(img_item).strip()
    
    # 检查是否是 "名称:URL" 格式
    if ':' in img_item and not img_item.startswith('http'):
        # 分割名称和 URL，只分割第一个 ':'
        parts = img_item.split(':', 1)
        if len(parts) == 2:
            name, url = parts
            # 如果 URL 部分不以 http 开头，说明需要拼接域名
            if not url.startswith('http://') and not url.startswith('https://'):
                if url.startswith('/'):
                    url = f"{image_base_url}{url}"
                else:
                    url = f"{image_base_url}/{url}"
            return f"{name}:{url}"
    
    # 纯 URL 格式
    if img_item.startswith('http://') or img_item.startswith('https://'):
        return img_item
    
    # 没有域名，拼接默认域名
    if img_item.startswith('/'):
        return f"{image_base_url}{img_item}"
    else:
        return f"{image_base_url}/{img_item}"

def serialize_row(row: Dict) -> Dict:
    """清洗数据：Decimal -> float, Date -> str, 处理 URL 列表"""
    new_row = {}
    for k, v in row.items():
        if isinstance(v, Decimal):
            new_row[k] = float(v)
        elif isinstance(v, (datetime.date, datetime.datetime)):
            new_row[k] = str(v)
        elif isinstance(v, bytes):
            new_row[k] = v.decode('utf-8', errors='ignore')
        elif k in ('image_urls', 'report_urls'):
            # 处理 URL 列表（支持字符串和列表格式）
            items = []
            if isinstance(v, str) and v:
                items = [item.strip() for item in v.split(',') if item.strip()]
            elif isinstance(v, list):
                items = v
            
            if k == 'image_urls':
                # 再次确保图片列表中只有图片类型，过滤掉 PDF 等
                IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp')
                final_imgs = []
                for item in items:
                    clean_item = str(item).strip().replace('`', '')
                    path_part = clean_item.split(':')[-1].split('?')[0].lower()
                    if any(path_part.endswith(ext) for ext in IMAGE_EXTS):
                        # 确保图片 URL 有域名
                        final_imgs.append(ensure_image_url(clean_item))
                    elif path_part.endswith('.pdf'):
                        continue
                    else:
                        # 兜底：其他未知类型暂留，并确保有域名
                        final_imgs.append(ensure_image_url(clean_item))
                
                # 图片字段根据数量返回字符串或列表
                if not final_imgs:
                    new_row[k] = []
                else:
                    new_row[k] = final_imgs if len(final_imgs) > 1 else final_imgs[0]
            else:
                # 报告字段统一返回列表
                new_row[k] = items
        else:
            new_row[k] = v
    return new_row

def build_numeric_sql(column, query_str):
    if not query_str: return None
    clean_str = re.sub(r'[^\d\.\-<>=]', '', str(query_str))
    range_match = re.match(r'^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$', clean_str)
    if range_match: return f"{column} BETWEEN {range_match.group(1)} AND {range_match.group(2)}"
    compare_match = re.match(r'^(>=|<=|>|<|=)(\d+(?:\.\d+)?)$', clean_str)
    if compare_match: return f"{column} {compare_match.group(1)} {compare_match.group(2)}"
    return None

def build_elem_sql_filter(query_str):
    """
    针对 elem 字段生成 SQL 粗筛条件 (LIKE)
    逻辑：
    1. 提取所有中文/英文成分名 (忽略数字和符号)
    2. 如果含 '/' (OR关系)，SQL 用 OR 连接
    3. 否则 (AND关系)，SQL 用 AND 连接
    返回: (sql_clause, params)
    """
    if not query_str: return None, []
    
    # 提取关键词，例如 "棉>95%" -> ["棉"]
    keywords = re.findall(r'[\u4e00-\u9fa5a-zA-Z]+', str(query_str))
    if not keywords: return None, []
    
    conditions = []
    params = []
    for kw in keywords:
        conditions.append("elem LIKE %s")
        params.append(f"%{kw}%")
    
    if '/' in query_str:
        # 或关系：(elem LIKE %s OR elem LIKE %s)
        return f"({' OR '.join(conditions)})", params
    else:
        # 且关系：elem LIKE %s AND elem LIKE %s
        return " AND ".join(conditions), params

def build_text_sql_filter(column, query_val):
    """
    针对文本字段生成 SQL 过滤条件
    支持: 
    1. 字符串 (含 / 和 +)
    2. 列表 (转为 IN 或 OR 处理)
    对 inelem 字段特殊处理，直接精确匹配（因为其值可能包含 / 和 + 字符）
    返回: (sql_clause, params)
    """
    if not query_val: return None, []
    
    # 特殊处理列表格式
    if isinstance(query_val, list):
        if not query_val: return None, []
        # 对于 code_start 或精确匹配字段，使用 IN 提高性能
        if column == 'code_start':
            placeholders = ", ".join(["%s"] * len(query_val))
            return f"{column} IN ({placeholders})", [str(i) for i in query_val]
        # inelem 字段列表格式也转为 OR 逻辑，但每个值保持完整
        if column == 'inelem':
            clauses = [f"{column} LIKE %s" for _ in query_val]
            params = [f"%{str(v)}%" for v in query_val]
            return f"({' OR '.join(clauses)})", params
        # 其他字段转为 OR 逻辑
        query_val = "/".join(str(i) for i in query_val)
    
    val = str(query_val).strip()
    if not val: return None, []
    
    # inelem 字段特殊处理：其值可能包含 / 和 +（如"40SRAC40/30/30紧赛纺 94.2%+40D双染氨纶"）
    # 不对其进行逻辑解析，直接使用 LIKE 模糊匹配
    if column == 'inelem':
        return f"{column} LIKE %s", [f"%{val}%"]

    # 简单的单个词 (无 /、+ 和 ,)
    if '/' not in val and '+' not in val and ',' not in val:
        if column == 'code':
            # 款号改回模糊匹配，以支持如 6228 和 6228A 等关联查询
            param = val if '%' in val else f"%{val}%"
            return f"{column} LIKE %s", [param]
        elif column == 'code_start':
            # code_start 依然保持精确匹配以保证性能
            return f"{column} = %s", [val]
        
        param = val if '%' in val else f"%{val}%"
        return f"{column} LIKE %s", [param]
    
    # 处理 OR 逻辑 (/)
    if '/' in val and '+' not in val:
        parts = [p.strip() for p in val.split('/') if p.strip()]
        if not parts: return None, []
        
        if column == 'code_start':
            # code_start 在 OR 逻辑下也应保持精确匹配
            placeholders = ", ".join(["%s"] * len(parts))
            return f"{column} IN ({placeholders})", parts
            
        clauses = [f"{column} LIKE %s" for _ in parts]
        params = [p if '%' in p else f"%{p}%" for p in parts]
        return f"({' OR '.join(clauses)})", params

    # 处理 AND 逻辑 (+ 或 ,)
    if ('+' in val or ',' in val) and '/' not in val:
        parts = [p.strip() for p in re.split(r'[+,]', val) if p.strip()]
        if not parts: return None, []
        clauses = [f"{column} LIKE %s" for _ in parts]
        params = [p if '%' in p else f"%{p}%" for p in parts]
        return " AND ".join(clauses), params

    # 复杂逻辑 (既有 / 又有 +) 暂时只在 SQL 层做部分过滤或跳过
    return None, []

def check_text_logic(target_text, query_str, column=None):
    """
    检查目标文本是否匹配查询逻辑
    支持: OR (/) 和 AND (+) 逻辑
    对 inelem 字段特殊处理，直接子串匹配（因为其值可能包含 / 和 + 字符）
    """
    if not query_str: return True
    
    target_text = str(target_text or "").lower()
    
    # inelem 字段特殊处理：直接子串匹配，不解析 / 和 + 逻辑
    if column == 'inelem':
        if isinstance(query_str, list):
            # 列表格式：任一匹配即可（OR 逻辑）
            return any(str(q).lower().strip() in target_text for q in query_str if q)
        else:
            # 字符串格式：直接子串匹配
            return str(query_str).lower().strip() in target_text
    
    # 处理列表格式，默认转为 OR 逻辑
    if isinstance(query_str, list):
        query_str = "/".join(str(i) for i in query_str)
        
    query_str = str(query_str).lower()
    for group in query_str.split('/'):
        # 同时支持 + 、 , 和 中文逗号 、 作为 AND 逻辑
        if all(cond.strip() in target_text for cond in re.split(r'[+,，、]', group) if cond.strip()):
            return True
    return False

def validate_hard_coded_field(field_name, value):
    """
    验证硬指标字段值是否在允许范围内
    支持单个值或列表值（列表内为 OR 关系）
    对 elem 字段特殊处理，支持复杂查询语法如 "棉 + 氨纶"、"棉 > 50%" 等
    返回: (is_valid, normalized_value, error_message)
    """
    if not value:
        return True, value, None
    
    valid_values = HARD_CODED_FIELDS.get(field_name)
    if not valid_values:
        return True, value, None  # 非硬指标字段，不验证
    
    # 对 elem 字段特殊处理，支持复杂查询语法
    if field_name == 'elem':
        return validate_elem_field(value, valid_values)
    
    # 处理字符串格式，支持 + 和 / 的组合
    if isinstance(value, str):
        # 按 / 分割为多个组（OR 关系）
        groups = [g.strip() for g in value.split('/') if g.strip()]
    elif isinstance(value, list):
        # 列表格式，每个元素作为一个组（OR 关系）
        groups = [str(v).strip() for v in value if str(v).strip()]
    else:
        groups = [str(value).strip()]
    
    if not groups:
        return True, value, None
    
    # 获取字段映射关系（如 fun_mapping）
    mapping_key = f"{field_name}_mapping"
    field_mapping = HARD_CODED_FIELDS.get(mapping_key, {})
    
    # 验证每个组内的值
    invalid_values = []
    
    for group in groups:
        # 每组内按 + 分割（AND 关系）
        parts = [p.strip() for p in group.split('+') if p.strip()]
        for part in parts:
            # 精确匹配（大小写敏感）
            if part not in valid_values:
                # 尝试通过映射查找
                if part not in field_mapping:
                    invalid_values.append(part)
    
    if invalid_values:
        return False, value, f"字段 '{field_name}' 包含无效值: {invalid_values}，有效值为: {sorted(valid_values)}"
    
    # 返回原始值，保持查询语法
    return True, value, None


def validate_elem_field(value, valid_values):
    """
    验证 elem 字段，支持复杂查询语法：
    - "棉 + 氨纶"：同时包含棉和氨纶
    - "棉 > 50%"：棉含量大于50%
    - "棉 > 80% + 氨纶 > 5%"：棉大于80%且氨纶大于5%
    - "棉 > 50% / 氨纶 > 5%"：棉大于50%或氨纶大于5%
    - "棉 > 50% / 氨纶"：棉大于50%或包含氨纶
    返回: (is_valid, normalized_value, error_message)
    """
    if not value:
        return True, value, None
    
    # 将值统一转为字符串处理
    if isinstance(value, list):
        # 列表格式，每个元素单独验证
        all_valid = True
        all_normalized = []
        all_invalid = []
        for v in value:
            is_valid, normalized, error = validate_elem_field(str(v), valid_values)
            if is_valid:
                all_normalized.append(normalized)
            else:
                all_invalid.append(str(v))
        if all_invalid:
            return False, value, f"字段 'elem' 包含无效值: {all_invalid}"
        return True, all_normalized, None
    
    val_str = str(value).strip()
    if not val_str:
        return True, value, None
    
    # 提取所有成分名称（去除百分比、操作符、数字等）
    # 支持的操作符: > < >= <= = + /
    # 先提取可能包含括号的中文成分名
    extracted_elems = set()
    
    # 按 / 和 + 分割
    groups = re.split(r'[/+]', val_str)
    for group in groups:
        group = group.strip()
        if not group:
            continue
        # 去除百分比和操作符及数字，提取成分名
        # 匹配模式: "棉 > 50%" 或 "棉>50%" 或 "棉"
        # 去除操作符和数字
        elem_part = re.sub(r'\s*[><=]+\s*[\d\.]+%?\s*', '', group).strip()
        if elem_part:
            # 可能还有纯数字，再清理一次
            elem_clean = re.sub(r'^\d+\.?\d*%?\s*', '', elem_part).strip()
            if elem_clean:
                extracted_elems.add(elem_clean)
    
    # 验证提取的成分名是否在有效值列表中
    invalid_elems = []
    for elem in extracted_elems:
        if elem not in valid_values:
            invalid_elems.append(elem)
    
    if invalid_elems:
        return False, value, f"字段 'elem' 包含无效的成分: {invalid_elems}，有效值为: {sorted(valid_values)}"
    
    # 返回原始值，保持查询语法
    return True, value, None

def check_hard_coded_logic(target_text, field_name, query_str):
    """
    硬指标字段匹配逻辑 - 要求目标值包含查询值（精确匹配）
    支持 OR 逻辑（/ 分隔）和 AND 逻辑（+ 分隔）
    支持字段值映射（如 fun 字段的简写映射到完整形式）
    支持空格分隔的多值匹配（如布种、工艺等字段）
    例如：
    - "保暖/凉感"：保暖或凉感（OR）
    - "保暖+抗菌"：同时有保暖和抗菌（AND）
    - "水盾+抗菌"：水盾(定制)+抗菌(定制)（通过映射）
    - "罗纹"：匹配 "罗纹 拉架1X1" 等包含罗纹的值
    """
    if not query_str: 
        return True
    
    target_text = str(target_text or "").strip()
    if not target_text:
        return False
    
    # 目标值可能包含多个值（以逗号、顿号、空格等分隔）
    target_values = [v.strip() for v in re.split(r'[,，、/;；\s]', target_text) if v.strip()]
    
    query_str = str(query_str)
    
    # 获取字段映射关系
    mapping_key = f"{field_name}_mapping"
    field_mapping = HARD_CODED_FIELDS.get(mapping_key, {})
    
    # 按 / 分割为多个组（OR 关系）
    for group in query_str.split('/'):
        group = group.strip()
        if not group:
            continue
        
        # 每组内按 + 分割（AND 关系）
        required_values = [v.strip() for v in group.split('+') if v.strip()]
        
        if not required_values:
            continue
        
        # 检查组内所有值是否都匹配（支持映射和子串匹配）
        all_match = True
        for val in required_values:
            # 直接匹配
            if val in target_values:
                continue
            # 通过映射匹配（如 水盾 -> 水盾(定制)）
            mapped_val = field_mapping.get(val)
            if mapped_val and mapped_val in target_values:
                continue
            # 子串匹配（对于布种等组合值，如 "罗纹" 匹配 "罗纹 拉架1X1"）
            if any(val in tv for tv in target_values):
                continue
            # 都不匹配
            all_match = False
            break
        
        if all_match:
            return True
    
    return False

def check_composition_logic(elem_str, logic_query):
    if not logic_query: return True
    elem_str_lower = str(elem_str or "").lower()
    # 提取成分和比例，支持 "95%棉" 或 "棉95%" 格式
    matches = re.findall(r'(\d+(?:\.\d+)?)%\s*([\u4e00-\u9fa5a-zA-Z]+)|([\u4e00-\u9fa5a-zA-Z]+)(\d+(?:\.\d+)?)%', elem_str_lower)
    row_elems = {}
    for m in matches:
        if m[0] and m[1]: # 95%棉
            row_elems[m[1]] = float(m[0])
        elif m[2] and m[3]: # 棉95%
            row_elems[m[2]] = float(m[3])

    for group in str(logic_query).split('/'):
        group_pass = True
        for cond in group.split('+'):
            cond = cond.strip().replace('%', '')
            if not cond: continue
            op_match = re.search(r'\s*(>=|<=|>|<|=)\s*([\d\.]+)', cond)
            if op_match:
                op, target_val = op_match.group(1), float(op_match.group(2))
                name = cond.replace(op_match.group(0), '').strip().lower()
                val = row_elems.get(name, 0)
                if op == '>': match = val > target_val
                elif op == '<': match = val < target_val
                elif op == '>=': match = val >= target_val
                elif op == '<=': match = val <= target_val
                else: match = val == target_val
            else:
                # 如果没有操作符（如仅搜索 "棉"），只要关键词在解析出的成分中，或者直接在原始字符串中即可
                cond_lower = cond.lower()
                match = (cond_lower in row_elems) or (cond_lower in elem_str_lower)
            if not match: group_pass = False; break
        if group_pass: return True
    return False

def get_sort_score(row: Dict, search_code: str, soft_criteria: Dict[str, Any], hard_criteria: Dict[str, Any] = None) -> Tuple:
    code = str(row.get('code', ''))
    sales = float(row.get('sale_num_year') or 0)
    
    match_score = 10
    if search_code:
        clean_search = search_code.strip().replace('%', '')
        if code == clean_search: match_score = 0
        elif code.startswith(clean_search): match_score = 1
        elif clean_search in code: match_score = 2

    # 软指标评分：匹配到的关键词越多，分数越低（越靠前）
    soft_match_count = 0
    for key, query_val in soft_criteria.items():
        if not query_val: continue
        target_text = str(row.get(key, '') or "").lower()
        
        # 提取关键词列表
        if isinstance(query_val, list):
            keywords = [str(i) for i in query_val]
        else:
            keywords = re.split(r'[/,，、+]', str(query_val))
            
        for kw in keywords:
            kw = kw.strip().lower()
            if kw and kw in target_text:
                soft_match_count += 1
                
    soft_score = 100 - soft_match_count
    
    # 硬指标评分：匹配到的硬指标越多，分数越低（越靠前）
    hard_match_count = 0
    if hard_criteria:
        for key, query_val in hard_criteria.items():
            if not query_val: continue
            if check_hard_coded_logic(row.get(key), key, query_val):
                hard_match_count += 1
    
    hard_score = 100 - hard_match_count * 2  # 硬指标权重更高

    if code.startswith('6'): series_score = 1
    elif code.startswith('9'): series_score = 2
    elif code.startswith('9'): series_score = 3
    elif code.startswith('3'): series_score = 4
    elif code.startswith('2'): series_score = 5
    else: series_score = 6
    
    return (match_score, hard_score, soft_score, series_score, -sales)

# --- 辅助函数 ---

def process_material_images_optimized(rows: List[Dict], codes: List[str]):
    """【优化版】批量获取并合并素材图 - 使用精确匹配"""
    if not codes:
        return
    
    # 过滤掉空的款号
    valid_codes = [str(c).strip() for c in codes if str(c).strip()]
    if not valid_codes:
        return
    
    # 【优化】使用 IN 语句替代 LIKE，更高效
    placeholders = ", ".join(["%s"] * len(valid_codes))
    img_sql = f"""
        SELECT name, pic_url 
        FROM ai_source_app_v1 
        WHERE name IN ({placeholders}) 
        AND file_type = 'image'
        LIMIT 100
    """
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(img_sql, valid_codes)
            img_rows = cursor.fetchall()
        conn.close()
        
        # 将图片按名称精确匹配
        name_to_imgs = {}
        for img_row in img_rows:
            name = img_row.get('name', '')
            pic_url = img_row.get('pic_url', '')
            if not pic_url or not name:
                continue
            
            new_url = ensure_image_url(pic_url)
            formatted_img = f"{name}:{new_url}"
            
            if name not in name_to_imgs:
                name_to_imgs[name] = []
            name_to_imgs[name].append(formatted_img)
        
        # 合并到原始行中
        for row in rows:
            code = str(row.get('code', ''))
            material_imgs = name_to_imgs.get(code, [])
            
            # 处理已有图片
            current_images = row.get('image_urls', [])
            if isinstance(current_images, str):
                current_images = [item.strip() for item in current_images.split(',') if item.strip()]
            elif not isinstance(current_images, list):
                current_images = []
            
            current_reports = row.get('report_urls', [])
            if isinstance(current_reports, str):
                current_reports = [item.strip() for item in current_reports.split(',') if item.strip()]
            elif not isinstance(current_reports, list):
                current_reports = []
            
            # 重新分类
            final_images = []
            final_reports = list(current_reports)
            IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp')
            
            for item in current_images:
                clean_item = item.strip().replace('`', '')
                path_part = clean_item.split(':')[-1].split('?')[0].lower()
                
                if any(path_part.endswith(ext) for ext in IMAGE_EXTS):
                    final_images.append(ensure_image_url(clean_item))
                elif path_part.endswith('.pdf'):
                    final_reports.append(item)
                else:
                    final_images.append(ensure_image_url(clean_item))
            
            # 合并素材图
            if material_imgs:
                final_images.extend(material_imgs)
            
            # 去重
            row['image_urls'] = list(dict.fromkeys(final_images))
            row['report_urls'] = list(dict.fromkeys(final_reports))
                
    except Exception as e:
        logger.error(f"Error fetching material images: {e}")


def process_material_images(rows: List[Dict], codes: List[str]):
    """批量获取并合并素材图"""
    if not codes:
        return
    
    # 构造正则表达式，匹配包含任意一个款号的名称
    # 过滤掉空的款号，并对款号进行转义以防特殊字符干扰正则
    valid_codes = [re.escape(str(c)) for c in codes if str(c).strip()]
    if not valid_codes:
        return
        
    # 将 REGEXP 改为多个 LIKE 条件，以兼容不支持正则的 MySQL 环境
    clauses = ["name LIKE %s" for _ in valid_codes]
    params = [f"%{c}%" for c in valid_codes]
    img_sql = f"SELECT name, pic_url FROM ai_source_app_v1 WHERE ({' OR '.join(clauses)}) AND file_type = 'image'"
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(img_sql, params)
            img_rows = cursor.fetchall()
        conn.close()
        
        # 将图片按款号归类
        code_to_imgs = {}
        for img_row in img_rows:
            name = img_row.get('name', '')
            pic_url = img_row.get('pic_url', '')
            if not pic_url:
                continue
                
            # 确保图片 URL 有域名
            new_url = ensure_image_url(pic_url)
            img_name = img_row.get('name', '')
            formatted_img = f"{img_name}:{new_url}"
            
            # 检查这个图片属于哪个款号 (一个图片名可能匹配多个款号，虽然概率低)
            for code in codes:
                if str(code) in name:
                    if code not in code_to_imgs:
                        code_to_imgs[code] = []
                    code_to_imgs[code].append(formatted_img)
        
        # 合并到原始行中
        for row in rows:
            code = str(row.get('code', ''))
            material_imgs = code_to_imgs.get(code, [])
            
            # 1. 获取并规范化已有的图片和报告列表
            current_images = row.get('image_urls', [])
            if isinstance(current_images, str):
                current_images = [item.strip() for item in current_images.split(',') if item.strip()]
            elif not isinstance(current_images, list):
                current_images = []
            
            current_reports = row.get('report_urls', [])
            if isinstance(current_reports, str):
                current_reports = [item.strip() for item in current_reports.split(',') if item.strip()]
            elif not isinstance(current_reports, list):
                current_reports = []
            
            # 2. 重新分类：确保图片字段只有图片，PDF 移至报告
            final_images = []
            final_reports = list(current_reports)
            IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp')
            
            for item in current_images:
                clean_item = item.strip().replace('`', '')
                # 获取纯路径部分进行后缀判断
                path_part = clean_item.split(':')[-1].split('?')[0].lower()
                
                if any(path_part.endswith(ext) for ext in IMAGE_EXTS):
                    final_images.append(ensure_image_url(clean_item))
                elif path_part.endswith('.pdf'):
                    final_reports.append(item)
                else:
                    # 兜底：未知类型暂留图片字段，并确保有域名
                    final_images.append(ensure_image_url(clean_item))
            
            # 3. 合并素材图 (素材图在 SQL 阶段已过滤 file_type='image')
            if material_imgs:
                final_images.extend(material_imgs)
            
            # 4. 写回 row (统一去重)
            row['image_urls'] = list(dict.fromkeys(final_images))
            row['report_urls'] = list(dict.fromkeys(final_reports))
                
    except Exception as e:
        logger.error(f"Error fetching material images: {e}")

def is_empty_value(v: Any) -> bool:
    """判断值是否为空（空字符串、空列表、空字典、None）"""
    if v is None:
        return True
    if isinstance(v, str) and v.strip() == '':
        return True
    if isinstance(v, (list, dict)) and len(v) == 0:
        return True
    return False

def translate_dict_keys(d: Dict[str, Any]) -> Dict[str, Any] :
    """将查询参数字段名映射为中文，并移除 title 和空值"""
    if not isinstance(d, dict):
        return d
    result = {}
    for k, v in d.items():
        # 跳过 title 字段
        if k == 'title':
            continue
        # 跳过空值
        if is_empty_value(v):
            continue
        # 字段名映射为中文
        cn_key = QUERY_PARAM_CN_MAPPING.get(k, k)
        result[cn_key] = v
    return result

def organize_detail_by_categories(data: Dict[str, Any]) -> Dict[str, Any]:
    """将产品详情数据按类别整理，直接使用英文键名"""
    result = {}
    
    for category_name, field_keys in DETAIL_CATEGORIES.items():
        category_data = {}
        for key in field_keys:
            if key in data:
                # 直接使用英文键名
                category_data[key] = data[key]
        result[category_name] = category_data
    
    return result

# --- API 接口 ---

def build_hard_coded_sql_filter(column: str, query_val: str) -> tuple:
    """
    为硬指标字段构建SQL过滤条件
    支持 OR 逻辑（/ 分隔）和子串匹配
    对 inelem 字段特殊处理，直接精确匹配（因为其值可能包含 / 和 + 字符）
    返回: (sql_clause, params)
    """
    if not query_val:
        return None, []
    
    val = str(query_val).strip()
    if not val:
        return None, []
    
    # inelem 字段特殊处理：其值可能包含 / 和 +（如"40SRAC40/30/30紧赛纺 94.2%+40D双染氨纶"）
    # 不对其进行逻辑解析，直接使用 LIKE 模糊匹配
    if column == 'inelem':
        return f"{column} LIKE %s", [f"%{val}%"]
    
    # 按 / 分割为多个组（OR 关系）
    groups = [g.strip() for g in val.split('/') if g.strip()]
    if not groups:
        return None, []
    
    # 每组内按 + 分割（AND 关系），但SQL层面只做粗略匹配
    # 使用 OR 连接各组，每组用 LIKE
    clauses = []
    params = []
    
    for group in groups:
        # 提取关键词（去除 + 符号）
        parts = [p.strip() for p in group.split('+') if p.strip()]
        if not parts:
            continue
        
        # 构建每组的条件：所有关键词的 LIKE 条件用 AND 连接
        group_clauses = []
        for part in parts:
            group_clauses.append(f"{column} LIKE %s")
            params.append(f"%{part}%")
        
        if group_clauses:
            if len(group_clauses) == 1:
                clauses.append(group_clauses[0])
            else:
                clauses.append(f"({' AND '.join(group_clauses)})")
    
    if not clauses:
        return None, []
    
    if len(clauses) == 1:
        return clauses[0], params
    else:
        return f"({' OR '.join(clauses)})", params


def perform_single_search_fast(code: str, requested_fields: List[str]) -> Dict[str, Any]:
    """
    【款号快速查询】直接通过款号精确查询，跳过所有复杂过滤逻辑
    """
    start_time = time.time()
    
    # 构建精确查询SQL
    fields_sql = ", ".join(requested_fields) if requested_fields else ", ".join(DEFAULT_RETURN_FIELDS)
    sql = f"SELECT {fields_sql} FROM ai_product_app_v1 WHERE code = %s LIMIT 1"
    
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(sql, [code])
            row = cursor.fetchone()
        conn.close()
        
        if not row:
            return {"total": 0, "list": []}
        
        # 快速获取素材图（精确匹配）
        if 'image_urls' in requested_fields:
            code_val = str(row.get('code', ''))
            if code_val:
                img_sql = "SELECT name, pic_url FROM ai_source_app_v1 WHERE name = %s AND file_type = 'image' LIMIT 10"
                try:
                    conn = get_db_connection()
                    with conn.cursor() as cursor:
                        cursor.execute(img_sql, [code_val])
                        img_rows = cursor.fetchall()
                    conn.close()
                    
                    # 处理素材图
                    material_imgs = []
                    for img_row in img_rows:
                        name = img_row.get('name', '')
                        pic_url = img_row.get('pic_url', '')
                        if pic_url:
                            new_url = ensure_image_url(pic_url)
                            material_imgs.append(f"{name}:{new_url}")
                    
                    # 合并图片
                    current_images = row.get('image_urls', [])
                    if isinstance(current_images, str):
                        current_images = [item.strip() for item in current_images.split(',') if item.strip()]
                    elif not isinstance(current_images, list):
                        current_images = []
                    
                    IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp')
                    final_images = []
                    for item in current_images:
                        clean_item = item.strip().replace('`', '')
                        path_part = clean_item.split(':')[-1].split('?')[0].lower()
                        if any(path_part.endswith(ext) for ext in IMAGE_EXTS):
                            final_images.append(ensure_image_url(clean_item))
                    
                    if material_imgs:
                        final_images.extend(material_imgs)
                    
                    row['image_urls'] = list(dict.fromkeys(final_images))
                except Exception as e:
                    logger.error(f"Error fetching material images for code {code}: {e}")
        
        # 序列化并返回
        serialized = serialize_row(row)
        filtered_row = {k: v for k, v in serialized.items() if k in requested_fields} if requested_fields else serialized
        
        elapsed_time = round((time.time() - start_time) * 1000, 2)
        logger.info(f"[Fast Search] code={code}, time_ms={elapsed_time}")
        
        return {"total": 1, "list": [filtered_row]}
        
    except Exception as e:
        logger.error(f"[Fast Search Error] code={code}, error={str(e)}")
        return {"total": 0, "list": [], "error": str(e)}


def perform_single_search(query: Dict[str, Any]) -> Dict[str, Any]:
    """执行单条搜索逻辑 - 优化版本"""
    start_time = time.time()
    
    # 1. 解析参数
    title = query.get('title')
    limit_val = query.get('limit', 2000)
    limit = int(limit_val) if limit_val and str(limit_val).isdigit() else 2000
    
    # 【强制限制】产品搜索接口最多返回前 100 个商品
    effective_limit = min(limit, 100)
    
    # 兼容 sort 和 sort_by
    user_sort = query.get('sort', query.get('sort_by'))
    if not user_sort: user_sort = None
    
    requested_fields = query.get('fields', DEFAULT_RETURN_FIELDS)
    if not requested_fields:
        requested_fields = DEFAULT_RETURN_FIELDS
    elif isinstance(requested_fields, str):
        requested_fields = [f.strip() for f in re.split(r'[/,|+]', requested_fields) if f.strip()]
    
    # 2. 分离软硬指标和硬指标
    strict_query = {}
    soft_query = {}
    hard_coded_query = {}  # 硬指标查询参数
    metadata_fields = {'title', 'limit', 'sort', 'sort_by', 'fields', 'mode', 'code_start', 'type_notes'}
    
    for k, v in query.items():
        if v is None or k in metadata_fields: 
            continue
        # 硬指标字段
        if k in HARD_CODED_FIELDS:
            # 验证硬指标值
            is_valid, normalized, error_msg = validate_hard_coded_field(k, v)
            if not is_valid:
                logger.warning(f"[Hard-coded Validation Failed] title={title}, field={k}, error={error_msg}")
                return {"total": 0, "list": [], "error": error_msg}
            hard_coded_query[k] = normalized
        elif k in SOFT_FIELDS: 
            soft_query[k] = v
        else: 
            strict_query[k] = v
            
    search_code_val = strict_query.get('code', '')
    
    # 【优化】款号快速路径：如果只有code查询（无其他条件），走快速查询
    code_only_query = (
        search_code_val and 
        not soft_query and 
        not hard_coded_query and
        len([k for k in strict_query.keys() if k != 'code']) == 0 and
        not query.get('code_start') and
        not query.get('type_notes')
    )
    
    if code_only_query:
        # 提取纯款号（如果是列表取第一个）
        if isinstance(search_code_val, list):
            if len(search_code_val) == 1:
                return perform_single_search_fast(str(search_code_val[0]), requested_fields)
        else:
            # 检查是否是精确款号（不含通配符%）
            code_str = str(search_code_val).strip()
            if '%' not in code_str and len(code_str) >= 3:
                return perform_single_search_fast(code_str, requested_fields)
    
    code_start_filter = query.get('code_start')
    type_notes_filter = query.get('type_notes')
    mode = query.get('mode')
    
    if str(mode) == '1' and not code_start_filter and not type_notes_filter:
        code_start_filter = ['3', '6', '7', '9']
        type_notes_filter = ['现货', '订单', '订单主推']

    # 3. SQL 构造
    params = []
    # 如果用户指定了 fields，则按用户指定的字段查询；否则使用默认字段
    if requested_fields and len(requested_fields) > 0:
        required_fields = set(requested_fields)
    else:
        # 【优化】只查询必要字段，减少数据传输
        core_fields = {'code', 'sale_num_year', 'elem', 'weight', 'name', 'price', 'taxkgprice', 'image_urls'}
        required_fields = core_fields
    
    fields_sql = ", ".join(required_fields)
    sql_template = f"SELECT {fields_sql} FROM ai_product_app_v1 WHERE 1=1"
    
    # A. 商品类型过滤
    if code_start_filter:
        code_start_list = [str(c).strip() for c in (code_start_filter if isinstance(code_start_filter, list) else [code_start_filter]) if str(c).strip()]
        if code_start_list:
            placeholders = ", ".join(["%s"] * len(code_start_list))
            sql_template += f" AND code_start IN ({placeholders})"
            params.extend(code_start_list)
    
    # B. 运营分类过滤
    if type_notes_filter:
        type_notes_list = [str(t).strip() for t in (type_notes_filter if isinstance(type_notes_filter, list) else [type_notes_filter]) if str(t).strip()]
        if type_notes_list:
            placeholders = ", ".join(["%s"] * len(type_notes_list))
            sql_template += f" AND type_notes IN ({placeholders})"
            params.extend(type_notes_list)

    # C. 数值字段 SQL 过滤
    for key, val in strict_query.items():
        if key in NUMERIC_FIELDS:
            clause = build_numeric_sql(key, val)
            if clause: sql_template += f" AND {clause}"
    
    # D. 文本字段 SQL 过滤
    sql_filtered_fields = set()
    for key in STRICT_TEXT_FIELDS:
        if key == 'elem': continue
        val = strict_query.get(key)
        if not val: continue
        clause, c_params = build_text_sql_filter(key, val)
        if clause:
            sql_template += f" AND {clause}"
            params.extend(c_params)
            sql_filtered_fields.add(key)
    
    # 处理 elem 字段的 SQL
    elem_value = strict_query.get('elem') or hard_coded_query.get('elem')
    if elem_value:
        elem_clause, elem_params = build_elem_sql_filter(elem_value)
        if elem_clause:
            sql_template += f" AND {elem_clause}"
            params.extend(elem_params)
    
    # 【优化】硬指标字段下沉到SQL - 减少Python处理的数据量
    hard_coded_sql_fields = set()
    for key, val in hard_coded_query.items():
        if key == 'elem':
            continue  # elem 已在上面处理
        clause, c_params = build_hard_coded_sql_filter(key, val)
        if clause:
            sql_template += f" AND {clause}"
            params.extend(c_params)
            hard_coded_sql_fields.add(key)
    
    # 【优化】减少LIMIT，从源头控制数据量
    # 由于有复杂Python筛选，稍微多取一些，但不要太多
    sql_template += " LIMIT 1000"

    # 记录SQL语句
    sql_for_log = sql_template
    for i, param in enumerate(params, 1):
        sql_for_log = sql_for_log.replace('%s', f"'{param}'", 1)
    logger.info(f"[SQL] title={title}, SQL: {sql_for_log}")

    # 4. 执行查询
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            cursor.execute(sql_template, params)
            rows = cursor.fetchall()
        conn.close()
        logger.info(f"[SQL Result] title={title}, raw_rows={len(rows)}")
    except Exception as e:
        logger.error(f"[SQL Error] title={title}, error={str(e)}, SQL: {sql_for_log}")
        return {"total": 0, "list": [], "error": f"Database Error: {str(e)}"}

    # 5. Python 筛选（剩余无法在SQL完成的复杂逻辑）
    filtered_rows = []
    for row in rows:
        # 排除无重量商品（除非有明确款号查询）
        has_code_query = strict_query.get('code') or query.get('code')
        if not has_code_query:
            weight_val = row.get('weight')
            if weight_val is None or str(weight_val).strip() == '' or float(weight_val or 0) <= 0:
                continue

        match = True
        # 严格查询字段（已在SQL中过滤大部分，这里做精确校验）
        for key, val in strict_query.items():
            if key in NUMERIC_FIELDS or key in sql_filtered_fields: 
                continue
            if key == 'elem':
                if not check_composition_logic(row.get('elem'), val): 
                    match = False; break
            elif key in STRICT_TEXT_FIELDS:
                if not check_text_logic(row.get(key), val, column=key): 
                    match = False; break
        
        if not match:
            continue
        
        # 【优化】硬指标字段中未在SQL层面过滤的，在Python中精确筛选
        for key, val in hard_coded_query.items():
            if key == 'elem':
                # elem 字段始终在Python中进行精确验证（支持百分比查询语法）
                if not check_composition_logic(row.get('elem'), val): 
                    match = False; break
            elif key in hard_coded_sql_fields:
                # 已在SQL粗略过滤，Python做精确验证
                if not check_hard_coded_logic(row.get(key), key, val): 
                    match = False; break
        
        if match: 
            filtered_rows.append(row)

    # 6. 排序
    if user_sort:
        sort_parts = str(user_sort).strip().split()
        sort_field = sort_parts[0]
        reverse_order = (len(sort_parts) > 1 and sort_parts[1].upper() == 'DESC') or True
        try:
            filtered_rows.sort(key=lambda r: float(r.get(sort_field) or 0), reverse=reverse_order)
        except:
            filtered_rows.sort(key=lambda r: str(r.get(sort_field) or ''), reverse=reverse_order)
    else:
        # 【优化】软指标评分简化
        filtered_rows.sort(key=lambda r: get_sort_score(r, str(search_code_val), soft_query, hard_coded_query))

    # 7. 分页截断
    total_count = len(filtered_rows)
    return_limit = 10
    final_rows = filtered_rows[:return_limit]
    
    # 8. 【移除】素材图获取移到详情接口，提高搜索速度
    # if 'image_urls' in requested_fields:
    #     final_codes = [str(r.get('code', '')) for r in final_rows if r.get('code')]
    #     if final_codes:
    #         process_material_images_optimized(final_rows, final_codes)

    # 9. 构建结果（简化版，不包含素材图）
    cleaned_rows = []
    for row in final_rows:
        serialized = serialize_row(row)
        # 简化图片字段，只保留原始图片URL，并确保格式为 "名称:URL"
        if 'image_urls' in serialized:
            img_list = serialized['image_urls']
            if isinstance(img_list, list):
                # 最多保留3张主图，确保格式为 "名称:URL"
                formatted_imgs = []
                for img in img_list[:3]:
                    img_str = str(img).strip()
                    if img_str:
                        # 如果已经是 "名称:URL" 格式，保留
                        # 如果只有 URL，添加默认名称
                        if ':' in img_str and not img_str.startswith('http'):
                            formatted_imgs.append(img_str)
                        else:
                            # 提取文件名作为名称
                            url_part = img_str.split('?')[0]
                            file_name = url_part.split('/')[-1] if '/' in url_part else '图片'
                            formatted_imgs.append(f"{file_name}:{img_str}")
                serialized['image_urls'] = formatted_imgs
            elif isinstance(img_list, str) and img_list:
                # 处理逗号分隔的字符串
                items = [item.strip() for item in img_list.split(',') if item.strip()][:3]
                formatted_imgs = []
                for item in items:
                    if ':' in item and not item.startswith('http'):
                        formatted_imgs.append(item)
                    else:
                        url_part = item.split('?')[0]
                        file_name = url_part.split('/')[-1] if '/' in url_part else '图片'
                        formatted_imgs.append(f"{file_name}:{item}")
                serialized['image_urls'] = formatted_imgs
        filtered_row = {k: v for k, v in serialized.items() if k in requested_fields}
        cleaned_rows.append(filtered_row)

    elapsed_time = round((time.time() - start_time) * 1000, 2)
    logger.info(f"[Search Complete] title={title}, total={total_count}, returned={len(cleaned_rows)}, time_ms={elapsed_time}")

    return {"total": total_count, "list": cleaned_rows}

@app.post("/api/product_search")
async def product_search(request_data: Any = Body(...)):
    request_start_time = time.time()
    
    # 1. 参数归一化：统一转为列表处理
    logger.info(f"\n========== Product Search Request ==========")
    logger.info(f"Received request_data: {json.dumps(request_data, ensure_ascii=False)}")
    queries = []
    is_list_input = isinstance(request_data, list)
    
    if is_list_input:
        for item in request_data:
            if isinstance(item, dict):
                if 'tool_call' in item:
                    tool_calls = item['tool_call']
                    if isinstance(tool_calls, list):
                        for tc in tool_calls:
                            if isinstance(tc, dict):
                                q = tc.copy()
                                if 'title' in item and 'title' not in q: q['title'] = item['title']
                                if 'mode' in item and 'mode' not in q: q['mode'] = item['mode']
                                # 合并外层筛选参数（支持驼峰和下划线命名）
                                if 'codeStart' in item and 'code_start' not in q: q['code_start'] = parse_code_start(item['codeStart'])
                                if 'code_start' in item and 'code_start' not in q: q['code_start'] = parse_code_start(item['code_start'])
                                if 'typeNotes' in item and 'type_notes' not in q: q['type_notes'] = item['typeNotes']
                                if 'type_notes' in item and 'type_notes' not in q: q['type_notes'] = item['type_notes']
                                queries.append(q)
                    elif isinstance(tool_calls, dict):
                        q = tool_calls.copy()
                        if 'title' in item and 'title' not in q: q['title'] = item['title']
                        if 'mode' in item and 'mode' not in q: q['mode'] = item['mode']
                        # 合并外层筛选参数（支持驼峰和下划线命名）
                        if 'codeStart' in item and 'code_start' not in q: q['code_start'] = parse_code_start(item['codeStart'])
                        if 'code_start' in item and 'code_start' not in q: q['code_start'] = parse_code_start(item['code_start'])
                        if 'typeNotes' in item and 'type_notes' not in q: q['type_notes'] = item['typeNotes']
                        if 'type_notes' in item and 'type_notes' not in q: q['type_notes'] = item['type_notes']
                        queries.append(q)
                else:
                    queries.append(item)
    elif isinstance(request_data, dict):
        if 'tool_call' in request_data:
            tool_calls = request_data['tool_call']
            if isinstance(tool_calls, list):
                for tc in tool_calls:
                    if isinstance(tc, dict):
                        q = tc.copy()
                        if 'title' in request_data and 'title' not in q: q['title'] = request_data['title']
                        if 'mode' in request_data and 'mode' not in q: q['mode'] = request_data['mode']
                        # 合并外层筛选参数（支持驼峰和下划线命名）
                        if 'codeStart' in request_data and 'code_start' not in q: q['code_start'] = parse_code_start(request_data['codeStart'])
                        if 'code_start' in request_data and 'code_start' not in q: q['code_start'] = parse_code_start(request_data['code_start'])
                        if 'typeNotes' in request_data and 'type_notes' not in q: q['type_notes'] = request_data['typeNotes']
                        if 'type_notes' in request_data and 'type_notes' not in q: q['type_notes'] = request_data['type_notes']
                        queries.append(q)
            elif isinstance(tool_calls, dict):
                q = tool_calls.copy()
                if 'title' in request_data and 'title' not in q: q['title'] = request_data['title']
                if 'mode' in request_data and 'mode' not in q: q['mode'] = request_data['mode']
                # 合并外层筛选参数（支持驼峰和下划线命名）
                if 'codeStart' in request_data and 'code_start' not in q: q['code_start'] = request_data['codeStart']
                if 'code_start' in request_data and 'code_start' not in q: q['code_start'] = request_data['code_start']
                if 'typeNotes' in request_data and 'type_notes' not in q: q['type_notes'] = request_data['typeNotes']
                if 'type_notes' in request_data and 'type_notes' not in q: q['type_notes'] = request_data['type_notes']
                queries.append(q)
        else:
            queries.append(request_data)
    else:
        return {"error": "Invalid request format", "title": "", "query": {}, "total": 0, "list": []}

    # 2. 逐条执行查询并合并结果 (并行执行)
    async def process_query(q):
        # 即使 q 不是字典，也返回一个基础结构以保持数组长度一致
        if not isinstance(q, dict):
            return {
                "title": "",
                "query": {},
                "total": 0,
                "list": []
            }
        
        # 【优化】生成缓存key - 基于查询参数
        cache_key = None
        try:
            # 排除动态字段，只保留查询条件
            cache_dict = {k: v for k, v in q.items() if k not in ['title', 'limit', 'sort', 'sort_by', 'fields', 'mode']}
            if cache_dict:
                cache_key = hashlib.md5(json.dumps(cache_dict, sort_keys=True).encode()).hexdigest()
        except:
            pass
        
        # 【优化】检查缓存
        if cache_key:
            cached_result = cache.get(cache_key)
            if cached_result:
                logger.info(f"[Cache Hit] title={q.get('title', '')}, cache_key={cache_key[:8]}...")
                return {
                    "title": q.get("title", ""),
                    "query": translate_dict_keys(q),
                    "total": cached_result.get("total", 0),
                    "list": cached_result.get("list", [])
                }
        
        # 使用 run_in_threadpool 执行同步的数据库查询逻辑，避免阻塞事件循环
        search_res = await run_in_threadpool(perform_single_search, q)
        
        # 如果有错误，直接返回错误信息
        if "error" in search_res:
            return {
                "title": q.get("title", ""),
                "query": translate_dict_keys(q),
                "total": 0,
                "list": [],
                "error": search_res["error"]
            }
        
        # 【优化】写入缓存
        if cache_key and search_res.get("list"):
            cache.set(cache_key, search_res, ttl=60)  # 缓存60秒
        
        # 始终返回结果结构，即使 total 为 0
        return {
            "title": q.get("title", ""),
            "query": translate_dict_keys(q),
            "total": search_res.get("total", 0),
            "list": search_res.get("list", [])
        }

    # 并行处理所有查询
    tasks = [process_query(q) for q in queries]
    results = await asyncio.gather(*tasks)
    
    # 3. 兼容返回格式
    total_results = sum(r.get("total", 0) for r in results)
    returned_items = sum(len(r.get("list", [])) for r in results)
    request_elapsed = round((time.time() - request_start_time) * 1000, 2)
    
    logger.info(f"[Request Summary] queries={len(queries)}, total_results={total_results}, returned_items={returned_items}, time_ms={request_elapsed}")
    logger.info(f"========== End Request ==========\n")
    
    # 如果原始输入不是列表，但包含多组查询（tool_call数组），也返回数组格式
    if not is_list_input and len(queries) == 1:
        # 单查询单组结果，返回对象格式保持兼容
        if results:
            return results[0]
        return {
            "title": "",
            "query": {},
            "total": 0,
            "list": []
        }
    else:
        # 列表输入或多组查询，返回数组格式
        return results

@app.get("/api/get_product_detail")
async def get_product_detail(code: str):
    """通过款号获取产品详情"""
    if not code:
        raise HTTPException(status_code=400, detail="Code parameter is required")
    
    def fetch_detail(p_code):
        # 仅查询 FIELD_MAPPING 中定义的字段
        allowed_fields = list(FIELD_MAPPING.keys())
        fields_sql = ", ".join([f"`{f}`" for f in allowed_fields])
        sql = f"SELECT {fields_sql} FROM ai_product_app_v1 WHERE code = %s"
        
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                # 获取产品详情
                cursor.execute(sql, [p_code])
                row = cursor.fetchone()
            conn.close()
            return row
        except Exception as e:
            logger.error(f"Database error in get_product_detail for code {p_code}: {e}")
            return None

    row = await run_in_threadpool(fetch_detail, code)

    if not row:
        return {
            "success": False,
            "message": f"Product with code '{code}' not found",
            "data": None
        }

    # 【优化】获取素材图和报告 - 使用精确匹配
    def fetch_material_and_reports(p_code: str, row_data: Dict):
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                # 1. 获取素材图（精确匹配）
                cursor.execute(
                    "SELECT name, pic_url FROM ai_source_app_v1 WHERE name = %s AND file_type = 'image' LIMIT 20",
                    [p_code]
                )
                img_rows = cursor.fetchall()
                
                # 2. 获取报告PDF（精确匹配）
                cursor.execute(
                    "SELECT name, pic_url FROM ai_source_app_v1 WHERE name = %s AND file_type = 'pdf' LIMIT 10",
                    [p_code]
                )
                pdf_rows = cursor.fetchall()
            conn.close()
            
            # 处理素材图
            material_imgs = []
            for img_row in img_rows:
                name = img_row.get('name', '')
                pic_url = img_row.get('pic_url', '')
                if pic_url:
                    new_url = ensure_image_url(pic_url)
                    material_imgs.append(f"{name}:{new_url}")
            
            # 处理报告
            report_urls = []
            for pdf_row in pdf_rows:
                name = pdf_row.get('name', '')
                pic_url = pdf_row.get('pic_url', '')
                if pic_url:
                    new_url = ensure_image_url(pic_url)
                    report_urls.append(f"{name}:{new_url}")
            
            return material_imgs, report_urls
        except Exception as e:
            logger.error(f"Error fetching material/reports for code {p_code}: {e}")
            return [], []
    
    # 获取素材图和报告
    material_imgs, report_urls = await run_in_threadpool(fetch_material_and_reports, code, row)
    
    # 合并素材图到主数据
    current_images = row.get('image_urls', [])
    if isinstance(current_images, str):
        current_images = [item.strip() for item in current_images.split(',') if item.strip()]
    elif not isinstance(current_images, list):
        current_images = []
    
    current_reports = row.get('report_urls', [])
    if isinstance(current_reports, str):
        current_reports = [item.strip() for item in current_reports.split(',') if item.strip()]
    elif not isinstance(current_reports, list):
        current_reports = []
    
    # 处理已有图片和报告
    IMAGE_EXTS = ('.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp')
    final_images = []
    final_reports = list(current_reports)
    
    for item in current_images:
        clean_item = item.strip().replace('`', '')
        path_part = clean_item.split(':')[-1].split('?')[0].lower()
        if any(path_part.endswith(ext) for ext in IMAGE_EXTS):
            final_images.append(ensure_image_url(clean_item))
        elif path_part.endswith('.pdf'):
            final_reports.append(item)
        else:
            final_images.append(ensure_image_url(clean_item))
    
    # 合并素材图
    if material_imgs:
        final_images.extend(material_imgs)
    
    # 合并报告
    if report_urls:
        final_reports.extend(report_urls)
    
    # 去重并更新
    row['image_urls'] = list(dict.fromkeys(final_images)) if final_images else []
    row['report_urls'] = list(dict.fromkeys(final_reports)) if final_reports else []

    # 返回清洗后的详情数据，并按分类整理
    serialized_row = serialize_row(row)

    categorized_row = organize_detail_by_categories(serialized_row)
    
    return {
        "success": True,
        "data": categorized_row
    }

@app.get("/api/get_user_info")
async def get_user_info(user_id: str):
    """获取用户信息接口"""
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id parameter is required")
    
    def fetch_user(uid):
        sql = "SELECT * FROM ai_user WHERE id = %s AND product = 'sale'"
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                cursor.execute(sql, [uid])
                row = cursor.fetchone()
            conn.close()
            return row
        except Exception as e:
            logger.error(f"Database error in get_user_info for user_id {uid}: {e}")
            return None

    row = await run_in_threadpool(fetch_user, user_id)
    
    if not row:
        return {
            "success": False,
            "message": f"User with id '{user_id}' and product 'sale' not found",
            "data": None
        }
    
    # 清洗数据
    serialized_row = serialize_row(row)
    
    return {
        "success": True,
        "data": serialized_row
    }

@app.post("/api/search_source")
async def search_source(request_data: Any = Body(...)):
    """素材查询接口，兼容多关键词
    
    支持语法：
    - "6228+样衣图" : 需要同时满足 "6228" 和 "样衣图"（AND 关系）
    - "关键词1/关键词2" : 满足任意一个关键词即可（OR 关系）
    - ["6228+样衣图", "other"] : 列表中的每个元素按上述规则处理，元素之间是 OR 关系
    """
    logger.info(f"Received search_source request: {request_data}")
    
    # 兼容多种入参格式
    search_type = "all"
    if isinstance(request_data, dict):
        keywords = request_data.get('keywords', "")
        search_type = request_data.get('type', "")

        
        # 兼容 "type" 字段作为搜索类型的情况，但如果 keywords 为空且 type 有值，
        # 某些调用方可能把搜索词放在了 type 字段中
        if not keywords and search_type and search_type not in ['all', 'image', 'video']:
            keywords = search_type
            search_type = ""
    else:
        # 如果直接发送的是列表或字符串
        keywords = request_data

    # 归一化为列表
    if not keywords:
        kw_groups = []  # 每个元素是一个 {'type': 'AND'/'OR', 'keywords': [...]} 的字典
    elif isinstance(keywords, str):
        # 单字符串，解析其中的 + 和 / 关系
        kw_groups = _parse_keyword_expression(keywords)
    elif isinstance(keywords, list):
        # 列表，每个元素单独解析
        kw_groups = []
        for item in keywords:
            groups = _parse_keyword_expression(str(item).strip())
            kw_groups.extend(groups)
    else:
        kw_groups = []
    
    logger.info(f"Normalized kw_groups: {kw_groups}, search_type: {search_type}")

    def fetch_sources(groups, s_type):
        """根据关键词组构建 SQL 查询"""
        if not groups:
            return [], 0
        
        # 构建 WHERE 子句
        # 每个 group 之间是 OR 关系
        # group 内部：AND 组需要同时满足所有关键词，OR 组满足任意一个即可
        all_clauses = []
        all_params = []
        
        for group in groups:
            group_type = group['type']  # 'AND' 或 'OR'
            kws = group['keywords']
            
            # 为每个关键词构建 (name LIKE %kw% OR tags LIKE %kw%)
            kw_clauses = []
            for kw in kws:
                kw_clauses.append("(name LIKE %s OR tags LIKE %s)")
                all_params.extend([f"%{kw}%", f"%{kw}%"])
            
            if group_type == 'AND':
                # AND 关系：所有关键词都要满足（用 AND 连接）
                if kw_clauses:
                    all_clauses.append(f"({' AND '.join(kw_clauses)})")
            else:
                # OR 关系：满足任意一个关键词即可（用 OR 连接）
                if kw_clauses:
                    all_clauses.append(f"({' OR '.join(kw_clauses)})")
        
        # 组合所有 group（group 之间是 OR 关系）
        if all_clauses:
            where_clause = f"({' OR '.join(all_clauses)})"
        else:
            where_clause = "1=1"
        
        # 添加文件类型过滤
        if s_type and s_type != 'all':
            where_clause = f"({where_clause}) AND file_type = %s"
            all_params.append(s_type)
        
        where_clause = f"{where_clause} AND is_delete = 0"
        
        # 获取总数
        count_sql = f"SELECT COUNT(*) as total FROM ai_source_app_v1 WHERE {where_clause}"
        
        sql = f"""
            SELECT name, file_type, pic_url, video_path 
            FROM ai_source_app_v1 
            WHERE {where_clause}
            ORDER BY id DESC
            LIMIT 100
        """
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                # 先查总数
                cursor.execute(count_sql, all_params)
                res = cursor.fetchone()
                total_count = res.get('total', 0) if res else 0
                
                # 再查分页数据
                cursor.execute(sql, all_params)
                rows = cursor.fetchall()
            conn.close()
            return rows, total_count
        except Exception as e:
            logger.error(f"Database error in search_source for groups {groups}, type {s_type}: {e}")
            return [], 0

    rows, total = await run_in_threadpool(fetch_sources, kw_groups, search_type)
    
    # 增加调试日志
    logger.info(f"Search result: found {total} items for groups {kw_groups}")
    
    # 清洗数据并处理 pic_url 和 video_path 域名
    image_base_url = os.getenv('IMAGE_BASE_URL', 'https://lobe.wyoooni.net')
    cleaned_rows = []
    for row in rows:
        serialized = serialize_row(row)
        # 处理图片域名
        if serialized.get('pic_url') and serialized['pic_url'].startswith('/'):
            serialized['pic_url'] = f"{image_base_url}{serialized['pic_url']}"
        # 处理视频域名
        if serialized.get('video_path') and serialized['video_path'].startswith('/'):
            serialized['video_path'] = f"{image_base_url}{serialized['video_path']}"
        cleaned_rows.append(serialized)
    
    return {
        "success": True,
        "total": total,
        "list": cleaned_rows
    }


def _parse_keyword_expression(expr: str) -> list:
    """
    解析关键词表达式，支持 + (AND) 和 / (OR) 语法
    
    示例：
    - "6228+样衣图" -> [{'type': 'AND', 'keywords': ['6228', '样衣图']}]
    - "关键词1/关键词2" -> [{'type': 'OR', 'keywords': ['关键词1', '关键词2']}]
    - "6228+样衣图/其他" -> [{'type': 'AND', 'keywords': ['6228', '样衣图']}, {'type': 'OR', 'keywords': ['其他']}]
    
    优先级：+ (AND) 优先于 / (OR)
    即："a+b/c+d" 会被解析为 "(a+b) / (c+d)"
    """
    if not expr or not expr.strip():
        return []
    
    expr = expr.strip()
    
    # 先按 / 分割成多个组（OR 关系）
    # 但每个组内部可能包含 +（AND 关系）
    parts = [p.strip() for p in expr.split('/') if p.strip()]
    
    result = []
    for part in parts:
        # 检查组内是否包含 +
        if '+' in part:
            # AND 关系
            and_keywords = [k.strip() for k in part.split('+') if k.strip()]
            if and_keywords:
                result.append({'type': 'AND', 'keywords': and_keywords})
        else:
            # 单个关键词，视为 OR 关系中的一个
            result.append({'type': 'OR', 'keywords': [part]})
    
    return result

@app.get("/api/wechat_login")
async def wechat_login(code: str, type: str = "rs"):
    """微信登录接口"""
    logger.info(f"[API /api/wechat_login] Request received - code={code}, type={type}")
    
    if not code:
        logger.warning(f"[API /api/wechat_login] Missing required parameter: code")
        raise HTTPException(status_code=400, detail="code parameter is required")
    
    logger.info(f"[API /api/wechat_login] Initializing WeChat with type={type}")
    wechat = WeChat(type)
    
    logger.info(f"[API /api/wechat_login] Getting access_token...")
    access_token = await wechat.get_access_token()
    if not access_token:
        logger.error(f"[API /api/wechat_login] Failed to get access_token")
        return {"success": False, "message": "Failed to get access token"}
    
    logger.info(f"[API /api/wechat_login] Getting user_info with code={code}...")
    user_info = await wechat.get_user_info(access_token, code)
    if not user_info:
        logger.warning(f"[API /api/wechat_login] Failed to get user_info from WeChat")
        return {"success": False, "message": "Failed to get user info from WeChat"}
    
    # 获取 UserId (企业微信返回字段通常是 UserId 或 userid)
    userid = user_info.get("userid") or user_info.get("UserId")
    logger.info(f"[API /api/wechat_login] Got userid from WeChat: {userid}")
    
    # 检查数据库中是否存在该用户
    def fetch_user(uid):
        logger.info(f"[API /api/wechat_login] Checking database for user: {uid}")
        sql = "SELECT * FROM ai_user WHERE id = %s"
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                cursor.execute(sql, [uid])
                row = cursor.fetchone()
            conn.close()
            if row:
                logger.info(f"[API /api/wechat_login] User found in database: {uid}")
            else:
                logger.info(f"[API /api/wechat_login] User not found in database: {uid}")
            return row
        except Exception as e:
            logger.error(f"[API /api/wechat_login] Database error for userid {uid}: {e}")
            return None

    user_row = await run_in_threadpool(fetch_user, userid)
    
    if not user_row:
        result = {
            "success": True,
            "is_new_user": True,
            "wechat_user_info": user_info,
            "message": "User not found in database"
        }
        logger.info(f"[API /api/wechat_login] Response: {result}")
        return result
    
    # 如果用户存在，返回用户信息
    serialized_user = serialize_row(user_row)
    result = {
        "success": True,
        "is_new_user": False,
        "data": serialized_user,
        "wechat_user_info": user_info
    }
    logger.info(f"[API /api/wechat_login] Response: success=True, is_new_user=False, userid={userid}")
    return result


# --- ai_agent_prompt 表读写接口 ---

class AgentPromptRequest(BaseModel):
    """创建/更新 Agent Prompt 请求模型"""
    agent: str = Field(..., description="Agent 名称（唯一标识）")
    prompt: Optional[str] = Field(None, description="Prompt 内容")

class AgentPromptResponse(BaseModel):
    """Agent Prompt 响应模型"""
    id: Optional[int] = Field(None, description="记录ID")
    agent: str = Field(..., description="Agent 名称")
    prompt: Optional[str] = Field(None, description="Prompt 内容")


class FeedbackRequest(BaseModel):
    """AI Agent Feedback 请求模型"""
    agent: Optional[str] = Field(None, description="Agent标识")
    people: Optional[str] = Field(None, description="对话人唯一标识")
    sessionId: Optional[str] = Field(None, description="会话ID")
    messageId: Optional[str] = Field(None, description="消息ID")
    question: Optional[str] = Field(None, description="用户问题")
    productData: Optional[List[Dict[str, Any]]] = Field(None, description="产品数据列表")
    feedbackContent: Optional[str] = Field(None, description="反馈内容")


class FeedbackResponse(BaseModel):
    """AI Agent Feedback 响应模型"""
    id: Optional[int] = Field(None, description="记录ID")
    sessionId: str = Field(..., description="会话ID")
    messageId: str = Field(..., description="消息ID")
    feedbackContent: Optional[str] = Field(None, description="反馈内容")
    created_at: Optional[str] = Field(None, description="创建时间")

@app.get("/api/agent_prompt/{agent}", response_model=AgentPromptResponse)
async def get_agent_prompt(agent: str):
    """
    根据 agent 名称获取对应的 prompt
    
    - **agent**: Agent 名称（路径参数）
    """
    def fetch_prompt(agent_name: str):
        sql = "SELECT id, agent, prompt FROM ai_agent_prompt WHERE agent = %s LIMIT 1"
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                cursor.execute(sql, [agent_name])
                row = cursor.fetchone()
            conn.close()
            return row
        except Exception as e:
            logger.error(f"Database error in get_agent_prompt for agent {agent_name}: {e}")
            return None
    
    row = await run_in_threadpool(fetch_prompt, agent)
    
    if not row:
        raise HTTPException(status_code=404, detail=f"Agent '{agent}' not found")
    
    return AgentPromptResponse(
        id=row.get('id'),
        agent=row.get('agent'),
        prompt=row.get('prompt')
    )

@app.post("/api/agent_prompt")
async def save_agent_prompt(request: AgentPromptRequest):
    """
    创建或更新 Agent Prompt
    
    - **agent**: Agent 名称（必填，唯一标识）
    - **prompt**: Prompt 内容（可选）
    
    如果 agent 已存在则更新，不存在则创建
    """
    def upsert_prompt(agent_name: str, prompt_text: Optional[str]):
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                # 先检查是否存在
                check_sql = "SELECT id FROM ai_agent_prompt WHERE agent = %s LIMIT 1"
                cursor.execute(check_sql, [agent_name])
                existing = cursor.fetchone()
                
                if existing:
                    # OLAP 表不支持 UPDATE，先删除旧记录
                    delete_sql = "DELETE FROM ai_agent_prompt WHERE agent = %s"
                    cursor.execute(delete_sql, [agent_name])
                
                # 获取当前最大 ID
                cursor.execute("SELECT MAX(id) as max_id FROM ai_agent_prompt")
                max_id_row = cursor.fetchone()
                next_id = (max_id_row['max_id'] or 0) + 1 if max_id_row else 1
                
                # 插入新记录（插入或更新都是插入新记录）
                insert_sql = """
                    INSERT INTO ai_agent_prompt (id, agent, prompt) 
                    VALUES (%s, %s, %s)
                """
                cursor.execute(insert_sql, [next_id, agent_name, prompt_text])
                conn.commit()
                
                action = "updated" if existing else "created"
                return {"id": next_id, "agent": agent_name, "action": action}
            conn.close()
        except Exception as e:
            logger.error(f"Database error in save_agent_prompt for agent {agent_name}: {e}")
            raise e
    
    try:
        result = await run_in_threadpool(upsert_prompt, request.agent, request.prompt)
        return {
            "success": True,
            "data": result,
            "message": f"Agent prompt {result['action']} successfully"
        }
    except Exception as e:
        logger.error(f"Error saving agent prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save agent prompt: {str(e)}")

@app.get("/api/agent_prompts")
async def list_agent_prompts(
    page: int = 1,
    page_size: int = 100,
    keyword: Optional[str] = None
):
    """
    获取 Agent Prompt 列表
    
    - **page**: 页码，默认 1
    - **page_size**: 每页数量，默认 100
    - **keyword**: 搜索关键词（可选，搜索 agent 字段）
    """
    def fetch_list(page_num: int, size: int, kw: Optional[str]):
        offset = (page_num - 1) * size
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                # 查询总数
                if kw:
                    count_sql = "SELECT COUNT(*) as total FROM ai_agent_prompt WHERE agent LIKE %s"
                    cursor.execute(count_sql, [f"%{kw}%"])
                else:
                    count_sql = "SELECT COUNT(*) as total FROM ai_agent_prompt"
                    cursor.execute(count_sql)
                
                total_res = cursor.fetchone()
                total = total_res.get('total', 0) if total_res else 0
                
                # 查询列表
                if kw:
                    list_sql = """
                        SELECT id, agent, prompt 
                        FROM ai_agent_prompt 
                        WHERE agent LIKE %s 
                        ORDER BY id DESC 
                        LIMIT %s OFFSET %s
                    """
                    cursor.execute(list_sql, [f"%{kw}%", size, offset])
                else:
                    list_sql = """
                        SELECT id, agent, prompt 
                        FROM ai_agent_prompt 
                        ORDER BY id DESC 
                        LIMIT %s OFFSET %s
                    """
                    cursor.execute(list_sql, [size, offset])
                
                rows = cursor.fetchall()
            conn.close()
            return total, rows
        except Exception as e:
            logger.error(f"Database error in list_agent_prompts: {e}")
            return 0, []
    
    total, rows = await run_in_threadpool(fetch_list, page, page_size, keyword)
    
    return {
        "success": True,
        "total": total,
        "page": page,
        "page_size": page_size,
        "list": [
            {
                "id": row.get('id'),
                "agent": row.get('agent'),
                "prompt": row.get('prompt')
            } for row in rows
        ]
    }

@app.delete("/api/agent_prompt/{agent}")
async def delete_agent_prompt(agent: str):
    """
    根据 agent 名称删除对应的 prompt
    
    - **agent**: Agent 名称（路径参数）
    """
    def remove_prompt(agent_name: str):
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                delete_sql = "DELETE FROM ai_agent_prompt WHERE agent = %s"
                cursor.execute(delete_sql, [agent_name])
                affected = cursor.rowcount
                conn.commit()
            conn.close()
            return affected
        except Exception as e:
            logger.error(f"Database error in delete_agent_prompt for agent {agent_name}: {e}")
            raise e
    
    try:
        affected = await run_in_threadpool(remove_prompt, agent)
        if affected == 0:
            raise HTTPException(status_code=404, detail=f"Agent '{agent}' not found")
        return {
            "success": True,
            "message": f"Agent '{agent}' deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting agent prompt: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete agent prompt: {str(e)}")

@app.post("/api/ai_agent_feedback")
async def ai_agent_feedback(request: FeedbackRequest):
    """
    保存 AI Agent 用户反馈
    
    - **agent**: Agent标识（可选）
    - **sessionId**: 会话ID（可选）
    - **messageId**: 消息ID（可选）
    - **question**: 用户问题（可选）
    - **productData**: 产品数据列表（可选）
    - **feedbackContent**: 反馈内容（可选）
    """
    def save_feedback(data: FeedbackRequest):
        from datetime import datetime
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                insert_sql = """
                    INSERT INTO ai_agent_feedback 
                    (agent, people, session_id, message_id, question, product_data, feedback_content, created_at) 
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """
                cursor.execute(insert_sql, [
                    data.agent or 'sale',
                    data.people or '',
                    data.sessionId or '',
                    data.messageId or '',
                    data.question or '',
                    json.dumps(data.productData, ensure_ascii=False) if data.productData else '',
                    data.feedbackContent or '',
                    now_str
                ])
                conn.commit()
                conn.close()
                return {"success": True}
        except Exception as e:
            logger.error(f"Database error in save_feedback: {e}")
            # 表可能不存在，尝试创建表后重试
            try:
                conn = get_db_connection()
                with conn.cursor() as cursor:
                    # 尝试删除旧表（如果存在但结构不对）
                    try:
                        cursor.execute("DROP TABLE IF EXISTS ai_agent_feedback")
                        conn.commit()
                    except:
                        pass
                    create_table_sql = """
                        CREATE TABLE IF NOT EXISTS ai_agent_feedback (
                            created_at VARCHAR(20),
                            agent VARCHAR(255),
                            people VARCHAR(255),
                            session_id VARCHAR(255),
                            message_id VARCHAR(255),
                            question VARCHAR(2000),
                            product_data VARCHAR(20000),
                            feedback_content VARCHAR(2000)
                        )
                        DUPLICATE KEY(created_at)
                        DISTRIBUTED BY HASH(created_at) BUCKETS 1
                        PROPERTIES ("replication_num" = "1")
                    """
                    cursor.execute(create_table_sql)
                    conn.commit()
                    # 重试插入
                    insert_sql = """
                        INSERT INTO ai_agent_feedback 
                        (agent, people, session_id, message_id, question, product_data, feedback_content, created_at) 
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    """
                    cursor.execute(insert_sql, [
                        data.agent or 'sale',
                        data.people or '',
                        data.sessionId or '',
                        data.messageId or '',
                        data.question or '',
                        json.dumps(data.productData, ensure_ascii=False) if data.productData else '',
                        data.feedbackContent or '',
                        now_str
                    ])
                    conn.commit()
                    conn.close()
                    return {"success": True}
            except Exception as e2:
                logger.error(f"Retry failed in save_feedback: {e2}")
                raise e2
    
    try:
        result = await run_in_threadpool(save_feedback, request)
        return {
            "success": True,
            "data": result,
            "message": "Feedback saved successfully"
        }
    except Exception as e:
        logger.error(f"Error saving feedback: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save feedback: {str(e)}")


# 问答记录请求模型
class ChatRecordRequest(BaseModel):
    agent: Optional[str] = 'sale'
    people: str
    question: str
    answer: str

@app.post("/api/save_chat_record")
async def save_chat_record(request: ChatRecordRequest):
    """
    保存 AI 问答记录
    
    - **agent**: 咨询角色，默认 'sale'
    - **people**: 对话人唯一标识
    - **question**: 用户提问
    - **answer**: AI回答
    """
    def do_save_record(data: ChatRecordRequest):
        from datetime import datetime
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                insert_sql = """
                    INSERT INTO ai_product_chat_v1 
                    (agent, people, chattime, question, answer) 
                    VALUES (%s, %s, %s, %s, %s)
                """
                cursor.execute(insert_sql, [
                    data.agent or 'sale',
                    data.people,
                    now_str,
                    data.question,
                    data.answer
                ])
                conn.commit()
                conn.close()
                return {"success": True}
        except Exception as e:
            logger.error(f"Database error in save_chat_record: {e}")
            # 表可能不存在，尝试创建表后重试
            try:
                conn = get_db_connection()
                with conn.cursor() as cursor:
                    create_table_sql = """
                        CREATE TABLE IF NOT EXISTS ai_product_chat_v1 (
                            agent VARCHAR(32) DEFAULT 'sale' COMMENT '咨询角色，默认值sale',
                            people VARCHAR(64) NOT NULL COMMENT '对话人唯一标识',
                            chattime DATETIME NOT NULL COMMENT '对话时间',
                            question STRING NOT NULL COMMENT '用户提问',
                            answer STRING NOT NULL COMMENT 'AI回答'
                        )
                        ENGINE = OLAP
                        UNIQUE KEY(agent, people, chattime)
                        COMMENT 'AI产品聊天问答记录表v1'
                        DISTRIBUTED BY HASH(people) BUCKETS 10
                        PROPERTIES (
                            "replication_allocation" = "tag.location.default: 1"
                        )
                    """
                    cursor.execute(create_table_sql)
                    conn.commit()
                    # 重试插入
                    insert_sql = """
                        INSERT INTO ai_product_chat_v1 
                        (agent, people, chattime, question, answer) 
                        VALUES (%s, %s, %s, %s, %s)
                    """
                    cursor.execute(insert_sql, [
                        data.agent or 'sale',
                        data.people,
                        now_str,
                        data.question,
                        data.answer
                    ])
                    conn.commit()
                    conn.close()
                    return {"success": True}
            except Exception as e2:
                logger.error(f"Retry failed in save_chat_record: {e2}")
                raise e2
    
    try:
        result = await run_in_threadpool(do_save_record, request)
        return {
            "success": True,
            "data": result,
            "message": "Chat record saved successfully"
        }
    except Exception as e:
        logger.error(f"Error saving chat record: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save chat record: {str(e)}")


@app.get("/api/ai_agent_feedbacks")
async def get_ai_agent_feedbacks(
    page: int = 1,
    page_size: int = 50,
    people: Optional[str] = None
):
    """
    获取所有 AI Agent 反馈列表
    
    - **page**: 页码，默认 1
    - **page_size**: 每页数量，默认 50
    - **people**: 筛选对话人 people 字段，可选
    """
    def fetch_feedbacks(page_num: int, size: int, people_filter: Optional[str]):
        offset = (page_num - 1) * size
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                # 构建查询条件
                where_clauses = []
                params = []
                
                if people_filter:
                    where_clauses.append("people = %s")
                    params.append(people_filter)
                
                where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
                
                # 查询总数
                count_sql = f"SELECT COUNT(*) as total FROM ai_agent_feedback {where_sql}"
                cursor.execute(count_sql, params)
                total_res = cursor.fetchone()
                total = total_res.get('total', 0) if total_res else 0
                
                # 查询列表 - 包含 people 字段
                list_sql = f"""
                    SELECT created_at, agent, people, session_id, message_id, question, product_data, feedback_content
                    FROM ai_agent_feedback 
                    {where_sql}
                    ORDER BY created_at DESC 
                    LIMIT %s OFFSET %s
                """
                cursor.execute(list_sql, params + [size, offset])
                rows = cursor.fetchall()
                conn.close()
                return total, rows
        except Exception as e:
            logger.error(f"Database error in get_ai_agent_feedbacks: {e}")
            return 0, []
    
    total, rows = await run_in_threadpool(fetch_feedbacks, page, page_size, people)
    
    return {
        "success": True,
        "total": total,
        "page": page,
        "page_size": page_size,
        "list": [
            {
                "created_at": row.get('created_at'),
                "agent": row.get('agent'),
                "people": row.get('people'),
                "sessionId": row.get('session_id'),
                "messageId": row.get('message_id'),
                "question": row.get('question'),
                "productData": json.loads(row.get('product_data')) if row.get('product_data') else None,
                "feedbackContent": row.get('feedback_content')
            } for row in rows
        ]
    }


@app.get("/api/chat_records")
async def get_chat_records(
    page: int = 1,
    page_size: int = 50,
    agent: Optional[str] = None,
    people: Optional[str] = None
):
    """
    获取 AI 问答记录列表
    
    - **page**: 页码，默认 1
    - **page_size**: 每页数量，默认 50
    - **agent**: 筛选咨询角色，可选
    - **people**: 筛选对话人，可选
    """
    def fetch_records(page_num: int, size: int, agent_filter: Optional[str], people_filter: Optional[str]):
        offset = (page_num - 1) * size
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                # 构建查询条件
                where_clauses = []
                params = []
                
                if agent_filter:
                    where_clauses.append("agent = %s")
                    params.append(agent_filter)
                if people_filter:
                    where_clauses.append("people = %s")
                    params.append(people_filter)
                
                where_sql = "WHERE " + " AND ".join(where_clauses) if where_clauses else ""
                
                # 查询总数
                count_sql = f"SELECT COUNT(*) as total FROM ai_product_chat_v1 {where_sql}"
                cursor.execute(count_sql, params)
                total_res = cursor.fetchone()
                total = total_res.get('total', 0) if total_res else 0
                
                # 查询列表
                list_sql = f"""
                    SELECT agent, people, chattime, question, answer
                    FROM ai_product_chat_v1 
                    {where_sql}
                    ORDER BY chattime DESC 
                    LIMIT %s OFFSET %s
                """
                cursor.execute(list_sql, params + [size, offset])
                rows = cursor.fetchall()
                conn.close()
                return total, rows
        except Exception as e:
            logger.error(f"Database error in get_chat_records: {e}")
            return 0, []
    
    total, rows = await run_in_threadpool(fetch_records, page, page_size, agent, people)
    
    return {
        "success": True,
        "total": total,
        "page": page,
        "page_size": page_size,
        "list": [
            {
                "agent": row.get('agent'),
                "people": row.get('people'),
                "chattime": row.get('chattime'),
                "question": row.get('question'),
                "answer": row.get('answer')
            } for row in rows
        ]
    }


@app.post("/api/get_group_info")
async def get_group_info(request_data: List[Dict[str, Any]] = Body(...)):
    """
    获取分组信息接口
    
    根据传入的过滤条件，返回其他分组字段的不为空的分组值
    
    - 处理字段：fun、silhouette、touch、dressing_occasion、applicable_crowd、style、elem、fabric_erp
    - elem: 成分组合
    - fabric_erp: 布种
    - 其他字段会被过滤忽略
    - 对未传入的字段进行 GROUP BY 查询，返回不为空的分组值
    
    示例请求:
    ```json
    [
        {"dressing_occasion": "连衣裙"},
        {"price": "20-35元"}
    ]
    ```
    
    返回示例:
    ```json
    {
        "success": true,
        "filters": {"dressing_occasion": ["连衣裙"]},
        "groups": {
            "fun": ["保暖", "凉感", ...],
            "silhouette": ["垂坠", "挺括", ...],
            "touch": ["蓬松", "干爽", ...],
            "applicable_crowd": ["女款", "男款", ...],
            "style": ["休闲", "打底", ...],
            "elem": ["棉", "人棉", "聚酯纤维", ...],
            "fabric_erp": ["平纹", "珠地", "罗纹", ...]
        }
    }
    ```
    """
    # 定义允许的分组字段
    ALLOWED_FIELDS = {'fun', 'silhouette', 'touch', 'dressing_occasion', 'applicable_crowd', 'style', 'elem', 'fabric_erp'}
    
    # 收集过滤条件（只保留允许的字段）
    filters = {}
    for item in request_data:
        if isinstance(item, dict):
            for key, value in item.items():
                if key in ALLOWED_FIELDS and value is not None and value != '':
                    if key not in filters:
                        filters[key] = []
                    if isinstance(value, list):
                        filters[key].extend([v for v in value if v is not None and v != ''])
                    else:
                        filters[key].append(value)
    
    # 去重过滤值
    for key in filters:
        filters[key] = list(dict.fromkeys(filters[key]))  # 保持顺序去重
    
    # 确定需要查询分组的字段（未传入的允许字段）
    fields_to_query = ALLOWED_FIELDS - set(filters.keys())
    
    def fetch_groups():
        conn = None
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                results = {}
                
                # 构建基础 WHERE 条件（用于过滤数据）
                where_conditions = []
                params = []
                
                for field, values in filters.items():
                    if values:
                        placeholders = ', '.join(['%s'] * len(values))
                        where_conditions.append(f"{field} IN ({placeholders})")
                        params.extend(values)
                
                where_sql = ''
                if where_conditions:
                    where_sql = 'WHERE ' + ' AND '.join(where_conditions)
                
                # 定义需要返回Top3的字段
                TOP3_FIELDS = {'elem', 'fabric_erp', 'fun'}
                
                # 对每个未传入的字段进行查询
                for field in fields_to_query:
                    # 对 elem、fabric_erp、fun 字段，返回产品数量最多的前3个
                    if field in TOP3_FIELDS:
                        sql = f"""
                            SELECT {field} as field_value, COUNT(*) as cnt
                            FROM ai_product_app_v1 
                            {where_sql}
                            GROUP BY {field}
                            HAVING {field} IS NOT NULL AND {field} != ''
                            ORDER BY cnt DESC
                            LIMIT 3
                        """
                        cursor.execute(sql, params.copy() if params else [])
                        rows = cursor.fetchall()
                        values = [row['field_value'] for row in rows if row['field_value'] is not None and row['field_value'] != '']
                    else:
                        # 其他字段返回所有分组值
                        sql = f"""
                            SELECT DISTINCT {field} as field_value
                            FROM ai_product_app_v1 
                            {where_sql}
                            HAVING {field} IS NOT NULL AND {field} != ''
                            ORDER BY {field}
                        """
                        cursor.execute(sql, params.copy() if params else [])
                        rows = cursor.fetchall()
                        values = [row['field_value'] for row in rows if row['field_value'] is not None and row['field_value'] != '']
                    
                    # 对 elem 字段特殊处理：去除百分比数字
                    if field == 'elem':
                        cleaned_values = []
                        for val in values:
                            # 去除百分比数字，如 "46.2%粘纤" → "粘纤"
                            # 匹配模式：数字% 或 数字(空格)%
                            cleaned = re.sub(r'\d+(?:\.\d+)?%\s*', '', val).strip()
                            if cleaned:
                                cleaned_values.append(cleaned)
                        # 去重并保持顺序
                        values = list(dict.fromkeys(cleaned_values))
                    
                    # 对 fabric_erp 字段特殊处理：去除规格如 1x1、1x2、2x2 等
                    if field == 'fabric_erp':
                        cleaned_values = []
                        for val in values:
                            # 去除规格数字，如 "拉架1X1罗纹" → "拉架罗纹"
                            # 匹配模式：数字x数字（不区分大小写）
                            cleaned = re.sub(r'\d+[xX]\d+', '', val).strip()
                            if cleaned:
                                cleaned_values.append(cleaned)
                        # 去重并保持顺序
                        values = list(dict.fromkeys(cleaned_values))
                    
                    results[field] = values
                
                conn.close()
                return results
        except Exception as e:
            logger.error(f"Error fetching group info: {e}")
            if conn:
                conn.close()
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    groups = await run_in_threadpool(fetch_groups)
    
    return {
        "success": True,
        "filters": filters,
        "groups": groups
    }


# --- ai_product_app_v1 表专用接口 ---

# 商品列表接口 - 显示字段定义
PRODUCT_LIST_FIELDS = [
    'name', 'code', 'weight', 'width', 'price', 'taxkgprice', 'kgprice', 'taxmprice', 'fewprice',
    'className', 'elem', 'inelem', 'series', 'emptyqty', 'papertubeqty', 'type_name', 'season',
    'stock_qty', 'image_urls', 'color_name', 'fabe', 'devproid', 'unpilling', 'spring_color_fastness',
    'light_fastness', 'dry_rubbing_fastness', 'sale_num_year', 'report_urls', 'release_date',
    'customizable_grade', 'fabric_structure_two', 'production_process', 'fun', 'silhouette', 'touch',
    'dressing_occasion', 'applicable_crowd', 'style'
]

# 可筛选字段定义（包含显示字段中可用于筛选的字段）
PRODUCT_FILTER_FIELDS = [
    'code', 'name', 'weight', 'width', 'price', 'taxkgprice', 'kgprice', 'taxmprice', 'fewprice',
    'className', 'elem', 'inelem', 'series', 'type_name', 'season', 'color_name', 'fabe', 'devproid',
    'unpilling', 'spring_color_fastness', 'light_fastness', 'dry_rubbing_fastness', 'sale_num_year',
    'customizable_grade', 'fabric_structure_two', 'production_process', 'fun', 'silhouette', 'touch',
    'dressing_occasion', 'applicable_crowd', 'style', 'release_date', 'code_start', 'type_notes'
]

# 可编辑字段定义（只允许编辑以下字段）
PRODUCT_EDITABLE_FIELDS = [
    'fun', 'silhouette', 'touch', 'dressing_occasion', 'applicable_crowd', 'style',
    'customizable_grade', 'unpilling', 'spring_color_fastness', 'light_fastness', 'dry_rubbing_fastness'
]

class ProductListRequest(BaseModel):
    """商品列表查询请求"""
    page: int = Field(1, description="页码，默认 1")
    page_size: int = Field(20, description="每页数量，默认 20，最大 100")
    keyword: Optional[str] = Field(None, description="关键词搜索（搜索 code 或 name）")
    filters: Optional[Dict[str, Any]] = Field(None, description="筛选条件字典")
    sort_by: Optional[str] = Field(None, description="排序字段")
    sort_order: Optional[str] = Field("desc", description="排序方向：asc/desc")
    fields: Optional[List[str]] = Field(None, description="需要返回的字段列表，为空或未指定时返回默认字段")
    
    model_config = ConfigDict(extra="allow")

class ProductEditRequest(BaseModel):
    """商品编辑请求"""
    name: Optional[str] = Field(None, description="品名")
    weight: Optional[Union[int, str]] = Field(None, description="克重")
    width: Optional[str] = Field(None, description="幅宽")
    price: Optional[Union[int, str]] = Field(None, description="大货价")
    taxkgprice: Optional[Union[float, str]] = Field(None, description="含税公斤价")
    kgprice: Optional[Union[float, str]] = Field(None, description="净布价")
    taxmprice: Optional[Union[float, str]] = Field(None, description="含税米价")
    fewprice: Optional[str] = Field(None, description="散剪价")
    className: Optional[str] = Field(None, description="布种")
    elem: Optional[str] = Field(None, description="成分")
    inelem: Optional[str] = Field(None, description="纱支")
    series: Optional[str] = Field(None, description="系列")
    emptyqty: Optional[str] = Field(None, description="空差")
    papertubeqty: Optional[str] = Field(None, description="纸筒")
    type_name: Optional[str] = Field(None, description="运营分类")
    season: Optional[str] = Field(None, description="季节")
    stock_qty: Optional[str] = Field(None, description="库存")
    image_urls: Optional[str] = Field(None, description="色卡图片 URL")
    color_name: Optional[str] = Field(None, description="颜色")
    fabe: Optional[str] = Field(None, description="销售话术")
    devproid: Optional[Union[int, str]] = Field(None, description="开发款号")
    unpilling: Optional[str] = Field(None, description="抗起毛起球")
    spring_color_fastness: Optional[str] = Field(None, description="搅浮色牢度")
    light_fastness: Optional[str] = Field(None, description="耐光色牢度")
    dry_rubbing_fastness: Optional[str] = Field(None, description="干摩擦牢度")
    sale_num_year: Optional[Union[int, str]] = Field(None, description="近一年销量")
    report_urls: Optional[str] = Field(None, description="检测报告 URL")
    release_date: Optional[str] = Field(None, description="上架日期")
    customizable_grade: Optional[str] = Field(None, description="可订等级")
    fabric_structure_two: Optional[str] = Field(None, description="布种")
    production_process: Optional[str] = Field(None, description="工艺")
    fun: Optional[str] = Field(None, description="功能")
    silhouette: Optional[str] = Field(None, description="廓形")
    touch: Optional[str] = Field(None, description="手感")
    dressing_occasion: Optional[str] = Field(None, description="品类/用途")
    applicable_crowd: Optional[str] = Field(None, description="适用人群")
    style: Optional[str] = Field(None, description="风格")
    type_notes: Optional[str] = Field(None, description="类型备注")
    fabric_erp: Optional[str] = Field(None, description="ERP布种")
    introduce: Optional[str] = Field(None, description="产品介绍")

@app.post("/api/products/list")
async def get_product_list(request: ProductListRequest):
    """
    获取商品列表接口（支持分页和筛选）
    
    - **page**: 页码，默认 1
    - **page_size**: 每页数量，默认 20，最大 100
    - **keyword**: 关键词搜索（搜索 code 或 name）
    - **filters**: 筛选条件字典，如 {"elem": "棉", "season": "春"}
    - **sort_by**: 排序字段，如 "sale_num_year"
    - **sort_order**: 排序方向，"asc" 或 "desc"
    
    返回字段包含：
    name、code、weight、width、price、taxkgprice、kgprice、taxmprice、fewprice、className、
    elem、inelem、series、emptyqty、papertubeqty、type_name、season、stock_qty、image_urls、
    color_name、fabe、devproid、unpilling、spring_color_fastness、light_fastness、
    dry_rubbing_fastness、sale_num_year、report_urls、release_date、customizable_grade、
    fabric_structure_two、production_process、fun、silhouette、touch、dressing_occasion、
    applicable_crowd、style
    """
    start_time = time.time()
    
    # 参数校验
    page = max(1, request.page)
    page_size = min(100, max(1, request.page_size))
    offset = (page - 1) * page_size
    
    # 构建查询字段
    # 处理 fields 参数：如果为空数组或未指定，使用默认字段
    requested_fields = getattr(request, 'fields', None)
    if requested_fields and len(requested_fields) > 0:
        # 确保只包含有效字段
        valid_fields = [f for f in requested_fields if f in PRODUCT_LIST_FIELDS]
        if valid_fields:
            fields_sql = ", ".join(valid_fields)
        else:
            fields_sql = ", ".join(DEFAULT_RETURN_FIELDS)
    else:
        # 未指定或为空数组，使用默认字段
        fields_sql = ", ".join(DEFAULT_RETURN_FIELDS)
    
    # 构建 WHERE 条件
    where_conditions = ["1=1"]
    params = []
    
    # 关键词搜索
    if request.keyword:
        where_conditions.append("(code LIKE %s OR name LIKE %s)")
        keyword_param = f"%{request.keyword}%"
        params.extend([keyword_param, keyword_param])
    
    # 筛选条件处理
    if request.filters and isinstance(request.filters, dict):
        for field, value in request.filters.items():
            if field not in PRODUCT_FILTER_FIELDS or value is None or value == '':
                continue
            
            # 数值字段范围查询支持
            if field in NUMERIC_FIELDS and isinstance(value, str):
                clause = build_numeric_sql(field, value)
                if clause:
                    where_conditions.append(clause)
                    continue
            
            # 硬指标字段精确匹配
            if field in HARD_CODED_FIELDS:
                if isinstance(value, list):
                    placeholders = ", ".join(["%s"] * len(value))
                    where_conditions.append(f"{field} IN ({placeholders})")
                    params.extend(value)
                else:
                    where_conditions.append(f"{field} = %s")
                    params.append(value)
                continue
            
            # 文本字段模糊匹配
            if isinstance(value, list):
                placeholders = ", ".join(["%s"] * len(value))
                where_conditions.append(f"{field} IN ({placeholders})")
                params.extend(value)
            else:
                where_conditions.append(f"{field} LIKE %s")
                params.append(f"%{value}%")
    
    where_sql = " AND ".join(where_conditions)
    
    # 过滤价格和克重为0或空的产品（确保数据有效性）
    price_fields = ['price', 'taxkgprice', 'taxmprice', 'fewprice', 'kgprice']
    for field in price_fields:
        where_sql += f" AND (CAST({field} AS DECIMAL) > 0 OR {field} IS NULL)"
    
    # 克重字段过滤（weight 为0或空的产品也过滤掉）
    where_sql += " AND (CAST(weight AS DECIMAL) > 0 OR weight IS NULL)"
    
    # 排序处理
    sort_field = request.sort_by if request.sort_by and request.sort_by in PRODUCT_LIST_FIELDS else "sale_num_year"
    sort_order = "DESC" if request.sort_order.lower() == "desc" else "ASC"
    
    # 对数值字段进行类型转换，确保按数值排序而非字符串排序
    if sort_field in NUMERIC_FIELDS:
        sort_field_sql = f"CAST({sort_field} AS DECIMAL)"
    else:
        sort_field_sql = sort_field
    
    def fetch_product_list():
        conn = None
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                # 查询总数
                count_sql = f"SELECT COUNT(*) as total FROM ai_product_app_v1 WHERE {where_sql}"
                cursor.execute(count_sql, params)
                total_result = cursor.fetchone()
                total = total_result.get('total', 0) if total_result else 0
                
                # 查询数据
                sql = f"""
                    SELECT {fields_sql} 
                    FROM ai_product_app_v1 
                    WHERE {where_sql}
                    ORDER BY {sort_field_sql} {sort_order}
                    LIMIT %s OFFSET %s
                """
                cursor.execute(sql, params + [page_size, offset])
                rows = cursor.fetchall()
                
                return total, rows
        except Exception as e:
            logger.error(f"Database error in get_product_list: {e}")
            raise e
        finally:
            if conn:
                conn.close()
    
    try:
        total, rows = await run_in_threadpool(fetch_product_list)
        
        # 处理返回数据
        cleaned_rows = []
        codes = []
        for row in rows:
            serialized = serialize_row(row)
            cleaned_rows.append(serialized)
            if serialized.get('code'):
                codes.append(str(serialized['code']))
        
        # 批量获取素材图
        if codes:
            process_material_images(cleaned_rows, codes)
        
        elapsed_time = round((time.time() - start_time) * 1000, 2)
        logger.info(f"[Product List] page={page}, page_size={page_size}, total={total}, time_ms={elapsed_time}")
        
        return {
            "success": True,
            "data": {
                "list": cleaned_rows,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": (total + page_size - 1) // page_size
                }
            }
        }
    except Exception as e:
        logger.error(f"Error in get_product_list: {e}")
        raise HTTPException(status_code=500, detail=f"获取商品列表失败: {str(e)}")

@app.put("/api/products/{code}")
async def update_product(code: str, request: ProductEditRequest):
    """
    商品编辑接口
    
    - **code**: 款号（路径参数，主键）
    - 请求体为商品字段，支持更新的字段包括：
      name、weight、width、price、taxkgprice、kgprice、taxmprice、fewprice、
      className、elem、inelem、series、emptyqty、papertubeqty、type_name、season、
      stock_qty、image_urls、color_name、fabe、devproid、unpilling、
      spring_color_fastness、light_fastness、dry_rubbing_fastness、sale_num_year、
      report_urls、release_date、customizable_grade、fabric_structure_two、
      production_process、fun、silhouette、touch、dressing_occasion、
      applicable_crowd、style、type_notes、fabric_erp、introduce
    """
    if not code:
        raise HTTPException(status_code=400, detail="款号 code 不能为空")
    
    # 构建更新字段和值
    update_fields = []
    update_values = []
    
    # 遍历请求体中非空字段
    request_data = request.model_dump(exclude_unset=True)
    
    if not request_data:
        raise HTTPException(status_code=400, detail="没有提供要更新的字段")
    
    for field, value in request_data.items():
        if field in PRODUCT_EDITABLE_FIELDS and value is not None:
            update_fields.append(f"{field} = %s")
            update_values.append(value)
    
    if not update_fields:
        raise HTTPException(status_code=400, detail="没有有效的可更新字段")
    
    # 添加更新时间和款号条件
    update_values.append(code)
    
    def do_update():
        conn = None
        try:
            conn = get_db_connection()
            with conn.cursor() as cursor:
                # 先检查商品是否存在
                check_sql = "SELECT code FROM ai_product_app_v1 WHERE code = %s LIMIT 1"
                cursor.execute(check_sql, [code])
                existing = cursor.fetchone()
                
                if not existing:
                    return None, "PRODUCT_NOT_FOUND"
                
                # 执行更新
                update_sql = f"""
                    UPDATE ai_product_app_v1 
                    SET {', '.join(update_fields)}, updatedate = NOW()
                    WHERE code = %s
                """
                cursor.execute(update_sql, update_values)
                conn.commit()
                
                affected_rows = cursor.rowcount
                return affected_rows, None
        except Exception as e:
            logger.error(f"Database error in update_product for code {code}: {e}")
            raise e
        finally:
            if conn:
                conn.close()
    
    try:
        affected_rows, error = await run_in_threadpool(do_update)
        
        if error == "PRODUCT_NOT_FOUND":
            raise HTTPException(status_code=404, detail=f"商品 '{code}' 不存在")
        
        logger.info(f"[Product Update] code={code}, affected_rows={affected_rows}")
        
        return {
            "success": True,
            "data": {
                "code": code,
                "affected_rows": affected_rows
            },
            "message": "商品更新成功"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in update_product: {e}")
        raise HTTPException(status_code=500, detail=f"更新商品失败: {str(e)}")


@app.get("/api/wechat/auth_url")
async def get_auth_url(login_type: str = Query(...)):
    """获取企业微信授权URL"""
    global wechat
    logger.info(f"[API /api/wechat/auth_url] Request received - login_type={login_type}")
    try:
        wechat = WeChat(login_type)
        auth_url = wechat.get_auth_url()
        logger.info(f"[API /api/wechat/auth_url] Success - login_type={login_type}, auth_url={auth_url}")
        return JSONResponse({"auth_url": auth_url})
    except Exception as e:
        logger.error(f"[API /api/wechat/auth_url] Error - login_type={login_type}, error={str(e)}")
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/auth/callback")
async def wechat_callback(code: str, state: str = ""):
    """
    企业微信授权回调接口
    支持自动尝试两个企业主体（先 rc，后 rs）
    """
    logger.info(f"[API /api/auth/callback] Callback received - code={code}, state={state}")
    
    if not code:
        logger.warning(f"[API /api/auth/callback] No code provided, redirecting with '非企业微信使用'")
        return RedirectResponse(url="https://ai.wyoooni.net/?userid=非企业微信使用")
    
    # 尝试的登录类型顺序：先 rc，后 rs
    login_types = ['rc', 'rs']
    
    for login_type in login_types:
        logger.info(f"[API /api/auth/callback] Trying login_type={login_type}")
        wechat = WeChat(login_type)
        
        access_token = await wechat.get_access_token()
        if not access_token:
            logger.warning(f"[API /api/auth/callback] Failed to get access_token for type={login_type}")
            continue
        
        user_info = await wechat.get_user_info(access_token, code)
        if user_info:
            userid = user_info.get('userid', '')
            name = user_info.get('name', '')
            if userid:
                logger.info(f"[API /api/auth/callback] Success - userid={userid}, name={name} with type={login_type}")
                # 重定向到前端页面，带上 userid 参数
                frontend_url = f"{wechat.redirect_uri}?userid={userid}"
                logger.info(f"[API /api/auth/callback] Redirecting to: {frontend_url}")
                return RedirectResponse(url=frontend_url)
        
        logger.warning(f"[API /api/auth/callback] Failed to get user_info with type={login_type}")
    
    # 所有类型都失败了
    logger.error("[API /api/auth/callback] All login types failed, redirecting with '非企业微信使用'")
    return RedirectResponse(url="https://ai.wyoooni.net/?userid=非企业微信使用")
    logger.info(f"[API /api/auth/callback] Redirecting to: {frontend_url}")
    return RedirectResponse(url=frontend_url)

@app.get("/api/wechat/user_info")
async def get_user_info_by_code(code: str):
    """通过授权码获取用户信息"""
    global wechat
    logger.info(f"[API /api/wechat/user_info] Request received - code={code}")
    
    if not wechat:
        logger.warning(f"[API /api/wechat/user_info] WeChat object not initialized")
        return JSONResponse({"success": False, "message": "未初始化企业微信对象"})

    if not code:
        logger.warning(f"[API /api/wechat/user_info] Missing required parameter: code")
        return JSONResponse({"success": False, "message": "缺少授权码"})
    
    logger.info(f"[API /api/wechat/user_info] Getting access_token...")
    access_token = await wechat.get_access_token()
    if not access_token:
        logger.error(f"[API /api/wechat/user_info] Failed to get access_token")
        return JSONResponse({"success": False, "message": "获取access_token失败"})
    
    logger.info(f"[API /api/wechat/user_info] Getting user_info with code={code}...")
    user_info = await wechat.get_user_info(access_token, code)
    if user_info:
        result = {
            "success": True,
            "user_info": {
                "userid": user_info.get("UserId", ""),
                "name": user_info.get("name", ""),
                "mobile": user_info.get("mobile", ""),
                "email": user_info.get("email", ""),
                "avatar": user_info.get("avatar", ""),
                "department": user_info.get("department", [])
            }
        }
        logger.info(f"[API /api/wechat/user_info] Success - userid={user_info.get('UserId', '')}, name={user_info.get('name', '')}")
        return JSONResponse(result)
    
    logger.warning(f"[API /api/wechat/user_info] Failed to get user_info")
    return JSONResponse({"success": False, "message": "获取用户信息失败"})


if __name__ == "__main__":
    port = int(os.getenv('API_PORT', '8012'))
    uvicorn.run(app, host="0.0.0.0", port=port)
