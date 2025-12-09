# LV商品索引系统使用说明

## 功能概述

本系统实现了LV商品数据的抓取、缩略图生成、存储和前端展示功能，严格遵守"合理使用"原则，只显示低分辨率缩略图并链接到原始LV官网。

## 系统架构

### 1. 数据抓取模块 (`services/lv_scraper.py`)

- 从LV官网抓取商品信息（名称、价格、图片URL）
- 支持商品列表页和详情页抓取
- 自动解析HTML、JSON-LD结构化数据和data属性
- 请求延迟控制，避免过于频繁的请求

**注意**: 由于LV网站结构可能变化，需要根据实际情况调整HTML选择器。

### 2. 缩略图生成服务 (`services/thumbnail_service.py`)

- 下载原始高清图片
- 生成低分辨率缩略图（默认300x300像素）
- 降低JPEG质量（默认quality=40）
- 添加半透明水印
- 上传到R2云存储

### 3. 数据库存储 (`services/lv_products_db.py`)

- 使用Supabase（PostgreSQL）数据库存储商品信息
- 存储字段：
  - `product_id`: 商品唯一ID（TEXT PRIMARY KEY）
  - `product_name`: 商品名称（TEXT NOT NULL）
  - `price`: 商品价格（TEXT）
  - `original_lv_url`: LV官网原始链接（TEXT NOT NULL）
  - `thumbnail_url`: 生成的缩略图URL（TEXT）
  - `original_image_url`: 原始高清图片URL（TEXT NOT NULL）
  - `created_at`: 创建时间（TIMESTAMPTZ，自动设置）
  - `updated_at`: 更新时间（TIMESTAMPTZ，自动更新）
  - `metadata`: JSON格式的额外信息（JSONB）

### 4. API端点 (`main.py`)

#### 抓取商品
```
POST /lv-products/scrape
{
  "category_url": "https://www.louisvuitton.com/...",
  "max_pages": 1,
  "max_products": null,
  "generate_thumbnails": true,
  "watermark_text": "fashion-rec.dongzhouhe.com"
}
```

#### 列出商品
```
GET /lv-products?limit=20&offset=0&order_by=created_at&order_direction=DESC
```

#### 搜索商品
```
GET /lv-products/search?keyword=handbag&limit=20&offset=0
```

#### 获取单个商品
```
GET /lv-products/{product_id}
```

#### 生成缩略图
```
POST /lv-products/{product_id}/generate-thumbnail
{
  "watermark_text": "fashion-rec.dongzhouhe.com"
}
```

#### 删除商品
```
DELETE /lv-products/{product_id}
```

### 5. 前端展示 (`frontend/src/views/LVProducts.vue`)

- 商品列表网格展示
- 搜索功能
- 分页功能
- 抓取商品界面
- 点击商品跳转到LV官网

访问路径: `/lv-products`

## 安装和配置

### 1. 安装依赖

```bash
cd backend
uv sync
```

新增的依赖包：
- `requests`: HTTP请求
- `beautifulsoup4`: HTML解析

### 2. 环境变量

确保 `.env` 文件中已配置：
- `SUPABASE_URL`: Supabase项目URL
- `SUPABASE_KEY`: Supabase服务密钥（anon key）
- `R2_ENDPOINT_URL`: R2存储端点
- `R2_ACCESS_KEY_ID`: R2访问密钥ID
- `R2_SECRET_ACCESS_KEY`: R2访问密钥
- `R2_BUCKET_NAME`: R2存储桶名称
- `R2_PUBLIC_URL`: R2公共URL

### 3. 数据库初始化

#### 在Supabase中创建表

1. 登录Supabase Dashboard: https://app.supabase.com
2. 选择您的项目
3. 进入 **SQL Editor**
4. 执行 `supabase_migration.sql` 文件中的SQL语句

或者直接在SQL Editor中运行：

```sql
-- 创建lv_products表
CREATE TABLE IF NOT EXISTS lv_products (
    product_id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    price TEXT,
    original_lv_url TEXT NOT NULL,
    thumbnail_url TEXT,
    original_image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_lv_products_name ON lv_products(product_name);
CREATE INDEX IF NOT EXISTS idx_lv_products_created_at ON lv_products(created_at DESC);
```

