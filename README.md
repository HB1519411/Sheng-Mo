# 绳墨 - 集成AI游戏工具

**绳墨** 是一款专为个人打造的、功能丰富、界面简约的集成AI游戏工具。它以浏览器为载体，结合强大的后端服务，为您提供一个高度可定制化、私密且高效的 AI 体验环境。无论您是想进行沉浸式角色扮演、利用 AI 进行绘图创作，还是管理复杂的对话场景、阅读并引用参考资料，绳墨都能满足您的需求。

---

## ✨ 核心特性

*   **🚀 双 AI 引擎驱动:** 同时集成强大的 **谷歌 Gemini** 模型和 **NovelAI** 图像生成能力。
*   **🎭 深度角色扮演:** 支持多角色定义、状态管理、记忆与设定分离，构建生动的虚拟世界。
*   **🎨 AI 绘图集成:** 无缝调用 NovelAI 进行图像生成，支持丰富的参数调整和角色绘图模板。
*   **📚 小说阅读与引用:** 内建小说阅读器，可将小说内容作为动态参考信息注入 AI 对话。
*   **🛠️ 智能工具箱:** 配备多种专用 AI 工具（如游戏主持、写作大师等），拓展应用场景。
*   **💬 多聊天室管理:** 支持创建、管理、导入/导出多个独立的聊天场景，保持对话隔离。
*   **⚙️ 高度可配置:** 从 AI 参数到界面行为，提供全面的自定义选项。
*   **📱 移动端优化:** 主要界面为移动端交互设计，布局紧凑，操作便捷。
*   **🔒 本地化部署:** 所有数据（配置、聊天记录、角色、小说）均存储在本地，确保隐私安全。
*   **📦 便捷备份恢复:** 支持一键导出/导入完整配置和聊天室数据。

---

## 📝 详细功能介绍

### 🤖 AI 交互核心

*   **Gemini 模型代理:**
    *   支持接入多种谷歌 Gemini 模型进行文本生成。
    *   可精细调整生成参数：温度（Temperature）、顶P（Top P）、顶K（Top K）、最大输出令牌数。
    *   支持配置响应格式（MIME 类型），适配不同需求。
    *   支持 JSON Schema，实现结构化数据输出。
    *   可自定义 Schema 解析脚本（JavaScript），对 AI 输出进行预处理。
    *   支持全局系统指令（System Instruction）和多轮对话提示词预设（Prompt Preset Turns）。
    *   提供多个 API 密钥轮询机制，并记录失败次数，提高可用性。
    *   完全关闭 Gemini 的安全设置，提供更自由的交互体验。
*   **NovelAI 绘图代理:**
    *   集成 NovelAI 图像生成接口。
    *   可配置使用的 NovelAI 模型（如 NAI Diffusion 3/4 等）。
    *   支持设置默认的正面和负面提示词。
    *   支持艺术家风格链（Artist Chain）。
    *   可为每个角色设定独立的绘图模板（Drawing Template），自动应用于绘图提示词。
    *   全面控制生成参数：图像宽度、高度、步数（Steps）、引导系数（Scale）、CFG 重调（CFG Rescale）、采样器（Sampler）、噪点调度（Noise Schedule）、种子（Seed，0 为随机）。
    *   自动处理 API 请求与响应，将生成的图片直接显示在聊天界面。

### 💬 聊天室系统

*   **多聊天室:**
    *   创建和管理多个独立的聊天室，每个聊天室拥有自己的配置、历史记录、角色和小说。
    *   支持聊天室的重命名、删除。
    *   可方便地切换当前活动的聊天室。
*   **独立配置:**
    *   每个聊天室可设置独特的“扮演规则”（Roleplay Rules）和“公共信息”（Public Info），这些信息可作为上下文注入 AI 请求。
    *   支持为聊天室设置独立的背景图片。
*   **持久化存储:**
    *   聊天记录自动保存在本地对应的聊天室文件夹内（`history.json`）。
    *   聊天室特定配置（如激活的小说、角色状态等）保存在 `chatroom_config.json` 中。
*   **导入与导出:**
    *   支持将单个聊天室的所有数据（配置、历史、角色、小说、背景图）导出为 ZIP 压缩包。
    *   支持从 ZIP 压缩包导入聊天室数据，轻松迁移或分享场景。

### 🎭 角色扮演（RP）系统

*   **角色定义:**
    *   在每个聊天室中，可以创建和管理多个“永久角色”。
    *   每个角色包含独立的“设定”（Setting）、“记忆”（Memory）和“绘图模板”（Drawing Template）。
    *   支持角色的编辑、删除，以及单个角色的导入/导出（JSON 格式）。
