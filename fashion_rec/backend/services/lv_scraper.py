"""
LV商品数据抓取服务
用于从LV官网抓取商品信息（名称、价格、图片URL）
"""
import requests
from bs4 import BeautifulSoup
from typing import List, Dict, Optional, Any
import time
import re
from urllib.parse import urljoin, urlparse


class LVScraper:
    """LV商品数据抓取器"""
    
    def __init__(self, base_url: str = "https://www.louisvuitton.com", delay: float = 2.0):
        """
        初始化抓取器
        
        Args:
            base_url: LV官网基础URL
            delay: 请求之间的延迟时间（秒），避免过于频繁的请求
        """
        self.base_url = base_url
        self.delay = delay
        self.session = requests.Session()
        # 设置请求头，模拟浏览器访问
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
        })
    
    def fetch_product_list(self, category_url: str, max_pages: int = 1) -> List[Dict[str, Any]]:
        """
        从商品列表页抓取商品信息
        
        Args:
            category_url: 商品分类页面URL（例如：/zhs-cn/catalog/women/handbags）
            max_pages: 最大抓取页数
        
        Returns:
            商品信息列表，每个商品包含：name, price, original_image_url, product_url
        """
        products = []
        
        # 构建完整URL
        if not category_url.startswith('http'):
            category_url = urljoin(self.base_url, category_url)
        
        for page in range(1, max_pages + 1):
            try:
                # 根据实际网站结构调整URL（可能需要添加分页参数）
                page_url = category_url
                if page > 1:
                    # 常见的分页URL模式，需要根据实际网站调整
                    page_url = f"{category_url}?page={page}"
                
                print(f"[Scraper] 正在抓取第 {page} 页: {page_url}")
                
                response = self.session.get(page_url, timeout=30)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.content, 'html.parser')
                
                # 解析商品信息
                # 注意：以下选择器需要根据实际LV网站结构调整
                page_products = self._parse_product_list(soup, page_url)
                products.extend(page_products)
                
                print(f"[Scraper] 第 {page} 页抓取到 {len(page_products)} 个商品")
                
                # 延迟，避免请求过于频繁
                if page < max_pages:
                    time.sleep(self.delay)
                    
            except Exception as e:
                print(f"[Scraper] 抓取第 {page} 页时出错: {e}")
                continue
        
        return products
    
    def _parse_product_list(self, soup: BeautifulSoup, base_url: str) -> List[Dict[str, Any]]:
        """
        解析商品列表页面的HTML，提取商品信息
        
        注意：此方法的选择器需要根据实际LV网站的HTML结构进行调整
        """
        products = []
        
        # 方法1: 尝试查找商品卡片容器（需要根据实际HTML结构调整）
        # 常见的商品列表容器类名：product-item, product-card, product-tile等
        product_elements = soup.find_all(['div', 'article', 'li'], class_=re.compile(r'product|item|tile', re.I))
        
        for element in product_elements:
            try:
                product_info = self._extract_product_info(element, base_url)
                if product_info:
                    products.append(product_info)
            except Exception as e:
                print(f"[Scraper] 解析商品元素时出错: {e}")
                continue
        
        # 如果没找到商品，尝试查找JSON-LD结构化数据（很多电商网站会使用）
        if not products:
            products = self._parse_json_ld(soup, base_url)
        
        # 如果还是没找到，尝试查找带有data-product-id等属性的元素
        if not products:
            products = self._parse_data_attributes(soup, base_url)
        
        return products
    
    def _extract_product_info(self, element, base_url: str) -> Optional[Dict[str, Any]]:
        """
        从单个商品元素中提取信息
        """
        product = {}
        
        # 提取商品名称
        name_elem = element.find(['h2', 'h3', 'a', 'span'], class_=re.compile(r'title|name|product', re.I))
        if not name_elem:
            name_elem = element.find('a', href=re.compile(r'/product/'))
        if name_elem:
            product['name'] = name_elem.get_text(strip=True)
        
        # 提取价格
        price_elem = element.find(['span', 'div'], class_=re.compile(r'price|cost|amount', re.I))
        if price_elem:
            price_text = price_elem.get_text(strip=True)
            # 提取价格数字
            price_match = re.search(r'[\d,]+\.?\d*', price_text.replace(',', ''))
            if price_match:
                product['price'] = price_text
        
        # 提取商品链接
        link_elem = element.find('a', href=True)
        if link_elem:
            product_url = link_elem['href']
            if not product_url.startswith('http'):
                product_url = urljoin(base_url, product_url)
            product['product_url'] = product_url
        
        # 提取图片URL
        img_elem = element.find('img', src=True)
        if not img_elem:
            img_elem = element.find('img', {'data-src': True})
            if img_elem:
                img_url = img_elem['data-src']
            else:
                img_url = None
        else:
            img_url = img_elem.get('src') or img_elem.get('data-src')
        
        if img_url:
            if not img_url.startswith('http'):
                img_url = urljoin(base_url, img_url)
            # 尝试获取高清图片URL（移除尺寸限制参数）
            product['original_image_url'] = self._get_high_res_image_url(img_url)
        
        # 只返回包含必要信息的商品
        if product.get('name') and product.get('original_image_url'):
            return product
        
        return None
    
    def _get_high_res_image_url(self, img_url: str) -> str:
        """
        尝试从缩略图URL转换为高清图URL
        很多网站会在URL中包含尺寸参数，移除或修改这些参数可以获得原图
        """
        # 移除常见的尺寸参数
        patterns_to_remove = [
            r'[?&]w=\d+',
            r'[?&]h=\d+',
            r'[?&]width=\d+',
            r'[?&]height=\d+',
            r'[?&]size=\d+',
            r'/small/',
            r'/thumbnail/',
            r'/thumb/',
        ]
        
        high_res_url = img_url
        for pattern in patterns_to_remove:
            high_res_url = re.sub(pattern, '', high_res_url, flags=re.I)
        
        # 尝试替换常见的缩略图路径为原图路径
        high_res_url = high_res_url.replace('/small/', '/large/')
        high_res_url = high_res_url.replace('/thumbnail/', '/original/')
        high_res_url = high_res_url.replace('/thumb/', '/full/')
        
        return high_res_url
    
    def _parse_json_ld(self, soup: BeautifulSoup, base_url: str) -> List[Dict[str, Any]]:
        """
        解析JSON-LD结构化数据（如果网站使用了schema.org标记）
        """
        products = []
        json_ld_scripts = soup.find_all('script', type='application/ld+json')
        
        for script in json_ld_scripts:
            try:
                import json
                data = json.loads(script.string)
                
                # 检查是否是Product或ItemList类型
                if isinstance(data, list):
                    for item in data:
                        if item.get('@type') in ['Product', 'ItemList']:
                            if item.get('@type') == 'ItemList' and 'itemListElement' in item:
                                # 处理ItemList
                                for element in item['itemListElement']:
                                    if 'item' in element:
                                        products.append(self._parse_json_product(element['item'], base_url))
                            elif item.get('@type') == 'Product':
                                products.append(self._parse_json_product(item, base_url))
                elif isinstance(data, dict):
                    if data.get('@type') == 'Product':
                        products.append(self._parse_json_product(data, base_url))
                        
            except Exception as e:
                print(f"[Scraper] 解析JSON-LD时出错: {e}")
                continue
        
        return [p for p in products if p]
    
    def _parse_json_product(self, product_data: Dict, base_url: str) -> Optional[Dict[str, Any]]:
        """
        从JSON-LD的Product数据中提取信息
        """
        product = {}
        
        if 'name' in product_data:
            product['name'] = product_data['name']
        
        if 'offers' in product_data:
            offers = product_data['offers']
            if isinstance(offers, list) and offers:
                offers = offers[0]
            if isinstance(offers, dict) and 'price' in offers:
                price = offers['price']
                currency = offers.get('priceCurrency', '')
                product['price'] = f"{currency} {price}".strip()
        
        if 'image' in product_data:
            images = product_data['image']
            if isinstance(images, list) and images:
                product['original_image_url'] = images[0] if isinstance(images[0], str) else images[0].get('url', '')
            elif isinstance(images, str):
                product['original_image_url'] = images
            elif isinstance(images, dict):
                product['original_image_url'] = images.get('url', '')
        
        if 'url' in product_data or '@id' in product_data:
            product_url = product_data.get('url') or product_data.get('@id', '')
            if not product_url.startswith('http'):
                product_url = urljoin(base_url, product_url)
            product['product_url'] = product_url
        
        if product.get('name') and product.get('original_image_url'):
            return product
        
        return None
    
    def _parse_data_attributes(self, soup: BeautifulSoup, base_url: str) -> List[Dict[str, Any]]:
        """
        尝试从data-*属性中提取商品信息
        """
        products = []
        elements_with_data = soup.find_all(attrs={'data-product-id': True})
        
        for element in elements_with_data:
            try:
                product = {}
                product['name'] = element.get('data-product-name') or element.get_text(strip=True)
                product['price'] = element.get('data-product-price', '')
                
                img_url = element.get('data-product-image') or element.get('data-image-url')
                if img_url:
                    product['original_image_url'] = urljoin(base_url, img_url) if not img_url.startswith('http') else img_url
                
                product_url = element.get('data-product-url') or element.find('a', href=True)
                if isinstance(product_url, str):
                    product['product_url'] = urljoin(base_url, product_url) if not product_url.startswith('http') else product_url
                elif product_url:
                    product['product_url'] = urljoin(base_url, product_url.get('href', ''))
                
                if product.get('name') and product.get('original_image_url'):
                    products.append(product)
            except Exception as e:
                print(f"[Scraper] 解析data属性时出错: {e}")
                continue
        
        return products
    
    def fetch_product_detail(self, product_url: str) -> Optional[Dict[str, Any]]:
        """
        从商品详情页抓取更详细的信息
        
        Args:
            product_url: 商品详情页URL
        
        Returns:
            包含详细信息的商品字典
        """
        try:
            if not product_url.startswith('http'):
                product_url = urljoin(self.base_url, product_url)
            
            response = self.session.get(product_url, timeout=30)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            product = {}
            
            # 提取商品名称
            title_elem = soup.find(['h1', 'h2'], class_=re.compile(r'title|product-name', re.I))
            if title_elem:
                product['name'] = title_elem.get_text(strip=True)
            
            # 提取价格
            price_elem = soup.find(['span', 'div'], class_=re.compile(r'price|cost', re.I))
            if price_elem:
                product['price'] = price_elem.get_text(strip=True)
            
            # 提取所有商品图片（详情页通常有更多高清图片）
            images = []
            img_elements = soup.find_all('img', src=True)
            for img in img_elements:
                img_url = img.get('src') or img.get('data-src') or img.get('data-zoom-src')
                if img_url and 'product' in img_url.lower():
                    if not img_url.startswith('http'):
                        img_url = urljoin(product_url, img_url)
                    high_res = self._get_high_res_image_url(img_url)
                    if high_res not in images:
                        images.append(high_res)
            
            if images:
                product['original_image_url'] = images[0]  # 使用第一张图片作为主图
                product['all_images'] = images
            
            product['product_url'] = product_url
            
            # 延迟
            time.sleep(self.delay)
            
            return product if product.get('name') and product.get('original_image_url') else None
            
        except Exception as e:
            print(f"[Scraper] 抓取商品详情页时出错: {e}")
            return None


def scrape_lv_products(category_url: str, max_pages: int = 1, max_products: Optional[int] = None) -> List[Dict[str, Any]]:
    """
    便捷函数：抓取LV商品
    
    Args:
        category_url: 商品分类页面URL
        max_pages: 最大抓取页数
        max_products: 最大抓取商品数量（None表示不限制）
    
    Returns:
        商品信息列表
    """
    scraper = LVScraper()
    products = scraper.fetch_product_list(category_url, max_pages)
    
    if max_products:
        products = products[:max_products]
    
    return products

