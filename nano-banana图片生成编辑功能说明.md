# nano-banana 图片生成/编辑功能说明

## 功能概述

通用LLM大模型节点现在支持 nano-banana 系列模型的**自动模式切换**：

- **无图像输入** → 使用 `/v1/images/generations` 接口（文生图）
- **有图像输入** → 使用 `/v1/images/edits` 接口（图生图，支持1~6张图）

## 工作原理

### 1. 自动检测

当使用以下模型时，自动启用图片生成/编辑模式：
- `nano-banana`
- `nano-banana-pro`
- `nano-banana-pro-2k`
- `nano-banana-pro-4k`
- `gemini-3-pro-image-preview`
- `gemini-2.5-flash-image`

### 2. 接口选择逻辑

```
检测到 nano-banana 模型
    ↓
处理所有输入源
    ↓
检查是否有图像输入？
    ├─ 有图像 → 使用 /v1/images/edits（图生图）
    └─ 无图像 → 使用 /v1/images/generations（文生图）
```

### 3. 图像输入检测

系统会从以下位置收集图像输入：
- 节点的 `inputSources` 配置中 `format: "image"` 的输入
- 旧配置方式中的 `images` 数组
- 通过连线传入的图像数据

## 使用方法

### 文生图（无图像输入）

1. 添加"通用LLM大模型"节点
2. 配置：
   - **Model**: `nano-banana-pro-2k`
   - **Base URL**: `https://api.vveai.com/v1`（或您的 API 地址）
   - **API Key**: 您的 API Key
   - **Prompt**: "一张逼真的高分辨率照片，拍摄的是繁忙的城市街道"
   - **Size**: `2:3`（或其他尺寸）
3. 运行节点即可生成图片

### 图生图（有图像输入）

1. 添加"图片输入"节点，上传或输入图片
2. 添加"通用LLM大模型"节点
3. 配置：
   - **Model**: `nano-banana-pro-2k`
   - **Base URL**: `https://api.vveai.com/v1`
   - **API Key**: 您的 API Key
   - **Prompt**: "将这张图片改成夜景"
4. 在"输入"标签页中：
   - 添加输入源
   - **格式**: 选择 `image`
   - **节点/端口**: 连接到图片输入节点
5. 运行节点即可生成编辑后的图片

## 配置参数

### 通用参数

- **response_format**: 
  - `b64_json` - 返回 base64 格式（更稳定，推荐）
  - `url` - 返回 URL 格式（有效期仅数小时）

- **size**: 图片尺寸
  - 2.5系列：支持比例（如 `2:3`）或分辨率（如 `1024x1024`）
  - gemini-3-pro-image-preview：支持 `1K`、`2K`、`4K`

- **aspect_ratio**: 图片比例（仅 `gemini-3-pro-image-preview` 支持）
  - 示例：`2:3`、`16:9`、`1:1`

## 输出

图片生成/编辑完成后，输出到以下位置：

- **image 端口**: 完整的图片对象（包含 url、b64_json 等）
- **text 端口**: 图片 URL 字符串（兼容性）
- **上下文路径**: `vars.${节点ID}.image`

## 注意事项

1. **图片编辑接口限制**：
   - 通常只使用第一张输入图片
   - 某些 API 可能支持多张图片（1~6张）

2. **图片格式**：
   - 支持 base64 data URL
   - 支持本地文件路径（`/uploads/xxx.jpg`）
   - 支持远程 URL（`http://` 或 `https://`）
   - 本地文件会自动转换为 base64

3. **API 兼容性**：
   - 图片编辑接口可能使用 JSON 格式（图片以 base64 字符串传递）
   - 如果 API 要求 multipart/form-data，可能需要后续优化

## 示例工作流

### 示例 1：文生图

```
[手动触发] → [文本输入: "生成一张苹果的图片"] → [通用LLM大模型: nano-banana-pro-2k] → [图片输出]
```

### 示例 2：图生图

```
[手动触发] → [图片输入: 上传图片] → [通用LLM大模型: nano-banana-pro-2k, prompt: "改成夜景"] → [图片输出]
```

---

*最后更新：2026年1月27日*