*   **临时角色:**
    *   支持在聊天过程中动态创建“临时角色”，无需预先定义文件。
*   **角色状态管理:**
    *   提供直观的角色状态切换按钮，管理每个角色的行为模式：
        *   `默` (默认/静默): 角色不主动参与，仅作为背景信息。
        *   `活` (活动): 角色由 AI 控制，根据设定和场景自动发言或行动。
        *   `用` (用户控制): 角色行为由用户手动输入，AI 不会代为行动。
        *   `更` (更新): 触发“角色更新大师”工具，分析近期对话以更新该角色的记忆或设定。
*   **角色状态存储:**
    *   基础状态（默/活/用/更）存储在聊天室配置中。
    *   “角色详细状态”（Role Detailed States）用于存储更复杂的、由游戏主持人生成和更新的角色信息。

### 🛠️ 智能工具箱

绳墨内置了一系列专用 AI 工具，可在后台运行，辅助主对话流程：

*   **通用配置:** 每个工具均可独立启用/禁用，并可配置其使用的 Gemini 模型、主提示词、数据库指令、响应 Schema 及解析脚本。
*   **绘图大师 (Drawing Master):**
    *   负责解析绘图需求，结合角色绘图模板和场景信息，生成发送给 NovelAI 的具体提示词。
*   **游戏主持人 (Game Host):**
    *   添加/删除临时角色，静默/激活永久角色。
    *   能够输出场景上下文、更新角色状态、处理行动结果，并将这些信息结构化地展示在聊天界面。
*   **写作大师 (Writing Master):**
    *   用于根据对话内容或特定指令，辅助生成描述性文本或其他创意内容。
*   **角色更新大师 (Character Update Master):**
    *   分析最近的对话历史，智能地更新指定角色的“记忆”或“设定”文件，让角色能够“学习”和“成长”。
*   **私人助理 (Private Assistant):**
    *   一个通用的后台工具，可以自由的交流。

### 📚 小说阅读与参考

*   **小说管理:**
    *   支持在每个聊天室中添加和管理多部小说。
    *   提供文本文件上传功能，后端会自动将长文本分割成合适的段落（Segments）。
    *   自动提取文本中的章节标记（如“第一章”），并能基于段落数量自动生成补充目录（TOC）。
*   **小说阅读器:**
    *   内建一个独立的小说阅读界面。
    *   提供“书架”视图，展示当前聊天室的所有小说。
    *   提供“目录”视图，方便在章节间快速跳转。
    *   自动记忆每部小说上次阅读到的滚动位置。
*   **激活与引用:**
    *   用户可以在书架中选择要“激活”的小说。
    *   被激活的小说内容（根据当前阅读位置和全局配置的“参考文本字符数”）会自动提取，并作为一个特殊的上下文信息（`{{参考文本}}`）提供给 AI，使其能够“阅读”并引用相关内容。

### ⚙️ 配置与管理

*   **全局配置:**
    *   所有全局设置（如默认 AI 参数、API Key 相关设置、聊天室排序、工具配置等）保存在 `config.json` 文件中。
    *   设置更改后会自动保存。
*   **提示词预设:**
    *   支持配置一套包含系统指令和多轮用户/模型对话的模板。
    *   这些预设会作为基础上下文添加到发送给 Gemini 的请求中。
    *   支持将预设配置导出为 JSON 文件，或从文件中导入。
*   **运行时错误日志:**
    *   前端界面会捕获并显示 JavaScript 运行时错误，方便调试。
*   **完整备份与恢复:**
    *   提供一键导出整个应用状态（全局配置 + 所有聊天室数据）为 ZIP 文件的功能。
    *   支持从 ZIP 文件恢复整个应用状态，非常适合迁移或备份。
*   **数据清理:**
    *   提供“清空全部配置”的危险操作选项，用于彻底重置应用。

### ✨ 用户界面与体验

*   **界面设计:**
    *   主聊天界面 (`gemini_chat.html`) 优先考虑移动设备，布局紧凑，元素间距小。
    *   采用暗色主题，适合长时间使用。
    *   提供一个独立的编辑器界面 (`editor.html`)，用于项目文件的直接编辑（详见作者的话）。
*   **设置面板:**
    *   通过点击图标打开设置面板。
    *   设置项按层级和功能模块清晰分类。
