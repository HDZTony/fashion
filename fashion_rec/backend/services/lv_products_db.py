"""
LV商品数据库存储服务
使用Supabase存储商品信息
"""
from typing import List, Dict, Optional, Any
from datetime import datetime
import json
import uuid
from supabase import Client
from .supabase_client import create_supabase_client

# 表名
TABLE_NAME = "lv_products"


class LVProductsDB:
    """LV商品数据库管理类（使用Supabase）"""
    
    def __init__(self):
        """
        初始化Supabase客户端
        """
        self.client: Client = create_supabase_client()
        self.table = self.client.table(TABLE_NAME)
        # 确保表存在（如果不存在，需要在Supabase Dashboard中手动创建）
        self._ensure_table_exists()
    
    def _ensure_table_exists(self):
        """
        检查表是否存在，如果不存在则提示用户创建
        注意：Supabase需要在Dashboard中手动创建表，这里只做检查
        """
        try:
            # 尝试查询表，如果表不存在会抛出异常
            self.table.select("product_id").limit(1).execute()
        except Exception as e:
            print(f"[LVProductsDB] Warning: Table '{TABLE_NAME}' may not exist. Please create it in Supabase Dashboard.")
            print(f"[LVProductsDB] Error: {e}")
            print(f"[LVProductsDB] See SQL migration script in LV_PRODUCTS_README.md")
    
    def add_product(
        self,
        product_name: str,
        original_lv_url: str,
        original_image_url: str,
        thumbnail_url: Optional[str] = None,
        price: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        添加商品到数据库
        
        Args:
            product_name: 商品名称
            original_lv_url: LV官网原始链接
            original_image_url: 原始高清图片URL
            thumbnail_url: 生成的缩略图URL（如果已生成）
            price: 商品价格
            metadata: 额外的元数据（字典格式）
        
        Returns:
            商品ID
        """
        product_id = str(uuid.uuid4())
        now = datetime.utcnow().isoformat()
        
        data = {
            "product_id": product_id,
            "product_name": product_name,
            "price": price,
            "original_lv_url": original_lv_url,
            "thumbnail_url": thumbnail_url,
            "original_image_url": original_image_url,
            "created_at": now,
            "updated_at": now,
            "metadata": metadata if metadata else {},
        }
        
        try:
            response = self.table.insert(data).execute()
            if response.data:
                return product_id
            else:
                raise RuntimeError("Failed to insert product: no data returned")
        except Exception as e:
            print(f"[LVProductsDB] Error adding product: {e}")
            raise
    
    def update_product(
        self,
        product_id: str,
        thumbnail_url: Optional[str] = None,
        **kwargs
    ) -> bool:
        """
        更新商品信息
        
        Args:
            product_id: 商品ID
            thumbnail_url: 缩略图URL
            **kwargs: 其他要更新的字段
        
        Returns:
            是否更新成功
        """
        updates: Dict[str, Any] = {
            "updated_at": datetime.utcnow().isoformat(),
        }
        
        if thumbnail_url is not None:
            updates["thumbnail_url"] = thumbnail_url
        
        # 处理其他字段
        for key, value in kwargs.items():
            if key in ('product_name', 'price', 'original_lv_url', 'original_image_url'):
                updates[key] = value
            elif key == 'metadata' and isinstance(value, dict):
                updates[key] = value
        
        if len(updates) == 1:  # 只有updated_at，没有实际更新
            return False
        
        try:
            response = self.table.update(updates).eq("product_id", product_id).execute()
            return len(response.data) > 0
        except Exception as e:
            print(f"[LVProductsDB] Error updating product: {e}")
            return False
    
    def get_product(self, product_id: str) -> Optional[Dict[str, Any]]:
        """
        根据ID获取商品信息
        
        Args:
            product_id: 商品ID
        
        Returns:
            商品信息字典，如果不存在则返回None
        """
        try:
            response = self.table.select("*").eq("product_id", product_id).execute()
            if response.data and len(response.data) > 0:
                return self._normalize_product(response.data[0])
            return None
        except Exception as e:
            print(f"[LVProductsDB] Error getting product: {e}")
            return None
    
    def list_products(
        self,
        limit: Optional[int] = None,
        offset: int = 0,
        order_by: str = "created_at",
        order_direction: str = "DESC",
    ) -> List[Dict[str, Any]]:
        """
        列出商品列表
        
        Args:
            limit: 返回数量限制
            offset: 偏移量（用于分页）
            order_by: 排序字段
            order_direction: 排序方向（ASC或DESC）
        
        Returns:
            商品信息列表
        """
        try:
            # 验证排序字段
            valid_columns = ['product_id', 'product_name', 'price', 'created_at', 'updated_at']
            if order_by not in valid_columns:
                order_by = 'created_at'
            
            # 构建查询
            query = self.table.select("*")
            
            # 排序
            if order_direction.upper() == 'DESC':
                query = query.order(order_by, desc=True)
            else:
                query = query.order(order_by, desc=False)
            
            # 分页
            if limit:
                query = query.range(offset, offset + limit - 1)
            else:
                # 如果没有限制，使用一个很大的数字（Supabase默认限制是1000）
                query = query.range(offset, offset + 9999)
            
            response = query.execute()
            return [self._normalize_product(item) for item in response.data]
        except Exception as e:
            print(f"[LVProductsDB] Error listing products: {e}")
            return []
    
    def search_products(
        self,
        keyword: str,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        搜索商品（按名称）
        
        Args:
            keyword: 搜索关键词
            limit: 返回数量限制
            offset: 偏移量
        
        Returns:
            匹配的商品列表
        """
        try:
            # 使用ilike进行不区分大小写的模糊搜索
            query = self.table.select("*").ilike("product_name", f"%{keyword}%").order("created_at", desc=True)
            
            if limit:
                query = query.range(offset, offset + limit - 1)
            
            response = query.execute()
            return [self._normalize_product(item) for item in response.data]
        except Exception as e:
            print(f"[LVProductsDB] Error searching products: {e}")
            return []
    
    def delete_product(self, product_id: str) -> bool:
        """
        删除商品
        
        Args:
            product_id: 商品ID
        
        Returns:
            是否删除成功
        """
        try:
            response = self.table.delete().eq("product_id", product_id).execute()
            return len(response.data) > 0
        except Exception as e:
            print(f"[LVProductsDB] Error deleting product: {e}")
            return False
    
    def count_products(self) -> int:
        """
        获取商品总数
        
        Returns:
            商品总数
        """
        try:
            # 使用count查询获取总数
            response = self.table.select("product_id", count="exact").limit(0).execute()
            # Supabase返回的count在response.count中
            if hasattr(response, 'count') and response.count is not None:
                return response.count
            # 如果没有count属性，尝试从响应中获取
            return len(response.data) if response.data else 0
        except Exception as e:
            print(f"[LVProductsDB] Error counting products: {e}")
            # 如果count查询失败，尝试获取所有记录（不推荐，但作为fallback）
            try:
                response = self.table.select("product_id").execute()
                return len(response.data) if response.data else 0
            except:
                return 0
    
    def _normalize_product(self, product: Dict[str, Any]) -> Dict[str, Any]:
        """
        规范化商品数据格式
        
        Args:
            product: 从Supabase返回的商品数据
        
        Returns:
            规范化后的商品字典
        """
        # 确保metadata是字典格式
        if 'metadata' in product:
            if isinstance(product['metadata'], str):
                try:
                    product['metadata'] = json.loads(product['metadata'])
                except:
                    product['metadata'] = {}
            elif product['metadata'] is None:
                product['metadata'] = {}
        else:
            product['metadata'] = {}
        
        return product


# 全局数据库实例
_db_instance: Optional[LVProductsDB] = None


def get_db() -> LVProductsDB:
    """
    获取数据库实例（单例模式）
    
    Returns:
        LVProductsDB实例
    """
    global _db_instance
    if _db_instance is None:
        _db_instance = LVProductsDB()
    return _db_instance
