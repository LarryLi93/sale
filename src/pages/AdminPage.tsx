import React, { useState, useEffect } from 'react';
import { Search, Save, Edit2, X, ChevronLeft, ChevronRight, Loader2, ChevronDown, MessageSquare, Package, XCircle, MessagesSquare, BookOpen } from 'lucide-react';

// Cookie 工具函数
const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
};

const API_BASE_URL = `${import.meta.env.VITE_API_URL}/api`;

interface Product {
  name: string;
  code: string;
  weight: number;
  width: string;
  price: number;
  taxkgprice: number;
  kgprice: number;
  taxmprice: number;
  fewprice: string;
  className: string;
  elem: string;
  inelem: string;
  series: string;
  emptyqty: string;
  papertubeqty: string;
  type_name: string;
  season: string;
  stock_qty: string;
  image_urls: string;
  color_name: string;
  fabe: string;
  devproid: number;
  unpilling: string;
  spring_color_fastness: string;
  light_fastness: string;
  dry_rubbing_fastness: string;
  sale_num_year: number;
  report_urls: string;
  release_date: string;
  customizable_grade: string;
  fabric_structure_two: string;
  production_process: string;
  fun: string;
  silhouette: string;
  touch: string;
  dressing_occasion: string;
  applicable_crowd: string;
  style: string;
  [key: string]: any;
}

const FIELD_MAP: Record<string, string> = {
  name: '品名',
  code: '款号',
  image_urls: '图片',
  // 可编辑字段 - 放在款号后面
  fun: '功能',
  silhouette: '廓形',
  touch: '手感',
  dressing_occasion: '品类/用途',
  applicable_crowd: '适用人群',
  style: '风格',
  customizable_grade: '可订等级',
  unpilling: '抗起毛起球',
  spring_color_fastness: '搅浮色牢度',
  light_fastness: '耐光色牢度',
  dry_rubbing_fastness: '干摩擦牢度',
  // 其他字段
  weight: '克重',
  width: '幅宽',
  price: '大货价',
  taxkgprice: '含税公斤价',
  kgprice: '净布价',
  taxmprice: '含税米价',
  fewprice: '散剪价',
  className: '布种',
  elem: '成分',
  inelem: '纱支',
  emptyqty: '空差',
  papertubeqty: '纸筒',
  type_name: '运营分类',
  fabe: '销售话术',
  devproid: '开发款号',
  sale_num_year: '近一年销量',
  report_urls: '检测报告',
  fabric_structure_two: '布种(二)',
  production_process: '工艺'
};

const FIELDS = Object.keys(FIELD_MAP);

// 可编辑字段配置（只允许编辑以下字段）
const EDITABLE_FIELDS = new Set([
  'fun', 'silhouette', 'touch', 'dressing_occasion', 'applicable_crowd', 'style',
  'customizable_grade', 'unpilling', 'spring_color_fastness', 'light_fastness', 'dry_rubbing_fastness'
]);

// 反馈记录类型
interface FeedbackItem {
  created_at: string;
  agent: string;
  people: string;
  sessionId: string;
  messageId: string;
  question: string;
  productData: any[] | null;
  feedbackContent: string;
}

// 问答记录类型
interface ChatRecordItem {
  agent: string;
  people: string;
  chattime: string;
  question: string;
  answer: string;
}

