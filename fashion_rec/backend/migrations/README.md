# 数据库迁移说明

## 迁移 003: 将 tryon_history 表的 scene_image_url 重命名为 background_image_url

### 问题描述

代码尝试保存 `background_image_url` 到 `tryon_history` 表，但数据库表中存在的是 `scene_image_url` 列，导致保存失败并出现错误：
```
Could not find the 'background_image_url' column of 'tryon_history' in the schema cache
```

### 解决方案

需要将 `tryon_history` 表中的 `scene_image_url` 列重命名为 `background_image_url` 以匹配代码中的命名。

### 执行步骤

**推荐方法：使用 Supabase Dashboard（最简单）**

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 **SQL Editor**
4. 打开 `003_add_background_image_url_to_tryon_history.sql` 文件
5. **复制全部内容**
6. 粘贴到 SQL Editor 中
7. 点击 **Run** 执行

**使用 psql（如果有直接数据库访问权限）**：

```bash
psql -h <your-db-host> -U <your-user> -d <your-database> -f 003_add_background_image_url_to_tryon_history.sql
```

### 迁移内容

1. **检查列状态**: 
   - 如果 `scene_image_url` 存在且 `background_image_url` 不存在，则重命名
   - 如果 `background_image_url` 已存在，则跳过（可能已经执行过迁移）
   - 如果两个列都不存在，则添加 `background_image_url` 列（向后兼容）
2. **更新注释**: 为列添加/更新文档注释

### 验证

迁移完成后，可以执行以下查询验证：

```sql
-- 检查列是否存在
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'tryon_history' AND column_name = 'background_image_url';

-- 应该返回一行，显示 background_image_url 列的信息
```

### 回滚（如果需要）

如果需要回滚到 `scene_image_url`，执行：

```sql
-- 如果 background_image_url 存在，重命名回 scene_image_url
ALTER TABLE tryon_history RENAME COLUMN background_image_url TO scene_image_url;
```

---

## 迁移 002: 将 looks 表的 scene_image_url 重命名为 background_image_url

### 问题描述

代码尝试保存 `background_image_url` 到 `looks` 表，但数据库表中存在的是 `scene_image_url` 列，导致保存失败并出现错误：
```
Could not find the 'background_image_url' column of 'looks' in the schema cache
```

### 解决方案

需要将 `looks` 表中的 `scene_image_url` 列重命名为 `background_image_url` 以匹配代码中的命名。

### 执行步骤

**推荐方法：使用 Supabase Dashboard（最简单）**

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 **SQL Editor**
4. 打开 `002_add_background_image_url_to_looks.sql` 文件
5. **复制全部内容**
6. 粘贴到 SQL Editor 中
7. 点击 **Run** 执行

**使用 psql（如果有直接数据库访问权限）**：

```bash
psql -h <your-db-host> -U <your-user> -d <your-database> -f 002_add_background_image_url_to_looks.sql
```

### 迁移内容

1. **检查列状态**: 
   - 如果 `scene_image_url` 存在且 `background_image_url` 不存在，则重命名
   - 如果 `background_image_url` 已存在，则跳过（可能已经执行过迁移）
   - 如果两个列都不存在，则添加 `background_image_url` 列（向后兼容）
2. **更新注释**: 为列添加/更新文档注释

### 验证

迁移完成后，可以执行以下查询验证：

```sql
-- 检查列是否存在
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'looks' AND column_name = 'background_image_url';

-- 应该返回一行，显示 background_image_url 列的信息
```

### 回滚（如果需要）

如果需要回滚到 `scene_image_url`，执行：

```sql
-- 如果 background_image_url 存在，重命名回 scene_image_url
ALTER TABLE looks RENAME COLUMN background_image_url TO scene_image_url;
```

---

## 迁移 001: 更新 user_images.image_type 约束

### user_images 表的用途

`user_images` 表用于存储用户的图片历史记录，包括：

