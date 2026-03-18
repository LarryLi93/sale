import React, { useState } from 'react';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

export type Product = {
  name: string;
  code: string;
  elem: string;
  taxmprice?: number;
  taxkgprice?: number;
  price?: number;
  fewprice?: number;
  fabric_erp?: string;
  width?: string;
  weight?: number;
  image_urls?: string | string[];
  production_process?: string;
  series?: string;
  fun?: string;
  silhouette?: string;
  touch?: string;
  dressing_occasion?: string;
  applicable_crowd?: string;
  style?: string;
  papertubeqty?: string;
  emptyqty?: string;
  release_date?: string;
  customizable_grade?: string;
  sale_num_year?: number;
  inelem?: string;
  code_start?: string;
  type_notes?: string;
  fabric_structure_two?: string;
  report_urls?: string[];
  season_marking?: string;
};

export type ProductGroup = {
  title: string;
  query: any;
  total: number;
  list: Product[];
  reason?: string;
};

export type ComponentData = {
  element: string;
  list?: ProductGroup[];
  text?: string | string[];
  originalQuestion?: string;
  think?: string;
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
  const [displayedText, setDisplayedText] = React.useState(enabled ? '' : text);
  const lastTextRef = React.useRef(text);
  const currentIndexRef = React.useRef(enabled ? 0 : text.length);
  const isAnimatingModeRef = React.useRef(enabled);
  const completedRef = React.useRef(false);
  
  React.useEffect(() => {
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

// 商品列表组件
export default function ProductList({ 
  data,
  onProductClick,
  onExpandClick,
  topN = 3,
  animate = true,
  onThinkComplete
}: { 
  data: ComponentData;
  onProductClick: (product: Product) => void;
  onExpandClick: (group: ProductGroup) => void;
  topN?: number;
  animate?: boolean;
  onThinkComplete?: () => void;
}) {
  if (data.element !== '商品列表') return null;

  // think 内容流式显示完成状态
  const [thinkCompleted, setThinkCompleted] = React.useState(!animate);
  const [displayedThink, setDisplayedThink] = React.useState(animate ? '' : (data.think || ''));
  
  // 当 think 内容变化或动画属性变化时更新状态
  React.useEffect(() => {
    if (!data.think) return;

    if (!animate) {
      setThinkCompleted(true);
      setDisplayedThink(data.think);
    } else {
      // 只有在没有完成且当前内容为空时才重置
      if (!thinkCompleted && displayedThink === '') {
        setThinkCompleted(false);
        setDisplayedThink('');
      }
    }
  }, [data.think, animate]);
  
  const handleThinkComplete = () => {
    setThinkCompleted(true);
    onThinkComplete?.();
  };
  
  const thinkElement = data.think && (
    <div className="bg-orange-50/50 border border-orange-100 rounded-xl p-3 mb-1">
      <div className="text-sm text-gray-700 leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-li:my-0.5">
        <ReactMarkdown>
          {thinkCompleted ? data.think : displayedThink}
        </ReactMarkdown>
        {!thinkCompleted && <span className="inline-block w-1 h-4 ml-1 bg-orange-400 animate-pulse align-middle" />}
      </div>
    </div>
  );
  
  // 流式输出效果
  React.useEffect(() => {
    if (!animate || !data.think || thinkCompleted) return;
    
    // 如果已经有部分内容了，从当前长度开始继续
    let currentIndex = displayedThink.length;
    const text = data.think;
    
    const timer = setInterval(() => {
      if (currentIndex < text.length) {
        setDisplayedThink(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(timer);
        handleThinkComplete();
      }
    }, 15);
    
    return () => clearInterval(timer);
  }, [data.think, animate, thinkCompleted]);

  const [expandedQueries, setExpandedQueries] = useState<Record<number, boolean>>({});

  const toggleQuery = (idx: number) => {
    setExpandedQueries(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const renderQueryDetails = (query: any) => {
    if (!query) return null;
    let queryObj = query;
    if (typeof query === 'string') {
      try {
        queryObj = JSON.parse(query);
      } catch (e) {
        return <div className="py-1">{query}</div>;
      }
    }

    if (typeof queryObj !== 'object' || queryObj === null) {
      return <div className="py-1">{String(queryObj)}</div>;
    }

    return (
      <div className="flex flex-col gap-1 py-1">
        {Object.entries(queryObj).map(([key, value], idx) => (
          <div key={idx} className="flex gap-2 leading-relaxed">
            <span className="text-gray-400 font-medium shrink-0">{key}:</span>
            <span className="text-gray-600 break-all">
              {Array.isArray(value) ? value.join('、') : String(value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const filteredList = (data.list || []).filter(group => {
    if ('list' in group && Array.isArray(group.list)) {
      return group.list.length > 0;
    }
    return false;
  }) as ProductGroup[];

  if (filteredList.length === 0) {
    return (
      <div className="mt-1 pt-1">
        {thinkElement}
        <div className="flex flex-col items-center justify-center mt-2 pt-4 pb-2">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-3">
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">暂无数据</p>
        </div>
      </div>
    );
  }

  // 辅助函数：从 image_urls 中提取第一张图片URL
  const getFirstImageUrl = (imageUrls?: string | string[]): string | null => {
    if (!imageUrls) return null;
    const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
    if (urls.length === 0) return null;
    const first = urls[0];
    // 处理 "名称:URL" 格式，提取冒号后面的URL
    if (typeof first === 'string' && first.includes(':')) {
      const colonIndex = first.indexOf(':');
      if (colonIndex > 0 && !first.startsWith('http')) {
        return first.substring(colonIndex + 1);
      }
    }
    return first;
  };

  return (
    <div className="flex flex-col gap-3 mt-1 pt-1">
      {thinkElement}
      {filteredList.map((group, idx) => (
        <div key={idx} className={`flex flex-col gap-3 ${idx > 0 ? 'mt-4 border-t border-gray-50 pt-5' : ''}`}>
          {/* 标题和筛选按钮区域 */}
          <div className="flex items-center justify-between">
            {group.title && (
              <h3 className="text-base font-bold text-gray-900">{group.title}</h3>
            )}
            {group.query && (
              <button 
                onClick={() => toggleQuery(idx)}
                className="text-[10px] text-blue-500 hover:text-blue-600 flex items-center gap-0.5"
              >
                {expandedQueries[idx] ? '收起条件' : '查看条件'}
                {expandedQueries[idx] ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
              </button>
            )}
          </div>

          {/* reson 展示区域 */}
          {(() => {
            if (!group.query) return null;
            let queryObj: any = null;
            try {
              queryObj = typeof group.query === 'string' ? JSON.parse(group.query) : group.query;
            } catch (e) {}
            
            const reson = queryObj?.reson || queryObj?.reason;
            if (reson) {
              return (
                <div className="flex gap-2 leading-relaxed text-[14px] px-0.5 -mt-1">
                  <span className="text-black-600 break-all">{reson}</span>
                </div>
              );
            }
            return null;
          })()}

          {group.reason && (
            <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">
              {group.reason}
            </p>
          )}
          
          {/* 筛选条件详情 */}
          {group.query && expandedQueries[idx] && (
            <div className="bg-gray-50/80 rounded-lg p-2.5 border border-gray-100 text-[11px] text-gray-500 font-sans animate-in fade-in slide-in-from-top-1 duration-200 shadow-sm">
              {(() => {
                let queryObj: any = null;
                try {
                  queryObj = typeof group.query === 'string' ? JSON.parse(group.query) : group.query;
                } catch (e) {}
                
                if (queryObj && typeof queryObj === 'object') {
                  const { reson: _, reason: __, ...rest } = queryObj;
                  if (Object.keys(rest).length === 0) return null;
                  return renderQueryDetails(rest);
                }
                return renderQueryDetails(group.query);
              })()}
            </div>
          )}
          <div className="flex flex-col gap-3">
             {group.list.slice(0, topN).map((product, pIdx) => {
               const imageUrl = getFirstImageUrl(product.image_urls);
               return (
                 <div 
                   key={pIdx}
                   onClick={() => onProductClick(product)}
                   className="flex rounded-xl overflow-hidden border border-gray-100 p-3 relative cursor-pointer hover:bg-gray-50 transition-colors"
                   style={{ backgroundColor: 'rgb(242,245,248)' }}
                 >
                   {/* 商品图片 */}
                   {imageUrl && (
                     <div className="w-[50px] h-[50px] rounded-lg overflow-hidden bg-gray-100 mr-3 flex-shrink-0">
                       <img 
                         src={imageUrl} 
                         alt={product.name}
                         className="w-full h-full object-cover"
                         onError={(e) => {
                           (e.target as HTMLImageElement).style.display = 'none';
                         }}
                       />
                     </div>
                   )}
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center gap-2 mb-2">
                       <h4 className="font-bold text-gray-900 text-base flex-shrink-0">{product.code}</h4>
                       <span className="text-sm text-gray-600">|</span>
                       <span className="text-xs text-gray-700 line-clamp-1">{product.name}</span>
                       {product.fabric_erp && (
                         <>
                           <span className="text-sm text-gray-600">|</span>
                           <span className="text-xs text-gray-700 line-clamp-1">{product.fabric_erp}</span>
                         </>
                       )}
                     </div>

                     {product.elem && (
                       <div className="text-[11px] text-gray-500 mb-1.5 line-clamp-1">
                         {product.elem}
                       </div>
                     )}

                     <div className="flex flex-wrap items-center gap-1.5 mb-2">
                       {product.taxmprice !== undefined && (
                         <span className="text-[10px] text-green-600 bg-green-100/80 px-1.5 py-0.5 rounded border border-green-200/50">
                           ¥{product.taxmprice}<span className="text-[8px]">/含税米价</span>
                         </span>
                       )}
                       {product.taxkgprice !== undefined && (
                         <span className="text-[10px] text-blue-600 bg-blue-100/80 px-1.5 py-0.5 rounded border border-blue-200/50">
                           ¥{product.taxkgprice}<span className="text-[8px]">/含税公斤价</span>
                         </span>
                       )}
                       {product.price !== undefined && (
                         <span className="text-[10px] text-purple-600 bg-purple-100/80 px-1.5 py-0.5 rounded border border-purple-200/50">
                           ¥{product.price}<span className="text-[8px]">/大货价</span>
                         </span>
                       )}
                     </div>
 
                     {(() => {
                       const tags = [
                         product.weight ? `${product.weight}g/㎡` : null,
                         product.width,
                         product.customizable_grade
                       ].filter(Boolean);
                       if (tags.length === 0) return null;
                       return (
                         <div className="flex items-center gap-1 text-xs text-gray-500">
                           {tags.map((tag, idx) => (
                             <React.Fragment key={idx}>
                               {idx > 0 && <span className="text-gray-400">|</span>}
                               <span>{tag}</span>
                             </React.Fragment>
                           ))}
                         </div>
                       );
                     })()}
                   </div>
                 </div>
               );
             })}
           </div>
          {group.list.length > topN && (
            <div className="relative z-[30]">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onExpandClick(group);
                }}
                className="w-full py-2.5 bg-white text-gray-600 text-xs font-medium rounded-lg flex items-center justify-center gap-1 hover:bg-gray-50 active:bg-gray-100 transition-all mt-2 cursor-pointer border border-gray-100"
              >
                点击展开剩余商品（{group.list.length - topN}）
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
