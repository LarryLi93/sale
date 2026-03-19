import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Tag, Ruler, Factory, Sparkles, Palette, FileText, X, ZoomIn, ZoomOut, ChevronRight, ChevronLeft } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// 设置 PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Product {
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
  inelem?: string;
  code_start?: string;
  type_notes?: string;
  fabric_structure_two?: string;
  report_urls?: string[];
  season_marking?: string;
}

const parseImages = (urls?: string | string[]): string[] => {
  if (!urls) return [];
  if (Array.isArray(urls)) {
    return urls.map(url => {
      const parts = url.split(':');
      return parts.length > 1 ? parts.slice(1).join(':') : url;
    });
  }
  return urls.split(',').map(url => {
    const parts = url.split(':');
    return parts.length > 1 ? parts.slice(1).join(':') : url;
  });
};

const parseReports = (reports?: string[]): { name: string; url: string }[] => {
  if (!reports) return [];
  return reports.map(report => {
    // 修复：正确处理 https:// 格式的 URL
    // 格式: "文件名:https://domain.com/path"
    const firstColonIndex = report.indexOf(':');
    if (firstColonIndex === -1) {
      return { name: report, url: report };
    }
    const name = report.substring(0, firstColonIndex).trim();
    let url = report.substring(firstColonIndex + 1).trim();
    // 修复双斜杠问题
    url = url.replace(/\/\/+/g, '/').replace('https:/', 'https://').replace('http:/', 'http://');
    return { name, url };
  });
};

// 信息行组件 - 沉浸式风格
const InfoRow = ({ label, value, unit = '' }: { label: string; value?: string | number | null; unit?: string }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between items-start py-3 gap-4">
      <span className="text-gray-500 text-[13px] font-bold whitespace-nowrap flex-shrink-0">{label}</span>
      <span className="text-gray-900 text-[13px] text-right break-words whitespace-pre-wrap">{value}{unit}</span>
    </div>
  );
};

// 标签组件 - 沉浸式风格
const TagItem = ({ label, value }: { label: string; value?: string }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-2">
      <span className="text-gray-500 text-[15px] whitespace-nowrap flex-shrink-0">{label}</span>
      <span className="text-gray-900 text-[15px] font-medium break-words whitespace-pre-wrap">{value}</span>
    </div>
  );
};

// 区块标题组件 - 沉浸式风格
const SectionTitle = ({ title, icon: Icon }: { title: string; icon: any }) => (
  <div className="flex items-center gap-2 mb-4">
    <Icon size={18} className="text-orange-500" />
    <h3 className="text-base font-bold text-gray-900">{title}</h3>
  </div>
);

