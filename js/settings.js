import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const CATEGORY = "LLM 提示词生成器";
let currentConfig = {};

// 加载配置
async function loadConfig() {
    try {
        const res = await api.fetchApi("/prompt_assistant/config?file=config.json");
        if (res.ok) currentConfig = await res.json();
    } catch (e) {
        console.error("[llm_prompt_maona] 加载配置失败", e);
    }
}

// 保存配置
async function saveConfig() {
    try {
        await api.fetchApi("/prompt_assistant/config?file=config.json", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(currentConfig),
        });
    } catch (e) {
        console.error("[llm_prompt_maona] 保存配置失败", e);
    }
}

// ---------- 模型下拉（无标签） ----------
let modelSelectElement = null;

async function refreshModels(baseUrl) {
    if (!baseUrl || !modelSelectElement) return;
    const select = modelSelectElement;
    select.innerHTML = "";
    const loadingOpt = document.createElement("option");
    loadingOpt.value = "";
    loadingOpt.textContent = "加载中...";
    select.appendChild(loadingOpt);
    try {
        const res = await fetch(`/llm_prompt_maona/fetch_models?base_url=${encodeURIComponent(baseUrl)}&api_key=${encodeURIComponent(currentConfig.api_key || "")}`);
        const data = await res.json();
        const models = data.models || [];
        const errorMsg = data.error || "";
        select.innerHTML = "";
        if (models.length === 0) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = errorMsg || "无可用模型";
            select.appendChild(opt);
        } else {
            models.forEach(model => {
                const opt = document.createElement("option");
                opt.value = model;
                opt.textContent = model;
                select.appendChild(opt);
            });
            if (currentConfig.model && models.includes(currentConfig.model)) {
                select.value = currentConfig.model;
            } else {
                select.value = models[0];
                currentConfig.model = models[0];
                saveConfig();
            }
        }
    } catch (e) {
        console.error("[llm_prompt_maona] 获取模型列表失败", e);
        select.innerHTML = "";
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "请求失败";
        select.appendChild(opt);
    }
}

function createModelSettingRow() {
    const row = document.createElement("tr");
    const valueCell = document.createElement("td");
    valueCell.colSpan = 2;
    valueCell.style.display = "flex";
    valueCell.style.gap = "4px";
    valueCell.style.alignItems = "center";

    const select = document.createElement("select");
    select.style.flex = "1";
    select.style.padding = "2px";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "加载中...";
    select.appendChild(placeholder);
    modelSelectElement = select;

    const btn = document.createElement("button");
    btn.textContent = "刷新";
    btn.style.padding = "2px 6px";
    btn.style.cursor = "pointer";
    btn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (currentConfig.base_url) {
            await refreshModels(currentConfig.base_url);
        }
    };

    valueCell.appendChild(select);
    valueCell.appendChild(btn);
    row.appendChild(valueCell);

    select.addEventListener("change", () => {
        currentConfig.model = select.value;
        saveConfig();
    });

    setTimeout(async () => {
        if (currentConfig.base_url) {
            await refreshModels(currentConfig.base_url);
        }
    }, 200);

    return row;
}

// ---------- API Key 自定义行（带小眼睛） ----------
function createApiKeySettingRow() {
    const row = document.createElement("tr");
    const valueCell = document.createElement("td");
    valueCell.colSpan = 2;
    valueCell.style.display = "flex";
    valueCell.style.gap = "4px";
    valueCell.style.alignItems = "center";

    const input = document.createElement("input");
    input.type = "password";
    input.value = currentConfig.api_key || "";
    input.style.flex = "1";
    input.style.padding = "2px";
    input.addEventListener("input", () => {
        currentConfig.api_key = input.value;
        saveConfig();
    });

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = "👁️";
    toggleBtn.style.padding = "2px 6px";
    toggleBtn.style.cursor = "pointer";
    toggleBtn.style.background = "transparent";
    toggleBtn.style.border = "1px solid var(--border-color, #555)";
    toggleBtn.style.borderRadius = "4px";
    toggleBtn.style.color = "var(--input-text, #ddd)";
    toggleBtn.title = "显示/隐藏 API Key";

    toggleBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (input.type === "password") {
            input.type = "text";
            toggleBtn.textContent = "🙈";
        } else {
            input.type = "password";
            toggleBtn.textContent = "👁️";
        }
    });

    valueCell.appendChild(input);
    valueCell.appendChild(toggleBtn);
    row.appendChild(valueCell);
    return row;
}

