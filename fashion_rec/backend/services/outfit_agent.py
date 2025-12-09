import os
import json
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
import httpx
from langchain_core.messages import SystemMessage, HumanMessage

from services.vector_db import get_user_items, search_by_text
from services.recognition import llm

# Ensure .env is loaded so WEATHER_API_KEY is available
load_dotenv()

WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")
WEATHER_BASE_URL = "http://api.weatherapi.com/v1"


async def fetch_weather_by_ip(ip: Optional[str] = None) -> Dict[str, Any]:
  """
  Call WeatherAPI to get current weather by IP address.
  """
  if not WEATHER_API_KEY:
    raise RuntimeError("WEATHER_API_KEY is not set in environment")

  async with httpx.AsyncClient(timeout=10) as client:
    # 使用 WeatherAPI 的 auto:ip，让服务端自动根据外网 IP 判断位置。
    # 这样在本地开发（127.0.0.1）时也不会因为 q=127.0.0.1 报 400。
    params = {"key": WEATHER_API_KEY, "q": "auto:ip"}

    resp = await client.get(
      f"{WEATHER_BASE_URL}/current.json",
      params=params,
    )
    resp.raise_for_status()
    return resp.json()


async def fetch_weather(location: str) -> Dict[str, Any]:
  """
  Call WeatherAPI to get current weather for a location.
  """
  if not WEATHER_API_KEY:
    raise RuntimeError("WEATHER_API_KEY is not set in environment")

  async with httpx.AsyncClient(timeout=10) as client:
    resp = await client.get(
      f"{WEATHER_BASE_URL}/current.json",
      params={"key": WEATHER_API_KEY, "q": location},
    )
    resp.raise_for_status()
    return resp.json()


def summarize_weather(raw: Dict[str, Any]) -> str:
  location = raw.get("location") or {}
  current = raw.get("current") or {}
  cond = (current.get("condition") or {}).get("text", "")

  name = location.get("name") or ""
  country = location.get("country") or ""
  temp_c = current.get("temp_c")
  feelslike_c = current.get("feelslike_c")
  humidity = current.get("humidity")
  wind_kph = current.get("wind_kph")

  parts: List[str] = []
  if name or country:
    parts.append(f"地点: {name}, {country}")
  if cond:
    parts.append(f"天气: {cond}")
  if temp_c is not None:
    if feelslike_c is not None:
      parts.append(f"温度: {temp_c}°C (体感 {feelslike_c}°C)")
    else:
      parts.append(f"温度: {temp_c}°C")
  if humidity is not None:
    parts.append(f"湿度: {humidity}%")
  if wind_kph is not None:
    parts.append(f"风速: {wind_kph} km/h")

  return "；".join(parts)


def summarize_wardrobe(items: List[Dict[str, Any]]) -> str:
  """
  Convert get_user_items(user_id) result into a compact text list.
  """
  if not items:
    return "用户衣橱为空。"

  lines: List[str] = []
  for item in items[:30]:
    lines.append(
      f"- id={item.get('id')}, "
      f"{item.get('color', 'Unknown')} {item.get('type', 'Unknown')} "
      f"({item.get('style', 'Unknown')}, 材质: {item.get('material', 'Unknown')}, 场合: {item.get('occasion', 'Unknown')})"
    )
  if len(items) > 30:
    lines.append(f"... 还有 {len(items) - 30} 件未展示")

  return "\n".join(lines)