// 图片轮播组件 - 沉浸式全屏风格
const ImageCarousel = ({ 
  images, 
  productName,
  externalPreviewIndex,
  onExternalPreviewClose
}: { 
  images: string[]; 
  productName: string;
  externalPreviewIndex?: number | null;
  onExternalPreviewClose?: () => void;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewScale, setPreviewScale] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const [initialDistance, setInitialDistance] = useState(0);
  const [initialScale, setInitialScale] = useState(1);

  const goToSlide = (index: number) => {
    if (index < 0) index = images.length - 1;
    if (index >= images.length) index = 0;
    setCurrentIndex(index);
  };

  // 使用原生事件处理触摸，避免 passive 事件限制
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startXLocal = 0;
    let isDraggingLocal = false;

    const onTouchStart = (e: TouchEvent) => {
      startXLocal = e.touches[0].clientX;
      isDraggingLocal = true;
      setStartX(startXLocal);
      setIsDragging(true);
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingLocal) return;
      e.preventDefault();
      const currentX = e.touches[0].clientX;
      const diff = currentX - startXLocal;
      setTranslateX(diff);
    };

    const onTouchEnd = () => {
      if (!isDraggingLocal) return;
      isDraggingLocal = false;
      setIsDragging(false);
      
      setTranslateX(prev => {
        if (prev > 50) {
          goToSlide(currentIndex - 1);
        } else if (prev < -50) {
          goToSlide(currentIndex + 1);
        }
        return 0;
      });
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [currentIndex]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setStartX(e.clientX);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const diff = e.clientX - startX;
    setTranslateX(diff);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    if (translateX > 50) {
      goToSlide(currentIndex - 1);
    } else if (translateX < -50) {
      goToSlide(currentIndex + 1);
    }
    setTranslateX(0);
  };

  const openPreview = (index: number) => {
    setPreviewIndex(index);
    setPreviewScale(1);
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewScale(1);
  };

  const goToPreviewSlide = (direction: 'prev' | 'next') => {
    setPreviewScale(1);
    if (direction === 'prev') {
      setPreviewIndex(prev => prev === 0 ? images.length - 1 : prev - 1);
    } else {
      setPreviewIndex(prev => prev === images.length - 1 ? 0 : prev + 1);
    }
  };

  const handleZoomIn = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewScale(prev => Math.min(prev + 0.5, 4));
  };

  const handleZoomOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewScale(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setPreviewScale(prev => Math.min(prev + 0.2, 4));
    } else {
      setPreviewScale(prev => Math.max(prev - 0.2, 0.5));
    }
  };

  const getDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handlePreviewTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      setInitialDistance(getDistance(e.touches));
      setInitialScale(previewScale);
    }
  };

  const handlePreviewTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const currentDistance = getDistance(e.touches);
      const scale = (currentDistance / initialDistance) * initialScale;
      setPreviewScale(Math.min(Math.max(scale, 0.5), 4));
    }
  };

  const resetZoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPreviewScale(1);
  };

  if (images.length === 0) return null;

  return (
    <>
      {/* 主轮播区域 - 沉浸式全宽 */}
      <div 
        ref={containerRef}
        className="relative w-full aspect-square bg-gray-100 overflow-hidden cursor-grab active:cursor-grabbing touch-pan-y"

        style={{ touchAction: 'pan-y' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* 图片容器 */}
        <div 
          className="flex transition-transform duration-300 ease-out h-full"
          style={{ 
            transform: `translateX(calc(-${currentIndex * 100}% + ${translateX}px))`,
            transition: isDragging ? 'none' : 'transform 0.3s ease-out'
          }}
        >
          {images.map((img, idx) => (
            <div 
              key={idx} 
              className="w-full h-full flex-shrink-0 relative cursor-pointer"
              onClick={() => openPreview(idx)}
            >
              <img 
                src={img} 
                alt={`${productName}-${idx}`}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
          ))}
        </div>

        {/* 左右切换箭头 */}
        {images.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToSlide(currentIndex - 1);
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/20 hover:bg-black/40 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                goToSlide(currentIndex + 1);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-black/20 hover:bg-black/40 rounded-full flex items-center justify-center text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* 指示器 - 圆点，支持多行 */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 px-8">
            <div className="flex flex-wrap justify-center gap-1.5 max-w-full">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToSlide(idx);
                  }}
                  className={`h-1.5 rounded-full transition-all flex-shrink-0 ${
                    idx === currentIndex 
                      ? 'bg-white w-4' 
                      : 'bg-white/50 w-1.5'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* 图片计数器 */}
        <div className="absolute top-4 right-4 bg-black/40 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur-sm">
          {currentIndex + 1} / {images.length}
        </div>
      </div>

      {/* 缩略图列表 */}
      {images.length > 1 && (
        <div className="px-4 py-3 bg-white border-b border-gray-100">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => goToSlide(idx)}
                className={`relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === currentIndex 
                    ? 'border-orange-500' 
                    : 'border-gray-200'
                }`}
              >
                <img 
                  src={img} 
                  alt={`缩略图-${idx}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 全屏预览 */}
      {showPreview && (
        <div 
          className="fixed inset-0 bg-black z-50 flex flex-col"
          onClick={closePreview}
          onWheel={handleWheel}
          onTouchStart={handlePreviewTouchStart}
          onTouchMove={handlePreviewTouchMove}
        >
          {/* 顶部工具栏 */}
          <div className="flex items-center justify-between p-4 z-10">
            <span className="text-white text-sm">
              {previewIndex + 1} / {images.length}
            </span>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={handleZoomOut}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className="text-white text-sm min-w-[60px] text-center">
                {Math.round(previewScale * 100)}%
              </span>
              <button 
                onClick={handleZoomIn}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button 
                onClick={resetZoom}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white text-xs"
              >
                重置
              </button>
              <button 
                onClick={closePreview}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white ml-2"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* 预览图片 */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            {previewScale === 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPreviewSlide('prev');
                  }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white z-10"
                >
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPreviewSlide('next');
                  }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white z-10"
                >
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}

            <img 
              src={images[previewIndex]} 
              alt={`预览-${previewIndex}`}
              className="max-w-full max-h-full object-contain transition-transform duration-200"
              style={{ 
                transform: `scale(${previewScale})`,
                cursor: previewScale > 1 ? 'grab' : 'default'
              }}
              onClick={(e) => e.stopPropagation()}
              draggable={false}
            />
          </div>
          
          {/* 缩放提示 */}
          <div className="absolute bottom-30 left-1/2 -translate-x-1/2 text-white/60 text-xs text-center">
            {previewScale > 1 ? '双指捏合或滚轮缩放' : '滚轮缩放 / 双指捏合'}
          </div>

          {/* 底部缩略图 */}
          <div className="p-4 bg-black/50">
            <div className="flex gap-2 overflow-x-auto justify-center">
              {images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewIndex(idx);
                  }}
                  className={`relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === previewIndex 
                      ? 'border-orange-500' 
                      : 'border-white/30'
                  }`}
                >
                  <img 
                    src={img} 
                    alt={`预览缩略图-${idx}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default function ProductDetailPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  
  // 证书预览状态 - 必须在所有条件检查之前
  const [previewReport, setPreviewReport] = useState<{name: string; url: string} | null>(null);

  useEffect(() => {
    const fetchProductDetail = async () => {
      if (!code) {
        setLoading(false);
        return;
      }

      // 先从 sessionStorage 获取初始数据（用于快速展示）
      const savedProduct = sessionStorage.getItem('currentProduct');
      if (savedProduct) {
        const p = JSON.parse(savedProduct);
        if (p.code === code) {
          setProduct(p);
        }
      }

      // 调用接口获取完整商品信息（包括图片、证书等）
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/get_product_detail?code=${encodeURIComponent(code)}`);
        const result = await response.json();
        
        if (result.success && result.data) {
          // 后端返回的是分类格式数据，需要合并所有分类
          const categorizedData = result.data;
          
          // 将所有分类的字段合并成一个平铺对象
          const detailData: Record<string, any> = {};
          Object.values(categorizedData).forEach((category: any) => {
            if (typeof category === 'object' && category !== null) {
              Object.assign(detailData, category);
            }
          });
          
          // 合并基础信息和详情信息
          setProduct(prev => {
            const baseProduct = prev || {};
            return {
              ...baseProduct,
              ...detailData,
              // 确保图片和证书使用详情接口返回的数据
              image_urls: detailData.image_urls || detailData.imageUrls || baseProduct.image_urls,
              report_urls: detailData.report_urls || detailData.reportUrls || baseProduct.report_urls,
            } as Product;
          });
        }
      } catch (error) {
        console.error('获取商品详情失败:', error);
        // 如果接口失败，继续使用 sessionStorage 的数据
      } finally {
        setLoading(false);
      }
    };

    fetchProductDetail();
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <Package size={48} className="text-gray-300 mb-4" />
        <p className="text-gray-500 mb-4">商品信息未找到</p>
        <button 
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg"
        >
          返回首页
        </button>
      </div>
    );
  }

  const images = parseImages(product.image_urls);
  const reports = parseReports(product.report_urls);

  const openReportPreview = (report: {name: string; url: string}) => {
    setPreviewReport(report);
  };

  const closeReportPreview = () => {
    setPreviewReport(null);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部导航 - 沉浸式 */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-gray-100">
        <div className="flex items-center gap-3 px-4 h-14">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={22} className="text-gray-700" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 truncate">{product.code}</h1>
          </div>
        </div>
      </div>

      {/* 图片轮播 - 沉浸式全宽 */}
      {images.length > 0 && (
        <ImageCarousel images={images} productName={product.name} />
      )}

      {/* 商品名称 - 沉浸式大标题 */}
      <div className="px-4 py-4 border-b border-gray-100">
        <h2 className="text-xl font-bold text-gray-900 leading-tight">{product.name}</h2>
        {product.fabric_erp && (
          <p className="text-gray-500 text-sm mt-1">{product.fabric_erp}</p>
        )}
      </div>

      {/* 价格区域 - 沉浸式 */}
      {(product.taxmprice !== undefined || product.taxkgprice !== undefined || product.price !== undefined || product.fewprice !== undefined) && (
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="grid grid-cols-2 gap-3">
            {product.taxmprice !== undefined && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-gray-900">¥{product.taxmprice}</p>
                <p className="text-xs text-gray-500 mt-1">含税米价</p>
              </div>
            )}
            {product.taxkgprice !== undefined && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-gray-900">¥{product.taxkgprice}</p>
                <p className="text-xs text-gray-500 mt-1">含税公斤价</p>
              </div>
            )}
            {product.price !== undefined && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-gray-900">¥{product.price}</p>
                <p className="text-xs text-gray-500 mt-1">大货价</p>
              </div>
            )}
            {product.fewprice !== undefined && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-2xl font-bold text-gray-900">¥{product.fewprice}</p>
                <p className="text-xs text-gray-500 mt-1">散剪价</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 规格参数 - 沉浸式 */}
      <div className="px-4 py-4 border-b border-gray-100">
        <SectionTitle title="规格参数" icon={Ruler} />
        <div className="divide-y divide-gray-50">
          <InfoRow label="款号" value={product.code} />
          <InfoRow label="成分" value={product.elem} />
          <InfoRow label="纱支" value={product.inelem} />
          <InfoRow label="克重" value={product.weight} unit="g/㎡" />
          <InfoRow label="幅宽" value={product.width} unit="cm" />
          <InfoRow label="ERP布种" value={product.fabric_erp} />
          <InfoRow label="布种细分" value={product.fabric_structure_two} />
        </div>
      </div>

      {/* 商品信息 - 沉浸式 */}
      <div className="px-4 py-4 border-b border-gray-100">
        <SectionTitle title="商品信息" icon={Package} />
        <div className="divide-y divide-gray-50">
          <InfoRow label="商品系列" value={product.code_start} />
          <InfoRow label="可定等级" value={product.customizable_grade} />
          <InfoRow label="纸筒空差" value={product.papertubeqty && product.emptyqty ? `${product.papertubeqty}+${product.emptyqty}` : undefined} />
          <InfoRow label="备注类型" value={product.type_notes} />
          <InfoRow label="上市时间" value={product.release_date} />
        </div>
      </div>

      {/* 产品特性 - 沉浸式 */}
      {(product.fun || product.touch || product.silhouette || product.style || product.applicable_crowd || product.dressing_occasion || product.season_marking) && (
        <div className="px-4 py-4 border-b border-gray-100">
          <SectionTitle title="产品特性" icon={Sparkles} />
          <div className="divide-y divide-gray-50">
            <TagItem label="功能" value={product.fun} />
            <TagItem label="触感" value={product.touch} />
            <TagItem label="廓形" value={product.silhouette} />
            <TagItem label="风格" value={product.style} />
            <TagItem label="适用人群" value={product.applicable_crowd} />
            <TagItem label="穿着场景" value={product.dressing_occasion} />
            <TagItem label="适用季节" value={product.season_marking} />
          </div>
        </div>
      )}

      {/* 所属系列 - 沉浸式 */}
      {product.series && (
        <div className="px-4 py-4 border-b border-gray-100">
          <SectionTitle title="所属系列" icon={Palette} />
          <div className="flex flex-wrap gap-2 mt-2">
            {product.series.split(',').map((s, idx) => (
              <span key={idx} className="px-4 py-2 bg-gray-50 text-gray-700 rounded-full text-sm font-medium">
                {s.trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 生产工艺 - 沉浸式 */}
      {product.production_process && (
        <div className="px-4 py-4 border-b border-gray-100">
          <SectionTitle title="生产工艺" icon={Factory} />
          <div className="flex flex-wrap gap-2 mt-2">
            {product.production_process.split('、').map((process, idx) => (
              <span key={idx} className="px-4 py-2 bg-gray-50 text-gray-700 rounded-lg text-sm">
                {process.trim()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 相关证书 - 沉浸式 */}
      {reports.length > 0 && (
        <div className="px-4 py-4 pb-8">
          <SectionTitle title="相关证书" icon={FileText} />
          <div className="mt-2 space-y-2">
            {reports.map((report, idx) => {
              // 判断是否为图片
              const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(report.url);
              return (
                <div
                  key={idx}
                  onClick={() => openReportPreview(report)}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      {isImage ? (
                        <img 
                          src={report.url} 
                          alt={report.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <FileText size={20} className="text-blue-500" />
                      )}
                    </div>
                    <span className="text-[15px] text-gray-900">{report.name}</span>
                  </div>
                  <ChevronRight size={20} className="text-gray-400" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 证书预览页面 */}
      {previewReport && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          {/* 顶部导航栏 */}
          <div className="flex items-center justify-between px-4 h-14 bg-white border-b border-gray-100 flex-shrink-0">
            <button 
              onClick={closeReportPreview}
              className="flex items-center gap-1 text-gray-700 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="text-sm">返回详情</span>
            </button>
            <span className="text-sm text-gray-900 truncate max-w-[40%] text-center">
              {previewReport.name}
            </span>
            <a
              href={previewReport.url}
              download
              className="flex items-center gap-1 text-sm text-blue-500 hover:text-blue-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              下载
            </a>
          </div>

          {/* 预览内容 */}
          <div className="flex-1 relative bg-gray-100">
            {(() => {
              const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(previewReport.url);
              const isPDF = /\.pdf$/i.test(previewReport.url);
              
              if (isImage) {
                // 图片直接显示
                return (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <img 
                      src={previewReport.url} 
                      alt={previewReport.name}
                      className="max-w-full max-h-full object-contain shadow-lg"
                    />
                  </div>
                );
              } else if (isPDF) {
                // PDF 使用 react-pdf 本地预览
                return <PDFViewer url={previewReport.url} name={previewReport.name} />;
              } else {
                // 其他文件类型，提供下载提示
                return (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8">
                    <FileText size={64} className="text-gray-300 mb-4" />
                    <p className="text-gray-600 mb-4 text-center">该文件类型不支持在线预览</p>
                    <a
                      href={previewReport.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      下载文件
                    </a>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// PDF 预览组件
const PDFViewer = ({ url, name }: { url: string; name: string }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setLoading(false);
    setPageNumber(1);
  }

  function onDocumentLoadError(error: Error) {
    console.error('PDF加载失败:', error);
    setError('PDF 文件加载失败，请检查文件链接');
    setLoading(false);
  }

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(prev - 1, 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(prev + 1, numPages));
  };

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.2, 3));
  };

  const zoomOut = () => {
    setScale((prev) => Math.max(prev - 0.2, 0.5));
  };

  const resetZoom = () => {
    setScale(1.2);
  };

  return (
    <div className="w-full h-full flex flex-col bg-gray-100">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevPage}
            disabled={pageNumber <= 1}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-700" />
          </button>
          <span className="text-sm text-gray-700 min-w-[80px] text-center">
            {pageNumber} / {numPages}
          </span>
          <button
            onClick={goToNextPage}
            disabled={pageNumber >= numPages}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={20} className="text-gray-700" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomOut size={18} className="text-gray-700" />
          </button>
          <span className="text-sm text-gray-700 min-w-[60px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={scale >= 3}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomIn size={18} className="text-gray-700" />
          </button>
          <button
            onClick={resetZoom}
            className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors ml-2"
          >
            重置
          </button>
        </div>
      </div>

      {/* PDF 内容区域 */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto flex justify-center items-start py-8"
      >
        {loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 text-sm mt-3">加载 PDF 中...</p>
          </div>
        )}
        
        {error && (
          <div className="flex flex-col items-center justify-center h-full p-8">
            <FileText size={64} className="text-gray-300 mb-4" />
            <p className="text-gray-600 text-center mb-4">{error}</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              下载文件
            </a>
          </div>
        )}

        <Document
          file={url}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="shadow-lg"
        >
          {!loading && !error && (
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="bg-white"
              loading={
                <div className="w-[600px] h-[800px] bg-white flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              }
            />
          )}
        </Document>
      </div>
    </div>
  );
};