**注意**: 表结构会在首次运行时自动检查，但需要在Supabase Dashboard中手动创建表。

## 使用步骤

### 步骤1: 抓取商品数据

1. 打开前端页面 `/lv-products`
2. 点击"抓取商品"按钮
3. 输入LV商品分类页面URL（例如：`https://www.louisvuitton.com/zhs-cn/catalog/women/handbags`）
4. 设置抓取参数：
   - 最大抓取页数
   - 最大商品数量（可选）
   - 是否自动生成缩略图
   - 水印文字
5. 点击"开始抓取"

**注意**: 由于LV网站的反爬虫机制和HTML结构变化，可能需要根据实际情况调整选择器。建议先测试单个商品页面。

### 步骤2: 查看商品列表

抓取完成后，商品会自动显示在列表中。每个商品显示：
- 缩略图（如果有）
- 商品名称
- 价格
- 创建时间
- "查看详情"按钮（跳转到LV官网）

### 步骤3: 搜索商品

在搜索框输入关键词，可以搜索商品名称。

### 步骤4: 生成缩略图

如果某个商品没有缩略图，可以：
1. 将鼠标悬停在商品卡片上
2. 点击"生成缩略图"按钮
3. 系统会自动下载原图、生成缩略图、添加水印并上传到R2

## 合规性说明

本系统严格遵循"合理使用"原则：

1. **低分辨率缩略图**: 所有图片都被压缩到300x300像素，质量降低到40%
2. **水印标识**: 所有缩略图都添加了半透明水印，表明这是处理过的索引图
3. **原始链接**: 前端只显示缩略图，点击后直接跳转到LV官网原始链接
4. **不存储原图**: 系统只存储缩略图，不存储原始高清图片
5. **延迟控制**: 抓取时有请求延迟，避免对目标网站造成压力

## 技术细节

### 缩略图处理流程

1. 从LV官网下载原始高清图片
2. 使用PIL/Pillow调整图片尺寸到300x300像素（保持宽高比）
3. 如果图片比例不同，会在边缘填充白色背景
4. 添加半透明水印（右下角）
5. 以JPEG格式保存，质量设置为40%
6. 上传到R2云存储

### 数据库结构

Supabase（PostgreSQL）表结构：

```sql
CREATE TABLE lv_products (
    product_id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    price TEXT,
    original_lv_url TEXT NOT NULL,
    thumbnail_url TEXT,
    original_image_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 索引
CREATE INDEX idx_lv_products_name ON lv_products(product_name);
CREATE INDEX idx_lv_products_created_at ON lv_products(created_at DESC);
```

**迁移脚本**: 完整的SQL迁移脚本位于 `supabase_migration.sql`，包含表创建、索引和触发器。

## 故障排除

### 1. 抓取失败

- 检查网络连接
- 检查URL是否正确
- 查看控制台错误信息
- 可能需要根据实际网站结构调整选择器

### 2. 缩略图生成失败

- 检查原始图片URL是否可访问
- 检查R2存储配置是否正确
- 查看服务器日志

### 3. 前端页面无法访问

- 检查后端服务是否运行
- 检查API URL配置（`frontend/src/views/LVProducts.vue`中的`API_URL`）
- 检查认证token是否有效

## 注意事项

1. **网站结构变化**: LV网站可能会更新HTML结构，需要相应调整选择器
2. **反爬虫机制**: LV网站可能有反爬虫机制，建议：
   - 增加请求延迟
   - 使用代理（如需要）
   - 遵守robots.txt规则
3. **法律风险**: 请确保使用符合当地法律法规和LV的服务条款
4. **数据更新**: 商品信息和价格可能会变化，建议定期更新

## 扩展建议

1. **定时任务**: 可以添加定时任务自动抓取新商品
2. **增量更新**: 实现增量更新机制，只抓取新商品
3. **多网站支持**: 可以扩展到其他品牌网站
4. **缓存机制**: 添加缓存以减少重复请求
5. **图片CDN**: 使用CDN加速图片加载