async def generate_outfit_suggestions(
  user_id: str,
  location: Optional[str],
  user_prompt: str,
  base_item_ids: Optional[List[str]] = None,
  scene_image_url: Optional[str] = None,
  client_ip: Optional[str] = None,
  selected_items_roles: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
  """
  High-level agent:
  - fetch weather (IP-based)
  - get wardrobe items
  - build prompt with rules + user prompt
  - ask Qwen for structured JSON outfits + long-form text
  """
  # Only use IP (or auto:ip) to determine weather and location
  weather_raw = await fetch_weather_by_ip(client_ip)
  # Extract location from weather response for use in prompt
  location_info = weather_raw.get("location", {})
  final_location = location_info.get("name", "未知地点")

  weather_summary = summarize_weather(weather_raw)

  wardrobe_items = get_user_items(user_id)
  wardrobe_summary = summarize_wardrobe(wardrobe_items)

  base_item_ids = base_item_ids or []
  base_items = [item for item in wardrobe_items if str(item.get("id")) in {str(b) for b in base_item_ids}]
  base_items_summary_lines: List[str] = []
  for item in base_items:
    base_items_summary_lines.append(
      f"- id={item.get('id')}, {item.get('color', 'Unknown')} {item.get('type', 'Unknown')} "
      f"({item.get('style', 'Unknown')}, 场合: {item.get('occasion', 'Unknown')})"
    )
  base_items_summary = "\n".join(base_items_summary_lines) if base_items_summary_lines else "（用户未预先选择单品）"

  # Determine which roles are already selected (from selected_items_roles)
  selected_roles: set = set()
  if selected_items_roles:
    selected_roles = set(selected_items_roles.values())
  
  # Build role exclusion note if there are selected roles
  role_exclusion_note = ""
  if selected_roles:
    role_names_map = {
      "top": "上装",
      "bottom": "下装",
      "shoes": "鞋子",
      "outer": "外套",
      "accessory": "配饰"
    }
    selected_role_names = [role_names_map.get(r, r) for r in selected_roles]
    role_exclusion_note = f"\n\n重要：用户已经选择了以下角色的单品：{', '.join(selected_role_names)}。\n- 你生成的outfit方案中的items数组应该只包含剩余角色的单品（即除了已选择角色之外的其他角色）。\n- 不要包含已选择角色的单品，因为用户已经确定了这些单品。\n- 例如，如果用户已经选择了top和bottom，你只需要生成shoes、outer、accessory等剩余角色的单品。"

  system_prompt = f"""
你是一名专业穿搭顾问，请结合"当天实际天气"和"用户衣橱里的单品"，为用户生成穿搭建议。

要求：
- 你必须优先使用用户衣橱里的单品（通过颜色、类型、风格来匹配）。
- 如果用户预先选择了部分单品（在"用户预选单品"中列出），请优先把这些单品纳入穿搭方案中，视为已经确定要穿的基底，其余部位由你补全。
- 根据温度、天气状况（晴/雨/雪/风大）、湿度等决定是否需要外套、鞋子类型等。
- 你需要同时提供：
  1）结构化 JSON，用于前端渲染卡片；
  2）长文本 natural language 描述，方便用户阅读和手动修改。
{role_exclusion_note}

JSON 输出格式严格如下（只包含 JSON，不要解释）：
[
  {{
    "title": "方案标题",
    "items": [
      {{
        "wardrobe_id": "使用衣橱列表中 id=xxx 里的 xxx 作为该字段；如果不确定则为 null",
        "role": "top/bottom/shoes/outer/accessory 之一",
        "description": "对该单品的简短文字描述，例如：White crew neck t-shirt（白色圆领T恤）"
      }}
    ],
    "reason": "简短说明这套穿搭为什么适合今天的天气和场景",
    "long_text": "完整的自然语言描述，可以分段，适合直接展示给用户阅读"
  }}
]

只输出 JSON 数组，不要添加 ```json 这样的 Markdown 包裹，也不要在 JSON 外输出任何其他文字。
"""

  user_prompt_text = f"""
今天的天气信息：
{weather_summary}

用户衣橱清单（每一行是一件可用单品，注意 id 字段，可用于填入 wardrobe_id）：
{wardrobe_summary}

用户预选单品（如果有，表示用户希望一定或优先穿这些单品，其余部位由你补全）：
{base_items_summary}

用户额外偏好 / 规则提示（来自前端输入，可以为空）：
{user_prompt or "（用户未提供额外偏好）"}

任务：
- 根据用户的提示词和场景图片（如果有）判断穿搭场合，设计 1-3 套完整穿搭。
- 尽量使用"用户预选单品"（如果存在），并补全其他必要单品（裤子、外套、鞋子、配饰等）。
- 每一套说明使用了哪些衣橱里的单品，以及为什么适合当前天气和场景。
- 严格按照上面给出的 JSON 结构输出结果。
"""

  # Build message content: if scene_image_url exists, include it as image input
  if scene_image_url:
    user_prompt_text_with_scene = f"""{user_prompt_text}

用户上传了场景图片（例如办公室、咖啡馆、户外等），请仔细观察图片中的环境，根据实际场景来设计合适的穿搭方案。
"""
    # For qwen-vl, content can be a list with text and image URL
    # Format: [{"type": "text", "text": "..."}, {"type": "image_url", "image_url": {"url": "..."}}]
    user_message_content = [
      {"type": "text", "text": user_prompt_text_with_scene},
      {"type": "image_url", "image_url": {"url": scene_image_url}},
    ]
  else:
    user_message_content = user_prompt_text

  print("\n" + "="*80)
  print("=== Qwen-VL Model Request (Generate Outfit) ===")
  print("="*80)
  print("\n[System Prompt]:")
  print(system_prompt)
  print("\n[User Prompt]:")
  if scene_image_url:
    print(f"[Text]: {user_prompt_text_with_scene}")
    print(f"[Image URL]: {scene_image_url}")
  else:
    print(user_prompt_text)
  print("\n" + "="*80 + "\n")

  response = await llm.ainvoke(
    [
      SystemMessage(content=system_prompt),
      HumanMessage(content=user_message_content),
    ]
  )

  content = response.content.strip()

  # 防御性处理：如果模型误加了 ```json 包裹，先去掉
  if content.startswith("```json"):
    content = content[7:]
  if content.startswith("```"):
    content = content[3:]
  if content.endswith("```"):
    content = content[:-3]

  try:
    outfits = json.loads(content)
  except Exception as e:
    raise RuntimeError(f"解析 Qwen 穿搭 JSON 失败: {e}\n原始内容: {content[:500]}") from e

  # 向量检索增强 / fallback：
  # 1）如果 wardrobe_id 为空但有描述，用描述做 query，通过向量检索在用户衣橱中找最近的单品并填入 wardrobe_id。
  # 2）如果 wardrobe_id 不在当前用户衣橱中，也尝试用描述重新匹配。
  wardrobe_id_set = {str(item.get("id")) for item in wardrobe_items}

  for outfit in outfits:
    items_list = outfit.get("items") or []
    for item in items_list:
      desc = item.get("description") or ""
      wid = item.get("wardrobe_id")

      needs_mapping = False
      if not wid:
        needs_mapping = True
      elif str(wid) not in wardrobe_id_set:
        needs_mapping = True

      if not needs_mapping or not desc:
        continue

      try:
        results = search_by_text(desc, k=1, user_id=user_id)
        if results:
          best = results[0]
          item["wardrobe_id"] = best["id"]
      except Exception as e:
        print(f"Vector fallback failed for '{desc}': {e}")
        continue

  return {
    "weather_summary": weather_summary,
    "wardrobe_count": len(wardrobe_items),
    "outfits": outfits,
    "raw_text": content,
  }