// ---------- 模板管理器弹窗 ----------
function openTemplateManager() {
    const old = document.getElementById("maona-template-dialog");
    if (old) old.remove();

    const dialog = document.createElement("div");
    dialog.id = "maona-template-dialog";
    dialog.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:var(--comfy-menu-bg,#2a2a2a);padding:24px;border-radius:12px;z-index:9999;width:700px;max-height:85vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,0.5);color:var(--input-text,#ddd);font-family:system-ui;";

    let html = `<h3 style="margin-top:0">提示词模板管理</h3>`;
    html += `<div style="margin-bottom:8px"><label>选择模板：</label>
             <select id="maona-template-list" style="width:200px;margin-left:8px"></select>
             <button id="maona-template-load" style="margin-left:8px;padding:2px 8px">加载</button>
             <button id="maona-template-delete" style="margin-left:4px;padding:2px 8px;color:#f55">删除</button></div>`;
    html += `<div style="margin-bottom:8px"><input id="maona-template-name" placeholder="模板名称（保存时使用）" style="width:300px;padding:4px"></div>`;
    html += `<textarea id="maona-template-content" rows="16" style="width:100%;resize:vertical"></textarea>`;
    html += `<div style="margin-top:12px;display:flex;gap:10px">
                <button id="maona-template-new">新建</button>
                <button id="maona-template-save">保存</button>
                <button id="maona-template-cancel">关闭</button>
            </div>`;

    dialog.innerHTML = html;
    document.body.appendChild(dialog);

    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:9998";
    overlay.onclick = closeDialog;
    document.body.appendChild(overlay);

    const nameInput = document.getElementById("maona-template-name");
    const contentArea = document.getElementById("maona-template-content");
    const listSelect = document.getElementById("maona-template-list");

    function closeDialog() {
        dialog.remove();
        overlay.remove();
    }

    async function loadTemplateList() {
        try {
            const res = await fetch("/llm_prompt_maona/templates");
            const names = await res.json();
            listSelect.innerHTML = "";
            names.forEach(name => {
                const opt = document.createElement("option");
                opt.value = name;
                opt.textContent = name;
                listSelect.appendChild(opt);
            });
        } catch (e) {
            console.error("加载模板列表失败", e);
        }
    }

    loadTemplateList();

    document.getElementById("maona-template-load").onclick = async () => {
        const selected = listSelect.value;
        if (!selected) return;
        try {
            const res = await fetch(`/llm_prompt_maona/template?name=${encodeURIComponent(selected)}`);
            if (!res.ok) throw new Error("not found");
            const data = await res.json();
            nameInput.value = data.name;
            contentArea.value = data.content;
        } catch (e) {
            alert("加载模板失败");
        }
    };

    document.getElementById("maona-template-delete").onclick = async () => {
        const selected = listSelect.value;
        if (!selected) return;
        if (!confirm(`确定删除模板 "${selected}" 吗？`)) return;
        await fetch(`/llm_prompt_maona/template?name=${encodeURIComponent(selected)}`, { method: "DELETE" });
        nameInput.value = "";
        contentArea.value = "";
        loadTemplateList();
    };

    document.getElementById("maona-template-new").onclick = () => {
        nameInput.value = "";
        contentArea.value = "";
        listSelect.value = "";
    };

    document.getElementById("maona-template-save").onclick = async () => {
        const name = nameInput.value.trim();
        if (!name) { alert("请输入模板名称"); return; }
        const content = contentArea.value;
        await fetch("/llm_prompt_maona/template", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, content })
        });
        loadTemplateList();
        alert("模板已保存！");
    };

    document.getElementById("maona-template-cancel").onclick = closeDialog;
}

// ---------- 当前模板选择下拉 ----------
let activeTemplateSelect = null;

function createActiveTemplateRow() {
    const row = document.createElement("tr");
    const valueCell = document.createElement("td");
    valueCell.colSpan = 2;
    valueCell.style.display = "flex";
    valueCell.style.gap = "4px";
    valueCell.style.alignItems = "center";

    const select = document.createElement("select");
    select.style.flex = "1";
    select.style.padding = "2px";
    select.innerHTML = '<option value="">不使用模板</option>';
    activeTemplateSelect = select;

    const refreshBtn = document.createElement("button");
    refreshBtn.textContent = "刷新";
    refreshBtn.style.padding = "2px 6px";
    refreshBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await refreshActiveTemplateList();
    };

    valueCell.appendChild(select);
    valueCell.appendChild(refreshBtn);
    row.appendChild(valueCell);

    select.addEventListener("change", () => {
        currentConfig.active_template = select.value;
        saveConfig();
    });

    async function refreshActiveTemplateList() {
        try {
            const res = await fetch("/llm_prompt_maona/templates");
            const names = await res.json();
            select.innerHTML = '<option value="">不使用模板</option>';
            names.forEach(name => {
                const opt = document.createElement("option");
                opt.value = name;
                opt.textContent = name;
                select.appendChild(opt);
            });
            if (currentConfig.active_template && names.includes(currentConfig.active_template)) {
                select.value = currentConfig.active_template;
            } else {
                select.value = "";
            }
        } catch (e) {
            console.error("刷新模板列表失败", e);
        }
    }

    setTimeout(refreshActiveTemplateList, 100);
    return row;
}

