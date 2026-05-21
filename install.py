import os
import json
import asyncio
import urllib.request
import urllib.error
import folder_paths
from server import PromptServer         
from aiohttp import web
from .nodes import LLMPromptGenerator    

# ---------- 配置文件路径 ----------
def get_user_config_dir():
    try:
        user_dir = folder_paths.get_user_directory()
        if user_dir:
            return os.path.join(user_dir, "default", "comfyui_llm_prompt_maona")
    except:
        pass
    return os.path.join(os.path.dirname(__file__), "..", "..", "user", "default", "comfyui_llm_prompt_maona")

USER_CONFIG_DIR = get_user_config_dir()
os.makedirs(USER_CONFIG_DIR, exist_ok=True)
CONFIG_FILE = os.path.join(USER_CONFIG_DIR, "config.json")

DEFAULTS = {
    "api_key": "",
    "base_url": "",
    "model": "gpt-4o",
    "temperature": 0.7,
    "max_tokens": 2000,
    "system_prompt": "",
    "disable_thinking": True,
    "filter_thinking_output": True
}

if not os.path.exists(CONFIG_FILE):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(DEFAULTS, f, indent=2, ensure_ascii=False)

# ---------- 配置读写 API ----------
@PromptServer.instance.routes.get("/prompt_assistant/config")
async def get_config(request):
    file = request.query.get("file", "config.json")
    if file != "config.json":
        return web.Response(status=403)
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
        return web.json_response(data)
    except Exception as e:
        return web.Response(status=500, text=str(e))

@PromptServer.instance.routes.post("/prompt_assistant/config")
async def save_config(request):
    file = request.query.get("file", "config.json")
    if file != "config.json":
        return web.Response(status=403)
    try:
        data = await request.json()
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return web.Response(text="OK")
    except Exception as e:
        return web.Response(status=500, text=str(e))

# ---------- 模型列表代理 API ----------
def _fetch_url(url):
    try:
        with urllib.request.urlopen(url, timeout=5) as resp:
            return json.loads(resp.read().decode())
    except Exception:
        return None

@PromptServer.instance.routes.get("/llm_prompt_maona/fetch_models")
async def fetch_models(request):
    base_url = request.query.get("base_url", "").strip()
    if not base_url:
        return web.json_response({"error": "base_url is required"}, status=400)
    if base_url.endswith("/"):
        base_url = base_url[:-1]
    url = f"{base_url}/models"
    try:
        loop = asyncio.get_event_loop()
        response_data = await loop.run_in_executor(None, lambda: _fetch_url(url))
        if response_data is None:
            return web.json_response({"error": "Request failed"}, status=502)
        models = [m["id"] for m in response_data.get("data", []) if "id" in m]
        return web.json_response({"models": models})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

# ---------- 节点注册 ----------
NODE_CLASS_MAPPINGS = {
    "LLMPromptGenerator": LLMPromptGenerator
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "LLMPromptGenerator": "LLM 提示词生成器"
}

WEB_DIRECTORY = "./js"

print("[comfyui_llm_prompt_maona] 设置面板已就绪。")
