import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, ChevronRight } from 'lucide-react';

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
  sale_num_year?: number;
  inelem?: string;
  code_start?: string;
  type_notes?: string;
  fabric_structure_two?: string;
  report_urls?: string[];
  season_marking?: string;
}

interface ProductGroup {
  title: string;
  query: any;
  total: number;
  list: Product[];
}

export default function ProductListPage() {
  const navigate = useNavigate();
  const [group, setGroup] = useState<ProductGroup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 从 sessionStorage 获取列表数据
    const savedGroup = sessionStorage.getItem('currentProductGroup');
    if (savedGroup) {
      setGroup(JSON.parse(savedGroup));
    }
    setLoading(false);
  }, []);

  const handleProductClick = (product: Product) => {
    // 保存当前商品到 sessionStorage
    sessionStorage.setItem('currentProduct', JSON.stringify(product));
    // 跳转到详情页
    navigate(`/product/${product.code}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <Package size={48} className="text-gray-300 mb-4" />
        <p className="text-gray-500 mb-4">列表信息未找到</p>
        <button 
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg"
        >
          返回首页
        </button>
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
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-gray-900 text-lg leading-tight">{group.title || '商品列表'}</h1>
            <p className="text-sm text-gray-500 mt-0.5">共 {group.list.length} 款商品</p>
          </div>
        </div>
      </div>

      {/* 商品列表 */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="space-y-3">
          {group.list.map((product, idx) => {
            const imageUrl = getFirstImageUrl(product.image_urls);
            return (
              <div
                key={idx}
                onClick={() => handleProductClick(product)}
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
                {/* 左侧信息区域 */}
                <div className="flex-1 min-w-0">
                  {/* 商品编号 | 名称 | 工艺 */}
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-gray-900 text-base flex-shrink-0">{product.code}</h3>
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

                  {/* 价格标签 */}
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

                  {/* 规格信息 */}
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
        {/* 底部提示 */}
        {group.total > 10 && (
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-400">商品过多，优先显示热销前10</p>
          </div>
        )}
      </div>
    </div>
  );
}