*   **聊天界面:**
    *   消息气泡样式区分用户和 AI。
    *   支持显示由 NovelAI 生成的图片。
    *   特殊工具（如游戏主持）的输出有定制化的展示格式。
    *   提供消息操作菜单（长按消息旁的头像/图标触发），支持：
        *   切换显示 AI 消息的原始 JSON 数据或格式化文本。
        *   重新触发绘图（针对绘图大师消息）。
        *   保存角色更新（针对角色更新大师消息）。
        *   删除单条消息 或 删除此条及以下所有消息。
    *   支持直接编辑已发送的消息内容。
*   **交互元素:**
    *   顶栏提供设置入口、小说阅读器入口、运行/暂停按钮、角色列表开关等。
    *   角色列表面板可方便地查看和切换角色状态。
    *   提供加载状态指示器（Spinner）和请求重试时的视觉提示。
    *   为常用操作（如创建管理员消息、添加临时角色）提供快捷按钮。

---

**绳墨** 致力于为您提供一个强大而灵活的本地 AI 交互平台，让您的创意和想法得以自由驰骋。



# 绳墨 - 详尽操作指南 🧭

本指南将引导您全面了解并熟练使用 **绳墨** 的各项功能。

---

## 🚀 快速开始

1.  **启动后端:** 在您的终端或服务器环境中，运行 `start_backend.bat`或`start_backend.sh` 启动。
2.  **访问前端:** 在您的浏览器（移动端推荐edge浏览器）中打开指向 `gemini_chat.html` 的地址（通常是 `http://<您的IP地址(本地是：127.0.0.1)>:8888`）。
3.  **初始配置:** 首次使用时，建议先进入设置面板（点击左上角 `⚙️` 图标），配置您的谷歌 Gemini API 密钥和 NovelAI API 密钥（如果需要绘图功能）。

---

## 💬 主聊天界面 (`gemini_chat.html`)

这是您与 AI 交互的主要场所。

### 顶栏 (Top Toolbar)

位于界面最上方，固定显示，包含核心控制按钮：

*   **`⚙️` 设置图标 (左上角):**
    *   **短按:** 打开/关闭 **设置面板**。所有全局配置、聊天室管理、角色/小说编辑等都在这里进行。
    *   **长按:** 切换浏览器 **全屏模式**。
*   **`📖` 小说按钮 (右上角):**
    *   **点击:** 打开/关闭 **小说阅读界面**。您可以在此阅读、管理当前聊天室关联的小说，并将其内容作为参考信息提供给 AI。
*   **`👤` 角色按钮 (顶栏左二):**
    *   **短按:** 打开/关闭 **角色状态控制面板**（显示在顶栏下方）。
    *   **长按:** 直接跳转到 **设置面板** 中的 **聊天室角色列表** 页面，方便管理角色文件。
*   **`📜` 规则按钮 (顶栏左三):**
    *   **点击:** 直接跳转到 **设置面板** 中的 **当前聊天室设置** 页面，方便查看和编辑扮演规则、公共信息等。
*   **加载指示器 (旋转圆圈，顶栏中央):**
    *   当 AI 正在处理请求时，会显示并旋转。
    *   如果请求失败并尝试使用下一个 API 密钥重试时，圆圈顶部会短暂变为 **红色**。
*   **`📏` 管理员按钮 (顶栏右侧，运行按钮左侧):**
    *   **短按:** 在聊天区域 **创建一条新的“管理员”消息**，并立即进入编辑模式，允许您输入旁白、指令或场景描述等非角色发言。
    *   **长按:** 弹出输入框，允许您快速 **添加一个新的“临时角色”** 到当前聊天室。
*   **`▶`/`◼` 运行/暂停按钮 (顶栏最右侧):**
    *   **点击:** 切换 AI 的 **自动运行状态**。
        *   `▶` (暂停状态): AI 不会自动响应。点击后切换到 `◼` 运行状态。
        *   `◼` (运行状态): AI 会根据角色状态和设定自动响应。点击后切换到 `▶` 暂停状态。
    *   **解除暂停 (`▶` -> `◼`) 时的行为:**
        *   如果当前聊天室只有一个角色状态为 `活`，会自动触发该角色响应。
        *   如果有多个角色状态为 `活`，会在界面右上方弹出一个 **活动角色触发列表**，让您选择首先由哪个角色响应。
        *   如果 **游戏主持人** 工具已启用，会自动触发一次游戏主持人的响应。
        *   如果上一条消息是用户输入，且内容包含特定感官词（看、听、闻、模、尝等），且 **写作大师** 工具已启用，会自动触发一次写作大师的响应。
    *   **长按 (`▶` 或 `◼` 状态下均可):** 如果 **私人助理** 工具已启用，会直接触发一次私人助理的响应。
