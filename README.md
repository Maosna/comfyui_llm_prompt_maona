# comfyui_llm_prompt_maona

# LLM 提示词生成器 for ComfyUI

一个可在 ComfyUI 设置面板中配置的通用 LLM 提示词生成节点，支持 OpenAI、DeepSeek、Ollama 等兼容接口。

## 安装
1. 将本仓库克隆或下载到 ComfyUI 的 `custom_nodes/` 目录下：
   git clone https://github.com/Maosna/comfyui_llm_prompt_maona.git

3. 安装依赖：
   打开 ComfyUI 根目录终端，运行：
   .venv\Scripts\python.exe -m pip install openai

## 配置
- 重启 ComfyUI，在设置面板找到 “LLM 提示词生成器”。
- 填入 API Key、Base URL 等信息，模型列表可自动检测。
- 支持多模板管理（在设置面板的“模板”中操作）。

## 使用
- 在节点菜单中搜索 “LLM 提示词生成器”，拖入画布。
- 输入你的创作需求，生成提示词。


