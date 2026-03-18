import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Check, ChevronRight, RefreshCw, Image as ImageIcon, X, ArrowLeft, BookOpen, Package, Trash2, MessageSquare, ChevronDown, ChevronUp, ChevronLeft, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import ProductList, { Product, ProductGroup, ComponentData } from './components/ProductList';

type MaterialItem = {
  url: string;
  name?: string;
};

type MaterialGroup = {
  success: boolean;
  total: number;
  list: MaterialItem[];
};

type ExtendedComponentData = ComponentData | {
  element: string;
  list?: MaterialGroup[];
  text?: string | string[];
  originalQuestion?: string;
  think?: string;
};

type Message = {
  id: string;
  role: 'user' | 'bot';
  text: string;
  components: ExtendedComponentData[];
  images?: string[];
  responseTime?: number;
  n8nResponseTime?: number;
  thinkAnimated?: boolean;
};

// 流式文本显示组件
const StreamingText = ({ 
  text, 
  speed = 20, 
  enabled = true,
  onComplete
}: { 
  text: string; 
  speed?: number; 
  enabled?: boolean;
  onComplete?: () => void;
}) => {
  const [displayedText, setDisplayedText] = useState(enabled ? '' : text);
  const lastTextRef = useRef(text);
  const currentIndexRef = useRef(enabled ? 0 : text.length);
  const isAnimatingModeRef = useRef(enabled);
  const completedRef = useRef(false);
  
  useEffect(() => {
    if (completedRef.current) {
      setDisplayedText(text);
      currentIndexRef.current = text.length;
      return;
    }

    if (enabled && !isAnimatingModeRef.current) {
      isAnimatingModeRef.current = true;
      currentIndexRef.current = 0;
      setDisplayedText('');
    }

    if (!enabled && !isAnimatingModeRef.current) {
      setDisplayedText(text);
      currentIndexRef.current = text.length;
      return;
    }

    if (text !== lastTextRef.current) {
      if (!text.startsWith(lastTextRef.current)) {
        setDisplayedText('');
        currentIndexRef.current = 0;
      }
      lastTextRef.current = text;
    }
    
    const timer = setInterval(() => {
      if (currentIndexRef.current < text.length) {
        setDisplayedText(prev => prev + text.charAt(currentIndexRef.current));
        currentIndexRef.current++;
      } else {
        clearInterval(timer);
        if (!enabled) {
          isAnimatingModeRef.current = false;
        }
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.();
        }
      }
    }, speed);
    
    return () => clearInterval(timer);
  }, [text, speed, enabled, onComplete]);
  
  return <>{displayedText}</>;
};

