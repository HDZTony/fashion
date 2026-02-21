import os
import json
from typing import Dict, Any, List
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from dotenv import load_dotenv

load_dotenv()

# Initialize Qwen-VL model (default)
# Using Singapore endpoint, so must use Singapore API key
SINGAPORE_BASE_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
api_key = os.getenv("DASHSCOPE_API_KEY_SG")
if not api_key:
    raise RuntimeError(
        "DASHSCOPE_API_KEY_SG must be set in environment variables for Singapore endpoint. "
        "Please set this environment variable in Fly.io using: "
        "fly secrets set DASHSCOPE_API_KEY_SG=your_singapore_key_here"
    )

print("[Qwen-VL] Using Singapore endpoint with Singapore API key")

llm = ChatOpenAI(
    model="qwen3-vl-plus",
    api_key=api_key,
    base_url=SINGAPORE_BASE_URL,  # Singapore endpoint
    temperature=0.1,
)

# xAI / Grok vision model (lazy-init, only created when selected)
XAI_BASE_URL = "https://api.x.ai/v1"
_grok_llm: ChatOpenAI | None = None


def get_llm(model_name: str = "qwen") -> ChatOpenAI:
    """Return the appropriate LLM based on model_name ('qwen' or 'grok')."""
    global _grok_llm

    if model_name == "grok":
        if _grok_llm is not None:
            return _grok_llm

        xai_key = os.getenv("XAI_API_KEY")
        if not xai_key:
            raise RuntimeError(
                "XAI_API_KEY must be set in environment variables to use Grok. "
                "Get your API key from https://console.x.ai and set it: "
                "fly secrets set XAI_API_KEY=your_xai_key_here"
            )
        _grok_llm = ChatOpenAI(
            model="grok-2-vision-latest",
            api_key=xai_key,
            base_url=XAI_BASE_URL,
            temperature=0.1,
        )
        print("[Grok] Initialized xAI Grok vision model")
        return _grok_llm

    # Default: Qwen
    return llm