// ---------- 注册扩展 ----------
await loadConfig();

app.registerExtension({
    name: "comfyui_llm_prompt_maona.settings",
    settings: [
        {
            id: "comfyui_llm_prompt_maona.api_key",
            name: "API Key",
            category: [CATEGORY, "连接", "API Key"],
            tooltip: "OpenAI 兼容服务的 API Key",
            type: () => createApiKeySettingRow()
        },
        {
            id: "comfyui_llm_prompt_maona.base_url",
            name: "Base URL",
            type: "text",
            defaultValue: currentConfig.base_url || "",
            category: [CATEGORY, "连接", "Base URL"],
            tooltip: "例如 http://localhost:11434/v1",
            onChange: async (value) => {
                currentConfig.base_url = value;
                saveConfig();
                await refreshModels(value);
            }
        },
        {
            id: "comfyui_llm_prompt_maona.model",
            name: "模型",
            category: [CATEGORY, "连接", "模型"],
            tooltip: "选择或刷新可用模型",
            type: () => createModelSettingRow()
        },
        {
            id: "comfyui_llm_prompt_maona.temperature",
            name: "温度 (Temperature)",
            type: "number",
            defaultValue: currentConfig.temperature ?? 0.7,
            attrs: { min: 0.0, max: 2.0, step: 0.05 },
            category: [CATEGORY, "参数", "温度"],
            tooltip: "生成随机性",
            onChange: (value) => { currentConfig.temperature = value; saveConfig(); }
        },
        {
            id: "comfyui_llm_prompt_maona.max_tokens",
            name: "最大 Token 数",
            type: "number",
            defaultValue: currentConfig.max_tokens ?? 2000,   // 默认改为 2000
            attrs: { min: 10, max: 4000, step: 10 },
            category: [CATEGORY, "参数", "最大 Token"],
            tooltip: "生成提示词的最大长度",
            onChange: (value) => { currentConfig.max_tokens = value; saveConfig(); }
        },
        {
            id: "comfyui_llm_prompt_maona.disable_thinking",
            name: "关闭思维链",
            type: "boolean",
            defaultValue: currentConfig.disable_thinking ?? true,
            category: [CATEGORY, "高级", "关闭思维链"],
            tooltip: "某些模型支持关闭思维链",
            onChange: (value) => { currentConfig.disable_thinking = value; saveConfig(); }
        },
        {
            id: "comfyui_llm_prompt_maona.filter_thinking_output",
            name: "过滤思维链输出",
            type: "boolean",
            defaultValue: currentConfig.filter_thinking_output ?? true,
            category: [CATEGORY, "高级", "过滤思维链"],
            tooltip: "自动移除响应中的思考过程标签",
            onChange: (value) => { currentConfig.filter_thinking_output = value; saveConfig(); }
        },
        {
            id: "comfyui_llm_prompt_maona.use_template",
            name: "启用模板",
            type: "boolean",
            defaultValue: currentConfig.use_template ?? false,
            category: [CATEGORY, "模板", "开关"],
            tooltip: "开启后使用下方选择的模板",
            onChange: (value) => { currentConfig.use_template = value; saveConfig(); }
        },
        {
            id: "comfyui_llm_prompt_maona.active_template",
            name: "当前模板",
            category: [CATEGORY, "模板", "选择"],
            tooltip: "选择一个已保存的模板",
            type: () => createActiveTemplateRow()
        },
        {
            id: "comfyui_llm_prompt_maona.template_manager",
            name: "模板管理",
            category: [CATEGORY, "模板", "管理"],
            tooltip: "新建、编辑或删除提示词模板",
            type: () => {
                const row = document.createElement("tr");
                const cell = document.createElement("td");
                cell.colSpan = 2;
                const btn = document.createElement("button");
                btn.textContent = "打开模板管理器";
                btn.style.padding = "4px 12px";
                btn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openTemplateManager();
                };
                cell.appendChild(btn);
                row.appendChild(cell);
                return row;
            }
        }
    ]
});

console.log("[llm_prompt_maona] 全部设置项已注册");
