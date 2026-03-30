# Grok 多模态图像输入 & Qwen-VL 多图 batch（Studio 意图裁剪）

本文说明 **xAI Grok** 与 **DashScope Qwen-VL** 在本项目 `services/garment_vl_pipeline.py` 中的分工与限制。

---

## 一、Grok：图像理解（官方能力摘要）

以下内容整理自 xAI 文档 *Image Understanding / Model Capabilities*，便于与实现对齐。

### 1. 消息体（与纯文本的差异）

- 纯文本：`content` 为字符串。
- 带图：`content` 为 **对象数组**，可混合图像与文本；**图文顺序任意**（可先文后图或先图后文）。

OpenAI 兼容 / Responses API 形态示例（概念上）：

```json
{
  "role": "user",
  "content": [
    { "type": "input_image", "image_url": "data:image/jpeg;base64,...", "detail": "high" },
    { "type": "input_text", "text": "What is in this image?" }
  ]
}
```

`image_url` 可为公网 URL，或 `data:image/...;base64,...`。

### 2. 图像输入通用限制

| 项 | 说明 |
|----|------|
| 单张大小 | 最大约 **20MiB** |
| 张数 | 文档写明 **No limit**（无硬性张数上限） |
| 格式 | **jpg/jpeg** 或 **png** |

### 3. 服务端历史（重要）

> When sending images, it is advised to **not store request/response history** on the server. Otherwise the request may fail.

**本仓库做法**：Grok 规划裁剪（`plan_multi_image_intent_crops`）每次只发 **一条** user 轮（Responses `input`：多段 `input_text` / `input_image` + 规划提示），**不挂多轮会话状态**，符合上述建议。

---

## 二、本仓库实现映射

| 步骤 | 模型 | 行为 |
|------|------|------|
| 多图 + 用户文案 → 裁剪计划 `assignments` | **Grok 4.1 Fast**（`GARMENT_ASSESS_GROK_MODEL`） | 一次请求可带 **全部** 上传图（张数受 Grok/带宽/超时约束，非 Qwen 的 3 张 cap） |
| 按图出 bbox → 裁剪上传 R2 | **Qwen3-VL**（新加坡兼容端点） | **单次 HTTP 调用最多 3 张图**，见下节 |

实现细节：

- **Grok**：原生 OpenAI Python SDK，`AsyncOpenAI(..., base_url=https://api.x.ai/v1).responses.create`；与 ChatKit 编排共用 `services/xai_openai_client`（代理/超时等环境变量与 `chatkit_orchestration` 一致）。需 `XAI_API_KEY`。
- **Qwen-VL**：同一 SDK 的 **`chat.completions.create`**，指向 DashScope 新加坡 **compatible-mode**（`/v1/chat/completions`），非 OpenAI Responses。见 `services/dashscope_openai_client.py`。
- 无法访问公网的图（如 ChatKit localhost preview）在发 VL 前会转为 **base64 data URL**（与官方示例一致）。

---

## 三、Qwen-VL：多图 batch 与「每批最多 3 张」

DashScope Qwen-VL 多模态请求对单次消息中的 **图像数量有产品侧上限**（本仓库按 **3** 控制）。

- 常量：`garment_vl_pipeline.QWEN_VL_MAX_IMAGES_PER_CALL = 3`
- **`_qwen_batch_bbox_chunk`**：在 **同一次** Qwen `chat.completions` 请求里发送 **1～3 张**图 + 统一 JSON 输出 `per_image[]`（每张图对应一组 `items` bbox）。
- **`_execute_intent_assignments_qwen`**：按 Grok 返回的 `assignments` 顺序 **贪心打包**：
  - 每批最多 **3** 条 assignment，且批内 **`image_index` 不重复**（同一张图多条 assignment 会拆到后续批或走单图调用）；
  - 每批优先走 **batch**；解析失败或与 `image_index` 对不齐时，对该批 **降级** 为逐条 **`_run_single_assignment_crop`**（每图一次 Qwen，仍为单图请求）。

单图上传的 Studio 意图裁剪仍使用 **单图** Qwen 调用，不涉及 batch。

---

## 四、环境变量速查

| 变量 | 用途 |
|------|------|
| `XAI_API_KEY` | Grok 评估与多图规划 |
| `GARMENT_ASSESS_GROK_MODEL` | 可选，默认 `grok-4-1-fast-reasoning` |
| `OUTFIT_GROK_MODEL` | 穿搭生成选 Grok 时；默认 `grok-imagine-image` |
| `DASHSCOPE_API_KEY_SG` | Qwen-VL（新加坡） |

---

## 五、相关代码入口

- `plan_multi_image_intent_crops` — Grok 多图规划  
- `_qwen_batch_bbox_chunk` — Qwen 多图（≤3）batch bbox  
- `_execute_intent_assignments_qwen` — 按 3 张一批调度 Qwen  
- `POST /studio/intent-garment-crops`（`main.py`）— 对前端暴露的意图裁剪 API  