SYSTEM_PROMPT = """
You are a fashion expert AI. Your task is to analyze clothing images and extract structured data.

The image may contain one or multiple clothing items. For each clothing item visible in the image, identify the following attributes:

- Type: Be specific about the clothing item type. Use detailed categories:
  * Tops: T-shirt, graphic tee, long-sleeve tee, shirt (dress shirt, casual shirt, flannel), blouse, peplum top, wrap top, sweater, knitwear, sweatshirt, hoodie, zip-up hoodie, cardigan (longline, cropped, chunky), tank top, camisole, crop top, polo shirt, rugby shirt, vest (knitted, sweater, suit), tube top, bandeau, sports bra, athletic top.
  * Bottoms: Jeans (skinny, straight, bootcut, mom, distressed), trousers, slacks, suit pants, chinos, khakis, joggers, sweatpants, track pants, shorts (denim, chino, athletic, bike), skirts (pencil, A-line, pleated, mini, midi, maxi, wrap), culottes, palazzo pants, leggings, jeggings, cargo pants, utility pants, overalls, jumpsuits, rompers.
  * Outerwear: Jacket (denim, leather, moto, varsity, harrington), coat (trench, overcoat, pea coat, parka, duffle), blazer, suit jacket, windbreaker, rain jacket, bomber jacket, flight jacket, puffer jacket, down jacket, quilted coat, fleece jacket, sherpa jacket, cape, poncho, shawl.
  * Dresses: Shift dress, sheath dress, A-line dress, skater dress, wrap dress, shirt dress, sundress, slip dress, camisole dress, maxi dress, midi dress, mini dress, bodycon dress, bandage dress, evening gown, cocktail dress, sweater dress, turtleneck dress, cheongsam/qipao.
  * Shoes: Be precise—sneakers (running, basketball, skate), dress shoes (oxford, derby, brogue, monk strap), loafers, moccasins, boat shoes, boots (Chelsea, ankle, combat, hiking, cowboy, knee-high, thigh-high), sandals (strappy, gladiator, slides, flip-flops, espadrilles), heels (pumps, stilettos, block, kitten, wedges), flats (ballet, mary jane, d’Orsay), mules, clogs, slippers, house shoes, athletic cleats, specialty footwear (dance shoes, pointe shoes, tap shoes).
  * Accessories: Belt (leather, chain, corset), hat (baseball cap, fedora, beanie, bucket, beret, sun hat), scarf, shawl, wrap, bandana, gloves (leather, knit, mittens), jewelry (necklace, bracelet, earrings, rings, anklet, brooch), watches, sunglasses, eyeglasses, bags (backpack, tote, crossbody, clutch, satchel, messenger, fanny pack), wallet, cardholder, hair accessories (headband, scrunchie, hair clip), socks, tights, stockings.
  * Sportswear & Loungewear: Sports jersey, compression top, rash guard, yoga pants, performance leggings, tracksuit, warm-up jacket, swimwear (bikini, one-piece, swim trunks, boardshorts), activewear set, pajamas, lounge set, robe.
  * Traditional & Formalwear (if present): Suit, tuxedo, hanfu, kimono, sari, dirndl, kebaya, costume uniforms, stage outfits.
  Use the most specific type you can identify (e.g., "Leather dress shoes" instead of just "Shoes", "Denim jeans" instead of just "Jeans").
- Color: Main color and accent colors. If uncertain, provide multiple possible colors as an array.
- Pattern (e.g., Solid, Striped, Floral, Logo print)
- Style (e.g., Casual, Formal, Streetwear, Vintage)
- Occasion: Suitable occasions. If the item can be worn for multiple occasions, provide an array.
- Material: Inferred material (e.g., Cotton, Denim, Silk). If uncertain, provide multiple possibilities as an array.
- Gender: Determine if this clothing item is primarily for "Man's", "Women's", or "Unisex". Consider both the clothing type and any visible context in the image (such as model wearing the item). Use "Unisex" for items that are clearly unisex (e.g., basic t-shirts, sneakers, jeans). Use "Man's" for items typically worn by men (e.g., men's suit, dress shirt, men's jeans). Use "Women's" for items typically worn by women (e.g., dress, skirt, blouse, women's high heels).
- Description: A detailed, fluent, and complete natural language description in English that comprehensively describes the clothing item. This description should be suitable for use in image generation prompts. Include all relevant details: type, color, material, pattern/style details, and characteristics. Write it as a complete, flowing English sentence or sentences that would help an image generation model understand and visualize the item accurately. Be descriptive and specific.

IMPORTANT RULES:
1. Output the result as a JSON array. Each element represents one clothing item.
2. If the image contains only one item, return an array with one element.
3. For attributes where you are uncertain or the item has multiple valid values, use an array of strings instead of a single string.
4. Always include all attributes (type, color, pattern, style, occasion, material, gender, description) for each item.
5. The description field must be a single string in English, not an array. It should be a complete, fluent description suitable for image generation prompts.
6. The gender field must be exactly one of: "Man's", "Women's", or "Unisex".

Example for single item with certain attributes:
[
    {
        "type": "T-shirt",
        "color": "White",
        "pattern": "Logo print",
        "style": "Casual",
        "occasion": "Daily",
        "material": "Cotton",
        "gender": "Unisex",
        "description": "A white cotton T-shirt with a logo print design, casual style suitable for daily wear."
    }
]

Example for shoes (be specific):
[
    {
        "type": "Leather dress shoes",
        "color": "Black",
        "pattern": "Solid",
        "style": "Formal",
        "occasion": ["Work", "Formal"],
        "material": "Leather",
        "gender": "Man's",
        "description": "Black leather dress shoes with a solid color finish, formal style suitable for work and formal occasions."
    }
]
or
[
    {
        "type": "Sandals",
        "color": "Brown",
        "pattern": "Solid",
        "style": "Casual",
        "occasion": ["Daily", "Beach"],
        "material": ["Leather", "Rubber"],
        "gender": "Unisex",
        "description": "Brown sandals made of leather and rubber materials, solid color design, casual style perfect for daily wear and beach occasions."
    }
]

Example for single item with uncertain/multiple values:
[
    {
        "type": "Jacket",
        "color": ["Navy blue", "Dark blue"],
        "pattern": "Solid",
        "style": "Casual",
        "occasion": ["Daily", "Work"],
        "material": ["Cotton", "Polyester blend"],
        "gender": "Unisex",
        "description": "A navy blue or dark blue jacket made from cotton and polyester blend fabric, solid color pattern, casual style suitable for daily wear and work settings."
    }
]

Example for multiple items:
[
    {
        "type": "Navy blue cardigan",
        "color": "Navy blue",
        "pattern": "Solid",
        "style": "Casual",
        "occasion": ["Daily", "Work"],
        "material": "Cotton",
        "gender": "Unisex",
        "description": "A navy blue cardigan made of cotton material, solid color pattern, casual style perfect for daily wear and work occasions."
    },
    {
        "type": "White dress shirt",
        "color": "White",
        "pattern": "Solid",
        "style": "Formal",
        "occasion": "Work",
        "material": "Cotton",
        "gender": "Man's",
        "description": "A white dress shirt made of cotton fabric, solid color design, formal style suitable for work and professional settings."
    },
    {
        "type": "Beige chinos",
        "color": ["Beige", "Khaki"],
        "pattern": "Solid",
        "style": "Casual",
        "occasion": ["Daily", "Work"],
        "material": "Cotton twill",
        "gender": "Unisex",
        "description": "Beige or khaki colored chinos made from cotton twill fabric, solid color pattern, casual style appropriate for daily wear and work environments."
    },
    {
        "type": "White canvas sneakers",
        "color": "White",
        "pattern": "Solid",
        "style": "Casual",
        "occasion": ["Daily", "Sport"],
        "material": ["Canvas", "Rubber"],
        "gender": "Unisex",
        "description": "White canvas sneakers made of canvas and rubber materials, solid color design, casual style ideal for daily activities and sports."
    }
]

Output ONLY a valid JSON array. Do not include markdown formatting like ```json.
"""

