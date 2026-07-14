# Grok 多模态规划 & LocateAnything bbox（Studio 意图裁剪）

本文说明 `services/garment_vl_pipeline.py` 中 Studio 意图裁剪的当前分工：Grok 负责多图理解与裁剪计划，LocateAnything-3B 负责主 bbox 定位，Qwen3-VL 仅作为 bbox fallback。

---

## 一、Grok：图像理解与裁剪计划

本仓库用 Grok 4.1 Fast reasoning 一次性读取用户本轮所有图片与文字，输出：

- `assignments`：哪张图供应哪个衣物部件；
- `scene_image_index`：可选背景/环境图索引，避免被当作衣物裁剪；
- 每个 assignment 的 `focus` 与 `max_crops`。

实现要点：

- 入口：`plan_multi_image_intent_crops`
- API：xAI Responses，通过 `services/xai_openai_client.py`
- 环境变量：`XAI_API_KEY`、可选 `GARMENT_ASSESS_GROK_MODEL`
- 请求是无历史的一次性 user 输入，避免多图历史导致模型服务失败。

---

## 二、bbox：LocateAnything 主路径，Qwen3-VL fallback

| 步骤 | 模型/服务 | 行为 |
|------|-----------|------|
| 多图 + 用户文案 → 裁剪计划 | **Grok 4.1 Fast** | 一次请求读取本轮全部上传图 |
| 按图出 bbox → 裁剪上传 R2 | **LocateAnything-3B** | 调用本地 GPU 服务 `POST /v1/locate`，解析 `<box><x1><y1><x2><y2></box>` |
| bbox 失败 fallback | **Qwen3-VL** | LocateAnything 禁用、不可达、超时、返回空或坐标非法时，逐图降级 |

实现入口：

- `detect_garment_boxes_for_intent`：意图裁剪，LocateAnything → Qwen fallback
- `detect_garment_boxes`：通用衣物裁剪，LocateAnything → Qwen fallback
- `_execute_intent_assignments`：按 Grok assignment 并发/限流逐图定位
- `crop_boxes_upload`：复用 0-1000 bbox 到像素裁剪 + R2 上传逻辑

LocateAnything 服务默认来自 `doc/DEPLOY.md`：

```json
POST http://100.73.75.78:8000/v1/locate
{
  "image_url": "https://...",
  "prompt": "Locate the requested wearable garment..."
}
```

返回文本中需包含一个或多个 0-1000 归一化坐标：

```text
<box><10><20><300><400></box>
```

---

## 三、失败与回退策略

- LocateAnything 只接收 `image_url`；对非 HTTP(S)、localhost、127.0.0.1、`.local` URL 直接跳过并使用 Qwen fallback。
- LocateAnything HTTP 异常、非成功状态、空结果、无法解析 `<box>`、坐标越界或 `x0>=x1/y0>=y1`，均进入 Qwen fallback。
- Qwen fallback 仍沿用原来的 base64 data URL 能力，因此本地 ChatKit preview、私有图片、provider 无法下载的图片不会断链。
- 公开 API 不变：`POST /studio/intent-garment-crops` 仍返回 `{ crops, scene_image_index }`。

---

## 四、环境变量速查

| 变量 | 用途 |
|------|------|
| `LOCATEANYTHING_ENABLED` | 是否启用 LocateAnything 主路径，默认 `true` |
| `LOCATEANYTHING_BASE_URL` | LocateAnything 服务地址，默认 `http://100.73.75.78:8000` |
| `LOCATEANYTHING_TIMEOUT_SECONDS` | LocateAnything HTTP 超时，默认 `30` |
| `LOCATEANYTHING_MAX_CONCURRENCY` | 多 assignment bbox 并发数，默认 `3`，最大 `8` |
| `DASHSCOPE_API_KEY_SG` | Qwen3-VL fallback |
| `XAI_API_KEY` | Grok 评估与多图规划 |
| `GARMENT_ASSESS_GROK_MODEL` | 可选，默认 `grok-4-1-fast-reasoning` |
| `OUTFIT_GROK_MODEL` | 穿搭生成选 Grok 时；默认 `grok-imagine-image` |

---

## 五、相关代码入口

- `plan_multi_image_intent_crops` — Grok 多图规划
- `detect_garment_boxes_for_intent` — LocateAnything 主 bbox + Qwen fallback
- `_execute_intent_assignments` — assignment 并发调度
- `POST /studio/intent-garment-crops`（`main.py`）— 对前端暴露的意图裁剪 API