*   **`💬` 待处理动作按钮 (顶栏右下角，仅特定情况出现):**
    *   当某个角色状态为 `用` (用户控制)，并且轮到该角色行动时（例如由 AI 指定 `nextRoleToAct`），此按钮会出现。
    *   **点击:** 为该角色 **创建一条新消息** 并进入编辑模式，让您手动输入该角色的发言或行动。点击后此按钮消失。

### 角色状态控制面板 (`#role-buttons-wrapper`)

通过点击 `👤` 角色按钮显示/隐藏。

*   **布局:** 每个角色一行，左侧是代表角色的主按钮，右侧是状态选择按钮（默认隐藏）。
*   **角色主按钮 (`[角色名首字母/符号]`):**
    *   显示角色的简写标识（通常是名称首字母，为避免重复可能会使用其他字符或数字）。
    *   **临时角色** 的按钮背景色通常不同（例如白色背景）以作区分。
    *   **短按:** 展开/收起右侧的 **状态选择按钮**。
    *   **长按:** 直接跳转到 **设置面板** 中该角色的 **角色详情** 页面。
*   **状态选择按钮 (`默`, `活`, `用`, `更` - 点击角色主按钮后出现):**
    *   **含义:**
        *   `默` (默认/静默): 角色不主动行动，其设定和状态仍可作为上下文信息。
        *   `活` (活动): 角色由 AI 控制，在轮到它或被触发时会自动生成响应。
        *   `用` (用户控制): 角色行为需要用户手动输入。当 AI 指定此角色行动时，会弹出 `💬` 按钮提示用户输入。
        *   `更` (更新): **点击** 此状态会触发 **角色更新大师** 工具（如果已启用），该工具会分析近期对话，尝试更新此角色的记忆或设定。**注意:** 这不是一个持久状态，点击后会立即触发更新动作，角色状态通常不会停留在 `更`。
    *   **短按:** 将角色切换到对应的状态。当前状态的按钮会有高亮显示。状态更改会自动保存。
    *   **特殊长按:**
        *   **长按 `用` 按钮:** 立即为该角色 **创建一条新消息** 并进入编辑模式，相当于 `💬` 按钮的功能。
        *   **长按 `默` 按钮 (仅对临时角色有效):** 弹出确认框，确认后 **删除该临时角色**。

### 聊天区域 (`#chat-area`)

显示对话消息的主体区域。

*   **消息气泡:**
    *   不同样式区分用户发言 (`user-message`) 和 AI 发言 (`ai-response`)。
    *   AI 发言气泡上方会显示代表该 AI 角色的 **角色名称按钮**。
*   **消息内容:**
    *   **普通文本:** 显示角色的发言或行动描述。
    *   **图片:** 如果是 NovelAI 生成的图片，会直接显示图片。点击图片可 **全屏查看**。
    *   **游戏主持:** 以特定格式显示场景时间、地点、角色位置、角色状态等信息，并提供视图切换按钮（`🕒`, `📍`, `👤`）。
    *   **角色更新大师:** 显示更新后的角色记忆和设定摘要。
    *   **其他工具:** 根据其配置和功能显示相应输出。

### 图片查看器 (`#image-viewer-page`)

*   当您点击聊天气泡中的图片时，会覆盖整个屏幕显示该图片。
*   **点击图片查看器任意位置:** 关闭查看器，返回聊天界面。

---

## ⚙️ 设置面板 (`#settings-panel`)

通过点击左上角 `⚙️` 图标打开。包含所有配置选项。

### 导航

*   **主菜单:** 进入设置面板后首先看到的页面，列出所有设置大类。
*   **进入子页面:** 点击主菜单或子菜单中的条目进入相应设置页面。
*   **返回/关闭:**
    *   每个子页面的右上角都有一个 `✕` **关闭按钮**，点击会返回 **上一级页面**。
    *   如果已在顶层菜单（如 API 设置、绘图设置等），点击 `✕` 会返回 **设置主菜单**。
    *   在 **设置主菜单** 点击 `✕` 或再次点击 `⚙️` 图标会 **关闭整个设置面板**。

### 设置项详解

#### 1. API 设置 (`api-settings-page`)

*   **谷歌 API 密钥:**
    *   文本框，每行输入一个 Gemini API 密钥。
    *   输入或修改后，**切换焦点或按 Enter 键** 会自动保存。
    *   保存后会自动尝试获取可用模型列表。
*   **API 密钥失败计数:**
    *   显示每个已输入密钥的失败次数统计，方便判断密钥有效性。