async def analyze_image(image_url: str) -> List[Dict[str, Any]]:
    """
    Analyze an image using Qwen-VL and return structured fashion features.
    Returns a list of clothing items found in the image.
    Accepts a public URL.
    """
    # If it's a local path (legacy support or testing), convert to file://
    # But for R2, we expect a http/https URL
    final_url = image_url
    if not image_url.startswith("http"):
        if os.path.exists(image_url):
            abs_path = os.path.abspath(image_url)
            if os.name == 'nt':
                abs_path = abs_path.replace('\\', '/')
            final_url = f"file://{abs_path}"
        else:
            # Assume it might be a file:// URL already or invalid
            pass

    messages = [
        SystemMessage(content=SYSTEM_PROMPT),
        HumanMessage(content=[
            {"type": "text", "text": "Analyze all clothing items in this image. Identify each distinct item and extract their features."},
            {"type": "image_url", "image_url": {"url": final_url}}
        ])
    ]

    try:
        response = await llm.ainvoke(messages)
        content = response.content.strip()
        
        # Clean up potential markdown code blocks if the model ignores instructions
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]
            
        result = json.loads(content)
        
        # Ensure result is a list
        if isinstance(result, dict):
            # Single item returned as object, convert to list
            return [result]
        elif isinstance(result, list):
            return result
        else:
            print(f"Unexpected result format: {type(result)}")
            return [{"type": "Unknown", "error": "Unexpected response format"}]
            
    except json.JSONDecodeError as e:
        print(f"JSON decode error: {e}")
        print(f"Response content: {content[:500]}")
        return [{"type": "Unknown", "error": f"JSON decode error: {str(e)}"}]
    except Exception as e:
        print(f"Error analyzing image: {e}")
        return [{"type": "Unknown", "error": str(e)}]

async def generate_compatibility_queries(item_features: Dict[str, Any], occasion: str) -> List[str]:
    """
    Scheme A: Generate search queries for items that go well with the given item.
    """
    prompt = f"""
    I have a {item_features.get('color')} {item_features.get('type')} ({item_features.get('style')}).
    I want to wear it for a {occasion} occasion.
    Suggest 3 distinct clothing items (bottoms, shoes, or accessories) that would match well with this item to create a complete look.
    For each suggestion, provide a short visual description I can use to search a database.
    
    Output ONLY a JSON list of strings.
    Example: ["Blue denim jeans", "White sneakers", "Black leather belt"]
    """
    
    messages = [HumanMessage(content=prompt)]
    
    try:
        response = await llm.ainvoke(messages)
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
        return json.loads(content)
    except Exception as e:
        print(f"Error generating compatibility queries: {e}")
        return []

async def generate_outfit_queries(occasion: str) -> List[str]:
    """
    Scheme B: Generate search queries for a full outfit based on occasion.
    """
    prompt = f"""
    Suggest a complete, stylish outfit for a {occasion} occasion.
    Break it down into 3-4 key items (e.g., Top, Bottom, Shoes, Accessory).
    For each item, provide a short visual description.
    
    Output ONLY a JSON list of strings.
    Example: ["White linen shirt", "Beige chinos", "Brown loafers", "Silver watch"]
    """
    
    messages = [HumanMessage(content=prompt)]
    
    try:
        response = await llm.ainvoke(messages)
        content = response.content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.endswith("```"):
            content = content[:-3]
        return json.loads(content)
    except Exception as e:
        print(f"Error generating outfit queries: {e}")
        return []