1. **背景图片 (background)**: 用户上传的背景图片，用于虚拟试衣时作为背景环境
2. **模特图片 (model)**: 用户上传的模特/人物图片，用于虚拟试衣

**主要功能**：
- 保存用户上传的图片 URL（存储在 R2 中）
- 记录图片类型（`background` 或 `model`）
- 支持用户查看历史图片
- 支持用户删除历史图片
- 永久存储（不再有过期时间）

**API 端点**：
- `POST /background-image` - 上传背景图片
- `POST /model-image` - 上传模特图片
- `GET /user-images?image_type=background` - 获取背景图片历史
- `GET /user-images?image_type=model` - 获取模特图片历史
- `DELETE /user-images/{image_id}` - 删除历史图片

### 问题描述

代码中已将 `sence` 重命名为 `background`，但数据库约束仍然只允许 `sence` 值，导致插入失败。

### 解决方案

需要更新数据库约束，允许 `background` 和 `model` 值。

### 执行步骤

**推荐方法：使用主迁移脚本（最简单）**

1. 登录 [Supabase Dashboard](https://app.supabase.com)
2. 选择你的项目
3. 进入 **SQL Editor**
4. 打开 `001_update_image_type_constraint.sql` 文件
5. **复制全部内容**（包括所有步骤）
6. 粘贴到 SQL Editor 中
7. 点击 **Run** 执行

**脚本包含的步骤**：
1. 删除旧约束
2. 修复所有数据（将 `sence` 改为 `background`，NULL 改为 `model`，其他无效值改为 `model`）
3. 创建新约束（允许 `background` 和 `model`）
4. 验证查询（可选，用于确认迁移成功）

**如果执行失败**：
- 检查错误信息
- 可以尝试使用 `001_step_by_step_fix.sql` 逐步执行
- 或者使用 `001_diagnose_image_type.sql` 先诊断问题

**使用 psql（如果有直接数据库访问权限）**：

```bash
psql -h <your-db-host> -U <your-user> -d <your-database> -f 001_update_image_type_constraint.sql
```

### 迁移内容

**重要**: 必须按顺序执行，因为需要先删除约束才能更新数据。

**如果遇到约束错误**：说明表中可能已经有 `background` 值，但旧约束不允许。必须先删除约束。

1. **诊断数据状态**: 检查表中现有的 `image_type` 值
2. **删除旧约束**: 删除 `user_images_image_type_check` 约束（必须先执行）
3. **更新现有数据**: 将所有 `sence` 值更新为 `background`
4. **修复 NULL 值**: 将任何 NULL 值设置为 `model`（作为默认值）
5. **验证数据**: 确认所有值都是 `background` 或 `model`
6. **创建新约束**: 创建允许 `background` 和 `model` 的新约束

### 故障排除

**如果步骤 2（删除约束）失败**：
- 尝试使用 `CASCADE`：`ALTER TABLE user_images DROP CONSTRAINT user_images_image_type_check CASCADE;`
- 检查是否有其他对象依赖此约束

**如果步骤 6（创建约束）失败**：
- 说明表中仍有无效值
- 运行诊断查询：`SELECT image_type, COUNT(*) FROM user_images GROUP BY image_type;`
- 手动修复无效值后再创建约束

### 验证

迁移完成后，可以执行以下查询验证：

```sql
-- 检查约束是否存在
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'user_images_image_type_check';

-- 检查是否有遗留的 'sence' 值
SELECT COUNT(*) FROM user_images WHERE image_type = 'sence';

-- 应该返回 0
```

### 回滚（如果需要）

如果需要回滚到 `sence`，执行：

```sql
-- 更新数据回 'sence'
UPDATE user_images 
SET image_type = 'sence' 
WHERE image_type = 'background';

-- 删除约束
ALTER TABLE user_images 
DROP CONSTRAINT IF EXISTS user_images_image_type_check;

-- 恢复旧约束
ALTER TABLE user_images 
ADD CONSTRAINT user_images_image_type_check 
CHECK (image_type IN ('sence', 'model'));
```