*   **发送参数:**
    *   **Temperature, Top P, Top K, Max Output Tokens:** 输入框，调整 Gemini 模型生成参数。修改后自动保存。
    *   **Response Mime Type:** 下拉框，选择期望 AI 返回的数据格式。修改后自动保存（当前只支持JSON，整个工具是围绕JSON设计的）。

#### 2. 提示词预设 (`prompt-preset-page`)

*   **System Instruction (全局):**
    *   文本框，输入将应用于所有 Gemini 请求的系统级指令。**输入时自动保存**。
*   **对话轮次预设:**
    *   **添加 U/M 按钮:** 点击 `添加 U` 添加一个用户轮次，点击 `添加 M` 添加一个模型（AI）轮次。
    *   **预设列表:**
        *   `U/M 标签:` 显示该轮次的角色。
        *   `文本框:` 输入该轮次的具体指令或对话内容。**输入时自动保存**。
        *   `↑/↓ 按钮:` 调整该轮次的顺序。
        *   `✕ 按钮:` 删除该轮次。
    *   **导出/导入预设:**
        *   `导出预设:` 将当前所有提示词预设（包括系统指令、轮次、共享设置、工具设置）导出为 JSON 文件。
        *   `导入预设:` 点击后选择本地 JSON 文件导入预设。会覆盖当前的预设设置。

#### 3. 绘图设置 (`novelai-settings-page`)

*   **NovelAI API Key:** 输入框，输入您的 NovelAI API 密钥。**修改后自动保存**。
*   **模型 (Model):** 下拉框，选择要使用的 NovelAI 模型版本。**修改后自动保存**。
*   **艺术家链 (Artist Chain):** 输入框，输入您想附加到提示词中的艺术家名或其他风格标签。**输入时自动保存**。
*   **默认正面/负面提示词:** 文本框，输入默认添加到所有绘图请求的正面/负面提示词。**输入时自动保存**。
*   **上次发送的主要绘图提示词:** 文本框（只读），显示最近一次发送给 NovelAI 的主要提示词内容（不含默认词和艺术家链），方便调试。
*   **参数 (Width, Height, Steps, Scale, CFG Rescale, Seed):** 输入框，调整 NovelAI 生成参数。**修改后自动保存**。
*   **采样器 (Sampler), 噪点调度 (Noise Schedule):** 下拉框，选择 NovelAI 使用的采样器和调度。**修改后自动保存**。

#### 4. 报错日志 (`error-log-page`)

*   **错误信息显示区:** 文本框（只读），显示前端捕获到的 JavaScript 运行时错误。
*   **清空错误日志:** 按钮，清除显示区的内容。
*   **复制错误信息:** 按钮，将显示区的内容复制到剪贴板。
*   **清空全部配置 (危险!):** 红色按钮，**点击后会要求二次确认**。确认后将删除所有本地配置（`config.json`）、所有聊天室数据（`chatrooms` 目录）、所有生成的图片（`images/generated` 目录），相当于恢复出厂设置。**操作不可逆，请务必先备份！**
*   **导出完整配置 (ZIP):** 按钮，将当前的 `config.json` 和整个 `chatrooms` 目录打包下载为 ZIP 文件。
*   **导入完整配置 (ZIP):** 按钮，点击后选择本地 ZIP 文件。导入会 **覆盖** 当前的 `config.json` 和 `chatrooms` 目录。**导入前建议先备份当前配置！**

#### 5. 聊天室设置 (`chat-room-settings-page`)

*   这是一个子菜单页面。
*   **通用配置:** 点击进入全局的、应用于所有聊天室的默认 AI 配置（模型、Schema 等）。
*   **聊天室目录:** 点击进入管理所有聊天室的列表页面。

#### 6. 通用配置 (`general-config-page`)

这些是应用于 **非工具角色**（即普通角色和临时角色）的默认 AI 参数设置。

*   **参考文本字符数:** 输入框，设置从激活小说中提取多少字符作为参考上下文（`{{参考文本}}`）提供给 AI。**修改后自动保存**。
*   **模型 (角色/临时角色):** 下拉框，选择普通角色和临时角色默认使用的 Gemini 模型。**修改后自动保存**。
*   **Response Schema (JSON):** 文本框，输入期望普通角色响应遵循的 JSON 结构。**输入时自动保存**。
*   **Response Schema Parser (JS):** 文本框，输入用于解析上述 Schema 响应的 JavaScript 代码。**输入时自动保存**。
*   **共享数据库 (角色/临时角色):** 文本框，输入将作为 `{{数据库}}` 占位符内容注入到普通角色提示词中的共享信息。**输入时自动保存**。
*   **主提示词 (角色/临时角色):** 文本框，输入普通角色的主要行为指令或设定，会注入到 `{{主提示词}}` 占位符。**输入时自动保存**。

