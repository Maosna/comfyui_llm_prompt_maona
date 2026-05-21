# -*- coding: utf-8 -*-
import os
import json
import asyncio
import openai
import folder_paths
from aiohttp import web
from server import PromptServer
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

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")
os.makedirs(TEMPLATE_DIR, exist_ok=True)

DEFAULTS = {
    "api_key": "",
    "base_url": "",
    "model": "gpt-4o",
    "temperature": 0.7,
    "max_tokens": 2000,                
    "system_prompt": "",
    "disable_thinking": True,
    "filter_thinking_output": True,
    "use_template": False,
    "active_template": ""
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

# ---------- 模板管理 API ----------
@PromptServer.instance.routes.get("/llm_prompt_maona/templates")
async def list_templates(request):
    try:
        files = [f[:-4] for f in os.listdir(TEMPLATE_DIR) if f.endswith(".txt")]
        return web.json_response(sorted(files))
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.get("/llm_prompt_maona/template")
async def get_template(request):
    name = request.query.get("name", "").strip()
    if not name:
        return web.json_response({"error": "name required"}, status=400)
    filepath = os.path.join(TEMPLATE_DIR, f"{name}.txt")
    if not os.path.exists(filepath):
        return web.json_response({"error": "template not found"}, status=404)
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()
        return web.json_response({"name": name, "content": content})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.post("/llm_prompt_maona/template")
async def save_template(request):
    data = await request.json()
    name = data.get("name", "").strip()
    content = data.get("content", "")
    if not name:
        return web.json_response({"error": "name required"}, status=400)
    filepath = os.path.join(TEMPLATE_DIR, f"{name}.txt")
    try:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return web.json_response({"success": True})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

@PromptServer.instance.routes.delete("/llm_prompt_maona/template")
async def delete_template(request):
    name = request.query.get("name", "").strip()
    if not name:
        return web.json_response({"error": "name required"}, status=400)
    filepath = os.path.join(TEMPLATE_DIR, f"{name}.txt")
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
        return web.json_response({"success": True})
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)

# ---------- 模型列表获取 ----------
def _fetch_models_via_openai(base_url: str, api_key: str):
    client = openai.OpenAI(
        api_key=api_key,
        base_url=base_url,
        timeout=10.0,
        max_retries=1,
    )
    try:
        response = client.models.list()
        models = [m.id for m in response.data]
        return models
    except Exception:
        return None

@PromptServer.instance.routes.get("/llm_prompt_maona/fetch_models")
async def fetch_models(request):
    base_url = request.query.get("base_url", "").strip()
    api_key = request.query.get("api_key", "").strip()
    if not base_url:
        return web.json_response({"error": "base_url is required"}, status=400)
    base_url = base_url.rstrip("/")
    loop = asyncio.get_event_loop()
    models = await loop.run_in_executor(None, lambda: _fetch_models_via_openai(base_url, api_key))
    if models is None:
        return web.json_response({
            "models": [],
            "error": f"无法连接至 Base URL {base_url}"
        })
    return web.json_response({"models": models})

# ---------- 节点注册 ----------
NODE_CLASS_MAPPINGS = {
    "LLMPromptGenerator": LLMPromptGenerator
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "LLMPromptGenerator": "LLM 提示词生成器"
}

WEB_DIRECTORY = "./js"

print("[comfyui_llm_prompt_maona] 设置面板已就绪，模板目录：", TEMPLATE_DIR)
