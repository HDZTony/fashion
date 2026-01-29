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
    background_image_url: Optional[str] = None,
    background_action_prompt: Optional[str] = None,
    model_image_url: Optional[str] = None,
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

    # Get wardrobe items for validation (not for prompt)
    wardrobe_items = get_user_items(user_id)

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

    # Build background image instruction if provided
    background_instruction = ""
    if background_image_url:
        background_instruction = (
            "\n- IMPORTANT: A background image is provided with this request. "
            "Carefully analyze the environment/scene in the image (e.g., office, cafe, outdoor park, formal event, casual setting). "
            "Tailor the outfit suggestions to match the occasion and style appropriate for that background. "
            "The background image should strongly influence your outfit recommendations."
        )

    # Build model image instruction if provided (analyze person only, do NOT reference clothes in the photo)
    model_instruction = ""
    if model_image_url:
        model_instruction = (
            "\n- IMPORTANT: A model/person image is provided with this request. "
            "Analyze ONLY the person's body and appearance, NOT the clothing they are wearing in the photo. "
            "Focus on: gender/presentation, body proportions, figure/silhouette (body shape), skin tone/undertone if visible, hair color. "
            "Do NOT use the clothes in the model photo as reference; outfit suggestions should be based on wardrobe items and context only. "
            "Use the person analysis (body, skin, hair) to personalize fit, colors, and styling details. "
            "Keep the advice practical and non-judgmental."
        )

    system_prompt = f"""
You are a professional outfit stylist. Combine today's real weather with the user's pre-selected items to generate outfit suggestions.

CRITICAL LANGUAGE REQUIREMENT: ALL OUTPUTS MUST BE IN ENGLISH ONLY. Do not use Chinese, Japanese, or any other language. Every field in the JSON response must contain English text only.

Requirements:
- If the user pre-selected items (listed in "User pre-selected items"), treat them as fixed bases and fill the remaining roles.
- Factor weather (sun/rain/snow/wind), temperature, humidity to decide layers, shoes, and outerwear.{background_instruction}{model_instruction}
- Generate detailed descriptions for each item in the outfit. The descriptions will be used to match items from the user's wardrobe using vector search.
- Return:
    1) Structured JSON for frontend cards.
    2) A long-form natural language description for readability and manual tweaks.
{role_exclusion_note}

JSON output format (output JSON only, no extra text or Markdown fences):
[
    {{
        "title": "Outfit title in English only (e.g., 'Warm Street Style' or 'Casual Office Look')",
        "items": [
            {{
                "wardrobe_id": null,
                "role": "one of top/bottom/shoes/outer/accessory",
                "description": "Short English description only, e.g., 'Navy blue Teal Hoodie' or 'White Brown Sneakers'. Do NOT include Chinese translations or parentheses with Chinese text. Be specific about color, type, style, and material to help match items from the user's wardrobe."
            }}
        ],
        "reason": "Brief English rationale only (e.g., 'Cold temperatures require layered warmth; pre-selected hoodie and jacket combo balances street style with wind protection')",
        "long_text": "Full English description only; can include multiple paragraphs. Write naturally in English, describing the outfit, weather considerations, and style rationale. Do NOT use Chinese characters."
    }}
]

IMPORTANT: 
- Every string value in the JSON must be in English.
- Do not include Chinese text in parentheses or anywhere else.
- The title, description, reason, and long_text fields must all be 100% English.
- Set wardrobe_id to null for all items - it will be filled automatically by vector search based on the description.
- Only output the JSON array above. Do not add ```json fences or any text outside the JSON.
"""

    # Build image hint text
    background_hint = " and the background image (if provided below)" if background_image_url else ""
    background_scene_hint = " and background scene" if background_image_url else ""
    model_hint = " and the model/person image (if provided below)" if model_image_url else ""
    model_style_hint = " and the person's appearance" if model_image_url else ""

    user_prompt_text = f"""
Today's weather:
{weather_summary}

User pre-selected items (treated as fixed bases):
{base_items_summary}

User extra preferences / rules (can be empty):
{user_prompt or "(User did not provide extra preferences)"}

Task:
- Infer the occasion from user hints{background_hint}{model_hint}, design 3 complete outfits.
- Reuse "User pre-selected items" when present, and complete remaining roles (pants, outerwear, shoes, accessories, etc.).
- For each item in the outfit, provide a detailed description (color, type, style, material) that will be used to match items from the user's wardrobe.
- For each outfit, explain the style choices and why they fit the weather{background_scene_hint}{model_style_hint}.
- Strictly follow the JSON structure above. Set wardrobe_id to null for all items.
- REMEMBER: All text in your response must be in English only. Do not use Chinese or any other language in title, description, reason, or long_text fields.
"""

    # Build message content: include images if provided (model first, then background)
    if model_image_url or background_image_url:
        # Build action description section if provided
        action_description_section = ""
        if background_action_prompt:
            action_description_section = f"\n\nUser's Activity Description:\nThe user described the activity/action in the background: \"{background_action_prompt}\". Consider this activity when suggesting outfits - the outfit should be suitable for this specific activity."
    
        user_prompt_text_with_images = f"""{user_prompt_text}

Image Context:
The user may provide:
- A model/person image (analyze the person's body and appearance only; do NOT use the clothing in the photo as reference)
- A background/scene image (for environment/occasion cues)

If a model/person image is provided, analyze only the person (body proportions, figure, skin tone, hair)—ignore what they are wearing. Use that to personalize fit and styling; do not copy or reference the clothes in the photo.
If a background image is provided, analyze the environment/scene (office, cafe, outdoor park, formal venue, casual setting, etc.) and tailor the outfits to match the context{action_description_section}

Based on your analysis, tailor the outfit suggestions to match the background. The outfits should be appropriate and harmonious with the environment shown in the image. Remember: all output text must be in English only.
"""

        user_message_content: Any = [{"type": "text", "text": user_prompt_text_with_images}]
        if model_image_url:
            user_message_content.append({"type": "image_url", "image_url": {"url": model_image_url}})
        if background_image_url:
            user_message_content.append({"type": "image_url", "image_url": {"url": background_image_url}})
    else:
        user_message_content = user_prompt_text

    print("\n" + "="*80)
    print("=== Qwen-VL Model Request (Generate Outfit) - Complete Prompt ===")
    print("="*80)
    print("\n[System Prompt] (full):")
    print("-"*40)
    print(system_prompt)
    print("-"*40)
    print("\n[User Message] (full):")
    print("-"*40)
    if model_image_url or background_image_url:
        print(user_prompt_text_with_images)
        idx = 1
        if model_image_url:
            print(f"\n[Image {idx} - Model/Person]: {model_image_url}")
            idx += 1
        if background_image_url:
            print(f"[Image {idx} - Background]: {background_image_url}")
    else:
        print(user_prompt_text)
    print("-"*40)
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

    # 向量检索匹配：优先「未使用且 score ≥ 0.6」的候选，否则视为未匹配
    wardrobe_id_set = {str(item.get("id")) for item in wardrobe_items}
    matched_count = 0
    failed_count = 0
    MIN_SIMILARITY_THRESHOLD = 0.6
    used_wardrobe_ids: set[str] = set()

    for outfit in outfits:
        items_list = outfit.get("items") or []
        for item in items_list:
            desc = item.get("description") or ""
            if not desc:
                print("[Vector Search] Skipping item with empty description")
                continue
            wid = item.get("wardrobe_id")
            if wid and str(wid) in wardrobe_id_set:
                used_wardrobe_ids.add(str(wid))
                print(f"[Vector Search] Item already has valid wardrobe_id: {wid}, skipping")
                continue
            try:
                results = search_by_text(desc, k=3, user_id=user_id)
                if results:
                    best = None
                    for candidate in results:
                        score = candidate.get("score", 0)
                        candidate_id = str(candidate.get("id"))
                        if candidate_id in used_wardrobe_ids:
                            continue
                        if score >= MIN_SIMILARITY_THRESHOLD:
                            best = candidate
                            break
                    if best:
                        best_id = str(best["id"])
                        item["wardrobe_id"] = best_id
                        used_wardrobe_ids.add(best_id)
                        matched_count += 1
                        print(f"[Vector Search] Matched '{desc[:50]}...' -> wardrobe_id: {best_id} (score: {best.get('score', 0):.3f})")
                    else:
                        item["wardrobe_id"] = None
                        failed_count += 1
                        print(f"[Vector Search] No match for '{desc[:50]}...' (no candidate ≥{MIN_SIMILARITY_THRESHOLD} and unused)")
                else:
                    item["wardrobe_id"] = None
                    failed_count += 1
                    print(f"[Vector Search] No match for '{desc[:50]}...'")
            except Exception as e:
                print(f"[Vector Search] Error for '{desc[:50]}...': {e}")
                item["wardrobe_id"] = None
                failed_count += 1
  
    print(f"[Vector Search] Summary: {matched_count} matched, {failed_count} failed, {len(used_wardrobe_ids)} unique wardrobe_ids used")

    return {
        "weather_summary": weather_summary,
        "wardrobe_count": len(wardrobe_items),
        "outfits": outfits,
        "raw_text": content,
    }