const AdminPage: React.FC = () => {
  // 标签页切换，默认显示问答记录
  const [activeTab, setActiveTab] = useState<'products' | 'feedback' | 'chat'>('chat');
  
  // 商品管理状态
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [keyword, setKeyword] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Partial<Product>>({});
  const [saving, setSaving] = useState<string | null>(null);
  
  // 反馈记录状态
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackTotal, setFeedbackTotal] = useState(0);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [feedbackPageSize] = useState(20);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // 从 cookie 获取 user_id
  const userId = getCookie('user_id') || '';
  
  // 问答记录状态
  const [chatList, setChatList] = useState<ChatRecordItem[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatTotal, setChatTotal] = useState(0);
  const [chatPage, setChatPage] = useState(1);
  const [chatPageSize] = useState(20);
  const [expandedChatRows, setExpandedChatRows] = useState<Set<number>>(new Set());
  
  // 规则录入弹窗状态
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleContent, setRuleContent] = useState('');
  const [ruleLoading, setRuleLoading] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/products/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          page,
          page_size: pageSize,
          keyword,
          filters,
          sort_by: 'release_date',
          sort_order: 'desc'
        })
      });
      const data = await res.json();
      console.log('API Response:', data);
      
      let list = [];
      let totalCount = 0;

      // 适配新结构: { success: true, data: { list: [...], pagination: { total: 2754, ... } } }
      if (data.data && data.data.list && Array.isArray(data.data.list)) {
        list = data.data.list;
        totalCount = data.data.pagination?.total || data.data.total || list.length;
      } 
      // 适配另一种结构: { list: [...], pagination: { total: 2754, ... } }
      else if (data.list && Array.isArray(data.list)) {
        list = data.list;
        totalCount = data.pagination?.total || data.total || list.length;
      }
      // 适配旧结构: { data: [...], total: 100 }
      else if (data.data && Array.isArray(data.data)) {
        list = data.data;
        totalCount = data.total || list.length;
      }
      // 适配最简结构: [...]
      else if (Array.isArray(data)) {
        list = data;
        totalCount = list.length;
      }

      setProducts(list);
      setTotal(totalCount);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setProducts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, pageSize]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  const handleClearFilters = () => {
    setFilters({});
    setKeyword('');
    setPage(1);
    setTimeout(fetchProducts, 0);
  };

  const startEdit = (product: Product) => {
    setEditingRow(product.code);
    // 只复制可编辑字段的值
    const editableValues: Partial<Product> = {};
    EDITABLE_FIELDS.forEach(field => {
      editableValues[field] = product[field];
    });
    setEditingValues(editableValues);
  };

  const cancelEdit = () => {
    setEditingRow(null);
    setEditingValues({});
  };

  const handleValueChange = (field: string, value: any) => {
    setEditingValues(prev => ({ ...prev, [field]: value }));
  };

  const saveEdit = async (code: string) => {
    setSaving(code);
    try {
      const res = await fetch(`${API_BASE_URL}/products/${code}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingValues)
      });
      const data = await res.json();
      if (data.success) {
        setProducts(prev => prev.map(p => p.code === code ? { ...p, ...editingValues } : p));
        setEditingRow(null);
        setEditingValues({});
      } else {
        alert('保存失败: ' + data.message);
      }
    } catch (error) {
      console.error('Failed to save product:', error);
      alert('保存出错');
    } finally {
      setSaving(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, code: string) => {
    if (e.key === 'Enter') {
      saveEdit(code);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleFilterSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchProducts();
  };

  // 获取反馈记录
  const fetchFeedback = async () => {
    setFeedbackLoading(true);
    try {
      // 如果有 user_id，传入 people 参数
      const peopleParam = userId ? `&people=${encodeURIComponent(userId)}` : '';
      const res = await fetch(`${API_BASE_URL}/ai_agent_feedbacks?page=${feedbackPage}&page_size=${feedbackPageSize}`);
      const data = await res.json();
      
      if (data.success) {
        // 打印调试信息
        console.log('Feedback data:', data.list);
        setFeedbackList(data.list || []);
        setFeedbackTotal(data.total || 0);
      } else {
        setFeedbackList([]);
        setFeedbackTotal(0);
      }
    } catch (error) {
      console.error('Failed to fetch feedback:', error);
      setFeedbackList([]);
      setFeedbackTotal(0);
    } finally {
      setFeedbackLoading(false);
    }
  };

  // 获取问答记录
  const fetchChatRecords = async () => {
    setChatLoading(true);
    try {
      // 如果有 user_id，传入 people 参数
      const peopleParam = userId ? `&people=${encodeURIComponent(userId)}` : '';
      const res = await fetch(`${API_BASE_URL}/chat_records?page=${chatPage}&page_size=${chatPageSize}${peopleParam}`);
      const data = await res.json();
      
      if (data.success) {
        setChatList(data.list || []);
        setChatTotal(data.total || 0);
      } else {
        setChatList([]);
        setChatTotal(0);
      }
    } catch (error) {
      console.error('Failed to fetch chat records:', error);
      setChatList([]);
      setChatTotal(0);
    } finally {
      setChatLoading(false);
    }
  };

  // 切换标签页时加载对应数据
  useEffect(() => {
    if (activeTab === 'feedback') {
      // 清空列表并加载
      setFeedbackList([]);
      fetchFeedback();
    } else if (activeTab === 'chat') {
      // 清空列表并加载
      setChatList([]);
      fetchChatRecords();
    }
  }, [activeTab, feedbackPage, chatPage]);
  
  // 获取规则内容
  const fetchRuleContent = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/agent_prompt/sale`);
      if (response.ok) {
        const data = await response.json();
        if (data.prompt) {
          setRuleContent(data.prompt);
        }
      }
    } catch (error) {
      console.error('获取规则内容失败:', error);
    }
  };
  
  // 打开弹窗时加载规则内容
  useEffect(() => {
    if (showRuleModal) {
      fetchRuleContent();
    }
  }, [showRuleModal]);
  
  // 保存规则
  const handleSaveRule = async () => {
    setRuleLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/agent_prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent: 'sale', prompt: ruleContent })
      });
      if (response.ok) {
        alert('规则保存成功');
        setShowRuleModal(false);
      } else {
        alert('保存失败');
      }
    } catch (error) {
      console.error('保存规则失败:', error);
      alert('保存失败');
    } finally {
      setRuleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 font-sans">
      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Tab Switcher */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-2 mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'chat'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MessagesSquare size={16} />
              问答记录
            </button>
            <button
              onClick={() => setActiveTab('feedback')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'feedback'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MessageSquare size={16} />
              反馈记录
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === 'products'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Package size={16} />
              商品管理
            </button>
            <button
              onClick={() => setShowRuleModal(true)}
              className="px-6 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 text-gray-600 hover:bg-gray-100"
            >
              <BookOpen size={16} />
              规则录入
            </button>
          </div>
        </div>

        {activeTab === 'chat' ? (
          /* 问答记录列表 */
          <div key="chat-tab" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <div className="w-2 h-6 bg-orange-500 rounded-full"></div>
                问答记录列表
              </h1>
              <span className="text-sm text-gray-500">
                共 <span className="font-bold text-gray-800">{chatTotal}</span> 条记录
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">序号</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">对话人</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[200px]">问题</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[250px]">回答</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-40">时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {chatLoading ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="animate-spin text-orange-500" size={32} />
                          <span className="text-gray-500 text-sm font-medium">正在获取问答记录...</span>
                        </div>
                      </td>
                    </tr>
                  ) : chatList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-gray-500 text-sm">
                        暂无问答记录
                      </td>
                    </tr>
                  ) : (
                    chatList.map((item, index) => (
                      <tr key={index} className="hover:bg-orange-50/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {(chatPage - 1) * chatPageSize + index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          <div className="truncate max-w-[120px]" title={item.people}>
                            {item.people || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          <div className="line-clamp-2" title={item.question}>
                            {item.question || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          <div className={`${expandedChatRows.has(index) ? '' : 'line-clamp-2'}`} title={item.answer}>
                            {item.answer || '-'}
                          </div>
                          {item.answer && item.answer.length > 100 && (
                            <button
                              onClick={() => {
                                const newExpanded = new Set(expandedChatRows);
                                if (newExpanded.has(index)) {
                                  newExpanded.delete(index);
                                } else {
                                  newExpanded.add(index);
                                }
                                setExpandedChatRows(newExpanded);
                              }}
                              className="text-xs text-orange-500 hover:text-orange-600 mt-1 font-medium"
                            >
                              {expandedChatRows.has(index) ? '收起' : '展开'}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {item.chattime}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-500 font-medium">
                共 <span className="font-bold text-gray-800">{chatTotal}</span> 条记录
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setChatPage(p => Math.max(1, p - 1))}
                  disabled={chatPage === 1 || chatLoading}
                  className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold px-3 py-1 bg-white border border-orange-200 text-orange-600 rounded-lg shadow-sm">
                    {chatPage}
                  </span>
                  <span className="text-sm text-gray-400 font-medium">/</span>
                  <span className="text-sm text-gray-500 font-medium">
                    {Math.ceil(chatTotal / chatPageSize) || 1}
                  </span>
                </div>
                <button
                  onClick={() => setChatPage(p => p + 1)}
                  disabled={chatPage >= Math.ceil(chatTotal / chatPageSize) || chatLoading}
                  className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'feedback' ? (
          /* 反馈记录列表 */
          <div key="feedback-tab" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <div className="w-2 h-6 bg-orange-500 rounded-full"></div>
                反馈记录列表
              </h1>
              <span className="text-sm text-gray-500">
                共 <span className="font-bold text-gray-800">{feedbackTotal}</span> 条记录
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">序号</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-32">对话人</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[200px]">问题</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[300px]">检索商品结果</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider min-w-[200px]">反馈内容</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider w-40">时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {feedbackLoading ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="animate-spin text-orange-500" size={32} />
                          <span className="text-gray-500 text-sm font-medium">正在获取反馈记录...</span>
                        </div>
                      </td>
                    </tr>
                  ) : feedbackList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-20 text-center text-gray-500 text-sm">
                        暂无反馈记录
                      </td>
                    </tr>
                  ) : (
                    feedbackList.map((item, index) => (
                      <tr key={item.messageId || index} className="hover:bg-orange-50/30 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {(feedbackPage - 1) * feedbackPageSize + index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          <div className="truncate max-w-[120px]" title={item.people}>
                            {item.people || item.sessionId || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800 max-w-md">
                          <div className="line-clamp-2" title={item.question}>
                            {item.question || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.productData && item.productData.length > 0 ? (
                            <div className="space-y-1">
                              <div className="text-xs text-gray-400 mb-1">
                                共 {item.productData.length} 个商品
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {(expandedRows.has(item.messageId) 
                                  ? item.productData 
                                  : item.productData.slice(0, 5)
                                ).map((p: any, i: number) => (
                                  <span key={i} className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                                    {p.code || p.name || '未知'}
                                  </span>
                                ))}
                              </div>
                              {item.productData.length > 5 && (
                                <button
                                  onClick={() => {
                                    const newExpanded = new Set(expandedRows);
                                    if (newExpanded.has(item.messageId)) {
                                      newExpanded.delete(item.messageId);
                                    } else {
                                      newExpanded.add(item.messageId);
                                    }
                                    setExpandedRows(newExpanded);
                                  }}
                                  className="text-xs text-orange-500 hover:text-orange-600 mt-1 font-medium"
                                >
                                  {expandedRows.has(item.messageId) ? '收起' : `展开全部(${item.productData.length})`}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800">
                          <div className="line-clamp-2" title={item.feedbackContent}>
                            {item.feedbackContent || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {item.created_at}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-500 font-medium">
                共 <span className="font-bold text-gray-800">{feedbackTotal}</span> 条记录
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setFeedbackPage(p => Math.max(1, p - 1))}
                  disabled={feedbackPage === 1 || feedbackLoading}
                  className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold px-3 py-1 bg-white border border-orange-200 text-orange-600 rounded-lg shadow-sm">
                    {feedbackPage}
                  </span>
                  <span className="text-sm text-gray-400 font-medium">/</span>
                  <span className="text-sm text-gray-500 font-medium">
                    {Math.ceil(feedbackTotal / feedbackPageSize) || 1}
                  </span>
                </div>
                <button
                  onClick={() => setFeedbackPage(p => p + 1)}
                  disabled={feedbackPage >= Math.ceil(feedbackTotal / feedbackPageSize) || feedbackLoading}
                  className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </div>
        ) : activeTab === 'products' ? (
          <>
            {/* Top Filter Area */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <div className="w-2 h-6 bg-orange-500 rounded-full"></div>
                  商品管理系统
                </h1>
                <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-4 py-2 text-gray-500 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
              >
                重置
              </button>
              <button
                type="button"
                onClick={handleFilterSearch}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors shadow-sm flex items-center gap-2"
              >
                <Search size={16} />
                执行筛选
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3">
            {/* Main Search */}
            <div className="col-span-2">
              <label className="block text-[10px] text-gray-400 mb-0.5 ml-1 font-medium">综合搜索 (品名/款号)</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="搜索款号或品名..."
                  className="w-full pl-7 pr-7 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleFilterSearch(e)}
                />
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                {keyword && (
                  <button
                    onClick={() => setKeyword('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XCircle size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Field Filters */}
            {FIELDS.map(field => (
              <div key={field}>
                <label className="block text-[10px] text-gray-400 mb-0.5 ml-1 font-medium">{FIELD_MAP[field]}</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={FIELD_MAP[field]}
                    className="w-full pl-2 pr-7 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 transition-all outline-none"
                    value={filters[field] || ''}
                    onChange={(e) => handleFilterChange(field, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFilterSearch(e)}
                  />
                  {filters[field] && (
                    <button
                      onClick={() => handleFilterChange(field, '')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto relative scrollbar-thin scrollbar-thumb-gray-200">
            <table className="w-full text-left border-collapse min-w-[3000px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-20 w-20 shadow-[2px_0_5px_rgba(0,0,0,0.05)]">操作</th>
                  {FIELDS.map(field => {
                    // 根据字段类型设置不同宽度
                    const shortFields = ['code', 'name', 'weight', 'width', 'price', 'taxkgprice', 'kgprice', 'taxmprice', 'fewprice', 'stock_qty', 'sale_num_year'];
                    const mediumFields = ['className', 'elem', 'season', 'type_name', 'color_name', 'customizable_grade', 'fabric_structure_two'];
                    const isShort = shortFields.includes(field);
                    const isMedium = mediumFields.includes(field);
                    const isImage = field === 'image_urls';
                    return (
                      <th 
                        key={field} 
                        className={`px-2 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider ${
                          isImage ? 'min-w-[70px] w-[70px]' : isShort ? 'min-w-[80px]' : isMedium ? 'min-w-[120px]' : 'min-w-[100px]'
                        }`}
                      >
                        {FIELD_MAP[field]}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={FIELDS.length + 1} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="animate-spin text-orange-500" size={32} />
                        <span className="text-gray-500 text-sm font-medium">正在获取商品列表...</span>
                      </div>
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={FIELDS.length + 1} className="py-20 text-center text-gray-500 text-sm">
                      没有找到符合条件的商品
                    </td>
                  </tr>
                ) : (
                  products.map((product, index) => (
                    <tr 
                      key={product.code || index} 
                      className={`hover:bg-orange-50/30 transition-colors group ${editingRow === product.code ? 'bg-orange-50/50' : ''}`}
                      onDoubleClick={() => startEdit(product)}
                    >
                      <td className="px-2 py-2 sticky left-0 bg-white z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] group-hover:bg-orange-50/30">
                        <div className="flex items-center gap-1">
                          {editingRow === product.code ? (
                            <>
                              <button 
                                onClick={() => saveEdit(product.code)}
                                disabled={saving === product.code}
                                className="p-1 bg-green-500 text-white rounded hover:bg-green-600 transition-colors shadow-sm disabled:opacity-50"
                                title="保存 (Enter)"
                              >
                                {saving === product.code ? <Loader2 className="animate-spin" size={12} /> : <Save size={12} />}
                              </button>
                              <button 
                                onClick={cancelEdit}
                                className="p-1 bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
                                title="取消 (Esc)"
                              >
                                <X size={12} />
                              </button>
                            </>
                          ) : (
                            <button 
                              onClick={() => startEdit(product)}
                              className="p-1 text-gray-400 hover:text-orange-500 hover:bg-orange-100 rounded transition-all opacity-0 group-hover:opacity-100"
                              title="双击或点击编辑"
                            >
                              <Edit2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                      {FIELDS.map(field => {
                        // 图片字段特殊处理
                        if (field === 'image_urls') {
                          const imageUrl = product[field];
                          let displayUrl: string | null = null;
                          if (imageUrl) {
                            const urlStr = String(imageUrl);
                            // 处理 "名称:URL" 格式，提取冒号后面的URL
                            if (urlStr.includes(':')) {
                              const colonIndex = urlStr.indexOf(':');
                              if (colonIndex > 0 && !urlStr.startsWith('http')) {
                                displayUrl = urlStr.substring(colonIndex + 1);
                              } else {
                                displayUrl = urlStr;
                              }
                            } else {
                              displayUrl = urlStr;
                            }
                          }
                          return (
                            <td key={field} className="px-2 py-2">
                              {displayUrl ? (
                                <div className="w-[50px] h-[50px] rounded-lg overflow-hidden bg-gray-100">
                                  <img 
                                    src={displayUrl} 
                                    alt="商品图"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                      (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400 text-[10px]">无图</div>';
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="w-[50px] h-[50px] rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 text-[10px]">无图</div>
                              )}
                            </td>
                          );
                        }
                        return (
                          <td key={field} className="px-2 py-2 text-xs text-gray-600">
                            {editingRow === product.code && EDITABLE_FIELDS.has(field) ? (
                              <input
                                type="text"
                                className="w-full px-1.5 py-0.5 bg-white border border-orange-200 rounded text-xs focus:ring-1 focus:ring-orange-500 focus:outline-none transition-all shadow-sm"
                                value={editingValues[field] ?? ''}
                                onChange={(e) => handleValueChange(field, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, product.code)}
                                autoFocus={field === 'fun'}
                              />
                            ) : (
                              <div className="truncate max-w-[200px]" title={String(product[field] || '')}>
                                {String(product[field] || '-')}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-500 font-medium">
              共 <span className="font-bold text-gray-800">{total}</span> 条记录
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
                className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
              >
                <ChevronLeft size={18} />
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold px-3 py-1 bg-white border border-orange-200 text-orange-600 rounded-lg shadow-sm">
                  {page}
                </span>
                <span className="text-sm text-gray-400 font-medium">/</span>
                <span className="text-sm text-gray-500 font-medium">
                  {Math.ceil(total / pageSize) || 1}
                </span>
              </div>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / pageSize) || loading}
                className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 mb-8 text-center text-xs text-gray-400 font-medium flex items-center justify-center gap-2">
          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
          提示: 双击行进入编辑模式，Enter 键保存，Esc 键取消。
          <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
        </div>
      </>
    ) : null}
    </div>
    
    {/* 规则录入弹窗 */}
    {showRuleModal && (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <BookOpen size={20} className="text-orange-500" />
              规则录入
            </h2>
            <button
              onClick={() => setShowRuleModal(false)}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="p-4 flex-1 overflow-hidden">
            <textarea
              value={ruleContent}
              onChange={(e) => setRuleContent(e.target.value)}
              placeholder="请输入规则内容..."
              className="w-full h-[400px] p-4 border border-gray-200 rounded-lg resize-none outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-200 transition-all text-sm leading-relaxed"
              style={{ lineHeight: '1.8' }}
            />
          </div>
          
          <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
            <button
              onClick={() => setShowRuleModal(false)}
              disabled={ruleLoading}
              className="px-6 py-2 text-gray-600 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              取消
            </button>
            <button
              onClick={handleSaveRule}
              disabled={ruleLoading}
              className="px-6 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              {ruleLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save size={16} />
                  保存
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
};

export default AdminPage;
