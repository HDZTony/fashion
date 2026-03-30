# 字段使用文档

本文档梳理了系统中所有字段的来源、用途和数据流转过程。

## 目录
1. [前端字段](#前端字段)
2. [后端API模型](#后端api模型)
3. [数据流转流程](#数据流转流程)
4. [字段映射关系](#字段映射关系)

---

## 前端字段

### 用户输入字段

#### 1. `customPrompt` (自定义提示)
- **类型**: `ref<string>`
- **默认值**: `''`
- **来源**: 用户在文本输入框中输入
- **用途**: 作为 `prompt` 字段传递给 `/outfit` API，用于向AI提供额外的穿搭偏好
- **位置**: `Home.vue:46`

#### 2. `backgroundImageFile` (背景图片文件)
- **类型**: `ref<File | null>`
- **来源**: 用户通过文件选择器上传，或从历史图片中选择
- **用途**: 
  - 上传到 `/background-image` 获取 `backgroundImageUrl`
  - 作为背景参考传递给 Qwen-VL 模型
- **相关字段**: `backgroundImagePreviewUrl`, `backgroundImageUrl`
- **位置**: `Home.vue:49`

#### 3. `backgroundImageUrl` (背景图片URL)
- **类型**: `ref<string | null>`
- **来源**: 
  - 上传 `backgroundImageFile` 后从 `/background-image` API 返回
  - 从历史图片中选择后直接使用
- **用途**: 
  - 传递给 `/outfit` API (`background_image_url`)
  - 传递给 `/try-on` API (`background_image_url`)
  - 保存到 `SaveLookRequest` 中
- **位置**: `Home.vue:51`

#### 4. `modelImageFile` (模特图片文件)
- **类型**: `ref<File | null>`
- **来源**: 用户通过文件选择器上传，或从历史图片中选择
- **用途**: 上传到 `/model-image` 获取预览URL，用于试穿功能
- **相关字段**: `modelImagePreviewUrl`
- **位置**: `Home.vue:42`

#### 5. `modelImagePreviewUrl` (模特图片预览URL)
- **类型**: `ref<string | null>`
- **来源**: 
  - 上传 `modelImageFile` 后创建本地 blob URL
  - 从历史图片中选择后使用图片URL
- **用途**: 在前端显示预览，用于试穿功能
- **位置**: `Home.vue:248`

### 状态管理字段

#### 6. `uploadedItems` (已上传的衣橱单品)
- **类型**: `ref<Item[]>`
- **来源**: 从 `/items` API 获取用户的所有衣橱单品
- **结构**: 
  ```typescript
  {
    id?: string | number;
    url?: string;
    features: {
      path?: string;
      type: string | string[];
      color: string | string[];
      style?: string | string[];
      pattern?: string | string[];
      occasion?: string | string[];
      material?: string | string[];
    };
  }
  ```
- **用途**: 用于显示用户的衣橱，以及匹配穿搭方案中的 `wardrobe_id`
- **位置**: `Home.vue:36`

#### 7. `agentOutfits` (AI生成的穿搭方案)
- **类型**: `ref<AgentOutfit[]>`
- **来源**: 从 `/outfit` API 返回的 `outfits` 字段
- **结构**: 
  ```typescript
  {
    title: string;           // 方案标题
    items: AgentOutfitItem[]; // 单品列表
    reason: string;          // 简短说明
    long_text: string;       // 完整描述
  }
  ```
- **用途**: 在前端显示AI生成的穿搭方案卡片
- **位置**: `Home.vue:40`

#### 8. `activeWardrobeIds` (当前激活的衣橱单品ID列表)
- **类型**: `ref<string[]>`
- **来源**: 用户点击 "Apply outfit" 按钮时，从选中的 `AgentOutfit` 中提取 `wardrobe_id`
- **用途**: 
  - 用于计算 `activeWardrobeItems` (当前要试穿的搭配)
  - 传递给试穿功能
- **位置**: `Home.vue:41`

#### 9. `activeWardrobeItems` (当前激活的衣橱单品)
- **类型**: `computed<Item[]>`
- **来源**: 根据 `activeWardrobeIds` 从 `uploadedItems` 中查找对应的单品
- **用途**: 
  - 显示 "Applied outfit items" 缩略图
  - 传递给 `/try-on` API 作为 `garment_urls`
- **位置**: `Home.vue:242-246`

#### 10. `tryOnImageUrl` (试穿结果图片URL)
- **类型**: `ref<string | null>`
- **来源**: 从 `/try-on` API 返回的 `url` 字段
- **用途**: 在前端显示试穿效果图
- **位置**: `Home.vue:43`

#### 11. `isGenerating` (是否正在生成)
- **类型**: `ref<boolean>`
- **用途**: 控制加载状态显示
- **位置**: `Home.vue:44`

---

## 后端API模型

### 请求模型

#### 1. `OutfitAgentRequest` (生成穿搭请求)
- **位置**: `main.py:33-38`
- **字段**:
  ```python
  {
    "location": Optional[str] = None,  # 地点（可选，会从提示词或IP提取）
    "prompt": str,                      # 用户自定义提示（必需）
    "base_item_ids": Optional[List[str]] = None,  # 预选单品ID列表（可选）
    "background_image_url": Optional[str] = None,      # 背景图片URL（可选）
  }
  ```
- **来源**: 前端 `getRecommendations()` 函数构建
- **用途**: 传递给 `generate_outfit_suggestions()` 函数
- **注意**: 
  - `location` 字段可选，如果未提供，系统会从 `prompt` 中提取地点
  - 如果提示词中也没有地点，系统会通过客户端IP自动获取天气信息
  - `occasion` 字段已移除，穿搭场合由模型根据用户提示词和背景图片自动判断

#### 2. `SaveLookRequest` (保存穿搭方案请求)
- **位置**: `main.py:67-72`
- **字段**:
  ```python
  {
    "title": str,                      # 方案标题（必需）
    "items": List[SaveLookItem],       # 单品列表（必需）
    "location": Optional[str] = None,  # 地点（可选）
    "prompt": str,                     # 完整描述（必需）
    "background_image_url": Optional[str] = None,  # 背景图片URL（可选）
  }
  ```
- **来源**: 前端 `applyOutfit()` 函数构建
- **用途**: 保存到 `looks.json` 文件
- **注意**: `occasion` 字段已移除

#### 3. `SaveLookItem` (保存的单品项)
- **位置**: `main.py:61-64`
- **字段**:
  ```python
  {
    "wardrobe_id": str | None = None,  # 衣橱单品ID（可为空）
    "role": str,                        # 角色：top/bottom/shoes/outer/accessory
    "description": str,                 # 单品描述
  }
  ```

### 响应模型

#### 4. `OutfitAgentResponse` (生成穿搭响应)
- **位置**: `main.py:54-58`
- **字段**:
  ```python
  {
    "weather_summary": str,            # 天气摘要
    "wardrobe_count": int,             # 衣橱单品数量
    "outfits": List[OutfitPlan],       # 穿搭方案列表
    "raw_text": str,                   # 原始响应文本
  }
  ```

#### 5. `OutfitPlan` (穿搭方案)
- **位置**: `main.py:47-51`
- **字段**:
  ```python
  {
    "title": str,                      # 方案标题
    "items": List[OutfitItem],         # 单品列表
    "reason": str,                     # 简短说明
    "long_text": str,                  # 完整描述
  }
  ```

#### 6. `OutfitItem` (穿搭单品)
- **位置**: `main.py:41-44`
- **字段**:
  ```python
  {
    "wardrobe_id": Optional[str] = None,  # 衣橱单品ID
    "role": str,                          # 角色
    "description": str,                  # 描述
  }
  ```

---

## 数据流转流程

### 流程1: 生成穿搭方案

```
用户输入
  ├─ customPrompt (文本输入，可包含地点信息)
  └─ backgroundImageFile (文件上传)
      └─ 上传到 /background-image → backgroundImageUrl

前端构建请求 (getRecommendations)
  ├─ customPrompt → OutfitAgentRequest.prompt
  ├─ backgroundImageUrl → OutfitAgentRequest.background_image_url
  └─ selectedBaseItems → OutfitAgentRequest.base_item_ids

后端处理 (generate_outfit_suggestions)
  ├─ 确定地点 (determine_location)
  │   ├─ 如果提供了 location，直接使用
  │   ├─ 否则从 prompt 中提取地点 (extract_location_from_prompt)
  │   └─ 如果仍未找到，通过客户端IP获取天气 (fetch_weather_by_ip)
  ├─ 获取天气信息 (fetch_weather 或 fetch_weather_by_ip)
  ├─ 获取衣橱单品 (get_user_items)
  ├─ 构建提示词 (system_prompt + user_prompt)
  │   └─ 提示模型根据用户提示词和背景图片判断穿搭场合
  ├─ 调用 Qwen-VL 模型 (llm.ainvoke)
  │   └─ 如果 background_image_url 存在，作为多模态输入
  ├─ 解析 JSON 响应
  └─ 向量检索增强 (匹配 wardrobe_id)

后端返回 (OutfitAgentResponse)
  └─ outfits: List[OutfitPlan]

前端接收
  └─ agentOutfits.value = response.data.outfits
```

### 流程2: 应用穿搭方案并保存

```
用户点击 "Apply outfit"
  └─ 传入 AgentOutfit 对象

前端处理 (applyOutfit)
  ├─ 提取 wardrobe_id → activeWardrobeIds
  └─ 构建 SaveLookRequest
      ├─ title → outfit.title
      ├─ items → outfit.items (映射为 SaveLookItem)
      ├─ location → null (可选，不再硬编码)
      ├─ prompt → outfit.long_text || outfit.reason
      └─ background_image_url → backgroundImageUrl.value

后端保存 (save_look)
  └─ 保存到 looks.json
```

### 流程3: 试穿功能

```
用户点击 "Try on"
  ├─ 检查 modelImageFile 或 modelImagePreviewUrl
  └─ 检查 activeWardrobeItems

前端构建请求 (performTryOn)
  ├─ person_image → modelImageFile (FormData)
  ├─ garment_urls → activeWardrobeItems 的 URL 列表 (JSON字符串)
  └─ background_image_url → backgroundImageUrl.value (可选)

后端处理 (try_on)
  ├─ 保存 person_image 到本地
  ├─ 解析 garment_urls
  ├─ 创建衣服拼图 (garment_collage)
  ├─ 上传拼图到 R2 (设置7天过期)
  ├─ 调用 Qwen-Image-Edit API
  │   ├─ 所有图片上传到 R2 获取 URL
  │   └─ 传递 URL 而非 base64
  └─ 返回试穿结果 URL

前端显示
  └─ tryOnImageUrl.value = response.data.url
```

---

## 字段映射关系

### 前端 AgentOutfit → 后端 SaveLookRequest

| 前端字段 | 后端字段 | 转换逻辑 |
|---------|---------|---------|
| `outfit.title` | `title` | 直接映射 |
| `outfit.items[].wardrobe_id` | `items[].wardrobe_id` | 直接映射，可为 null |
| `outfit.items[].role` | `items[].role` | 直接映射 |
| `outfit.items[].description` | `items[].description` | 直接映射 |
| `null` (固定值) | `location` | 可选字段 |
| `outfit.long_text \|\| outfit.reason` | `prompt` | 优先使用 long_text |
| `backgroundImageUrl.value` | `background_image_url` | 直接映射，可为 null |

### 前端请求 → 后端 OutfitAgentRequest

| 前端字段 | 后端字段 | 转换逻辑 |
|---------|---------|---------|
| `customPrompt.value` | `prompt` | 直接映射 |
| `backgroundImageUrl.value` | `background_image_url` | 直接映射，可为 undefined |
| `selectedBaseItems[].id` | `base_item_ids` | 提取 ID 列表，可为 undefined |
| `undefined` | `location` | 可选，后端会从 prompt 或 IP 提取 |

### 后端 OutfitPlan → 前端 AgentOutfit

| 后端字段 | 前端字段 | 说明 |
|---------|---------|------|
| `title` | `title` | 直接映射 |
| `items` | `items` | 结构相同，直接映射 |
| `reason` | `reason` | 直接映射 |
| `long_text` | `long_text` | 直接映射 |

---

## 关键字段说明

### wardrobe_id
- **含义**: 衣橱中单品的唯一标识符
- **来源**: 
  - Qwen-VL 模型生成时可能包含（基于衣橱清单匹配）
  - 如果为空，后端会通过向量检索尝试匹配
- **用途**: 
  - 在前端匹配 `uploadedItems` 显示实际单品
  - 用于试穿功能获取单品图片URL
  - 保存到历史记录中

### role
- **含义**: 单品在穿搭中的角色
- **可能值**: `top`, `bottom`, `shoes`, `outer`, `accessory`
- **来源**: Qwen-VL 模型生成
- **用途**: 用于分类显示和逻辑处理

### background_image_url
- **含义**: 背景参考图片的R2 URL
- **来源**: 
  - 用户上传背景图片后从 `/background-image` API 返回
  - 从历史图片中选择
- **用途**: 
  - 作为多模态输入传递给 Qwen-VL 模型
  - 传递给 Qwen-Image-Edit 模型（试穿时）
  - 保存到历史记录中

### location
- **含义**: 用户所在位置
- **当前实现**: 
  - 可选字段，不再硬编码
  - 优先级：1) 请求中提供的 location 2) 从用户提示词中提取 3) 通过客户端IP自动获取
- **用途**: 
  - 用于获取天气信息
  - 保存到历史记录中（可选）
- **提取逻辑**: 
  - 使用正则表达式从用户提示词中提取常见城市名称
  - 如果未找到，使用 WeatherAPI 的 IP 自动检测功能

---

## API端点总结

### POST `/outfit`
- **请求**: `OutfitAgentRequest`
- **响应**: `OutfitAgentResponse`
- **用途**: 生成穿搭方案

### POST `/looks`
- **请求**: `SaveLookRequest`
- **响应**: 保存的look对象（包含 `id`, `user_id`, `created_at`）
- **用途**: 保存穿搭方案到历史

### POST `/try-on`
- **请求**: FormData
  - `person_image`: File
  - `garment_urls`: JSON字符串
  - `background_image_url`: 可选字符串
- **响应**: `{ url: string }`
- **用途**: 生成试穿效果图

### POST `/background-image`
- **请求**: FormData (`file`)
- **响应**: `{ url: string }`
- **用途**: 上传背景图片到R2并保存到历史

### POST `/model-image`
- **请求**: FormData (`file`)
- **响应**: `{ url: string }`
- **用途**: 上传模特图片到R2并保存到历史

### GET `/user-images`
- **请求**: Query参数 `image_type` (`background` 或 `model`)
- **响应**: `List[HistoricalImage]`
- **用途**: 获取用户的历史图片

---

## 注意事项

1. **字段命名不一致**: 
   - 前端使用 `AgentOutfit`，后端使用 `OutfitPlan`
   - 结构相同，但类型定义分离

2. **location 字段**: 
   - 已改为可选字段
   - 自动从用户提示词中提取，或通过IP获取
   - 不再硬编码为 `'Beijing'`

3. **occasion 字段**: 
   - 已完全移除
   - 穿搭场合由模型根据用户提示词和背景图片自动判断

4. **prompt 字段映射**: 
   - `OutfitAgentRequest.prompt` 来自 `customPrompt.value` (用户输入)
   - `SaveLookRequest.prompt` 来自 `outfit.long_text || outfit.reason` (AI生成)

4. **图片URL处理**: 
   - 所有图片都上传到 Cloudflare R2
   - 背景图片和模特图片保存到历史记录
   - 衣服拼图（garment_collage）设置7天自动过期

5. **wardrobe_id 匹配**: 
   - 如果模型生成的 `wardrobe_id` 为空或无效
   - 后端会通过向量检索尝试匹配
   - 使用 `description` 字段作为查询文本

