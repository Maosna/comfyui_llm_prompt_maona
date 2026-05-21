import os
import json
import re
from openai import OpenAI

def load_settings():
    config_path = None
    try:
        from folder_paths import get_user_directory
        user_dir = get_user_directory()
        if user_dir:
            config_path = os.path.join(user_dir, "default", "comfyui_llm_prompt_maona", "config.json")
    except:
        pass
    if not config_path or not os.path.exists(config_path):
        base = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
        config_path = os.path.join(base, "user", "default", "comfyui_llm_prompt_maona", "config.json")

    settings = {}
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            settings = json.load(f)

    settings["temperature"] = float(settings.get("temperature", 0.7))
    settings["max_tokens"] = int(settings.get("max_tokens", 2000))   
    settings["disable_thinking"] = settings.get("disable_thinking", True) in (True, "true", "True")
    settings["filter_thinking_output"] = settings.get("filter_thinking_output", True) in (True, "true", "True")
    settings["use_template"] = settings.get("use_template", False) in (True, "true", "True")
    settings["active_template"] = settings.get("active_template", "")
    return settings

class LLMPromptGenerator:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "requirement": ("STRING", {"multiline": True, "default": ""}),
            },
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "generate_prompt"
    CATEGORY = "prompt/llm"

    def generate_prompt(self, requirement):
        cfg = load_settings()
        key = cfg.get("api_key", "").strip()
        if not key:
            raise ValueError("请先在 ComfyUI 设置中配置 'API Key'。")
        base_url = cfg.get("base_url", "").strip() or None
        client = OpenAI(api_key=key, base_url=base_url)

        # 构建系统提示词
        system_prompt = cfg.get("system_prompt", "").strip()
        if not system_prompt:
            system_prompt = (
                "你是一位顶级的 AI 绘画提示词工程师。"
                "根据用户的需求描述，生成一个详细、高质量的图像生成提示词。"
                "提示词应使用英文，包含风格、构图、光照、细节等要素，"
                "长度适中，适合直接用于 Stable Diffusion 等模型。"
                "只输出提示词文本，不要加任何解释。"
            )

        # 加载节点包内的模板
        if cfg.get("use_template") and cfg.get("active_template"):
            template_name = cfg["active_template"]
            template_dir = os.path.join(os.path.dirname(__file__), "templates")
            template_path = os.path.join(template_dir, f"{template_name}.txt")
            if os.path.exists(template_path):
                try:
                    with open(template_path, "r", encoding="utf-8") as f:
                        template_content = f.read()
                    system_prompt += "\n\n[风格参考模板]\n" + template_content
                except Exception as e:
                    print(f"[llm_prompt_maona] 读取模板失败: {e}")

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": requirement}
        ]
        api_params = {
            "model": cfg.get("model", "gpt-4o"),
            "messages": messages,
            "temperature": cfg.get("temperature", 0.7),
            "max_tokens": cfg.get("max_tokens", 2000),   
        }
        if cfg.get("disable_thinking"):
            try:
                api_params["extra_body"] = {"disable_thinking": True}
            except:
                pass

        try:
            response = client.chat.completions.create(**api_params)
        except TypeError:
            api_params.pop("extra_body", None)
            response = client.chat.completions.create(**api_params)

        result = response.choices[0].message.content.strip()
        if cfg.get("filter_thinking_output"):
            result = re.sub(r"<思考>.*?</思考>", "", result, flags=re.DOTALL)
        return (result,)
