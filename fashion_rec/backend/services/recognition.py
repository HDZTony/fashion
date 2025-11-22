import os
import json
from typing import Dict, Any, List
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from dotenv import load_dotenv

load_dotenv()

# Initialize Qwen-VL model
# Using the same configuration as the reference code
api_key = os.getenv("DASHSCOPE_API_KEY")
if not api_key:
    # Fallback for development if env var not set immediately
    print("Warning: DASHSCOPE_API_KEY not found in environment variables.")

llm = ChatOpenAI(
    model="qwen-vl-max", # Using max for better performance as requested
    api_key=api_key,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
    temperature=0.1,
)

SYSTEM_PROMPT = """
You are a fashion expert AI. Your task is to analyze clothing images and extract structured data.
Identify the following attributes:
- Type (e.g., T-shirt, Jeans, Dress, Jacket)
- Color (Main color and accent colors)
- Pattern (e.g., Solid, Striped, Floral)
- Style (e.g., Casual, Formal, Streetwear, Vintage)
- Occasion (e.g., Daily, Work, Party, Sports)
- Material (inferred, e.g., Cotton, Denim, Silk)

Output the result ONLY as a valid JSON object. Do not include markdown formatting like ```json.
Example:
{
    "type": "T-shirt",
    "color": "White",
    "pattern": "Logo print",
    "style": "Casual",
    "occasion": "Daily",
    "material": "Cotton"
}
"""

async def analyze_image(image_url: str) -> Dict[str, Any]:
    """
    Analyze an image using Qwen-VL and return structured fashion features.
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
            {"type": "text", "text": "Analyze this clothing item."},
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
            
        return json.loads(content)
    except Exception as e:
        print(f"Error analyzing image: {e}")
        # Return a fallback or re-raise
        return {
            "type": "Unknown",
            "error": str(e)
        }

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