const KnowledgeQA = ({ data }: { data: ComponentData }) => {
  if (data.element !== '知识问答' || !data.text || Array.isArray(data.text)) return null;

  return (
    <div className="mt-3">
      <div className="bg-blue-50/80 rounded-xl p-4 border border-blue-100">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
            <BookOpen size={14} className="text-white" />
          </div>
          <span className="text-sm font-medium text-blue-700">知识问答</span>
        </div>
        <div className="text-[15px] leading-relaxed text-gray-700">
          <ReactMarkdown>{data.text}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

const QuestionSuggestions = ({
  data,
  onQuestionClick
}: {
  data: ComponentData;
  onQuestionClick: (originalQuestion: string, selectedQuestion: string) => void;
}) => {
  if (data.element !== '问题建议' || !data.text) return null;

  const questions = Array.isArray(data.text) ? data.text : [];
  if (questions.length === 0) return null;

  const originalQuestion = data.originalQuestion || '';

  return (
    <div className="mt-3">
      <div className="flex flex-col gap-2">
        {questions.map((question, idx) => (
          <button
            key={idx}
            onClick={() => onQuestionClick(originalQuestion, question)}
            className="text-left px-3 py-2 bg-gray-50 hover:bg-orange-50 text-gray-600 hover:text-orange-600 text-sm rounded-lg border border-gray-100 hover:border-orange-200 transition-all duration-200 flex items-center gap-2 group"
          >
            <span className="w-5 h-5 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center text-xs font-medium group-hover:bg-orange-500 group-hover:text-white transition-colors">
              {idx + 1}
            </span>
            <span className="flex-1">{question}</span>
            <ChevronRight size={14} className="text-gray-300 group-hover:text-orange-400 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
};

const MaterialList = ({
  data,
  onImageClick,
  onExpandClick
}: {
  data: ExtendedComponentData;
  onImageClick: (url: string) => void;
  onExpandClick?: (group: MaterialGroup) => void;
}) => {
  if (data.element !== '素材列表') return null;

  // 空状态：没有数据或列表为空
  if (!data.list || data.list.length === 0) {
    return (
      <div className="mt-3 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
            <ImageIcon size={14} className="text-white" />
          </div>
          <span className="text-sm font-medium text-purple-700">素材列表</span>
        </div>
        <div className="flex flex-col items-center justify-center mt-2 pt-4 pb-2">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">暂无素材</p>
        </div>
      </div>
    );
  }

  const materialGroup = data.list[0] as any;
  
  // 空状态：素材组成功但列表为空
  if (!materialGroup.success || !materialGroup.list || materialGroup.list.length === 0) {
    return (
      <div className="mt-3 border-t border-gray-100 pt-3">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
            <ImageIcon size={14} className="text-white" />
          </div>
          <span className="text-sm font-medium text-purple-700">素材列表</span>
          {materialGroup.total !== undefined && (
            <span className="text-xs text-gray-400">({materialGroup.total}张)</span>
          )}
        </div>
        <div className="flex flex-col items-center justify-center mt-2 pt-4 pb-2">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">暂无素材</p>
        </div>
      </div>
    );
  }

  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 10;
  const totalPages = Math.ceil(materialGroup.list.length / itemsPerPage);

  const displayList = materialGroup.list.slice(
    currentPage * itemsPerPage,
    (currentPage + 1) * itemsPerPage
  );

  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  return (
    <div className="mt-3 border-t border-gray-100 pt-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
          <ImageIcon size={14} className="text-white" />
        </div>
        <span className="text-sm font-medium text-purple-700">素材列表</span>
        <span className="text-xs text-gray-400">({materialGroup.total}张)</span>
      </div>
      <div className="grid grid-cols-2 gap-2 transition-all duration-300">
        {displayList.map((item: any, idx: number) => {
          const imageUrl = item.pic_url || item.url || '';
          return (
            <div
              key={idx}
              onClick={() => onImageClick(imageUrl)}
              className="aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity relative group"
            >
              <img
                src={imageUrl}
                alt={item.name || `素材${idx + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center text-gray-400 text-[10px] p-2 text-center">图片加载失败</div>';
                }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-black/40 p-1 translate-y-full group-hover:translate-y-0 transition-transform">
                <p className="text-[10px] text-white truncate">{item.name}</p>
              </div>
            </div>
          );
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-3 py-2">
          <button
            onClick={prevPage}
            disabled={currentPage === 0}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 transition-colors text-xs text-gray-600"
          >
            <ChevronLeft size={14} /> 上一页
          </button>
          <span className="text-xs text-gray-500 tabular-nums">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={nextPage}
            disabled={currentPage === totalPages - 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-100 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-gray-100 transition-colors text-xs text-gray-600"
          >
            下一页 <ChevronRight size={14} />
          </button>
        </div>
      )}
      {materialGroup.list.length > itemsPerPage * (currentPage + 1) && onExpandClick && (
        <button
          onClick={() => onExpandClick(materialGroup)}
          className="w-full py-2.5 bg-gray-50 text-gray-600 text-xs font-medium rounded-lg flex items-center justify-center gap-1 hover:bg-gray-100 transition-colors mt-2"
        >
          查看全部素材 ({materialGroup.total}张)<ChevronRight size={14} />
        </button>
      )}
    </div>
  );
};

const ImagePreview = ({ 
  imageUrl, 
  scale, 
  onScaleChange,
  onClose 
}: { 
  imageUrl: string; 
  scale: number;
  onScaleChange: (scale: number) => void;
  onClose: () => void;
}) => {
  if (!imageUrl) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/90 z-50 flex flex-col"
      onClick={onClose}
    >
      <div className="flex items-center justify-between p-4 bg-black/50">
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onScaleChange(Math.max(0.5, scale - 0.25)); }}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <span className="text-lg">−</span>
          </button>
          <span className="text-white text-sm min-w-[60px] text-center">{Math.round(scale * 100)}%</span>
          <button 
            onClick={(e) => { e.stopPropagation(); onScaleChange(Math.min(3, scale + 0.25)); }}
            className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <span className="text-lg">+</span>
          </button>
        </div>
        <button 
          onClick={onClose}
          className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        <img 
          src={imageUrl} 
          alt="预览"
          className="max-w-full max-h-full object-contain transition-transform duration-200"
          style={{ transform: `scale(${scale})` }}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      
      <div className="p-4 bg-black/50 text-center">
        <span className="text-white/60 text-xs">点击空白处关闭，滚轮或按钮缩放</span>
      </div>
    </div>
  );
};

const Toast = ({ show, message, type }: { show: boolean; message: string; type: 'success' | 'error' }) => {
  if (!show) return null;

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] animate-in fade-in zoom-in-95 duration-200">
      <div className={`px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 ${
        type === 'success' ? 'bg-gray-800/90 text-white' : 'bg-red-500/90 text-white'
      }`}>
        {type === 'success' ? (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
};

const ChatMessage = ({
  message,
  isLast,
  onRegenerate,
  isLoading,
  onProductClick,
  onExpandClick,
  onImageClick,
  onMaterialExpand,
  onQuestionClick,
  onFeedback,
  onThinkComplete,
  topN = 3,
  processingStep = -1,
  processingSteps = []
}: {
  message: Message,
  isLast?: boolean,
  onRegenerate?: () => void,
  isLoading?: boolean,
  onProductClick: (product: Product, responseTime?: number) => void,
  onExpandClick: (group: ProductGroup) => void,
  onImageClick?: (url: string) => void;
  onMaterialExpand?: (group: MaterialGroup) => void;
  onQuestionClick?: (originalQuestion: string, selectedQuestion: string) => void;
  onFeedback?: (message: Message) => void;
  onThinkComplete?: (messageId: string) => void;
  topN?: number,
  processingStep?: number,
  processingSteps?: string[]
}) => {
  const isUser = message.role === 'user';
  const isEmpty = !message.text && message.components.length === 0;

  return (
    <div className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div className={`flex flex-col gap-2 ${isUser ? 'items-end max-w-[85%]' : 'items-start w-full'}`}>
        <div 
          className={`px-4 py-3 overflow-hidden ${
            isUser 
              ? 'rounded-2xl rounded-tr-sm' 
              : 'text-gray-800 rounded-2xl rounded-tl-sm w-full'
          }`}
          style={isUser ? { backgroundColor: 'rgb(248,229,217)' } : { backgroundColor: 'white' }}
        >
          {message.images && message.images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.images.map((img, idx) => (
                <img key={idx} src={img} alt="uploaded" className="max-w-[200px] max-h-[200px] rounded-lg object-cover" />
              ))}
            </div>
          )}
          {/* 判断是否显示流式文本和步骤条：只有当没有商品列表组件时才显示 */}
          {(() => {
            const hasProductList = message.components.some((c: any) => c.element === '商品列表');
            
            // 如果有商品列表组件，只显示组件，不显示流式文本和步骤条
            if (hasProductList) {
              return null;
            }
            
            // 如果正在加载中，显示流式文本和步骤条
            if (isLast && isLoading) {
              return (
                <div className="py-2">
                  {/* 流式文本显示在步骤条上方 */}
                  {message.text && (
                    <div className="mb-3 text-[15px] leading-relaxed break-words text-gray-800">
                      <ReactMarkdown>{message.text}</ReactMarkdown>
                    </div>
                  )}
                  {/* 步骤条显示在流式文本下方 */}
                  <div className="flex items-center gap-1">
                    {processingSteps.map((step, idx) => {
                      const isCompleted = idx < processingStep;
                      const isCurrent = idx === processingStep;
                      const isLastStep = idx === processingSteps.length - 1;
                      
                      return (
                        <React.Fragment key={idx}>
                          <div className="flex flex-col items-center gap-1">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-all duration-300 ${
                              isCompleted 
                                ? 'bg-green-500 text-white' 
                                : isCurrent 
                                  ? 'bg-orange-500 text-white' 
                                  : 'bg-gray-200 text-gray-500'
                            }`}>
                              {isCompleted ? (
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : isCurrent && isLastStep ? (
                                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              ) : (
                                idx + 1
                              )}
                            </div>
                            <span className={`text-[9px] whitespace-nowrap transition-colors duration-300 ${
                              isCompleted || isCurrent ? 'text-gray-700' : 'text-gray-400'
                            }`}>
                              {step}
                            </span>
                          </div>
                          {idx < processingSteps.length - 1 && (
                            <div className={`w-4 h-[2px] transition-colors duration-300 ${
                              isCompleted ? 'bg-green-500' : 'bg-gray-200'
                            }`} />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              );
            }
            
            // 如果不是最后一条或不在加载中，但有流式文本，显示文本
            return null;
          })()}
          
          {/* 显示消息文本（非加载状态下，且没有商品列表组件） */}
          {(() => {
            const hasProductList = message.components.some((c: any) => c.element === '商品列表');
            if (hasProductList) return null;
            return message.text && !isLoading ? (
              <div className={`text-[15px] leading-relaxed break-words ${isUser ? 'text-black' : 'text-gray-800'}`}>
                <ReactMarkdown>{message.text}</ReactMarkdown>
              </div>
            ) : null;
          })()}
          
          {/* 显示组件（包括商品列表等） */}
          {message.components.map((comp, idx) => (
            <React.Fragment key={idx}>
              {comp.element === '商品列表' && (
                <ProductList 
                  data={comp} 
                  onProductClick={(p) => onProductClick(p, message.responseTime)}
                  onExpandClick={onExpandClick}
                  topN={topN}
                  animate={isLast && !message.thinkAnimated}
                  onThinkComplete={() => onThinkComplete?.(message.id)}
                />
              )}
              {comp.element === '知识问答' && (
                <KnowledgeQA data={comp} />
              )}
              {comp.element === '素材列表' && onImageClick && (
                <MaterialList 
                  data={comp} 
                  onImageClick={onImageClick} 
                  onExpandClick={onMaterialExpand}
                />
              )}
              {comp.element === '问题建议' && onQuestionClick && (
                <QuestionSuggestions 
                  data={comp} 
                  onQuestionClick={onQuestionClick}
                />
              )}
            </React.Fragment>
          ))}
        </div>
        {/* 底部区域 - 只对AI消息显示 */}
        {!isUser && (
          <div className="flex items-center justify-between mt-1 px-1 w-full">
            {/* 左下角 - 接口响应耗时 */}
            <span className="text-xs text-gray-400">
              {message.responseTime !== undefined
                ? `${Math.max(0.1, message.responseTime - 1).toFixed(1)}秒`
                : ''}
            </span>
            
            {/* 右下角 - 操作按钮 */}
            <div className="flex items-center gap-3">
              {isLast && onRegenerate && !isLoading && (
                <button
                  onClick={onRegenerate}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-orange-500 transition-colors"
                >
                  <RefreshCw size={12} />
                  重新回答
                </button>
              )}
              {onFeedback && !isLoading && (
                <button
                  onClick={() => onFeedback(message)}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-500 transition-colors"
                  title="反馈问题"
                >
                  <MessageSquare size={12} />
                  <span>反馈</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ChatInput = ({ 
  onSend, 
  onOpenPreference,
  onClear,
  disabled = false
}: { 
  onSend: (text: string, images: string[]) => void,
  onOpenPreference: () => void,
  onClear: () => void,
  disabled?: boolean
}) => {
  const [text, setText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingText, setRecordingText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);
  const originalTextRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImages(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别功能');
      return;
    }
    
    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'zh-CN';
      
      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        // 遍历所有结果，区分最终结果和临时结果
        for (let i = 0; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }
        
        // 合并最终结果和临时结果，实时显示完整内容
        setRecordingText(finalTranscript + interimTranscript);
      };

      recognitionRef.current.onerror = (event: any) => {
        // 语音识别错误
        if (event.error === 'not-allowed') {
          alert('无法访问麦克风，请在浏览器设置中允许麦克风权限。');
        }
        stopRecording();
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }

    originalTextRef.current = text;
    setRecordingText('');
    setIsRecording(true);
    // 强制触发一次重新渲染以显示原始文本
    setText(text);
    try {
      recognitionRef.current.start();
    } catch (e) {}
  };

  const stopRecording = () => {
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  useEffect(() => {
    if (!isRecording && recordingText) {
      setText(originalTextRef.current + recordingText);
      setRecordingText('');
    }
  }, [isRecording, recordingText]);

  const displayText = isRecording ? originalTextRef.current + recordingText : text;

  const handleSend = () => {
    if (displayText.trim()) {
      onSend(displayText, images);
      setText('');
      setRecordingText('');
      setImages([]);
      originalTextRef.current = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 快捷问题按钮组
  const quickQuestions = [
    '20-35元',
    '200-350克',
    '适合连衣裙',
    '高端大气',
    '6327相似款',
    '6228A平替'
  ];

  return (
    <div className="p-3 pb-safe relative">
      {isRecording && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs py-2 px-4 rounded-full flex items-center gap-2 whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 z-50">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
          语音录入中...松开结束
        </div>
      )}

      {/* 快捷问题轮播 - 渐变色边框上方 */}
      <div className={`mb-2 overflow-hidden rounded-xl bg-gradient-to-r from-orange-50 via-pink-50 to-purple-50 border border-orange-100 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
        <div className="flex items-center py-2 animate-marquee-left">
          {/* 复制两份实现无缝轮播 */}
          {[...quickQuestions, ...quickQuestions].map((question, idx) => (
            <button
              key={idx}
              onClick={() => onSend(question, [])}
              disabled={disabled}
              className="flex-shrink-0 mx-2 px-3 py-1.5 bg-white text-xs text-gray-600 rounded-full border border-orange-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-300 transition-all shadow-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      <div className="relative rounded-2xl p-[1px] bg-gradient-to-r from-orange-400 via-pink-500 to-purple-500 shadow-lg">
        {/* 清空会话按钮 - 右上角 */}
        <button 
          onClick={onClear}
          className="absolute top-2 right-2 z-10 w-8 h-8 bg-white text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors rounded-full shadow-md flex items-center justify-center border border-gray-100"
          title="清空对话"
        >
          <Trash2 size={16} />
        </button>
        <div className="bg-white rounded-[15px] flex flex-col p-2 gap-2">
          {images.length > 0 && (
            <div className="flex gap-2 overflow-x-auto py-1 px-1 scrollbar-hide">
              {images.map((img, idx) => (
                <div key={idx} className="relative flex-shrink-0">
                  <img src={img} alt="upload" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
                  <button 
                    onClick={() => removeImage(idx)}
                    className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full p-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <textarea
            value={displayText}
            onChange={(e) => {
              if (!isRecording) setText(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder="请输入您的问题..."
            className="w-full resize-none outline-none text-[15px] p-1 min-h-[40px] max-h-[120px] text-gray-700 placeholder-gray-400 bg-transparent scrollbar-hide"
            rows={1}
          />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <button 
                onClick={onOpenPreference}
                className="text-xs text-orange-600 bg-orange-50 px-2.5 py-1.5 rounded-lg font-medium hover:bg-orange-100 transition-colors whitespace-nowrap"
              >
                搜索偏好
              </button>
            </div>
            <div className="flex items-center gap-3">
              <input 
                type="file" 
                accept="image/*" 
                multiple 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
              {/* 图片上传按钮已隐藏
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-50"
              >
                <ImageIcon size={20} />
              </button>
              */}
              <button 
                onPointerDown={(e) => {
                  e.preventDefault();
                  startRecording();
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  stopRecording();
                }}
                onPointerLeave={stopRecording}
                onPointerCancel={stopRecording}
                style={{ touchAction: 'none' }}
                className={`transition-colors p-1 rounded-full ${isRecording ? 'text-orange-500 bg-orange-50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
              >
                <Mic size={20} className={isRecording ? 'animate-pulse' : ''} />
              </button>
              <button 
                onClick={handleSend}
                disabled={!displayText.trim() || disabled}
                className="bg-orange-500 text-white px-5 py-1.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                搜索
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PreferenceModal = ({
  isOpen,
  onClose,
  topN,
  setTopN,
  codeStart,
  setCodeStart,
  searchType,
  setSearchType
}: {
  isOpen: boolean,
  onClose: () => void,
  topN: number,
  setTopN: (n: number) => void,
  codeStart: string[],
  setCodeStart: (c: string[]) => void,
  searchType: string,
  setSearchType: (t: string) => void
}) => {
  if (!isOpen) return null;

  const topNOptions = [3, 4, 5, 6, 7];
  const searchTypeOptions = [
    { value: '精准', label: '精准' },
    { value: '推理', label: '推理' }
  ];
  const codeStartOptions = [
    { value: '3', label: '3系列' },
    { value: '6', label: '6系列' },
    { value: '7', label: '7系列' },
    { value: '9', label: '9系列' }
  ];
  const toggleCodeStart = (value: string) => {
    if (codeStart.includes(value)) {
      setCodeStart(codeStart.filter(c => c !== value));
    } else {
      setCodeStart([...codeStart, value]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm transition-opacity">
      <div className="bg-white w-full sm:w-96 rounded-t-3xl sm:rounded-2xl p-6 animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-gray-900">搜索偏好配置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">搜索模式</h3>
          <div className="flex gap-2 flex-wrap">
            <button
              disabled
              className="px-4 py-2 rounded-xl border text-sm font-medium border-orange-500 bg-orange-50 text-orange-600 cursor-default"
            >
              精准
            </button>
            <button
              disabled
              className="px-4 py-2 rounded-xl border text-sm font-medium border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
            >
              推理
            </button>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">每组推荐商品数量</h3>
          <div className="flex gap-2 flex-wrap">
            {topNOptions.map((n) => (
              <button
                key={n}
                onClick={() => setTopN(n)}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                  topN === n
                    ? 'border-orange-500 bg-orange-50 text-orange-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {n}个
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">商品类型</h3>
          <div className="flex gap-2 flex-wrap">
            {codeStartOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => toggleCodeStart(option.value)}
                className={`px-4 py-2 rounded-xl border text-sm font-medium transition-all ${
                  codeStart.includes(option.value)
                    ? 'border-blue-500 bg-blue-50 text-blue-600'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-orange-500 text-white py-3.5 rounded-xl font-medium hover:bg-orange-600 transition-colors shadow-orange-500/20"
        >
          确定
        </button>
      </div>
    </div>
  );
};

const FeedbackModal = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  question
}: {
  isOpen: boolean,
  onClose: () => void,
  onSubmit: (feedback: string) => Promise<void>,
  isLoading?: boolean,
  question?: string
}) => {
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFeedback('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!feedback.trim()) return;
    await onSubmit(feedback);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center backdrop-blur-sm transition-opacity">
      <div className="bg-white w-full sm:w-96 rounded-t-3xl sm:rounded-2xl p-6 animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-gray-900">问题反馈</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {question && (
          <div className="mb-4 p-3 bg-gray-50 rounded-xl">
            <p className="text-xs text-gray-500 mb-1">问题</p>
            <p className="text-sm text-gray-700 line-clamp-2">{question}</p>
          </div>
        )}

        <div className="mb-8">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            反馈内容 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="请描述您遇到的问题..."
            className="w-full h-32 p-3 border border-gray-200 rounded-xl resize-none outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all text-sm"
          />
          {!feedback.trim() && (
            <p className="text-xs text-red-500 mt-1">请输入反馈内容</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 bg-gray-100 text-gray-700 py-3.5 rounded-xl font-medium hover:bg-gray-200 transition-colors disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !feedback.trim()}
            className="flex-1 bg-red-500 text-white py-3.5 rounded-xl font-medium hover:bg-red-600 transition-colors shadow-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                提交中...
              </>
            ) : '提交反馈'}
          </button>
        </div>
      </div>
    </div>
  );
};

// 主应用组件
export default function App() {
  // 每次进入页面清空聊天记录，使用空数组初始化
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Cookie 工具函数
  const setCookie = (name: string, value: string, days = 30) => {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
  };
  
  const getCookie = (name: string): string | null => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  };
  
  // 从 cookie 读取或使用默认值
  const [topN, setTopN] = useState(() => {
    const saved = getCookie('topN');
    return saved ? parseInt(saved, 10) : 3;
  });
  
  const [codeStart, setCodeStart] = useState<string[]>(() => {
    const saved = getCookie('codeStart');
    return saved ? JSON.parse(saved) : ['6', '7', '9'];
  });
  
  const [searchType, setSearchType] = useState(() => {
    const saved = getCookie('searchType');
    return saved || '精准';
  });
  
  // 保存到 cookie
  const handleSetTopN = (n: number) => {
    setTopN(n);
    setCookie('topN', n.toString());
  };
  
  const handleSetCodeStart = (codes: string[]) => {
    setCodeStart(codes);
    setCookie('codeStart', JSON.stringify(codes));
  };

  const handleSetSearchType = (type: string) => {
    setSearchType(type);
    setCookie('searchType', type);
  };
  const [showPreference, setShowPreference] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const navigate = useNavigate();
  const [previewImage, setPreviewImage] = useState<string>('');
  const [imageScale, setImageScale] = useState(1);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' as 'success' | 'error' });
  const [currentMessageForFeedback, setCurrentMessageForFeedback] = useState<Message | null>(null);
  const [processingStep, setProcessingStep] = useState(-1);
  const processingSteps = ['意图识别', '数据规则', '数据拟合', '格式规整', '浅度推理', '深度思考'];
  
  // 用户名状态
  const [userName, setUserName] = useState<string>('');
  
  // 生成随机会话ID
  const generateSessionId = () => {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  };
  
  // 从 cookie 读取 user_id（同步版本，用于初始化）
  const getUserIdFromCookie = (): string => {
    // 1. 首先尝试从 cookie 读取
    let userId = getCookie('user_id');
    if (userId) {
      console.log('Got user_id from cookie:', userId);
      return userId;
    }
    return '';
  };
  
  // 必须先定义 sessionId，后面的 useEffect 才能引用
  const [sessionId, setSessionId] = useState(() => {
    // 初始化时先尝试从 cookie 获取
    const cookieUserId = getUserIdFromCookie();
    if (cookieUserId) {
      return cookieUserId;
    }
    // 如果没有 cookie，生成临时 sessionId
    return generateSessionId();
  });
  
  // 获取授权 URL
  const fetchAuthUrl = async (loginType: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/wechat/auth_url?login_type=${loginType}`);
      const data = await response.json();
      
      if (data.auth_url) {
        console.log(`Redirecting to WeChat auth (${loginType}):`, data.auth_url);
        // 保存尝试过的 login_type 到 sessionStorage，用于回调后判断
        sessionStorage.setItem('wechat_auth_attempt', loginType);
        window.location.href = data.auth_url;
      } else {
        console.error(`Failed to get WeChat auth URL (${loginType})`);
        // 如果 rc 失败，尝试 rs
        if (loginType === 'rc') {
          fetchAuthUrl('rs');
        }
      }
    } catch (error) {
      console.error(`Failed to get WeChat auth URL (${loginType}):`, error);
      // 如果 rc 失败，尝试 rs
      if (loginType === 'rc') {
        fetchAuthUrl('rs');
      }
    }
  };

  // 处理微信授权逻辑（在 useEffect 中执行，避免初始化时的问题）
  useEffect(() => {
    // 发起企业微信授权流程（必须先声明，因为被其他函数使用）
    const initiateWechatAuth = () => {
      // 检查是否已经尝试过 rc
      const attempt = sessionStorage.getItem('wechat_auth_attempt');
      
      if (!attempt) {
        // 先尝试 login_type = rc
        fetchAuthUrl('rc');
      } else if (attempt === 'rc') {
        // rc 已经尝试过且失败了，直接尝试 rs
        fetchAuthUrl('rs');
      }
      // 如果 attempt 是 rs，说明都尝试过了，不再尝试
    };

    // 处理授权失败，尝试下一个 login_type（必须先声明，因为被 handleWechatAuth 使用）
    const handleAuthFailure = () => {
      const attempt = sessionStorage.getItem('wechat_auth_attempt');
      
      if (attempt !== 'rs') {
        // rc 失败了，尝试 rs
        console.log('rc auth failed or not in rc corp, trying rs...');
        fetchAuthUrl('rs');
      } else {
        // rs 也失败了，两个企业主体都失败了
        console.log('Both rc and rs auth failed');
        sessionStorage.removeItem('wechat_auth_attempt');
        // 清除 URL 参数
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    };

    // 主授权处理函数（最后声明，依赖上面的辅助函数）
    const handleWechatAuth = async () => {
      // 1. 首先检查 cookie
      const cookieUserId = getCookie('user_id');
      if (cookieUserId) {
        console.log('User already logged in:', cookieUserId);
        return;
      }

      // 2. 从 URL 参数读取（企业微信登录后返回的）
      const urlParams = new URLSearchParams(window.location.search);
      const urlUserId = urlParams.get('userid');
      
      // 处理 URL 中的 userid
      if (urlUserId) {
        // 检查是否是有效的 userid
        if (urlUserId !== '非企业微信使用' && urlUserId !== '无员工信息') {
          // 成功获取到 userid
          const userId = urlUserId;
          setCookie('user_id', userId, 30);
          setSessionId(userId);
          console.log('Set user_id from URL:', userId);
          // 清除 URL 参数，避免重复处理
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
          // 清除尝试记录
          sessionStorage.removeItem('wechat_auth_attempt');
          return;
        } else {
          // 授权失败（非企业微信使用 或 无员工信息）
          console.log(`WeChat auth returned: ${urlUserId}`);
          handleAuthFailure();
          return;
        }
      }
      
      // 3. 尝试通过企业微信授权获取（先 rc 后 rs）
      initiateWechatAuth();
    };

    // 执行授权流程
    handleWechatAuth();
  }, []); // 只在组件挂载时执行

  // 从后端获取用户信息
  useEffect(() => {
    const fetchUserInfo = async () => {
      const userId = getCookie('user_id');
      if (userId) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL}/api/get_user_info?user_id=${userId}`);
          const data = await response.json();
          if (data.success && data.data) {
            // 优先使用 name 字段，如果没有则使用 id
            const name = data.data.name || data.data.id || userId;
            setUserName(name);
          } else {
            // 如果后端没有用户信息，直接使用 user_id
            setUserName(userId);
          }
        } catch (error) {
          console.error('Failed to fetch user info:', error);
          setUserName(userId);
        }
      }
    };
    
    fetchUserInfo();
  }, [sessionId]); // sessionId 变化时重新获取
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // 用户发送消息时滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type }), 2000);
  };

  // 组件挂载时从 localStorage 恢复聊天记录
  useEffect(() => {
    const savedMessages = localStorage.getItem('chatMessages');
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        if (Array.isArray(parsedMessages) && parsedMessages.length > 0) {
          setMessages(parsedMessages);
        }
      } catch (e) {
        // 解析失败，保持空数组
      }
    }
    
    // 读取 cookie 中的 user_id 并打印
    const userIdFromCookie = getCookie('user_id');
    console.log('User ID from cookie:', userIdFromCookie);
    console.log('All cookies:', document.cookie);
  }, []);

  // 保存聊天记录到 localStorage
  useEffect(() => {
    localStorage.setItem('chatMessages', JSON.stringify(messages));
  }, [messages]);

  const handleSend = async (text: string, images: string[]) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text,
      components: [],
      images
    };
    
    // 添加临时的 bot 消息用于显示步骤条
    const tempBotMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'bot',
      text: '',
      components: []
    };
    
    setMessages(prev => [...prev, userMessage, tempBotMessage]);
    setTimeout(scrollToBottom, 50);
    setIsLoading(true);
    setProcessingStep(0);
    const startTime = Date.now();

    // 模拟处理步骤
    const stepInterval = setInterval(() => {
      setProcessingStep(prev => {
        if (prev >= processingSteps.length - 1) {
          clearInterval(stepInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 800);

    try {
      const response = await fetch('https://agent.wyoooni.net/webhook/4mon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chatInput: text,
          sessionId,
          imageUrl: images || [],
          codeStart: codeStart.length > 0 ? codeStart : ['6', '7', '9'],
          topN,
          searchType
        })
      });

      // 使用 ReadableStream 读取流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let textContent = '';
      let components: ExtendedComponentData[] = [];
      let hasReceivedComponent = false;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          // 处理 buffer 中的完整行
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留不完整的最后一行
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            try {
              const parsed = JSON.parse(trimmedLine);
              if (parsed.type === 'item' && parsed.content !== undefined) {
                const content = parsed.content;
                
                // 判断 content 是否为 JSON 格式的组件数据
                if (typeof content === 'string') {
                  // 先尝试解析为 JSON（组件格式）
                  try {
                    const parsedContent = JSON.parse(content);
                    // 成功解析为 JSON，说明是组件数据
                    hasReceivedComponent = true;
                    if (Array.isArray(parsedContent)) {
                      components = parsedContent;
                    } else {
                      components = [parsedContent];
                    }
                  } catch {
                    // 不是 JSON，当作纯文本流式拼接
                    textContent += content;
                    // 实时更新流式文本
                    setMessages(prev => {
                      const newMessages = [...prev];
                      const lastIndex = newMessages.length - 1;
                      if (lastIndex >= 0 && newMessages[lastIndex].role === 'bot') {
                        newMessages[lastIndex] = {
                          ...newMessages[lastIndex],
                          text: textContent
                        };
                      }
                      return newMessages;
                    });
                  }
                } else if (typeof content === 'object') {
                  // content 是对象，直接作为组件
                  hasReceivedComponent = true;
                  if (Array.isArray(content)) {
                    components = content;
                  } else {
                    components = [content];
                  }
                }
              }
            } catch (e) {
              // 解析错误的行，忽略
            }
          }
        }
        
        // 处理最后可能剩余的 buffer
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer.trim());
            if (parsed.type === 'item' && parsed.content !== undefined) {
              const content = parsed.content;
              if (typeof content === 'string') {
                try {
                  const parsedContent = JSON.parse(content);
                  hasReceivedComponent = true;
                  components = Array.isArray(parsedContent) ? parsedContent : [parsedContent];
                } catch {
                  if (!hasReceivedComponent) {
                    textContent += content;
                  }
                }
              } else if (typeof content === 'object') {
                hasReceivedComponent = true;
                components = Array.isArray(content) ? content : [content];
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }

      const responseTime = (Date.now() - startTime) / 1000;
      
      // 最终更新：只有当收到商品列表组件时，才清空流式文本和步骤条
      const hasProductList = components.some((c: any) => c.element === '商品列表');
      
      // 构建AI回答内容（用于保存记录）
      let answerContent = textContent;
      // 收集所有商品款号（使用Set去重）
      const productCodeSet = new Set<string>();
      if (hasProductList && components.length > 0) {
        components.forEach((comp: any) => {
          if (comp.element === '商品列表' && comp.list) {
            // 收集所有商品的款号
            comp.list.forEach((g: any) => {
              if (g.list && Array.isArray(g.list)) {
                g.list.forEach((p: any) => {
                  if (p.code) {
                    productCodeSet.add(p.code);
                  }
                });
              }
            });
          }
        });
        // 构建包含所有款号的回答
        if (productCodeSet.size > 0) {
          answerContent = '商品推荐: ' + Array.from(productCodeSet).join(', ');
        }
      }
      
      // 保存问答记录
      saveChatRecord(text, answerContent, Array.from(productCodeSet));
      
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        if (lastIndex >= 0 && newMessages[lastIndex].role === 'bot') {
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            // 只有当收到商品列表组件时才清空流式文本，否则保留
            text: hasProductList ? '' : textContent,
            components: components,
            responseTime
          };
        }
        return newMessages;
      });
    } catch (error) {
      showToast('请求失败，请稍后重试', 'error');
    } finally {
      clearInterval(stepInterval);
      setIsLoading(false);
      setProcessingStep(-1);
    }
  };

  const handleRegenerate = async () => {
    // 生成新的会话ID
    setSessionId(generateSessionId());
    // 重新生成最后一条回答
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMessage) return;
    
    // 移除最后一条bot消息，添加临时的bot消息用于显示步骤条
    const tempBotMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'bot',
      text: '',
      components: []
    };
    
    setMessages(prev => {
      // 移除最后一条bot消息，添加新的临时bot消息
      const filtered = prev.filter((m, idx) => !(idx === prev.length - 1 && m.role === 'bot'));
      return [...filtered, tempBotMessage];
    });
    setTimeout(scrollToBottom, 50);
    setIsLoading(true);
    setProcessingStep(0);

    // 模拟处理步骤
    const stepInterval = setInterval(() => {
      setProcessingStep(prev => {
        if (prev >= processingSteps.length - 1) {
          clearInterval(stepInterval);
          return prev;
        }
        return prev + 1;
      });
    }, 800);

    try {
      const response = await fetch('https://agent.wyoooni.net/webhook/4mon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chatInput: lastUserMessage.text,
          sessionId,
          imageUrl: lastUserMessage.images || [],
          codeStart: codeStart.length > 0 ? codeStart : ['6', '7', '9'],
          topN,
          searchType
        })
      });

      // 使用 ReadableStream 读取流式响应
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let textContent = '';
      let components: ExtendedComponentData[] = [];
      let hasReceivedComponent = false;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          
          // 处理 buffer 中的完整行
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // 保留不完整的最后一行
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;
            
            try {
              const parsed = JSON.parse(trimmedLine);
              if (parsed.type === 'item' && parsed.content !== undefined) {
                const content = parsed.content;
                
                // 判断 content 是否为 JSON 格式的组件数据
                if (typeof content === 'string') {
                  // 先尝试解析为 JSON（组件格式）
                  try {
                    const parsedContent = JSON.parse(content);
                    // 成功解析为 JSON，说明是组件数据
                    hasReceivedComponent = true;
                    if (Array.isArray(parsedContent)) {
                      components = parsedContent;
                    } else {
                      components = [parsedContent];
                    }
                  } catch {
                    // 不是 JSON，当作纯文本流式拼接
                    textContent += content;
                    // 实时更新流式文本
                    setMessages(prev => {
                      const newMessages = [...prev];
                      const lastIndex = newMessages.length - 1;
                      if (lastIndex >= 0 && newMessages[lastIndex].role === 'bot') {
                        newMessages[lastIndex] = {
                          ...newMessages[lastIndex],
                          text: textContent
                        };
                      }
                      return newMessages;
                    });
                  }
                } else if (typeof content === 'object') {
                  // content 是对象，直接作为组件
                  hasReceivedComponent = true;
                  if (Array.isArray(content)) {
                    components = content;
                  } else {
                    components = [content];
                  }
                }
              }
            } catch (e) {
              // 解析错误的行，忽略
            }
          }
        }
        
        // 处理最后可能剩余的 buffer
        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer.trim());
            if (parsed.type === 'item' && parsed.content !== undefined) {
              const content = parsed.content;
              if (typeof content === 'string') {
                try {
                  const parsedContent = JSON.parse(content);
                  hasReceivedComponent = true;
                  components = Array.isArray(parsedContent) ? parsedContent : [parsedContent];
                } catch {
                  if (!hasReceivedComponent) {
                    textContent += content;
                  }
                }
              } else if (typeof content === 'object') {
                hasReceivedComponent = true;
                components = Array.isArray(content) ? content : [content];
              }
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
      
      // 最终更新：只有当收到商品列表组件时，才清空流式文本和步骤条
      const hasProductList = components.some((c: any) => c.element === '商品列表');
      
      // 构建AI回答内容（用于保存记录）
      let answerContent = textContent;
      // 收集所有商品款号
      let productCodes: string[] = [];
      if (hasProductList && components.length > 0) {
        components.forEach((comp: any) => {
          if (comp.element === '商品列表' && comp.list) {
            // 收集所有商品的款号
            comp.list.forEach((g: any) => {
              if (g.list && Array.isArray(g.list)) {
                g.list.forEach((p: any) => {
                  if (p.code) {
                    productCodes.push(p.code);
                  }
                });
              }
            });
          }
        });
        // 构建包含所有款号的回答
        if (productCodes.length > 0) {
          answerContent = '商品推荐: ' + productCodes.join(', ');
        }
      }
      
      // 保存问答记录
      if (lastUserMessage) {
        saveChatRecord(lastUserMessage.text, answerContent, productCodes);
      }
      
      setMessages(prev => {
        const newMessages = [...prev];
        const lastIndex = newMessages.length - 1;
        if (lastIndex >= 0 && newMessages[lastIndex].role === 'bot') {
          newMessages[lastIndex] = {
            ...newMessages[lastIndex],
            // 只有当收到商品列表组件时才清空流式文本，否则保留
            text: hasProductList ? '' : textContent,
            components: components
          };
        }
        return newMessages;
      });
    } catch (error) {
      showToast('请求失败，请稍后重试', 'error');
    } finally {
      clearInterval(stepInterval);
      setIsLoading(false);
      setProcessingStep(-1);
    }
  };

  // 保存问答记录到后端
  const saveChatRecord = async (question: string, answer: string, productCodes?: string[]) => {
    try {
      // 从 cookie 读取 user_id
      const userId = getCookie('user_id') || sessionId;
      
      await fetch(`${import.meta.env.VITE_API_URL}/api/save_chat_record`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'sale',
          people: userId,
          question,
          answer
        })
      });
    } catch (error) {
      console.error('Save chat record failed:', error);
    }
  };

  const handleClear = () => {
    setMessages([]);
    localStorage.removeItem('chatMessages');
    setSessionId(generateSessionId());
    showToast('对话已清空');
  };

  const handleProductClick = (product: Product, responseTime?: number) => {
    // 保存到 sessionStorage
    sessionStorage.setItem('currentProduct', JSON.stringify(product));
    // 跳转到详情页
    navigate(`/product/${product.code}`);
  };

  const handleExpandClick = (group: ProductGroup) => {
    // 保存到 sessionStorage
    sessionStorage.setItem('currentProductGroup', JSON.stringify(group));
    // 跳转到列表页
    navigate('/list');
  };

  const handleFeedback = (message: Message) => {
    setCurrentMessageForFeedback(message);
    setShowFeedback(true);
  };

  const handleFeedbackSubmit = async (feedback: string) => {
    if (!currentMessageForFeedback) return;
    
    // 找到对应用户的问题（bot消息的前一条user消息）
    let userQuestion = currentMessageForFeedback.text;
    if (currentMessageForFeedback.role === 'bot') {
      const messageIndex = messages.findIndex(m => m.id === currentMessageForFeedback.id);
      if (messageIndex > 0) {
        const prevMessage = messages[messageIndex - 1];
        if (prevMessage.role === 'user') {
          userQuestion = prevMessage.text;
        }
      }
    }
    
    // 提取商品数据（从商品列表组件中）
    let productData: any[] = [];
    if (currentMessageForFeedback.components) {
      currentMessageForFeedback.components.forEach((comp: any) => {
        if (comp.element === '商品列表' && comp.list) {
          comp.list.forEach((group: any) => {
            if (group.list && Array.isArray(group.list)) {
              // 只提取关键字段，减少数据量
              productData = productData.concat(
                group.list.map((p: any) => ({
                  code: p.code,
                  name: p.name,
                  price: p.price,
                  taxmprice: p.taxmprice,
                  taxkgprice: p.taxkgprice
                }))
              );
            }
          });
        }
      });
    }
    
    try {
      // 从 cookie 读取 user_id
      const userId = getCookie('user_id') || sessionId;
      
      await fetch(`${import.meta.env.VITE_API_URL}/api/ai_agent_feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: 'sale',
          people: userId,
          messageId: currentMessageForFeedback.id,
          question: userQuestion,
          feedbackContent: feedback,
          productData: productData.length > 0 ? productData : undefined
        })
      });
      showToast('反馈提交成功');
    } catch (error) {
      showToast('提交失败', 'error');
    }
  };

  const handleQuestionClick = (originalQuestion: string, selectedQuestion: string) => {
    handleSend(selectedQuestion, []);
  };

  const handleThinkComplete = (messageId: string) => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, thinkAnimated: true } : m
    ));
  };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'rgb(242,245,248)' }}>
      {/* 顶部导航 */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-pink-500 rounded-xl flex items-center justify-center">
            <Package size={18} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">销售助手</h1>
            <p className="text-xs text-gray-400">AI 智能商品推荐</p>
          </div>
        </div>
        
        {/* 右上角用户信息 */}
        {userName && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-full">
            <div className="w-6 h-6 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center">
              <User size={14} className="text-white" />
            </div>
            <span className="text-sm text-gray-700 font-medium">{userName}</span>
          </div>
        )}
      </div>

      {/* 聊天区域 */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400">
            <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <Package size={32} className="text-gray-300" />
            </div>
            <p className="text-sm">开始您的商品咨询</p>
          </div>
        ) : (
          messages.map((message, idx) => (
            <ChatMessage
              key={message.id}
              message={message}
              isLast={idx === messages.length - 1}
              onRegenerate={idx === messages.length - 1 && message.role === 'bot' ? handleRegenerate : undefined}
              isLoading={isLoading && idx === messages.length - 1}
              onProductClick={handleProductClick}
              onExpandClick={handleExpandClick}
              onImageClick={setPreviewImage}
              onQuestionClick={handleQuestionClick}
              onFeedback={handleFeedback}
              onThinkComplete={handleThinkComplete}
              topN={topN}
              processingStep={processingStep}
              processingSteps={processingSteps}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 输入区域 */}
      <div className="shrink-0 bg-white border-t border-gray-100">
        <ChatInput
          onSend={handleSend}
          onOpenPreference={() => setShowPreference(true)}
          onClear={handleClear}
          disabled={isLoading}
        />
      </div>

      {/* 弹窗组件 */}
      <PreferenceModal
        isOpen={showPreference}
        onClose={() => setShowPreference(false)}
        topN={topN}
        setTopN={handleSetTopN}
        codeStart={codeStart}
        setCodeStart={handleSetCodeStart}
        searchType={searchType}
        setSearchType={handleSetSearchType}
      />

      <FeedbackModal
        isOpen={showFeedback}
        onClose={() => setShowFeedback(false)}
        onSubmit={handleFeedbackSubmit}
        question={currentMessageForFeedback?.text}
      />

      {/* 图片预览 */}
      <ImagePreview
        imageUrl={previewImage}
        scale={imageScale}
        onScaleChange={setImageScale}
        onClose={() => {
          setPreviewImage('');
          setImageScale(1);
        }}
      />

      {/* Toast 提示 */}
      <Toast {...toast} />
    </div>
  );
}