#### 7. 聊天室目录 (`chat-room-directory-page`)

*   **十 添加聊天室:** 按钮，点击后弹出输入框，输入新聊天室名称并创建。
*   **聊天室列表:**
    *   显示所有已创建的聊天室。
    *   **单选按钮:** 点击选中一个聊天室，将其设为 **当前活动聊天室**。切换会自动保存并加载新聊天室的数据。
    *   **聊天室名称标签:** 点击标签会直接进入该聊天室的 **聊天室详情** 页面。

#### 8. 聊天室详情 (`chat-room-detail-page`)

*   通过点击 **聊天室目录** 中的 **聊天室名称标签** 进入。
*   **标题:** 显示当前正在查看详情的聊天室名称。
*   这是一个子菜单页面。
*   **当前聊天室设置:** 点击进入编辑当前聊天室的特定信息（规则、历史、管理操作等）。
*   **聊天室角色:** 点击进入管理 **当前聊天室** 的角色列表。
*   **聊天室小说:** 点击进入管理 **当前聊天室** 的小说列表。

#### 9. 当前聊天室设置 (`current-chatroom-settings-page`)

*   **消息记录:** 文本框（只读），显示当前聊天室格式化后的主要对话历史（不含原始 JSON 或详细状态）。
*   **清空消息记录:** 按钮，删除当前聊天室的所有聊天记录，并将所有角色的详细状态清空，基础状态保留。
*   **最新世界信息:** 文本框（只读），显示由 **游戏主持人** 工具生成的最新场景上下文信息。
*   **扮演规则 (当前聊天室):** 文本框，输入仅应用于当前聊天室的扮演规则。**输入时自动保存**。
*   **公共信息 (当前聊天室):** 文本框，输入仅应用于当前聊天室的公共背景信息。**输入时自动保存**。
*   **聊天室管理:**
    *   `重命名:` 按钮，点击后弹出输入框，修改当前聊天室的名称。
    *   `删除:` 按钮（红色），点击后要求确认，**删除当前聊天室及其所有数据**。
    *   `导出 (ZIP):` 按钮，将当前聊天室的所有数据导出为 ZIP 文件。
    *   `导入 (ZIP):` 按钮，点击后选择 ZIP 文件导入聊天室数据。如果聊天室名称已存在，会自动重命名导入的聊天室。

#### 10. 聊天室角色 (`role-list-page`)

*   可以通过 **聊天室详情菜单** 或 **长按顶栏 `👤` 角色按钮** 进入。
*   **十 添加角色:** 按钮，点击后弹出输入框，为当前聊天室创建新的 **永久角色** 文件。
*   **角色列表:**
    *   显示当前聊天室的所有 **永久角色** 和 **临时角色**（如果有）。
    *   **角色名称:** 点击角色名称会进入该角色的 **角色详情** 页面。
    *   **`✎` 编辑按钮 (仅永久角色，非管理员):** 点击后弹出输入框，重命名该角色。
    *   **`✕` 删除按钮 (仅永久角色，非管理员):** 删除该角色的定义文件及其在聊天室配置中的状态。

#### 11. 角色详情 (`role-detail-page`)

*   可以通过点击 **聊天室角色列表** 中的角色名称或 **长按角色状态控制面板的角色主按钮** 进入。
*   **标题:** 显示正在查看的角色名称，并标记是否为临时角色。
*   **角色设定:** 文本框，编辑角色的核心设定。**永久角色可编辑，输入时自动保存。临时角色和管理员只读。**
*   **角色记忆:** 文本框，编辑角色的记忆信息。**永久角色可编辑，输入时自动保存。临时角色和管理员只读。**
*   **角色状态:** 文本框（只读），显示该角色当前的详细状态信息（通常由工具更新）。
*   **Drawing Template:** 输入框，编辑角色的绘图模板（用于绘图大师）。**永久角色可编辑，输入时自动保存。临时角色和管理员只读。**
*   **导出此角色:** 按钮（仅永久角色，非管理员可见），将当前角色的定义（设定、记忆、模板）导出为 JSON 文件。
*   **导入此角色:** 按钮，点击选择 JSON 文件。导入会 **创建** 一个新角色（如果名称冲突会提示重命名），而不是覆盖当前角色。

#### 12. 聊天室小说 (`story-mode-page`)

