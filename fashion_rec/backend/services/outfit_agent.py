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
  """
  Build a concise, English weather summary to keep the model outputs English-first.
  """
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
    parts.append(f"Location: {name}, {country}".strip().rstrip(","))
  if cond:
    parts.append(f"Condition: {cond}")
  if temp_c is not None:
    if feelslike_c is not None:
      parts.append(f"Temperature: {temp_c}°C (feels like {feelslike_c}°C)")
    else:
      parts.append(f"Temperature: {temp_c}°C")
  if humidity is not None:
    parts.append(f"Humidity: {humidity}%")
  if wind_kph is not None:
    parts.append(f"Wind: {wind_kph} km/h")

  return " | ".join(parts)


def summarize_wardrobe(items: List[Dict[str, Any]]) -> str:
  """
  Convert get_user_items(user_id) result into a compact text list.
  """
  if not items:
    return "Wardrobe is empty."

  lines: List[str] = []
  for item in items[:30]:
    lines.append(
      f"- id={item.get('id')}, "
      f"{item.get('color', 'Unknown')} {item.get('type', 'Unknown')} "
      f"({item.get('style', 'Unknown')}, material: {item.get('material', 'Unknown')}, occasion: {item.get('occasion', 'Unknown')})"
    )
  if len(items) > 30:
    lines.append(f"... {len(items) - 30} more not shown")

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
  final_location = location_info.get("name", "Unknown location")

  weather_summary = summarize_weather(weather_raw)

  wardrobe_items = get_user_items(user_id)
  wardrobe_summary = summarize_wardrobe(wardrobe_items)

  base_item_ids = base_item_ids or []
  base_items = [item for item in wardrobe_items if str(item.get("id")) in {str(b) for b in base_item_ids}]
  base_items_summary_lines: List[str] = []
  for item in base_items:
    base_items_summary_lines.append(
      f"- id={item.get('id')}, {item.get('color', 'Unknown')} {item.get('type', 'Unknown')} "
      f"({item.get('style', 'Unknown')}, occasion: {item.get('occasion', 'Unknown')})"
    )
  base_items_summary = "\n".join(base_items_summary_lines) if base_items_summary_lines else "(No pre-selected items)"

  # Determine which roles are already selected (from selected_items_roles)
  selected_roles: set = set()
  if selected_items_roles:
    selected_roles = set(selected_items_roles.values())
  
  # Build role exclusion note if there are selected roles
  role_exclusion_note = ""
  if selected_roles:
    role_names_map = {
      "top": "top",
      "bottom": "bottom",
      "shoes": "shoes",
      "outer": "outer",
      "accessory": "accessory"
    }
    selected_role_names = [role_names_map.get(r, r) for r in selected_roles]
    role_exclusion_note = (
      "\n\nImportant: The user already selected items for these roles: "
      f"{', '.join(selected_role_names)}.\n"
      "- In your outfit JSON, only include items for the remaining roles.\n"
      "- Do NOT include items for roles already selected by the user.\n"
      "- Example: if the user chose top and bottom, only propose shoes/outer/accessory, etc."
    )

  system_prompt = f"""
You are a professional outfit stylist. Combine today's real weather with the user's wardrobe to generate outfit suggestions. All outputs must be in English.

Requirements:
- Prioritize using items from the user's wardrobe (match by color, type, and style).
- If the user pre-selected items (listed in "User pre-selected items"), treat them as fixed bases and fill the remaining roles.
- Factor weather (sun/rain/snow/wind), temperature, humidity to decide layers, shoes, and outerwear.
- Return:
  1) Structured JSON for frontend cards.
  2) A long-form natural language description for readability and manual tweaks.
{role_exclusion_note}

JSON output format (output JSON only, no extra text or Markdown fences):
[
  {{
    "title": "Outfit title in English",
    "items": [
      {{
        "wardrobe_id": "id from wardrobe list; null if not sure",
        "role": "one of top/bottom/shoes/outer/accessory",
        "description": "Short English description, e.g., White crew neck t-shirt"
      }}
    ],
    "reason": "Brief English rationale for why this fits today's weather/scene",
    "long_text": "Full English description; can include multiple paragraphs"
  }}
]

Only output the JSON array above. Do not add ```json fences or any text outside the JSON.
"""

  user_prompt_text = f"""
Today's weather:
{weather_summary}

User wardrobe list (each line is an item; use id for wardrobe_id):
{wardrobe_summary}

User pre-selected items (treated as fixed bases):
{base_items_summary}

User extra preferences / rules (can be empty):
{user_prompt or "(User did not provide extra preferences)"}

Task:
- Infer the occasion from user hints and scene image (if any), design 1-3 complete outfits.
- Reuse "User pre-selected items" when present, and complete remaining roles (pants, outerwear, shoes, accessories, etc.).
- For each outfit, explain which wardrobe items you used and why they fit the weather/scene.
- Strictly follow the JSON structure above.
"""

  # Build message content: if scene_image_url exists, include it as image input
  if scene_image_url:
    user_prompt_text_with_scene = f"""{user_prompt_text}

The user uploaded a scene image (e.g., office, cafe, outdoor). Carefully observe the environment and tailor outfits to that scene.
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


