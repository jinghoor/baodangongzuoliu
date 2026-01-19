# 可视化工作流（Node + React，端口 1888）

基于 Node.js（Express + TS）和 React（Vite + TS）的可视化工作流。画布使用 React Flow，支持 LLM（OpenAI 兼容，含文件/图片输入）、文本处理、HTTP、条件/循环、文件读写，以及图像/视频生成占位节点。后端同步执行 DAG，生成的文件存放 `backend/uploads/`，数据存放 `backend/data/`。

## 目录
- `backend/`：Express + TypeScript，工作流 CRUD、运行执行器、Provider 配置、上传接口、静态托管前端。
- `frontend/`：React + Vite + React Flow，包含节点库、画布、配置面板、上传、运行与日志视图。

## 运行
```bash
# 后端
cd backend
npm install   # 已装可跳过
npm run dev   # http://localhost:1888
# 或
npm run build && npm start

# 前端（开发模式）
cd ../frontend
npm install   # 已装可跳过
npm run dev   # Vite 默认 5173
# 生产构建（后端会托管 ./frontend/dist）
npm run build
```

## 已有 API
- `GET /health`
- `POST /workflows`，`PUT /workflows/:id`，`GET /workflows`，`GET /workflows/:id`
- `POST /workflows/:id/run`（后台异步执行 DAG）
- `GET /runs/:id`，`GET /runs/:id/logs`
- `POST /providers`，`GET /providers`（OpenAI 兼容 Provider 配置，可存 baseURL/model/key 别名）
- `POST /uploads`（表单字段 `files`，多文件；返回本地 URL，可给 LLM 文件/图片输入）
- 静态 `/uploads` 暴露上传文件
- 前端静态托管：若 `frontend/dist` 存在，直接由后端提供。

## 执行器能力
- DAG 执行：按依赖拓扑运行；条件节点根据连线 label（true/false）决定分支；未满足依赖的节点不会执行。
- 节点类型：
  - LLM（OpenAI 兼容）：支持自定义 baseURL/model/apiKey，占位文件/图片 URL；无密钥时使用 Mock 文本。
  - 文本处理：模板变量替换 (`{{path.to.value}}`)。
  - HTTP：GET/POST 等，Headers/Body 支持模板，响应写入上下文。
  - 条件：`expression` 基于 `ctx` 求值。
  - 循环：对数组 `itemsPath` 进行模板 map，写入 `destPath`。
  - 文件：内容模板写入本地文件，返回路径/URL。
  - 日志：写入运行日志。
  - 图像/视频占位：返回 Mock URL，等待接入真实生成服务。

## 前端要点
- 左侧节点库：触发器、文本/LLM、控制流、HTTP/文件、图像/视频占位。
- 画布：React Flow 可连线，条件分支用连线 label 标注 true/false。
- 右侧面板：节点配置表单、文件/图片上传（获取 URL 可用于 LLM 文件/图片输入）、运行日志查看。
- 运行：保存工作流后点击“运行一次”，自动调用后端并轮询日志。

## 配置
- `PORT`：后端端口，默认 `1888`。
- `OPENAI_API_KEY` 或 `DEFAULT_OPENAI_KEY`：未在节点填 apiKey 时使用。

## Doubao-Seed-1.8 模型配置

通用LLM大模型节点现已支持 Doubao-Seed-1.8 多模态模型。配置方法如下：

### 1. 节点配置

在通用LLM大模型节点中填写以下信息：

- **Base URL**: `https://ark.cn-beijing.volces.com/api/v3`
- **Model**: `doubao-seed-1-8-251228`（或其他 Doubao 模型名称）
- **API Key**: 填写您的 ARK_API_KEY，或留空使用环境变量

### 2. 环境变量配置（可选）

如果不在节点中填写 API Key，可以在后端环境变量中设置：

```bash
export ARK_API_KEY="your-api-key-here"
# 或者在 .env 文件中设置
```

### 3. 多模态输入

Doubao-Seed-1.8 支持图片和文本的多模态输入：

- **文本输入**：在节点的输入源中，选择格式为 "text"
- **图片输入**：在节点的输入源中，选择格式为 "image"，可以：
  - 通过连线从图片输入节点获取
  - 在配置面板中上传图片获取 URL
  - 直接填写图片 URL

### 4. 自动检测

系统会自动检测 Doubao 模型（通过模型名称包含 "doubao" 或 baseURL 包含 "volces.com"），并使用相应的 API 格式：
- 使用 `/v3/responses` 端点（而非标准的 `/v3/chat/completions`）
- 使用 `input` 数组格式（而非 `messages` 格式）
- 支持 `input_text` 和 `input_image` 类型

### 5. 获取响应结果

LLM 节点的响应会自动提取并存储到以下位置：

- **文本内容**：`_outputs.${节点ID}.text` - 这是提取后的纯文本内容
- **完整响应**：`_outputs.${节点ID}.fullResponse` - 这是完整的 API 响应对象（仅 Doubao 模型）

在**文本输出节点**中获取结果：

1. 添加一个"文本输出"节点
2. 将 LLM 节点的输出端口连接到文本输出节点的输入端口
3. 在文本输出节点的"输入"标签页中：
   - **节点/端口**：选择连接的 LLM 节点，端口选择 "text"
   - **字段路径**：通常留空即可（文本内容已自动提取）
   - 如果响应格式特殊，可能需要填写字段路径，如 `output.text` 或 `response.output.text`

**注意**：系统会自动解析 Doubao 响应中的文本内容，通常不需要填写字段路径。如果自动提取失败，可以：
- 查看运行日志，了解响应结构
- 尝试填写字段路径，如 `output.text` 或 `response.output.text`
- 或使用 `fullResponse` 端口获取完整响应对象

### 示例工作流

1. 添加一个"图片输入"节点，上传或粘贴图片
2. 添加一个"通用LLM大模型"节点
3. 配置节点：
   - Base URL: `https://ark.cn-beijing.volces.com/api/v3`
   - Model: `doubao-seed-1-8-251228`
   - API Key: 您的 ARK_API_KEY
4. 在节点的"输入"标签页中，添加输入源：
   - 第一个输入：格式选择 "image"，连接到图片输入节点
   - 第二个输入：格式选择 "text"，填写提示词（如："你看见了什么？"）
5. 添加一个"文本输出"节点，连接到 LLM 节点的 "text" 输出端口
6. 运行工作流即可获得多模态分析结果

## 后续扩展
- 将占位图/视频节点接入真实生成服务，回写 URL/元数据到上下文。
- 增加持久化 DB（Postgres/SQLite）替换本地 JSON 存储；引入权限、多用户与版本管理。
- 引入队列/多 worker，支持长时任务与并发控制；增加 WS/SSE 实时日志推送。 