*   可以通过 **聊天室详情菜单** 进入。
*   **十 添加小说 (从剪贴板):** 按钮，点击后弹出输入框要求输入小说名称，然后弹出另一个输入框粘贴小说全文。后台会自动处理、分段并保存。
*   **小说列表:**
    *   显示当前聊天室已添加的所有小说。
    *   **小说名称:** 只读显示。
    *   **`✎` 编辑按钮:** 点击后弹出输入框，重命名该小说。
    *   **`✕` 删除按钮:** 点击后要求确认，删除该小说文件及其在聊天室配置中的关联信息。

#### 13. 工具列表 (`tool-list-page`)

*   这是一个子菜单页面，列出所有可用的智能工具。
*   点击工具名称（如“绘图大师”）进入对应工具的设置页面。

#### 14. [各工具] 设置页面 (例如 `drawing-master-page`)

*   **启用:** 复选框，勾选以启用该工具。**修改后自动保存**。
*   **模型:** 下拉框，选择该工具使用的 Gemini 模型。**修改后自动保存**。
*   **Response Schema (JSON):** 文本框，输入该工具期望的响应结构。**输入时自动保存**。
*   **Response Schema Parser (JS):** 文本框，输入解析该工具响应的 JS 代码。**输入时自动保存**。
*   **数据库:** 文本框，输入供该工具使用的特定背景信息或指令，会注入 `{{数据库}}` 占位符。**输入时自动保存**。
*   **主提示词:** 文本框，输入该工具的核心功能指令，会注入 `{{主提示词}}` 占位符。**输入时自动保存**。

---

## 📖 小说阅读界面 (`#novel-interface`)

通过点击右上角 `📖` 小说按钮打开/关闭。

### 顶栏

*   **`☰` 目录按钮:** 点击打开 **目录页面**。
*   **`📚` 书架按钮:** 点击打开 **书架页面**。

### 内容区域 (`#novel-content-area`)

*   显示当前选定的小说内容。
*   **滚动:** 页面滚动会自动触发保存当前阅读位置（对应段落 ID）。
*   **章节标记:** 如果小说包含章节标题，会以醒目样式显示。

### 书架页面 (`#novel-bookshelf-page`)

*   通过点击 `📚` 书架按钮打开。
*   **`✕` 关闭按钮:** 返回小说阅读界面。
*   **小说列表:**
    *   列出当前聊天室的所有小说。
    *   **单选按钮:** 选择一本小说作为 **当前阅读** 的小说。选中后会自动加载其内容到阅读区域。
    *   **小说名称标签:** 点击标签效果同点击单选按钮。当前阅读的小说名称会加粗。
    *   **复选框:** 勾选表示 **激活** 该小说，其内容将作为 `{{参考文本}}` 提供给 AI。取消勾选则不激活。**修改后自动保存**。

### 目录页面 (`#novel-toc-page`)

*   通过点击 `☰` 目录按钮打开。
*   **`✕` 关闭按钮:** 返回小说阅读界面。
*   **目录列表:**
    *   显示当前阅读小说的目录（自动生成或提取）。
    *   **点击章节标题:** 跳转到小说内容区域对应的章节位置，并关闭目录页面。

---

## 💬 消息交互操作

与聊天区域中的消息进行交互。

### 创建消息

*   **用户控制角色发言:**
    1.  在 **角色状态控制面板** 中找到目标角色。
    2.  展开状态按钮。
    3.  **长按 `用` 按钮**。
    4.  会在聊天区底部创建一条该角色的消息，并自动进入编辑模式。输入内容后按 Enter 或失去焦点即可完成。
*   **响应 `💬` 按钮:**
    1.  当轮到状态为 `用` 的角色行动时，顶栏右下角出现 `💬` 按钮。
    2.  点击 `💬` 按钮。
    3.  操作同上。
*   **管理员发言:**
    1.  点击顶栏的 `📏` 管理员按钮。
    2.  会在聊天区底部创建一条管理员消息，并自动进入编辑模式。输入内容后失去焦点即可完成。

### 编辑消息

*   **触发编辑:**
    1.  找到要编辑的消息气泡。
    2.  **长按** 气泡上方的 **角色名称按钮**。
*   **编辑过程:**
    *   消息气泡背景变白，内容变为可编辑状态。光标会自动定位到末尾。
    *   修改文本内容。
    *   **按 Enter 键** 或 **点击聊天界面其他任意位置** (失去焦点) 即可保存修改。修改会自动同步到历史记录。
*   **注意:**
    *   游戏主持人的格式化视图无法直接编辑，需要先切换到“原始”视图。
    *   绘图大师生成的图片消息无法直接编辑文本，长按名称按钮进入编辑模式会显示其原始 JSON 数据供编辑。

### 消息动作菜单

