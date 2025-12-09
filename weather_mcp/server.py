import asyncio
import os
from typing import Any, Dict

import aiohttp
from mcp.server import Server
from mcp.types import ToolResult, TextContent

# WeatherAPI.com 文档：https://www.weatherapi.com/docs/
# 当前天气接口示例：
#   http://api.weatherapi.com/v1/current.json?key=<YOUR_API_KEY>&q=London

BASE_URL = "http://api.weatherapi.com/v1"
CURRENT_PATH = "/current.json"

# 从环境变量读取 API Key，避免写死在代码里
WEATHER_API_KEY = os.getenv("WEATHER_API_KEY")

server = Server("weather-mcp")


@server.tool()
async def get_weather(q: str) -> ToolResult:
    """
    使用 WeatherAPI.com 实时天气接口获取当前天气。

    参数:
      q: 位置查询参数，可以是：
         - 城市名，例如: "London", "Beijing", "深圳"
         - 经纬度，例如: "48.8567,2.3508"
         - 邮编 / 邮政编码，例如: "10001", "SW1"
         - auto:ip 让服务端根据 IP 自动定位
    """
    if not WEATHER_API_KEY:
        return ToolResult(
            content=[
                TextContent(
                    type="text",
                    text=(
                        "WeatherAPI API key 未配置。\n"
                        "请在环境变量中设置 WEATHER_API_KEY 后再重试。"
                    ),
                )
            ]
        )

    url = BASE_URL + CURRENT_PATH
    params = {
        "key": WEATHER_API_KEY,
        "q": q,
        # 如需空气质量等信息，可以增加 aqi=yes 等参数
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params, timeout=10) as resp:
                text = await resp.text()
                if resp.status != 200:
                    # WeatherAPI 的错误也在 body 里返回 JSON，直接透传文字方便调试
                    return ToolResult(
                        content=[
                            TextContent(
                                type="text",
                                text=f"调用 WeatherAPI 失败，HTTP {resp.status}。\n响应内容：\n{text}",
                            )
                        ]
                    )

                data: Dict[str, Any] = await resp.json()
    except asyncio.TimeoutError:
        return ToolResult(
            content=[
                TextContent(
                    type="text",
                    text="请求 WeatherAPI 超时，请稍后再试。",
                )
            ]
        )
    except Exception as e:  # noqa: BLE001
        return ToolResult(
            content=[
                TextContent(
                    type="text",
                    text=f"请求 WeatherAPI 时出现错误：{e}",
                )
            ]
        )

    # 根据 WeatherAPI 文档解析字段：https://www.weatherapi.com/docs/
    location = data.get("location", {}) or {}
    current = data.get("current", {}) or {}
    condition = current.get("condition", {}) or {}

    city_name = location.get("name") or q
    region = location.get("region") or ""
    country = location.get("country") or ""
    localtime = location.get("localtime") or ""

    temp_c = current.get("temp_c")
    feelslike_c = current.get("feelslike_c")
    humidity = current.get("humidity")
    wind_kph = current.get("wind_kph")
    wind_dir = current.get("wind_dir")
    text_condition = condition.get("text")

    lines = []
    lines.append(f"位置: {city_name}, {region}, {country}".strip(", "))
    if localtime:
        lines.append(f"当地时间: {localtime}")
    lines.append("")

    if temp_c is not None:
        if feelslike_c is not None:
            lines.append(f"当前温度: {temp_c}°C (体感 {feelslike_c}°C)")
        else:
            lines.append(f"当前温度: {temp_c}°C")

    if text_condition:
        lines.append(f"天气状况: {text_condition}")
    if humidity is not None:
        lines.append(f"湿度: {humidity}%")
    if wind_kph is not None:
        if wind_dir:
            lines.append(f"风: {wind_kph} km/h 来自 {wind_dir}")
        else:
            lines.append(f"风速: {wind_kph} km/h")

    if not lines:
        lines.append("未能从 WeatherAPI 响应中解析到有效天气信息。")

    # WeatherAPI 免费计划文档要求提供链接回溯：
    # 参考: https://www.weatherapi.com/docs/
    lines.append("")
    lines.append('数据来源: WeatherAPI.com (https://www.weatherapi.com/)')

    return ToolResult(
        content=[
            TextContent(
                type="text",
                text="\n".join(lines),
            )
        ]
    )


async def main() -> None:
    """
    以 stdio 方式运行 MCP 服务器。
    """
    await server.run_stdio()


if __name__ == "__main__":
    asyncio.run(main())