*   **触发菜单:** **短按** 消息气泡上方的 **角色名称按钮**。会在按钮旁边弹出一排小的操作按钮。再次短按可收起菜单。点击聊天界面其他区域也会收起菜单。
*   **可用动作 (根据消息类型有所不同):**
    *   **`🔄` 切换原始/格式化:** (仅 AI 消息) 在 AI 返回的原始 JSON 文本和经过解析/格式化的文本之间切换显示。
    *   **`🖼️` 设为背景/下载:** (仅 NovelAI 图片消息)
        *   **短按:** 将此图片设置为当前聊天室的背景。
        *   **长按:** 下载此图片到本地。
    *   **`🖌️` 重新绘制:** (仅 NovelAI 图片消息 或 其对应的绘图大师消息) 使用之前的提示词信息，重新向 NovelAI 请求生成一次图片，并在原消息位置更新图片。
    *   **`💾` 保存角色更新:** (仅角色更新大师消息) 将该次更新的记忆和设定应用并保存到对应的 **永久角色** 文件中。对临时角色无效。
    *   **`✕` 删除:**
        *   **短按:** 删除 **当前这一条** 消息。
        *   **长按:** 弹出确认框，确认后删除 **当前这条消息以及它之后的所有消息**。

---

## 💾 备份与恢复

强烈建议定期备份您的数据！

*   **导出/导入单个聊天室:**
    *   在 **设置面板 -> 聊天室设置 -> 聊天室详情 -> 当前聊天室设置** 中。
    *   `导出 (ZIP)` 下载包含该聊天室所有数据的压缩包。
    *   `导入 (ZIP)` 上传之前导出的压缩包以恢复或复制聊天室。
*   **导出/导入单个角色:**
    *   在 **设置面板 -> 聊天室设置 -> 聊天室详情 -> 聊天室角色 -> [角色名称] -> 角色详情** 中。
    *   `导出此角色` 下载该角色定义的 JSON 文件。
    *   `导入此角色` 上传 JSON 文件以创建新角色（名称冲突会提示重命名）。
*   **导出/导入提示词预设:**
    *   在 **设置面板 -> 提示词预设** 中。
    *   `导出预设` 下载包含系统指令、对话轮次、共享设置、工具设置的 JSON 文件。
    *   `导入预设` 上传 JSON 文件以覆盖当前的预设。
*   **导出/导入完整配置:**
    *   在 **设置面板 -> 报错日志** 中。
    *   `导出完整配置 (ZIP)` 下载包含 `config.json` 和所有聊天室数据的压缩包。
    *   `导入完整配置 (ZIP)` 上传压缩包以 **完全覆盖** 当前所有配置和聊天室数据。

---

恭喜您！阅读完本指南，您应该已经掌握了 **绳墨** 的所有核心操作。现在，开始您的 AI 探索之旅吧！

##作者的话
###说明：工具的核心定位为'多角色聊天室'，上面都是哈基米写的介绍。
###免责声明：本人对代码脚本一窍不通，本工具的全部代码由Gemini生成，出了任何问题请去投诉谷歌。
###安全性：工具制作过程中，我已反复向哈基米强调不要安全性，所及基本上是没有的，大概？
###开发者反馈：本人*非常乐意*与*开发者*(工具本身/预设/角色卡/聊天室等)交流讨论，并愿意提供一切力所能及的帮助(但受限于自身能力，很多时候可能帮不上什么忙)。
###使用者反馈：十分抱歉，因为本人能力和精力有限，难以接受和处理任何*使用者*的反馈，如果您在使用时遇到任何问题，可以前往请Discord发布页求助万能的群友，或参考下一条自行解决。
###问题处理：工具带有一个编辑网页(editor.html)，在后端启动的前提下，可以通过`http://<您的IP地址(本地是：127.0.0.1)>:8888/editor`来访问它。点击它的"导出"按钮，可以导出一个带有工具全部源代码的txt文本，将这个源代码提交给AI，您就可以问一问万能的AI该怎么办了。
###更新：bug遇到再修，更新随用随更，更新了我会在发布页讲。如果您有意成为本工具的开发者，请联系我。
###联系方式：Discord(用户名：hb1519411)
###Git发布页：https://github.com/HB1519411/Sheng-Mo
###Discord发布页：https://discord.com/channels/1134557553011998840/1357570298873905203

##致谢：
###特别鸣谢"类脑ΟΔΥΣΣΕΙΑ"
###感谢"从前跟你一样"大佬，您的绘图脚本为开发工作省下了很大的功夫。
###感谢"無汽糖水、yorino和许多因为时间久远无从查起的预设大佬"，您的预设为我提供了很多灵感。