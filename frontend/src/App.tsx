import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useParams } from "react-router-dom";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  addEdge,
  MarkerType,
  useEdgesState,
  useNodesState,
  useStore,
} from "reactflow";
import type { Connection, Edge, Node, NodeTypes, ReactFlowInstance } from "reactflow";
import html2canvas from "html2canvas";
import "reactflow/dist/style.css";
import "./App.css";
import DefaultNode from "./nodes/DefaultNode";
import type { NodeData } from "./nodes/DefaultNode";
import HomePage from "./HomePage";
import AllProjectsPage from "./AllProjectsPage";
import LoginPage from "./LoginPage";
import RegisterPage from "./RegisterPage";
import ProfilePage from "./ProfilePage";
import AdminPage from "./AdminPage";
import ProtectedRoute from "./ProtectedRoute";
import { apiBase, apiFetch } from "./api";
import { useAuth } from "./auth";
import type { User } from "./auth";

type PaletteItem = {
  type: string;
  name: string;
  detail: string;
  badge?: string;
  placeholder?: boolean;
};

type PaletteSection = {
  title: string;
  items: PaletteItem[];
};

const palette: PaletteSection[] = [
  {
    title: "触发器",
    items: [
      { type: "start", name: "手动触发", detail: "从前端点击运行", badge: "Run" },
      { type: "cron", name: "定时触发", detail: "Cron / repeatable", badge: "Cron" },
      { type: "webhook", name: "Webhook", detail: "外部回调触发", badge: "HTTP" },
    ],
  },
  {
    title: "输入",
    items: [
      { type: "text-input", name: "文本输入", detail: "固定文本内容", badge: "Text" },
      { type: "image-input", name: "图片输入", detail: "上传/粘贴多张图片", badge: "IMG" },
    ],
  },
  {
    title: "输出",
    items: [
      { type: "text-output", name: "文本输出", detail: "输出文本结果", badge: "Out" },
      { type: "image-output", name: "图片输出", detail: "输出图片结果", badge: "IMG" },
    ],
  },
  {
    title: "AI",
    items: [
      { type: "llm-generic", name: "通用LLM大模型", detail: "支持多种大模型 API", badge: "AI" },
      {
        type: "doubao-1-8",
        name: "豆包1.8多模态模型",
        detail: "Doubao Seed 1.8 多模态",
        badge: "AI",
      },
      { type: "image-placeholder", name: "图像生成", detail: "占位节点", badge: "IMG", placeholder: true },
    ],
  },
  {
    title: "转换",
    items: [
      { type: "text", name: "文本处理", detail: "模板/变量替换", badge: "Text" },
      { type: "log", name: "显示", detail: "输出到运行日志", badge: "Log" },
    ],
  },
  {
    title: "工具",
    items: [
      { type: "http", name: "HTTP 请求", detail: "REST/JSON", badge: "HTTP" },
      { type: "time", name: "获取时间", detail: "当前时间戳", badge: "Time" },
      { type: "save-file", name: "保存文件", detail: "保存内容到文件", badge: "File" },
      { type: "display", name: "显示", detail: "展示输入数据", badge: "Show" },
    ],
  },
  {
    title: "流程控制",
    items: [
      { type: "condition", name: "条件判断", detail: "if / else", badge: "Flow" },
      { type: "loop", name: "循环/Map", detail: "遍历集合", badge: "Flow" },
      { type: "end", name: "结束", detail: "输出最终结果", badge: "End" },
    ],
  },
];

const defaultConfigByType: Record<string, Record<string, unknown>> = {
  llm: { prompt: "Hello {{user}}", model: "gpt-4o-mini", outputPath: "vars.llm.text" },
  "llm-generic": {
    prompt: "Hello {{user}}",
    model: "gpt-4o-mini",
    baseURL: "https://api.openai.com/v1",
    inputSources: [{ mode: "source", format: "text", sourcePath: "", defaultValue: "", inputLabel: "Input 1" }],
    outputPath: "vars.llm.text",
  },
  "doubao-1-8": {
    prompt: "Hello {{user}}",
    model: "doubao-seed-1-8-251228",
    baseURL: "https://ark.cn-beijing.volces.com/api/v3",
    inputSources: [{ mode: "source", format: "text", sourcePath: "", defaultValue: "", inputLabel: "Input 1" }],
    outputPath: "vars.llm.text",
  },
  "llm-file": {
    prompt: "Summarize the file/image context.",
    model: "gpt-4o-mini",
    outputPath: "vars.llm_file.text",
    files: [],
    images: [],
    inputSources: [{ mode: "source", format: "text", sourcePath: "", defaultValue: "", inputLabel: "Input 1" }],
  },
  text: { template: "Hi {{user}}", outputPath: "vars.text" },
  condition: { expression: "ctx.flag === true" },
  loop: {
    itemsPath: "vars.list",
    destPath: "vars.loop.results",
    template: "item={{item}}",
  },
  http: { url: "https://httpbin.org/get", method: "GET", headers: {}, body: {}, outputPath: "vars.http" },
  file: { contentTemplate: "content {{value}}", filename: "output.txt", outputPath: "vars.file" },
  "save-file": { contentTemplate: "content {{value}}", filename: "output.txt", outputPath: "vars.file" },
  log: { message: "log: {{value}}" },
  display: { dataPath: "vars.time" },
  time: { outputPath: "vars.time" },
  start: { outputPath: "vars.trigger" },
  cron: { intervalSeconds: 60, outputPath: "vars.trigger" },
  webhook: { key: "my-webhook", outputPath: "vars.webhook" },
  "text-input": { value: "Hello", outputPath: "vars.input.text" },
  "image-input": { images: [], outputPath: "vars.input.images" },
  "text-output": {
    value: "",
    outputPath: "vars.output.text",
    inputSources: [
      {
        mode: "source",
        format: "text",
        sourcePath: "",
        defaultValue: "",
        inputLabel: "Text 1",
        outputLabel: "Text 1",
      },
    ],
  },
  "image-output": {
    outputPath: "vars.output.images",
    inputSources: [
      {
        mode: "source",
        format: "image",
        sourcePath: "",
        defaultValue: "",
        inputLabel: "Image 1",
        outputLabel: "Image 1",
      },
    ],
  },
  end: { dataPath: "", outputPath: "vars.output" },
  "image-placeholder": { outputPath: "vars.image" },
  "video-placeholder": { outputPath: "vars.video" },
  merge: {},
};

const tabs = [
  { id: "config", label: "配置" },
  { id: "input", label: "输入" },
  { id: "output", label: "输出" },
  { id: "props", label: "属性" },
];

const getTextOutputLabel = (
  source: Record<string, any> | undefined,
  idx: number,
  kind: "input" | "output",
) => {
  const fallback = `Text ${idx + 1}`;
  if (!source) return fallback;
  return String(kind === "input" ? source.inputLabel || fallback : source.outputLabel || fallback);
};

const normalizeTextOutputSources = (sources: Array<Record<string, any>>) =>
  (sources.length ? sources : [{}]).map((source, idx) => ({
    ...source,
    inputLabel: getTextOutputLabel(source, idx, "input"),
    outputLabel: getTextOutputLabel(source, idx, "output"),
  }));

const buildTextOutputInputsFromSources = (sources: Array<Record<string, any>>) =>
  (sources.length ? sources : [{}]).map((source, idx) => ({
    id: `text-${idx}`,
    label: getTextOutputLabel(source, idx, "input"),
  }));

const buildTextOutputOutputsFromSources = (sources: Array<Record<string, any>>) =>
  (sources.length ? sources : [{}]).map((source, idx) => ({
    id: `text-${idx}`,
    label: getTextOutputLabel(source, idx, "output"),
  }));

const getImageOutputLabel = (
  source: Record<string, any> | undefined,
  idx: number,
  kind: "input" | "output",
) => {
  const fallback = `Image ${idx + 1}`;
  if (!source) return fallback;
  return String(kind === "input" ? source.inputLabel || fallback : source.outputLabel || fallback);
};

const normalizeImageOutputSources = (sources: Array<Record<string, any>>) =>
  (sources.length ? sources : [{}]).map((source, idx) => ({
    ...source,
    format: source.format || "image",
    inputLabel: getImageOutputLabel(source, idx, "input"),
    outputLabel: getImageOutputLabel(source, idx, "output"),
  }));

const buildImageOutputInputsFromSources = (sources: Array<Record<string, any>>) =>
  (sources.length ? sources : [{}]).map((source, idx) => ({
    id: `image-${idx}`,
    label: getImageOutputLabel(source, idx, "input"),
  }));

const buildImageOutputOutputsFromSources = (sources: Array<Record<string, any>>) =>
  (sources.length ? sources : [{}]).map((source, idx) => ({
    id: `image-${idx}`,
    label: getImageOutputLabel(source, idx, "output"),
  }));

const formatNodeOutput = (value: unknown, limit = 800) => {
  if (value === undefined) return "";
  let text: string;
  if (typeof value === "string") {
    text = value;
  } else {
    try {
      const json = JSON.stringify(value, null, 2);
      text = json === undefined ? String(value) : json;
    } catch {
      text = String(value);
    }
  }
  if (text.length > limit) return `${text.slice(0, limit)}...`;
  return text;
};

const tryParseJson = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!["{", "[", "\""].includes(trimmed[0])) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
};

const unwrapJsonString = (value: unknown, maxDepth = 2) => {
  let current = value;
  let depth = 0;
  while (typeof current === "string" && depth < maxDepth) {
    const parsed = tryParseJson(current);
    if (parsed === null) break;
    current = parsed;
    depth += 1;
  }
  return current;
};

const extractImageUrlsFromText = (text: string) => {
  const matches = text.match(/https?:\/\/\S+/gi) || [];
  const cleaned = matches.map((url) => url.replace(/[),.;]+$/g, ""));
  const unique = Array.from(new Set(cleaned));
  return unique.filter((url) =>
    /(\.png|\.jpg|\.jpeg|\.webp|\.gif|\.bmp|\.svg)(\?.*)?$/i.test(url) ||
    /^https?:\/\/.+/i.test(url),
  );
};

const getByPath = (obj: any, pathStr: string) => {
  if (!pathStr) return obj;
  const keys = pathStr.split(".").filter(Boolean);
  let current: any = obj;
  for (let i = 0; i < keys.length; i += 1) {
    const key = keys[i];
    current = unwrapJsonString(current);
    if (current === undefined || current === null) return undefined;
    if (typeof current === "string") {
      if (key === "text") {
        current = current;
        continue;
      }
      return undefined;
    }
    if (typeof current !== "object") return undefined;
    current = (current as any)[key];
  }
  return unwrapJsonString(current);
};

const toTextValue = (value: unknown) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const buildTextOutputBlocks = (
  outputs: Record<string, unknown>,
  sources: Array<Record<string, any>>,
) => {
  return sources.map((source) => {
    if (!source) return { format: "text", value: "" };
    let val: unknown;
    if (source.mode === "const") {
      val = source.defaultValue;
    } else if (source.sourceNodeId && source.sourcePortId) {
      val = getByPath(outputs as any, `${source.sourceNodeId}.${source.sourcePortId}`);
      if (source.sourcePath) {
        val = getByPath(val, source.sourcePath);
      }
    }
    if (val === undefined && source.defaultValue !== undefined) {
      val = source.defaultValue;
    }
    const text = val === undefined || val === null ? "" : toTextValue(val);
    return { format: source.format || "text", value: text };
  }) as Array<{ format: "text" | "markdown" | "code"; value: string }>;
};

const extractImageUrls = (value: unknown): string[] => {
  const unwrapped = unwrapJsonString(value);
  if (unwrapped === undefined || unwrapped === null) return [];
  if (typeof unwrapped === "string") return unwrapped ? [unwrapped] : [];
  if (Array.isArray(unwrapped)) {
    return unwrapped.flatMap((item) => extractImageUrls(item));
  }
  if (typeof unwrapped === "object") {
    const maybeUrl = (unwrapped as any).url ?? (unwrapped as any).path;
    if (typeof maybeUrl === "string") return maybeUrl ? [maybeUrl] : [];
  }
  return [];
};

const buildImageOutputData = (
  outputs: Record<string, unknown>,
  sources: Array<Record<string, any>>,
) => {
  const images: string[] = [];
  const values: Array<unknown> = [];
  sources.forEach((source) => {
    if (!source) {
      values.push("");
      return;
    }
    let urls: string[] = [];
    if (source.mode === "const") {
      urls = extractImageUrls(source.defaultValue);
    } else if (source.mode === "all") {
      const refs = Array.isArray(source.sourceRefs) ? source.sourceRefs : [];
      refs.forEach((ref: any) => {
        if (!ref?.sourceNodeId || !ref?.sourcePortId) return;
        let val: unknown = getByPath(
          outputs as any,
          `${ref.sourceNodeId}.${ref.sourcePortId}`,
        );
        if (source.sourcePath) {
          val = getByPath(val, source.sourcePath);
        }
        urls.push(...extractImageUrls(val));
      });
      if (urls.length === 0 && source.defaultValue !== undefined) {
        urls = extractImageUrls(source.defaultValue);
      }
    } else if (source.sourceNodeId && source.sourcePortId) {
      let val: unknown = getByPath(
        outputs as any,
        `${source.sourceNodeId}.${source.sourcePortId}`,
      );
      if (source.sourcePath) {
        val = getByPath(val, source.sourcePath);
      }
      if (val === undefined && source.defaultValue !== undefined) {
        val = source.defaultValue;
      }
      urls = extractImageUrls(val);
    } else if (source.defaultValue !== undefined) {
      urls = extractImageUrls(source.defaultValue);
    }
    images.push(...urls);
    values.push(urls.length > 1 ? urls : urls[0] || "");
  });
  return { images, values };
};

const buildPreviewOutputsFromNodes = (nodes: Node<NodeData>[]) => {
  const outputs: Record<string, unknown> = {};
  nodes.forEach((node) => {
    const raw = node.data?.lastOutput;
    if (raw === undefined || raw === null || raw === "") return;
    const parsed = unwrapJsonString(raw);
    if (node.data.nodeType === "text-output") {
      const ports = node.data.outputs || [];
      const blocks = node.data.lastBlocks || [];
      if (ports.length > 0 && blocks.length > 0) {
        const mapped: Record<string, unknown> = {};
        ports.forEach((port, idx) => {
          const block = blocks[idx];
          mapped[port.id] = block?.value ?? parsed;
        });
        outputs[node.id] = mapped;
      } else if (typeof parsed === "string" && ports.length === 1) {
        outputs[node.id] = { [ports[0].id]: parsed };
      } else {
        outputs[node.id] = parsed;
      }
      return;
    }
    if (node.data.nodeType === "image-output") {
      const ports = node.data.outputs || [];
      const values = node.data.lastImageValues || [];
      if (ports.length > 0 && values.length > 0) {
        const mapped: Record<string, unknown> = {};
        ports.forEach((port, idx) => {
          mapped[port.id] = values[idx] ?? "";
        });
        outputs[node.id] = mapped;
      } else if (typeof parsed === "string" && ports.length === 1) {
        outputs[node.id] = { [ports[0].id]: parsed };
      } else {
        outputs[node.id] = parsed;
      }
      return;
    }
    if (typeof parsed === "string") {
      const ports = node.data.outputs || [];
      if (ports.length === 1) {
        outputs[node.id] = { [ports[0].id]: parsed };
      } else {
        outputs[node.id] = parsed;
      }
    } else {
      outputs[node.id] = parsed;
    }
  });
  return outputs;
};

type GuidelinesState = {
  x: number | null;
  y: number | null;
};

const Guidelines = ({ x, y }: GuidelinesState) => {
  const transform = useStore((state) => state.transform);
  const [tx, ty, zoom] = transform;
  const lineWidth = Math.max(0.5, 1 / zoom);
  return (
    <div
      className="guidelines-layer"
      style={{ transform: `translate(${tx}px, ${ty}px) scale(${zoom})` }}
    >
      {x !== null && (
        <div
          className="guideline vertical"
          style={{ left: x, borderLeftWidth: `${lineWidth}px` }}
        />
      )}
      {y !== null && (
        <div
          className="guideline horizontal"
          style={{ top: y, borderTopWidth: `${lineWidth}px` }}
        />
      )}
    </div>
  );
};

const WorkflowEditor = () => {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { id } = useParams<{ id?: string }>();
  const nodeTypes = useMemo<NodeTypes>(() => ({ default: DefaultNode }), []);
  const [workflowName, setWorkflowName] = useState("我的可视化工作流");
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [uploaded, setUploaded] = useState<Array<{ url: string; name: string }>>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("config");
  const [nodeRunResult, setNodeRunResult] = useState<string>("");
  const [runMessage, setRunMessage] = useState<string>("");
  const [runLogs, setRunLogs] = useState<Array<{ ts: string; level: string; message: string }>>(
    [],
  );
  const [runContext, setRunContext] = useState<Record<string, unknown> | null>(null);
  const [runStatus, setRunStatus] = useState<string>("");
  const [runId, setRunId] = useState<string>("");
  const [showLogs, setShowLogs] = useState<boolean>(true);
  const [logPanelPos, setLogPanelPos] = useState({ x: 24, y: 120 });
  const [isDraggingLogs, setIsDraggingLogs] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number; startX: number; startY: number } | null>(
    null,
  );
  const pollRef = useRef<number | null>(null);
  const [guidelines, setGuidelines] = useState<GuidelinesState>({ x: null, y: null });
  const saveTimer = useRef<number | null>(null);
  const storageKey = "workflow-editor-state-v1";
  const flowWrapperRef = useRef<HTMLDivElement | null>(null);
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const canvasRef = useRef<HTMLElement | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId],
  );

  // 只在没有从URL加载工作流时，才从localStorage加载
  useEffect(() => {
    // 如果URL中有id，不加载localStorage（等待从API加载）
    if (id) return;
    
    // 如果是新建项目（/workflow），清空所有状态，创建全新工作流
    // 注意：新建项目时不从localStorage加载，确保是全新的工作流
    setNodes([]);
    setEdges([]);
    setWorkflowId(null);
    setWorkflowName("我的可视化工作流");
  }, [id, setNodes, setEdges, setWorkflowId, setWorkflowName]);

  useEffect(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            nodes,
            edges,
            workflowId,
            savedAt: new Date().toISOString(),
          }),
        );
      } catch {
        // ignore
      }
    }, 250);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [nodes, edges, workflowId]);

  const addNode = (item: PaletteItem) => {
    const id = crypto.randomUUID();
    const wrapperRect = flowWrapperRef.current?.getBoundingClientRect();
    const centerClient = wrapperRect
      ? {
          x: wrapperRect.left + wrapperRect.width / 2,
          y: wrapperRect.top + wrapperRect.height / 2,
        }
      : { x: 400, y: 300 };
    const projected = reactFlowRef.current
      ? reactFlowRef.current.project(centerClient)
      : centerClient;
    const position = findFreePosition({
      x: Math.max(0, projected.x - 120),
      y: Math.max(0, projected.y - 80),
    });
    let inputs = [{ id: "in", label: "Data" }];
    let outputs = [{ id: "out", label: "Data" }];
    let variant = "generic";
    let badge: string | undefined;
    let preview: string | undefined;

    switch (item.type) {
      case "http":
        inputs = [
          { id: "url", label: "URL" },
          { id: "body", label: "Body" },
        ];
        outputs = [
          { id: "response", label: "Response" },
          { id: "body", label: "Body" },
          { id: "status", label: "Status" },
        ];
        variant = "http";
        badge = "POST";
        break;
      case "time":
        inputs = [];
        outputs = [{ id: "time", label: "Time" }];
        variant = "time";
        break;
      case "display":
        inputs = [{ id: "data", label: "Data" }];
        outputs = [];
        variant = "display";
        break;
      case "save-file":
        inputs = [
          { id: "content", label: "Content" },
          { id: "path", label: "Path" },
        ];
        outputs = [{ id: "result", label: "Result" }];
        variant = "save-file";
        break;
      case "start":
        inputs = [];
        outputs = [{ id: "out", label: "Data" }];
        variant = "start";
        break;
      case "cron":
        inputs = [];
        outputs = [{ id: "out", label: "Data" }];
        variant = "cron";
        badge = "Cron";
        break;
      case "webhook":
        inputs = [];
        outputs = [{ id: "out", label: "Data" }];
        variant = "webhook";
        badge = "HTTP";
        break;
      case "text-input":
        inputs = [{ id: "in", label: "Data" }];
        outputs = [{ id: "text", label: "Text" }];
        variant = "input";
        break;
      case "image-input":
        inputs = [{ id: "in", label: "Data" }];
        outputs = [{ id: "images", label: "Images" }];
        variant = "input";
        badge = "IMG";
        break;
      case "text-output":
        inputs = buildTextOutputInputsFromSources(
          normalizeTextOutputSources([
            {
              mode: "source",
              format: "text",
              sourcePath: "",
              defaultValue: "",
              inputLabel: "Text 1",
              outputLabel: "Text 1",
            },
          ]),
        );
        outputs = buildTextOutputOutputsFromSources(
          normalizeTextOutputSources([
            {
              mode: "source",
              format: "text",
              sourcePath: "",
              defaultValue: "",
              inputLabel: "Text 1",
              outputLabel: "Text 1",
            },
          ]),
        );
        variant = "output";
        break;
      case "image-output":
        inputs = buildImageOutputInputsFromSources(
          normalizeImageOutputSources([
            {
              mode: "source",
              format: "image",
              sourcePath: "",
              defaultValue: "",
              inputLabel: "Image 1",
              outputLabel: "Image 1",
            },
          ]),
        );
        outputs = buildImageOutputOutputsFromSources(
          normalizeImageOutputSources([
            {
              mode: "source",
              format: "image",
              sourcePath: "",
              defaultValue: "",
              inputLabel: "Image 1",
              outputLabel: "Image 1",
            },
          ]),
        );
        variant = "output";
        badge = "IMG";
        break;
      case "condition":
        inputs = [{ id: "in", label: "Data" }];
        outputs = [
          { id: "true", label: "True" },
          { id: "false", label: "False" },
        ];
        variant = "condition";
        break;
      case "loop":
        inputs = [{ id: "list", label: "List" }];
        outputs = [{ id: "result", label: "Result" }];
        variant = "loop";
        break;
      case "end":
        inputs = [{ id: "data", label: "Data" }];
        outputs = [];
        variant = "end";
        break;
      case "file":
        inputs = [{ id: "content", label: "Content" }];
        outputs = [{ id: "file", label: "File" }];
        variant = "save-file";
        break;
      case "llm":
      case "llm-file":
      case "llm-generic":
      case "doubao-1-8":
        inputs = [{ id: "input-0", label: "Input 1" }];
        // 默认输出端口，如果配置了 Doubao-Seed-1.8 模型，会在 useEffect 中自动更新
        outputs = [
          { id: "text", label: "Text" },
          { id: "fullResponse", label: "Full Response" },
        ];
        variant = "llm";
        break;
      case "log":
        inputs = [{ id: "data", label: "Data" }];
        outputs = [];
        variant = "display";
        break;
      default:
        break;
    }

    const defaultOutputMap: Record<string, { path: string }> = {};
    outputs.forEach((port) => {
      defaultOutputMap[port.id] = { path: `vars.${id}.${port.id}` };
    });

    setNodes((nds) => [
      ...nds,
      {
        id,
        type: "default",
        position,
        data: {
          label: item.name,
          nodeType: item.type,
          config: {
            ...(defaultConfigByType[item.type] || {}),
            outputMap: defaultOutputMap,
          },
          inputs,
          outputs,
          variant,
          badge,
          preview,
        },
      },
    ]);
  };

  const onConnect = useCallback(
    (params: Edge | Connection) => {
      // only allow source handle (red) -> target handle (green)
      if (!params.sourceHandle || !params.targetHandle) {
        alert("请从红色输出拖到绿色输入");
        return;
      }
      const sourceLabel = params.sourceHandle.replace("out-", "");
      const targetPort = params.targetHandle.replace("in-", "");
      const sourcePort = params.sourceHandle.replace("out-", "");
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            style: { stroke: "#60a5fa" },
            markerEnd: { type: MarkerType.ArrowClosed },
            label: sourceLabel,
          },
          eds,
        ),
      );
      if (params.target && params.source) {
        setNodes((nds) =>
          nds.map((n) => {
            if (n.id !== params.target) return n;
            if (
              (n.data.nodeType === "text-output" && targetPort.startsWith("text-")) ||
              (n.data.nodeType === "image-output" && targetPort.startsWith("image-"))
            ) {
              const sources =
                (n.data.config?.inputSources as Array<Record<string, any>>) || [];
              const index = Number(
                targetPort.replace(n.data.nodeType === "text-output" ? "text-" : "image-", ""),
              );
              const nextSources = [...sources];
              const baseLabel = n.data.nodeType === "text-output" ? "Text" : "Image";
              const existing = nextSources[index] || {
                mode: "source",
                format: n.data.nodeType === "text-output" ? "text" : "image",
                sourcePath: "",
                defaultValue: "",
                inputLabel: `${baseLabel} ${index + 1}`,
                outputLabel: `${baseLabel} ${index + 1}`,
              };
              const isAllMode = existing.mode === "all";
              nextSources[index] = {
                ...existing,
                mode: isAllMode ? "all" : "source",
                ...(isAllMode
                  ? {}
                  : {
                      sourceNodeId: params.source,
                      sourcePortId: sourcePort,
                    }),
              };
              if (n.data.nodeType === "image-output") {
                const refs = Array.isArray(nextSources[index].sourceRefs)
                  ? [...nextSources[index].sourceRefs]
                  : [];
                if (
                  !refs.some(
                    (ref) =>
                      ref?.sourceNodeId === params.source &&
                      ref?.sourcePortId === sourcePort,
                  )
                ) {
                  refs.push({ sourceNodeId: params.source, sourcePortId: sourcePort });
                }
                nextSources[index] = { ...nextSources[index], sourceRefs: refs };
              }
              const normalized =
                n.data.nodeType === "text-output"
                  ? normalizeTextOutputSources(
                      nextSources.length
                        ? nextSources
                        : [{ mode: "source", format: "text", sourcePath: "", defaultValue: "" }],
                    )
                  : normalizeImageOutputSources(
                      nextSources.length
                        ? nextSources
                        : [{ mode: "source", format: "image", sourcePath: "", defaultValue: "" }],
                    );
              const nextOutputPorts =
                n.data.nodeType === "text-output"
                  ? buildTextOutputOutputsFromSources(normalized)
                  : buildImageOutputOutputsFromSources(normalized);
              const outputMap = (n.data.config?.outputMap as Record<string, any>) || {};
              const nextOutputMap = { ...outputMap };
              nextOutputPorts.forEach((port) => {
                if (!nextOutputMap[port.id]?.path) {
                  nextOutputMap[port.id] = { path: `vars.${n.id}.${port.id}` };
                }
              });
              const outputs =
                (runContext as any)?._outputs ||
                buildPreviewOutputsFromNodes(nds as Node<NodeData>[]);
              const nextBlocks =
                n.data.nodeType === "text-output" && outputs && typeof outputs === "object"
                  ? buildTextOutputBlocks(outputs as Record<string, unknown>, normalized)
                  : n.data.lastBlocks;
              const nextImages =
                n.data.nodeType === "image-output" && outputs && typeof outputs === "object"
                  ? buildImageOutputData(outputs as Record<string, unknown>, normalized)
                  : null;
              return {
                ...n,
                data: {
                  ...n.data,
                  config: {
                    ...n.data.config,
                    inputSources: normalized,
                    outputMap: nextOutputMap,
                  },
                  inputs:
                    n.data.nodeType === "text-output"
                      ? buildTextOutputInputsFromSources(normalized)
                      : buildImageOutputInputsFromSources(normalized),
                  outputs: nextOutputPorts,
                  lastBlocks: nextBlocks,
                  lastImages: nextImages?.images ?? n.data.lastImages,
                  lastImageValues: nextImages?.values ?? n.data.lastImageValues,
                },
              };
            }
            // 处理 LLM 节点
            const isLLM = ["llm", "llm-file", "llm-generic", "doubao-1-8"].includes(
              n.data.nodeType,
            );
            if (isLLM && targetPort.startsWith("input-")) {
              const idx = Number(targetPort.replace("in-input-", ""));
              if (!Number.isNaN(idx)) {
                const sources = (n.data.config?.inputSources as Array<Record<string, any>>) || [];
                const nextSources = [...sources];
                while (nextSources.length <= idx) {
                  nextSources.push({
                    mode: "source",
                    format: "text",
                    sourcePath: "",
                    defaultValue: "",
                    inputLabel: `Input ${nextSources.length + 1}`,
                  });
                }
                nextSources[idx] = {
                  ...nextSources[idx],
                  mode: "source",
                  sourceNodeId: params.source,
                  sourcePortId: sourcePort,
                };
                const inputs = nextSources.map((_, i) => ({
                  id: `input-${i}`,
                  label: nextSources[i]?.inputLabel || `Input ${i + 1}`,
                }));
                return {
                  ...n,
                  data: {
                    ...n.data,
                    config: {
                      ...n.data.config,
                      inputSources: nextSources,
                    },
                    inputs,
                  },
                };
              }
            }
            const inputMap = (n.data.config?.inputMap as Record<string, any>) || {};
            return {
              ...n,
              data: {
                ...n.data,
                config: {
                  ...n.data.config,
                  inputMap: {
                    ...inputMap,
                    [targetPort]: {
                      mode: "source",
                      sourceNodeId: params.source,
                      sourcePortId: sourcePort,
                    },
                  },
                },
              },
            };
          }),
        );
      }
    },
    [],
  );

  const onEdgeDoubleClick = useCallback((_: unknown, edge: Edge) => {
    setEdges((eds) => eds.filter((e) => e.id !== edge.id));
  }, []);

  const findFreePosition = useCallback(
    (center: { x: number; y: number }) => {
      const step = 40;
      const maxRing = 8;
      const defaultSize = { w: 240, h: 180 };
      const getSize = (n: Node<NodeData>) => {
        const w =
          (n.style as any)?.width ||
          (n as any)?.width ||
          defaultSize.w;
        const h =
          (n.style as any)?.height ||
          (n as any)?.height ||
          defaultSize.h;
        return { w, h };
      };
      const overlaps = (pos: { x: number; y: number }) => {
        const rectA = {
          x1: pos.x,
          y1: pos.y,
          x2: pos.x + defaultSize.w,
          y2: pos.y + defaultSize.h,
        };
        return nodes.some((n) => {
          const size = getSize(n);
          const rectB = {
            x1: n.position.x,
            y1: n.position.y,
            x2: n.position.x + size.w,
            y2: n.position.y + size.h,
          };
          return !(
            rectA.x2 < rectB.x1 ||
            rectA.x1 > rectB.x2 ||
            rectA.y2 < rectB.y1 ||
            rectA.y1 > rectB.y2
          );
        });
      };
      if (!overlaps(center)) return center;
      for (let ring = 1; ring <= maxRing; ring += 1) {
        const dist = ring * step;
        const candidates = [
          { x: center.x + dist, y: center.y },
          { x: center.x - dist, y: center.y },
          { x: center.x, y: center.y + dist },
          { x: center.x, y: center.y - dist },
          { x: center.x + dist, y: center.y + dist },
          { x: center.x + dist, y: center.y - dist },
          { x: center.x - dist, y: center.y + dist },
          { x: center.x - dist, y: center.y - dist },
        ];
        for (const pos of candidates) {
          if (!overlaps(pos)) return pos;
        }
      }
      return center;
    },
    [nodes],
  );

  useEffect(() => {
    if (!isDraggingLogs) return;
    const handleMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setLogPanelPos({
        x: dragStartRef.current.x + dx,
        y: dragStartRef.current.y + dy,
      });
    };
    const handleUp = () => {
      setIsDraggingLogs(false);
      dragStartRef.current = null;
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isDraggingLogs]);

  // 生成并上传缩略图
  const generateAndUploadThumbnail = async (): Promise<string | null> => {
    if (!flowWrapperRef.current || !reactFlowRef.current || !canvasRef.current) {
      console.log('Missing refs for thumbnail generation');
      return null;
    }
    
    if (nodes.length === 0) {
      console.log('No nodes to capture, skipping thumbnail');
      return null;
    }
    
    try {
      const reactFlowInstance = reactFlowRef.current;
      
      // 先使用fitView确保所有节点可见
      reactFlowInstance.fitView({ padding: 0.2, duration: 0 });
      
      // 等待视图调整完成
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // 截取整个canvas区域（绿框位置）- 这是包含整个画布的容器
      const canvasElement = canvasRef.current;
      if (!canvasElement) {
        console.error('Could not find canvas element');
        return null;
      }
      
      // 获取canvas的实际尺寸
      const rect = canvasElement.getBoundingClientRect();
      console.log('Canvas size:', rect.width, 'x', rect.height);
      
      // 检查节点是否在DOM中
      const nodeElements = canvasElement.querySelectorAll('.react-flow__node');
      console.log('Found', nodeElements.length, 'node elements in DOM');
      
      if (nodeElements.length === 0) {
        console.error('No node elements found in DOM');
        return null;
      }
      
      // 直接截取整个canvas元素（网页层面，包含整个画布区域）
      const canvas = await html2canvas(canvasElement, {
        width: rect.width,
        height: rect.height,
        scale: 0.4, // 降低scale以生成合适的缩略图尺寸
        backgroundColor: '#f7f8fb', // 使用画布背景色
        logging: false,
        useCORS: true,
        allowTaint: true,
        onclone: (_clonedDoc, element) => {
          // 在克隆的元素中确保所有节点和边可见
          const clonedCanvas = element as HTMLElement;
          
          // 确保所有节点可见
          const clonedNodes = clonedCanvas.querySelectorAll('.react-flow__node');
          clonedNodes.forEach((node) => {
            const nodeEl = node as HTMLElement;
            nodeEl.style.opacity = '1';
            nodeEl.style.visibility = 'visible';
            nodeEl.style.display = 'block';
          });
          
          // 确保所有边可见
          const clonedEdges = clonedCanvas.querySelectorAll('.react-flow__edge');
          clonedEdges.forEach((edge) => {
            const edgeEl = edge as HTMLElement;
            edgeEl.style.opacity = '1';
            edgeEl.style.visibility = 'visible';
          });
          
          // 隐藏控制按钮和minimap（如果存在）
          const controls = clonedCanvas.querySelector('.react-flow__controls');
          if (controls) {
            (controls as HTMLElement).style.display = 'none';
          }
          const minimap = clonedCanvas.querySelector('.react-flow__minimap');
          if (minimap) {
            (minimap as HTMLElement).style.display = 'none';
          }
        },
      });

      console.log('Canvas generated, size:', canvas.width, 'x', canvas.height);

      // 转换为blob
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png', 0.9);
      });

      if (!blob) {
        console.error('Failed to convert canvas to blob');
        return null;
      }

      console.log('Blob created, size:', blob.size, 'bytes');

      // 上传到后端
      const formData = new FormData();
      formData.append('files', blob, `thumbnail-${Date.now()}.png`);
      
      const uploadRes = await apiFetch("/uploads", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        console.error('Failed to upload thumbnail:', errorText);
        return null;
      }

      const uploadData = await uploadRes.json();
      if (uploadData.files && uploadData.files.length > 0) {
        const thumbnailUrl = uploadData.files[0].url;
        console.log('Thumbnail uploaded successfully:', thumbnailUrl);
        return thumbnailUrl;
      }
      return null;
    } catch (err) {
      console.error('Error generating thumbnail:', err);
      return null;
    }
  };

  const handleSave = async (opts?: { silent?: boolean }) => {
    setIsSaving(true);
    try {
      // 生成并上传缩略图
      const thumbnailUrl = await generateAndUploadThumbnail();
      
      const payload = {
        name: workflowName,
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.data.nodeType,
          name: n.data.label,
          config: {
            ...(n.data.config || {}),
            // 保存节点位置
            position: n.position,
            // 保存节点variant和badge（用于恢复节点颜色）
            ...(n.data.variant ? { variant: n.data.variant } : {}),
            ...(n.data.badge ? { badge: n.data.badge } : {}),
          },
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          // 保存边的样式（animated和style）
          animated: e.animated || false,
          style: e.style || undefined,
        })),
        ...(thumbnailUrl ? { thumbnail: thumbnailUrl } : {}),
      };
      const saveOnce = async (useId: string | null) => {
        const res = await apiFetch(`/workflows${useId ? `/${useId}` : ""}`, {
          method: useId ? "PUT" : "POST",
          body: JSON.stringify(payload),
        });
        return res;
      };

      let res = await saveOnce(workflowId);
      if (res.status === 404 && workflowId) {
        // 后端已无此工作流，重建为新项目
        setWorkflowId(null);
        res = await saveOnce(null);
      }

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "保存失败");
      }
      const data = await res.json();
      setWorkflowId(data.id);
      // 如果URL中没有id，更新URL
      if (!id && data.id) {
        navigate(`/workflow/${data.id}`, { replace: true });
      }
      return data.id as string;
    } catch (err) {
      const message = err instanceof Error ? err.message : "保存失败";
      if (!opts?.silent) {
        alert(`保存失败: ${message}`);
      }
      throw err;
    } finally {
      setIsSaving(false);
    }
  };

  const handleGoHome = async () => {
    // 返回首页前自动保存
    try {
      await handleSave();
      // 保存成功后，等待一小段时间确保后端已更新，然后导航
      setTimeout(() => {
        navigate("/");
      }, 100);
    } catch (err) {
      console.error("Failed to save workflow:", err);
      // 即使保存失败，也允许返回首页（用户可能想放弃）
      const proceed = window.confirm("保存失败，是否仍要返回首页？");
      if (proceed) {
        navigate("/");
      }
    }
  };

  const handleNameChange = async (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setIsEditingName(false);
      return;
    }
    setWorkflowName(trimmed);
    setIsEditingName(false);
    // 如果工作流已保存，更新名称
    if (workflowId) {
      try {
        const res = await apiFetch(`/workflows/${workflowId}`);
        if (!res.ok) return;
        const workflow = await res.json();
        await apiFetch(`/workflows/${workflowId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: trimmed,
            nodes: workflow.nodes,
            edges: workflow.edges,
          }),
        });
      } catch (err) {
        console.error("Failed to update workflow name:", err);
      }
    }
  };

  const SNAP_THRESHOLD = 6;
  const GRID_SIZE = 20;
  const snapToGridValue = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;
  const getBounds = (node: any) => {
    const width = node.width ?? 200;
    const height = node.height ?? 90;
    const position = node.positionAbsolute ?? node.position;
    const x = snapToGridValue(position.x);
    const y = snapToGridValue(position.y);
    return {
      x,
      y,
      width,
      height,
      left: x,
      right: x + width,
      top: y,
      bottom: y + height,
      centerX: x + width / 2,
      centerY: y + height / 2,
    };
  };

  const onNodeDrag = useCallback(
    (_: unknown, dragNode: any) => {
      const others = nodes.filter((n) => n.id !== dragNode.id);
      if (!others.length) {
        setGuidelines({ x: null, y: null });
        return;
      }
      const rect = getBounds(dragNode);
      let guideX: number | null = null;
      let guideY: number | null = null;
      let snapX = rect.x;
      let snapY = rect.y;
      let bestDx = SNAP_THRESHOLD + 1;
      let bestDy = SNAP_THRESHOLD + 1;

      others.forEach((n) => {
        const b = getBounds(n);
        const xPairs = [
          { target: rect.left, guide: b.left, snap: b.left },
          { target: rect.centerX, guide: b.centerX, snap: b.centerX - rect.width / 2 },
          { target: rect.right, guide: b.right, snap: b.right - rect.width },
        ];
        xPairs.forEach((p) => {
          const delta = Math.abs(p.target - p.guide);
          if (delta <= SNAP_THRESHOLD && delta < bestDx) {
            bestDx = delta;
            guideX = p.guide;
            snapX = p.snap;
          }
        });

        const yPairs = [
          { target: rect.top, guide: b.top, snap: b.top },
          { target: rect.centerY, guide: b.centerY, snap: b.centerY - rect.height / 2 },
          { target: rect.bottom, guide: b.bottom, snap: b.bottom - rect.height },
        ];
        yPairs.forEach((p) => {
          const delta = Math.abs(p.target - p.guide);
          if (delta <= SNAP_THRESHOLD && delta < bestDy) {
            bestDy = delta;
            guideY = p.guide;
            snapY = p.snap;
          }
        });
      });

      setGuidelines({ x: guideX, y: guideY });
      snapX = snapToGridValue(snapX);
      snapY = snapToGridValue(snapY);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === dragNode.id
            ? { ...n, position: { x: snapX, y: snapY } }
            : n,
        ),
      );
    },
    [nodes, setNodes],
  );

  const onNodeDragStop = useCallback(() => {
    setGuidelines({ x: null, y: null });
  }, []);

  const updateInputMap = (portId: string, patch: Record<string, unknown>) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNodeId) return n;
        const inputMap = (n.data.config?.inputMap as Record<string, any>) || {};
        const current = inputMap[portId] || {};
        return {
          ...n,
          data: {
            ...n.data,
            config: {
              ...n.data.config,
              inputMap: {
                ...inputMap,
                [portId]: { ...current, ...patch },
              },
            },
          },
        };
      }),
    );
  };

  const updateInputLabel = (portId: string, label: string) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNodeId) return n;
        if (n.data.nodeType === "text-output" || n.data.nodeType === "image-output") {
          const sources =
            (n.data.config?.inputSources as Array<Record<string, any>>) || [];
          const idx = Number(portId.replace(n.data.nodeType === "text-output" ? "text-" : "image-", ""));
          if (Number.isNaN(idx) || !sources[idx]) return n;
          const next = [...sources];
          next[idx] = { ...next[idx], inputLabel: label };
          return {
            ...n,
            data: {
              ...n.data,
              config: { ...n.data.config, inputSources: next },
              inputs:
                n.data.nodeType === "text-output"
                  ? buildTextOutputInputsFromSources(next)
                  : buildImageOutputInputsFromSources(next),
            },
          };
        }
        const nextInputs = (n.data.inputs || []).map((p) =>
          p.id === portId ? { ...p, label } : p,
        );
        return { ...n, data: { ...n.data, inputs: nextInputs } };
      }),
    );
  };

  const updateTextOutputSources = (sources: Array<Record<string, unknown>>) => {
    if (!selectedNodeId) return;
    const nextSources = normalizeTextOutputSources(
      sources.length > 0
        ? (sources as Array<Record<string, any>>)
        : [{ mode: "source", format: "text", sourcePath: "", defaultValue: "" }],
    );
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNodeId) return n;
        const outputs =
          (runContext as any)?._outputs ||
          buildPreviewOutputsFromNodes(nds as Node<NodeData>[]);
        const nextBlocks =
          n.data.nodeType === "text-output" && outputs && typeof outputs === "object"
            ? buildTextOutputBlocks(outputs as Record<string, unknown>, nextSources as any)
            : n.data.lastBlocks;
        const nextOutputPorts = buildTextOutputOutputsFromSources(nextSources as any);
        const outputMap = (n.data.config?.outputMap as Record<string, any>) || {};
        const nextOutputMap = { ...outputMap };
        nextOutputPorts.forEach((port) => {
          if (!nextOutputMap[port.id]?.path) {
            nextOutputMap[port.id] = { path: `vars.${n.id}.${port.id}` };
          }
        });
        return {
          ...n,
          data: {
            ...n.data,
            config: {
              ...n.data.config,
              inputSources: nextSources,
              outputMap: nextOutputMap,
            },
            inputs:
              n.data.nodeType === "text-output"
                ? buildTextOutputInputsFromSources(nextSources as any)
                : n.data.inputs,
            outputs:
              n.data.nodeType === "text-output"
                ? nextOutputPorts
                : n.data.outputs,
            lastBlocks: nextBlocks,
          },
        };
      }),
    );
  };

  const updateLLMInputSources = (sources: Array<Record<string, unknown>>) => {
    if (!selectedNodeId) return;
    const nextSources = sources.length > 0
      ? (sources as Array<Record<string, any>>)
      : [{ mode: "source", format: "text", sourcePath: "", defaultValue: "" }];
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNodeId) return n;
        const inputs = nextSources.map((_, idx) => ({
          id: `input-${idx}`,
          label: nextSources[idx]?.inputLabel || `Input ${idx + 1}`,
        }));
        return {
          ...n,
          data: {
            ...n.data,
            config: {
              ...n.data.config,
              inputSources: nextSources,
            },
            inputs,
          },
        };
      }),
    );
  };

  const updateImageOutputSources = (sources: Array<Record<string, unknown>>) => {
    if (!selectedNodeId) return;
    const nextSources = normalizeImageOutputSources(
      sources.length > 0
        ? (sources as Array<Record<string, any>>)
        : [{ mode: "source", format: "image", sourcePath: "", defaultValue: "" }],
    );
    const refsByIndex: Record<number, Array<{ sourceNodeId: string; sourcePortId: string }>> = {};
    edges
      .filter(
        (e) =>
          e.target === selectedNodeId &&
          typeof e.targetHandle === "string" &&
          e.targetHandle.startsWith("in-image-"),
      )
      .forEach((e) => {
        const idx = Number(String(e.targetHandle).replace("in-image-", ""));
        if (Number.isNaN(idx)) return;
        const sourcePortId = String(e.sourceHandle || "").replace("out-", "");
        const list = refsByIndex[idx] || [];
        list.push({ sourceNodeId: e.source, sourcePortId });
        refsByIndex[idx] = list;
      });
    nextSources.forEach((source: any, idx) => {
      if (source.mode === "all") {
        source.sourceRefs = refsByIndex[idx] || [];
      }
    });
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNodeId) return n;
        const outputs =
          (runContext as any)?._outputs ||
          buildPreviewOutputsFromNodes(nds as Node<NodeData>[]);
        const nextOutputPorts = buildImageOutputOutputsFromSources(nextSources as any);
        const outputMap = (n.data.config?.outputMap as Record<string, any>) || {};
        const nextOutputMap = { ...outputMap };
        nextOutputPorts.forEach((port) => {
          if (!nextOutputMap[port.id]?.path) {
            nextOutputMap[port.id] = { path: `vars.${n.id}.${port.id}` };
          }
        });
        const nextImages =
          outputs && typeof outputs === "object"
            ? buildImageOutputData(outputs as Record<string, unknown>, nextSources as any)
            : null;
        return {
          ...n,
          data: {
            ...n.data,
            config: {
              ...n.data.config,
              inputSources: nextSources,
              outputMap: nextOutputMap,
            },
            inputs:
              n.data.nodeType === "image-output"
                ? buildImageOutputInputsFromSources(nextSources as any)
                : n.data.inputs,
            outputs:
              n.data.nodeType === "image-output"
                ? nextOutputPorts
                : n.data.outputs,
            lastImages: nextImages?.images ?? n.data.lastImages,
            lastImageValues: nextImages?.values ?? n.data.lastImageValues,
          },
        };
      }),
    );
  };

  const updateOutputMap = (portId: string, path: string) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNodeId) return n;
        const outputMap = (n.data.config?.outputMap as Record<string, any>) || {};
        return {
          ...n,
          data: {
            ...n.data,
            config: {
              ...n.data.config,
              outputMap: {
                ...outputMap,
                [portId]: { path },
              },
            },
          },
        };
      }),
    );
  };

  const updateOutputLabel = (portId: string, label: string) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNodeId) return n;
        if (n.data.nodeType === "text-output" || n.data.nodeType === "image-output") {
          const sources =
            (n.data.config?.inputSources as Array<Record<string, any>>) || [];
          const idx = Number(portId.replace(n.data.nodeType === "text-output" ? "text-" : "image-", ""));
          if (Number.isNaN(idx) || !sources[idx]) return n;
          const next = [...sources];
          next[idx] = { ...next[idx], outputLabel: label };
          return {
            ...n,
            data: {
              ...n.data,
              config: { ...n.data.config, inputSources: next },
              outputs:
                n.data.nodeType === "text-output"
                  ? buildTextOutputOutputsFromSources(next)
                  : buildImageOutputOutputsFromSources(next),
            },
          };
        }
        const nextOutputs = (n.data.outputs || []).map((p) =>
          p.id === portId ? { ...p, label } : p,
        );
        return { ...n, data: { ...n.data, outputs: nextOutputs } };
      }),
    );
  };

  const duplicateNode = () => {
    if (!selectedNode) return;
    const id = crypto.randomUUID();
    const position = {
      x: selectedNode.position.x + 40,
      y: selectedNode.position.y + 40,
    };
    const outputMap = (selectedNode.data.config?.outputMap as Record<string, any>) || {};
    const nextOutputMap: Record<string, any> = {};
    Object.entries(outputMap).forEach(([portId, entry]) => {
      const path = String(entry?.path || "");
      nextOutputMap[portId] = {
        ...entry,
        path: path ? path.replace(selectedNode.id, id) : path,
      };
    });
    setNodes((nds) => [
      ...nds,
      {
        ...selectedNode,
        id,
        position,
        selected: false,
        data: {
          ...selectedNode.data,
          label: `${selectedNode.data.label} 副本`,
          config: { ...selectedNode.data.config, outputMap: nextOutputMap },
        },
      },
    ]);
  };

  const deleteNode = () => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  };

  const runSingleNode = async () => {
    if (!selectedNode) return;
    setNodeRunResult("运行中...");
    try {
      const res = await apiFetch("/nodes/run", {
        method: "POST",
        body: JSON.stringify({
          node: {
            id: selectedNode.id,
            type: selectedNode.data.nodeType,
            name: selectedNode.data.label,
            config: selectedNode.data.config,
          },
          context: {},
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      if (typeof data.credits === "number") {
        setUser((prev: User | null) => (prev ? { ...prev, credits: data.credits } : prev));
      }
      const outputText = JSON.stringify(data.outputs || data.context || {}, null, 2);
      setNodeRunResult(outputText);
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNode.id ? { ...n, data: { ...n.data, lastOutput: outputText } } : n,
        ),
      );
    } catch (err: any) {
      setNodeRunResult(`错误: ${err.message}`);
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    setRunMessage("运行中...");
    setRunLogs([]);
    setRunContext(null);
    setRunStatus("queued");
    setShowLogs(true);
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, lastOutput: undefined } })),
    );
    try {
      const id = await handleSave({ silent: true });
      const res = await apiFetch(`/workflows/${id}/run`, {
        method: "POST",
        body: JSON.stringify({ context: {} }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRunId(data.runId);
      setRunStatus(data.status);
      setRunMessage(`运行已提交: ${data.runId}`);
      if (typeof data.credits === "number") {
        setUser((prev: User | null) => (prev ? { ...prev, credits: data.credits } : prev));
      }
    } catch (err: any) {
      setRunMessage(`运行失败: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const pollRun = useCallback(async (id: string) => {
    try {
      const res = await apiFetch(`/runs/${id}/logs`);
      if (!res.ok) return;
      const data = await res.json();
      setRunLogs(data.logs || []);
      setRunStatus(data.status || "");
      setRunContext(data.context || null);
      if (data.status === "queued" || data.status === "running") {
        // 流式输出时，更频繁地轮询以实时显示
        pollRef.current = window.setTimeout(() => pollRun(id), 300);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!runId) return;
    if (pollRef.current) window.clearTimeout(pollRef.current);
    pollRun(runId);
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [runId, pollRun]);

  useEffect(() => {
    if (!runContext) return;
    const outputs = (runContext as any)?._outputs;
    if (!outputs || typeof outputs !== "object") return;
    setNodes((nds) =>
      nds.map((n) => {
        const nodeOutput = (outputs as Record<string, unknown>)[n.id];
        if (nodeOutput === undefined) {
          if (!n.data.lastOutput) return n;
          return { ...n, data: { ...n.data, lastOutput: undefined } };
        }
        if (n.data.nodeType === "start") {
          let textOutput = "";
          if (typeof nodeOutput === "string") {
            textOutput = nodeOutput;
          } else if (nodeOutput && typeof nodeOutput === "object" && "out" in (nodeOutput as any)) {
            const outVal = (nodeOutput as any).out;
            textOutput = typeof outVal === "string" ? outVal : formatNodeOutput(outVal, Infinity);
          } else {
            textOutput = formatNodeOutput(nodeOutput, Infinity);
          }
          if (n.data.lastOutput === textOutput) return n;
          return { ...n, data: { ...n.data, lastOutput: textOutput } };
        }
        if (n.data.nodeType === "text-input") {
          let textOutput = "";
          if (typeof nodeOutput === "string") {
            textOutput = nodeOutput;
          } else if (nodeOutput && typeof nodeOutput === "object" && "text" in (nodeOutput as any)) {
            const outVal = (nodeOutput as any).text;
            textOutput = typeof outVal === "string" ? outVal : formatNodeOutput(outVal, Infinity);
          } else {
            textOutput = formatNodeOutput(nodeOutput, Infinity);
          }
          if (n.data.lastOutput === textOutput) return n;
          return { ...n, data: { ...n.data, lastOutput: textOutput } };
        }
        if (n.data.nodeType === "text-output") {
          const sources =
            (n.data.config?.inputSources as Array<Record<string, any>>) || [];
          const blocks = buildTextOutputBlocks(outputs as Record<string, unknown>, sources);
          return {
            ...n,
            data: {
              ...n.data,
              lastBlocks: blocks,
              lastOutput: formatNodeOutput(nodeOutput),
            },
          };
        }
        if (n.data.nodeType === "image-output") {
          const sources =
            (n.data.config?.inputSources as Array<Record<string, any>>) || [];
          const { images, values } = buildImageOutputData(
            outputs as Record<string, unknown>,
            sources,
          );
          return {
            ...n,
            data: {
              ...n.data,
              lastImages: images,
              lastImageValues: values,
              lastOutput: formatNodeOutput(nodeOutput),
            },
          };
        }
        // 对于 LLM 节点，支持流式输出，不限制字符长度
        const isLLM = ["llm", "llm-file", "llm-generic", "doubao-1-8"].includes(
          n.data.nodeType,
        );
        if (isLLM) {
          const model = String(n.data.config?.model || "");
          const isDoubaoSeed = /doubao-seed-1-8/i.test(model);
          
          if (isDoubaoSeed && typeof nodeOutput === "object" && nodeOutput !== null) {
            // Doubao-Seed-1.8: 分别提取 thinking 和 answer
            const thinking = (nodeOutput as any).thinking || "";
            const answer = (nodeOutput as any).answer || "";
            return {
              ...n,
              data: {
                ...n.data,
                lastOutput: answer || thinking || "", // 默认显示 answer，如果没有则显示 thinking
                lastThinking: thinking,
                lastAnswer: answer,
                status: runStatus === "running" ? "running" : n.data.status,
              },
            };
          } else {
            // 其他模型: 正常显示
            const formatted = formatNodeOutput(nodeOutput, Infinity);
            if (n.data.lastOutput === formatted) return n;
            return {
              ...n,
              data: {
                ...n.data,
                lastOutput: formatted,
                status: runStatus === "running" ? "running" : n.data.status,
              },
            };
          }
        }
        const formatted = formatNodeOutput(nodeOutput);
        if (n.data.lastOutput === formatted) return n;
        return { 
          ...n, 
          data: { 
            ...n.data, 
            lastOutput: formatted,
          } 
        };
      }),
    );
  }, [runContext, runStatus, setNodes]);

  useEffect(() => {
    setNodes((nds) => {
      let changed = false;
      const next = nds.map((n) => {
        // 处理 LLM 节点的 inputSources 和输出端口
        const isLLM = ["llm", "llm-file", "llm-generic", "doubao-1-8"].includes(
          n.data.nodeType,
        );
        if (isLLM) {
          // 检测模型配置，动态更新输出端口
          const model = String(n.data.config?.model || "");
          const isDoubaoSeed = /doubao-seed-1-8/i.test(model);
          const currentOutputs = n.data.outputs || [];
          const expectedOutputs = isDoubaoSeed
            ? [
                { id: "thinking", label: "Thinking" },
                { id: "answer", label: "Answer" },
              ]
            : [
                { id: "text", label: "Text" },
                { id: "fullResponse", label: "Full Response" },
              ];
          
          // 检查输出端口是否需要更新
          const outputsChanged =
            currentOutputs.length !== expectedOutputs.length ||
            currentOutputs.some(
              (port, idx) =>
                port.id !== expectedOutputs[idx]?.id || port.label !== expectedOutputs[idx]?.label,
            );
          
          if (outputsChanged) {
            changed = true;
            const outputMap = (n.data.config?.outputMap as Record<string, any>) || {};
            const newOutputMap: Record<string, any> = {};
            expectedOutputs.forEach((port) => {
              if (outputMap[port.id]?.path) {
                newOutputMap[port.id] = outputMap[port.id];
              } else {
                newOutputMap[port.id] = { path: `vars.${n.id}.${port.id}` };
              }
            });
            
            return {
              ...n,
              data: {
                ...n.data,
                config: { ...n.data.config, outputMap: newOutputMap },
                outputs: expectedOutputs,
              },
            };
          }
          
          const sources = (n.data.config?.inputSources as Array<Record<string, any>>) || [];
          const nextSources = [...sources];
          let sourceChanged = false;
          
          // 收集所有连接到 LLM 节点的边
          const connectedEdges = edges.filter(
            (e) =>
              e.target === n.id &&
              typeof e.targetHandle === "string" &&
              e.targetHandle.startsWith("in-input-"),
          );
          
          // 更新每个来源的配置
          connectedEdges.forEach((e) => {
            const idx = Number(String(e.targetHandle).replace("in-input-", ""));
            if (Number.isNaN(idx)) return;
            
            while (nextSources.length <= idx) {
              nextSources.push({
                mode: "source",
                format: "text",
                sourcePath: "",
                defaultValue: "",
                inputLabel: `Input ${nextSources.length + 1}`,
              });
            }
            
            const sourcePortId = String(e.sourceHandle || "").replace("out-", "");
            const existing = nextSources[idx] || {};
            if (
              existing.sourceNodeId !== e.source ||
              existing.sourcePortId !== sourcePortId
            ) {
              nextSources[idx] = {
                ...existing,
                mode: "source",
                sourceNodeId: e.source,
                sourcePortId,
              };
              sourceChanged = true;
            }
          });
          
          // 清理已断开的来源
          nextSources.forEach((source, idx) => {
            if (source.mode === "source" && source.sourceNodeId) {
              const hasEdge = connectedEdges.some(
                (e) =>
                  Number(String(e.targetHandle).replace("in-input-", "")) === idx &&
                  e.source === source.sourceNodeId &&
                  String(e.sourceHandle || "").replace("out-", "") === source.sourcePortId,
              );
              if (!hasEdge) {
                nextSources[idx] = {
                  ...source,
                  sourceNodeId: undefined,
                  sourcePortId: undefined,
                };
                sourceChanged = true;
              }
            }
          });
          
          if (sourceChanged) {
            changed = true;
            const inputs = nextSources.map((_, i) => ({
              id: `input-${i}`,
              label: nextSources[i]?.inputLabel || `Input ${i + 1}`,
            }));
            return {
              ...n,
              data: {
                ...n.data,
                config: {
                  ...n.data.config,
                  inputSources: nextSources,
                },
                inputs,
              },
            };
          }
          return n;
        }
        
        // 确保输入类节点具备输入端口（便于连线触发器）
        if (n.data.nodeType === "text-input" || n.data.nodeType === "image-input") {
          const inputs = n.data.inputs || [];
          const hasIn = inputs.some((p) => p.id === "in");
          if (!hasIn) {
            changed = true;
            return {
              ...n,
              data: {
                ...n.data,
                inputs: [{ id: "in", label: "Data" }],
              },
            };
          }
        }

        // 处理普通节点的 inputMap 清理（如 OpenAI 节点）
        if (n.data.nodeType !== "text-output" && n.data.nodeType !== "image-output") {
          const inputMap = (n.data.config?.inputMap as Record<string, any>) || {};
          const inputs = n.data.inputs || [];
          let inputMapChanged = false;
          const nextInputMap = { ...inputMap };
          
          // 检查每个输入端口，如果对应的边不存在，清理 inputMap
          inputs.forEach((input) => {
            const portId = input.id;
            const mapping = inputMap[portId];
            if (mapping && mapping.mode === "source" && mapping.sourceNodeId) {
              // 检查是否存在对应的边
              const hasEdge = edges.some(
                (e) =>
                  e.target === n.id &&
                  e.targetHandle === `in-${portId}` &&
                  e.source === mapping.sourceNodeId &&
                  e.sourceHandle === `out-${mapping.sourcePortId}`,
              );
              if (!hasEdge) {
                // 边已断开，清理 inputMap
                delete nextInputMap[portId];
                inputMapChanged = true;
              }
            }
          });
          
          if (inputMapChanged) {
            changed = true;
            return {
              ...n,
              data: {
                ...n.data,
                config: {
                  ...n.data.config,
                  inputMap: nextInputMap,
                },
              },
            };
          }
          return n;
        }
        const isText = n.data.nodeType === "text-output";
        const prefix = isText ? "text-" : "image-";
        const normalize = isText ? normalizeTextOutputSources : normalizeImageOutputSources;
        const buildInputs = isText
          ? buildTextOutputInputsFromSources
          : buildImageOutputInputsFromSources;
        const buildOutputs = isText
          ? buildTextOutputOutputsFromSources
          : buildImageOutputOutputsFromSources;
        const baseLabel = isText ? "Text" : "Image";
        const defaultSource = {
          mode: "source",
          format: isText ? "text" : "image",
          sourcePath: "",
          defaultValue: "",
          inputLabel: `${baseLabel} 1`,
          outputLabel: `${baseLabel} 1`,
        };
        const sources =
          (n.data.config?.inputSources as Array<Record<string, any>>) || [];
        const nextSources = [...sources];
        let maxIndex = sources.length - 1;
        const collectedRefs: Record<number, Array<{ sourceNodeId: string; sourcePortId: string }>> =
          {};
        edges
          .filter(
            (e) =>
              e.target === n.id &&
              typeof e.targetHandle === "string" &&
              e.targetHandle.startsWith(`in-${prefix}`),
          )
          .forEach((e) => {
            const idx = Number(String(e.targetHandle).replace(`in-${prefix}`, ""));
            if (Number.isNaN(idx)) return;
            maxIndex = Math.max(maxIndex, idx);
            const sourcePortId = String(e.sourceHandle || "").replace("out-", "");
            const existing = nextSources[idx] || {
              mode: "source",
              format: isText ? "text" : "image",
              sourcePath: "",
              defaultValue: "",
              inputLabel: `${baseLabel} ${idx + 1}`,
              outputLabel: `${baseLabel} ${idx + 1}`,
            };
            const isAllMode = existing.mode === "all";
            if (
              !isAllMode &&
              existing.mode !== "const" &&
              (existing.sourceNodeId !== e.source || existing.sourcePortId !== sourcePortId)
            ) {
              nextSources[idx] = {
                ...existing,
                mode: "source",
                sourceNodeId: e.source,
                sourcePortId,
              };
              changed = true;
            }
            if (!isText) {
              const list = collectedRefs[idx] || [];
              list.push({ sourceNodeId: e.source, sourcePortId });
              collectedRefs[idx] = list;
            }
          });
        const normalized = normalize(nextSources.length ? nextSources : [defaultSource]);
        const desiredLength = Math.max(1, maxIndex + 1, normalized.length);
        if (normalized.length !== desiredLength) {
          while (normalized.length < desiredLength) {
            (normalized as any[]).push({
              mode: "source",
              format: isText ? "text" : "image",
              sourcePath: "",
              defaultValue: "",
              inputLabel: `${baseLabel} ${normalized.length + 1}`,
              outputLabel: `${baseLabel} ${normalized.length + 1}`,
            });
          }
          changed = true;
        }
        if (!isText) {
          normalized.forEach((source: any, idx) => {
            const refs = collectedRefs[idx] || [];
            const current = Array.isArray(source.sourceRefs) ? source.sourceRefs : [];
            const same =
              current.length === refs.length &&
              current.every(
                (ref: any, rIdx: number) =>
                  ref?.sourceNodeId === refs[rIdx]?.sourceNodeId &&
                  ref?.sourcePortId === refs[rIdx]?.sourcePortId,
              );
            if (!same) {
              normalized[idx] = { ...source, sourceRefs: refs };
              changed = true;
            }
          });
        }
        if (!changed) return n;
        const nextOutputPorts = buildOutputs(normalized);
        const outputMap = (n.data.config?.outputMap as Record<string, any>) || {};
        const nextOutputMap = { ...outputMap };
        nextOutputPorts.forEach((port) => {
          if (!nextOutputMap[port.id]?.path) {
            nextOutputMap[port.id] = { path: `vars.${n.id}.${port.id}` };
          }
        });
        const outputs =
          (runContext as any)?._outputs ||
          buildPreviewOutputsFromNodes(nds as Node<NodeData>[]);
        const nextImages =
          !isText && outputs && typeof outputs === "object"
            ? buildImageOutputData(outputs as Record<string, unknown>, normalized)
            : null;
        return {
          ...n,
          data: {
            ...n.data,
            config: { ...n.data.config, inputSources: normalized, outputMap: nextOutputMap },
            inputs: buildInputs(normalized),
            outputs: nextOutputPorts,
            lastImages: nextImages?.images ?? n.data.lastImages,
            lastImageValues: nextImages?.values ?? n.data.lastImageValues,
          },
        };
      });
      return changed ? next : nds;
    });
  }, [edges, setNodes]);

  const handleConfigChange = (key: string, value: unknown) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNodeId) return n;
        const newConfig = { ...(n.data.config || {}), [key]: value };
        
        // 如果是 LLM 节点且修改了 model 字段，动态更新输出端口
        const isLLM = ["llm", "llm-file", "llm-generic", "doubao-1-8"].includes(
          n.data.nodeType,
        );
        if (isLLM && key === "model") {
          const model = String(value || "");
          const isDoubaoSeed = /doubao-seed-1-8/i.test(model);
          
          let newOutputs: Array<{ id: string; label: string }> = [];
          if (isDoubaoSeed) {
            // Doubao-Seed-1.8: 只有 Thinking 和 Answer 两个输出端口
            newOutputs = [
              { id: "thinking", label: "Thinking" },
              { id: "answer", label: "Answer" },
            ];
          } else {
            // 其他模型: Text 和 Full Response
            newOutputs = [
              { id: "text", label: "Text" },
              { id: "fullResponse", label: "Full Response" },
            ];
          }
          
          // 更新输出端口映射
          const outputMap = (n.data.config?.outputMap as Record<string, any>) || {};
          const newOutputMap: Record<string, any> = {};
          newOutputs.forEach((port) => {
            if (outputMap[port.id]?.path) {
              newOutputMap[port.id] = outputMap[port.id];
            } else {
              newOutputMap[port.id] = { path: `vars.${n.id}.${port.id}` };
            }
          });
          
          return {
            ...n,
            data: {
              ...n.data,
              config: { ...newConfig, outputMap: newOutputMap },
              outputs: newOutputs,
            },
          };
        }
        
        return { ...n, data: { ...n.data, config: newConfig } };
      }),
    );
  };

  const handleLabelChange = (label: string) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => (n.id === selectedNodeId ? { ...n, data: { ...n.data, label } } : n)),
    );
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    const res = await apiFetch("/uploads", { method: "POST", body: form });
    if (!res.ok) {
      alert("上传失败");
      return;
    }
    const data = await res.json();
    const list = (data.files || []).map((f: any) => ({ url: `${apiBase}${f.url}`, name: f.originalName }));
    setUploaded((prev) => [...prev, ...list]);
    return list;
  };

  const handleImageInputUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedNodeId) return;
    const uploadedFiles = await handleUpload(files);
    if (!uploadedFiles) return;
    const imageUrls = uploadedFiles.map((f: { url: string }) => f.url);
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== selectedNodeId) return n;
        const currentImages = (n.data.config?.images as string[]) || [];
        return {
          ...n,
          data: {
            ...n.data,
            config: { ...n.data.config, images: [...currentImages, ...imageUrls] },
          },
        };
      }),
    );
  };

  const handlePasteImage = async (e: ClipboardEvent) => {
    if (!selectedNodeId) return;
    const selectedNode = nodes.find((n) => n.id === selectedNodeId);
    if (!selectedNode || selectedNode.data.nodeType !== "image-input") return;

    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      const form = new FormData();
      imageFiles.forEach((f) => form.append("files", f));
      const res = await apiFetch("/uploads", { method: "POST", body: form });
      if (!res.ok) {
        alert("粘贴图片上传失败");
        return;
      }
      const data = await res.json();
      const imageUrls = (data.files || []).map((f: { url: string }) => `${apiBase}${f.url}`);
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== selectedNodeId) return n;
          const currentImages = (n.data.config?.images as string[]) || [];
          return {
            ...n,
            data: {
              ...n.data,
              config: { ...n.data.config, images: [...currentImages, ...imageUrls] },
            },
          };
        }),
      );
    }

    const text = e.clipboardData?.getData("text/plain") || "";
    const urlList = extractImageUrlsFromText(text);
    if (urlList.length > 0) {
      e.preventDefault();
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== selectedNodeId) return n;
          const currentImages = (n.data.config?.images as string[]) || [];
          return {
            ...n,
            data: {
              ...n.data,
              config: { ...n.data.config, images: [...currentImages, ...urlList] },
            },
          };
        }),
      );
    }
  };

  useEffect(() => {
    window.addEventListener("paste", handlePasteImage as any);
    return () => {
      window.removeEventListener("paste", handlePasteImage as any);
    };
  }, [selectedNodeId, nodes]);

  const renderConfigForm = () => {
    if (!selectedNode) return <div className="panel-text">选择节点以编辑配置</div>;
    const type = selectedNode.data.nodeType as string;
    const cfg = selectedNode.data.config || {};
        const isLLM = ["llm", "llm-file", "llm-generic", "doubao-1-8"].includes(type);

    return (
      <div className="form">
        <label className="field">
          <span>节点名称</span>
          <input value={selectedNode.data.label} onChange={(e) => handleLabelChange(e.target.value)} />
        </label>

        {isLLM ? (
          <>
            <label className="field">
              <span>Prompt</span>
              <textarea
                rows={4}
                value={String(cfg.prompt || "")}
                onChange={(e) => handleConfigChange("prompt", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Model</span>
              <input value={String(cfg.model || "")} onChange={(e) => handleConfigChange("model", e.target.value)} />
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                示例：gpt-4o-mini, doubao-seed-1-8-251228
              </div>
            </label>
            <label className="field">
              <span>Base URL</span>
              <input
                value={String(cfg.baseURL || "https://api.openai.com/v1")}
                onChange={(e) => handleConfigChange("baseURL", e.target.value)}
              />
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                标准 OpenAI: https://api.openai.com/v1<br />
                Doubao-Seed: https://ark.cn-beijing.volces.com/api/v3
              </div>
            </label>
            <label className="field">
              <span>API Key（可留空用环境变量）</span>
              <input
                type="password"
                value={String(cfg.apiKey || "")}
                onChange={(e) => handleConfigChange("apiKey", e.target.value)}
              />
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                Doubao 使用 ARK_API_KEY 环境变量，或在此处填写
              </div>
            </label>
            <label className="field">
              <span>输出路径</span>
              <input
                value={String(cfg.outputPath || "")}
                onChange={(e) => handleConfigChange("outputPath", e.target.value)}
              />
            </label>
            <label className="field">
              <span>文件 URLs (逗号分隔)</span>
              <input
                value={Array.isArray(cfg.files) ? cfg.files.join(",") : ""}
                onChange={(e) =>
                  handleConfigChange(
                    "files",
                    e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
            <label className="field">
              <span>图片 URLs (逗号分隔)</span>
              <input
                value={Array.isArray(cfg.images) ? cfg.images.join(",") : ""}
                onChange={(e) =>
                  handleConfigChange(
                    "images",
                    e.target.value
                      .split(",")
                      .map((v) => v.trim())
                      .filter(Boolean),
                  )
                }
              />
            </label>
          </>
        ) : null}

        {type === "text" && (
          <>
            <label className="field">
              <span>模板</span>
              <textarea
                rows={3}
                value={String(cfg.template || "")}
                onChange={(e) => handleConfigChange("template", e.target.value)}
              />
            </label>
            <label className="field">
              <span>输出路径</span>
              <input
                value={String(cfg.outputPath || "")}
                onChange={(e) => handleConfigChange("outputPath", e.target.value)}
              />
            </label>
          </>
        )}

        {type === "condition" && (
          <label className="field">
            <span>表达式（ctx 为上下文）</span>
            <input
              value={String(cfg.expression || "")}
              onChange={(e) => handleConfigChange("expression", e.target.value)}
            />
          </label>
        )}

        {type === "loop" && (
          <>
            <label className="field">
              <span>items 路径</span>
              <input
                value={String(cfg.itemsPath || "")}
                onChange={(e) => handleConfigChange("itemsPath", e.target.value)}
              />
            </label>
            <label className="field">
              <span>写入路径</span>
              <input
                value={String(cfg.destPath || "")}
                onChange={(e) => handleConfigChange("destPath", e.target.value)}
              />
            </label>
            <label className="field">
              <span>模板 (item 可用)</span>
              <textarea
                rows={3}
                value={String(cfg.template || "")}
                onChange={(e) => handleConfigChange("template", e.target.value)}
              />
            </label>
          </>
        )}

        {type === "end" && (
          <>
            <label className="field">
              <span>数据路径</span>
              <input
                value={String(cfg.dataPath || "")}
                onChange={(e) => handleConfigChange("dataPath", e.target.value)}
              />
            </label>
            <label className="field">
              <span>输出路径</span>
              <input
                value={String(cfg.outputPath || "")}
                onChange={(e) => handleConfigChange("outputPath", e.target.value)}
              />
            </label>
          </>
        )}

        {type === "log" && (
          <label className="field">
            <span>日志模板</span>
            <textarea
              rows={3}
              value={String(cfg.message || "")}
              onChange={(e) => handleConfigChange("message", e.target.value)}
            />
          </label>
        )}

        {type === "text-input" && (
          <>
            <label className="field">
              <span>文本内容</span>
              <textarea
                rows={3}
                value={String(cfg.value || "")}
                onChange={(e) => handleConfigChange("value", e.target.value)}
              />
            </label>
            <label className="field">
              <span>输出路径</span>
              <input
                value={String(cfg.outputPath || "")}
                onChange={(e) => handleConfigChange("outputPath", e.target.value)}
              />
            </label>
          </>
        )}

        {type === "image-input" && (
          <>
            <label className="field">
              <span>输出路径</span>
              <input
                value={String(cfg.outputPath || "")}
                onChange={(e) => handleConfigChange("outputPath", e.target.value)}
              />
            </label>
            <div className="upload-block">
              <div className="panel-title">图片管理</div>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleImageInputUpload(e.target.files)}
              />
              <div className="panel-text" style={{ marginTop: "8px", fontSize: "12px", color: "#6b7280" }}>
                支持上传多张图片，或选中节点后按 Ctrl+V 粘贴剪切板中的图片/图片URL（可多行）
              </div>
            </div>
          </>
        )}

        {type === "text-output" && (
          <>
            <label className="field">
              <span>默认文本</span>
              <textarea
                rows={3}
                value={String(cfg.value || "")}
                onChange={(e) => handleConfigChange("value", e.target.value)}
              />
            </label>
            <label className="field">
              <span>输出路径</span>
              <input
                value={String(cfg.outputPath || "")}
                onChange={(e) => handleConfigChange("outputPath", e.target.value)}
              />
            </label>
          </>
        )}

        {type === "image-output" && (
          <label className="field">
            <span>输出路径</span>
            <input
              value={String(cfg.outputPath || "")}
              onChange={(e) => handleConfigChange("outputPath", e.target.value)}
            />
          </label>
        )}

        {type === "http" && (
          <>
            <label className="field">
              <span>URL</span>
              <input value={String(cfg.url || "")} onChange={(e) => handleConfigChange("url", e.target.value)} />
            </label>
            <label className="field">
              <span>Method</span>
              <input
                value={String(cfg.method || "GET")}
                onChange={(e) => handleConfigChange("method", e.target.value)}
              />
            </label>
            <label className="field">
              <span>Headers (JSON)</span>
              <textarea
                rows={3}
                value={JSON.stringify(cfg.headers || {}, null, 2)}
                onChange={(e) => handleConfigChange("headers", JSON.parse(e.target.value || "{}"))}
              />
            </label>
            <label className="field">
              <span>Body (JSON)</span>
              <textarea
                rows={3}
                value={JSON.stringify(cfg.body || {}, null, 2)}
                onChange={(e) => handleConfigChange("body", JSON.parse(e.target.value || "{}"))}
              />
            </label>
            <label className="field">
              <span>输出路径</span>
              <input
                value={String(cfg.outputPath || "")}
                onChange={(e) => handleConfigChange("outputPath", e.target.value)}
              />
            </label>
          </>
        )}

        {(type === "file" || type === "save-file") && (
          <>
            <label className="field">
              <span>内容模板</span>
              <textarea
                rows={3}
                value={String(cfg.contentTemplate || "")}
                onChange={(e) => handleConfigChange("contentTemplate", e.target.value)}
              />
            </label>
            <label className="field">
              <span>文件名</span>
              <input
                value={String(cfg.filename || "")}
                onChange={(e) => handleConfigChange("filename", e.target.value)}
              />
            </label>
            <label className="field">
              <span>输出路径</span>
              <input
                value={String(cfg.outputPath || "")}
                onChange={(e) => handleConfigChange("outputPath", e.target.value)}
              />
            </label>
          </>
        )}

        {type === "display" && (
          <label className="field">
            <span>数据路径</span>
            <input
              value={String(cfg.dataPath || "")}
              onChange={(e) => handleConfigChange("dataPath", e.target.value)}
            />
          </label>
        )}

        {type === "time" && (
          <label className="field">
            <span>输出路径</span>
            <input
              value={String(cfg.outputPath || "")}
              onChange={(e) => handleConfigChange("outputPath", e.target.value)}
            />
          </label>
        )}

        {(type === "image-placeholder" || type === "video-placeholder") && (
          <label className="field">
            <span>输出路径</span>
            <input
              value={String(cfg.outputPath || "")}
              onChange={(e) => handleConfigChange("outputPath", e.target.value)}
            />
          </label>
        )}

        {type === "start" && (
          <label className="field">
            <span>输出路径</span>
            <input
              value={String(cfg.outputPath || "")}
              onChange={(e) => handleConfigChange("outputPath", e.target.value)}
            />
          </label>
        )}

        {type === "cron" && (
          <>
            <label className="field">
              <span>间隔秒数</span>
              <input
                value={String(cfg.intervalSeconds || 60)}
                onChange={(e) => handleConfigChange("intervalSeconds", Number(e.target.value || 0))}
              />
            </label>
            <label className="field">
              <span>输出路径</span>
              <input
                value={String(cfg.outputPath || "")}
                onChange={(e) => handleConfigChange("outputPath", e.target.value)}
              />
            </label>
          </>
        )}

        {type === "webhook" && (
          <>
            <label className="field">
              <span>Webhook Key</span>
              <input
                value={String(cfg.key || "")}
                onChange={(e) => handleConfigChange("key", e.target.value)}
              />
            </label>
            <label className="field">
              <span>输出路径</span>
              <input
                value={String(cfg.outputPath || "")}
                onChange={(e) => handleConfigChange("outputPath", e.target.value)}
              />
            </label>
          </>
        )}
      </div>
    );
  };

  const renderInputTab = () => {
    if (!selectedNode) return null;
    const cfg = selectedNode.data.config || {};
    const inputs = selectedNode.data.inputs || [];
    const isLLM = ["llm", "llm-file", "llm-generic", "doubao-1-8"].includes(
      selectedNode.data.nodeType,
    );

    if (isLLM) {
      const sources = (cfg.inputSources as Array<Record<string, any>>) || [];
      const incomingAll = edges.filter(
        (e) =>
          e.target === selectedNode.id &&
          typeof e.targetHandle === "string" &&
          e.targetHandle.startsWith("in-input-"),
      );
      const optionsByIndex = new Map<number, typeof incomingAll>();
      incomingAll.forEach((edge) => {
        const idx = Number(String(edge.targetHandle).replace("in-input-", ""));
        if (Number.isNaN(idx)) return;
        const list = optionsByIndex.get(idx) || [];
        list.push(edge);
        optionsByIndex.set(idx, list);
      });

      const buildOptions = (list: typeof incomingAll) =>
        list.map((e) => {
          const sourceNode = nodes.find((n) => n.id === e.source);
          const sourcePortId = (e.sourceHandle || "").replace("out-", "");
          const sourcePort = sourceNode?.data.outputs?.find((p) => p.id === sourcePortId);
          return {
            value: `${e.source}:${sourcePortId}`,
            label: `${sourceNode?.data.label || e.source} / ${sourcePort?.label || sourcePortId}`,
            sourceNodeId: e.source,
            sourcePortId,
          };
        });

      return (
        <div className="form">
          <div className="panel-title">输入来源</div>
          {sources.length === 0 && <div className="panel-text">暂无输入来源</div>}
          {sources.map((source, idx) => {
            const incoming = optionsByIndex.get(idx) || [];
            const options = buildOptions(incoming);
            return (
              <div className="io-row" key={`llm-input-source-${idx}`}>
                <div className="io-title">来源 {idx + 1}</div>
                <div className="io-grid">
                  <label className="field inline">
                    <span>输入名称</span>
                    <input
                      value={String(source.inputLabel || `Input ${idx + 1}`)}
                      onChange={(e) => {
                        const next = [...sources];
                        next[idx] = { ...next[idx], inputLabel: e.target.value };
                        updateLLMInputSources(next);
                      }}
                    />
                  </label>
                  <label className="field inline">
                    <span>来源</span>
                    <select
                      value={source.mode || (options.length ? "source" : "const")}
                      onChange={(e) => {
                        const next = [...sources];
                        next[idx] = { ...next[idx], mode: e.target.value };
                        updateLLMInputSources(next);
                      }}
                    >
                      <option value="source">上游</option>
                      <option value="const">常量</option>
                    </select>
                  </label>
                  {(source.mode || (options.length ? "source" : "const")) === "source" ? (
                    <>
                      <label className="field inline">
                        <span>节点/端口</span>
                        <select
                          value={
                            source.sourceNodeId && source.sourcePortId
                              ? `${source.sourceNodeId}:${source.sourcePortId}`
                              : options[0]?.value || ""
                          }
                          onChange={(e) => {
                            const [sourceNodeId, sourcePortId] = e.target.value.split(":");
                            const next = [...sources];
                            next[idx] = {
                              ...next[idx],
                              sourceNodeId,
                              sourcePortId,
                              mode: "source",
                            };
                            updateLLMInputSources(next);
                          }}
                        >
                          {options.length === 0 && <option value="">无上游连接</option>}
                          {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field inline">
                        <span>字段路径</span>
                        <input
                          value={String(source.sourcePath || "")}
                          onChange={(e) => {
                            const next = [...sources];
                            next[idx] = { ...next[idx], sourcePath: e.target.value };
                            updateLLMInputSources(next);
                          }}
                          placeholder="a.b.c"
                        />
                      </label>
                      <label className="field inline">
                        <span>默认值</span>
                        <input
                          value={String(source.defaultValue || "")}
                          onChange={(e) => {
                            const next = [...sources];
                            next[idx] = { ...next[idx], defaultValue: e.target.value };
                            updateLLMInputSources(next);
                          }}
                          placeholder="为空时使用"
                        />
                      </label>
                    </>
                  ) : (
                    <label className="field inline">
                      <span>常量值</span>
                      <input
                        value={String(source.defaultValue || "")}
                        onChange={(e) => {
                          const next = [...sources];
                          next[idx] = { ...next[idx], defaultValue: e.target.value, mode: "const" };
                          updateLLMInputSources(next);
                        }}
                        placeholder="文本内容"
                      />
                    </label>
                  )}
                  <label className="field inline">
                    <span>格式</span>
                    <select
                      value={String(source.format || "text")}
                      onChange={(e) => {
                        const next = [...sources];
                        next[idx] = { ...next[idx], format: e.target.value };
                        updateLLMInputSources(next);
                      }}
                    >
                      <option value="text">Text</option>
                      <option value="image">Image</option>
                      <option value="file">File</option>
                    </select>
                  </label>
                  <div className="field inline">
                    <button
                      className="panel-btn danger"
                      type="button"
                      onClick={() => {
                        const next = sources.filter((_, sIdx) => sIdx !== idx);
                        updateLLMInputSources(next);
                      }}
                    >
                      删除来源
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <button
            className="panel-btn"
            type="button"
            onClick={() => {
              const next = [
                ...sources,
                {
                  mode: "source",
                  format: "text",
                  sourcePath: "",
                  defaultValue: "",
                  inputLabel: `Input ${sources.length + 1}`,
                },
              ];
              updateLLMInputSources(next);
            }}
          >
            添加来源
          </button>
        </div>
      );
    }

    if (selectedNode.data.nodeType === "text-output") {
      const sources = (cfg.inputSources as Array<Record<string, any>>) || [];
          const incomingAll = edges.filter(
            (e) =>
              e.target === selectedNode.id &&
              typeof e.targetHandle === "string" &&
              e.targetHandle.startsWith("in-text-"),
          );
          const optionsByIndex = new Map<number, typeof incomingAll>();
          incomingAll.forEach((edge) => {
            const idx = Number(String(edge.targetHandle).replace("in-text-", ""));
            if (Number.isNaN(idx)) return;
            const list = optionsByIndex.get(idx) || [];
            list.push(edge);
            optionsByIndex.set(idx, list);
          });

          const buildOptions = (list: typeof incomingAll, sourceNodeId?: string) => {
            // 如果提供了 sourceNodeId，显示该节点的所有输出端口
            if (sourceNodeId) {
              const sourceNode = nodes.find((n) => n.id === sourceNodeId);
              if (sourceNode?.data.outputs) {
                return sourceNode.data.outputs.map((port) => ({
                  value: `${sourceNodeId}:${port.id}`,
                  label: `${sourceNode.data.label || sourceNodeId} / ${port.label || port.id}`,
                  sourceNodeId,
                  sourcePortId: port.id,
                }));
              }
            }
            // 否则，只显示已连接的端口
            return list.map((e) => {
              const sourceNode = nodes.find((n) => n.id === e.source);
              const sourcePortId = (e.sourceHandle || "").replace("out-", "");
              const sourcePort = sourceNode?.data.outputs?.find((p) => p.id === sourcePortId);
              return {
                value: `${e.source}:${sourcePortId}`,
                label: `${sourceNode?.data.label || e.source} / ${sourcePort?.label || sourcePortId}`,
                sourceNodeId: e.source,
                sourcePortId,
              };
            });
          };

      return (
        <div className="form">
          <div className="panel-title">输入来源</div>
          {sources.length === 0 && <div className="panel-text">暂无输入来源</div>}
          {sources.map((source, idx) => {
            const incoming = optionsByIndex.get(idx) || [];
            // 获取所有连接到该输入的源节点ID
            const connectedNodeIds = new Set(incoming.map((e) => e.source));
            // 如果有已选择的源节点，也包含它
            if (source.sourceNodeId) {
              connectedNodeIds.add(source.sourceNodeId);
            }
            // 构建选项：显示所有连接节点的所有输出端口
            const allOptions: Array<{ value: string; label: string; sourceNodeId: string; sourcePortId: string }> = [];
            connectedNodeIds.forEach((nodeId) => {
              const sourceNode = nodes.find((n) => n.id === nodeId);
              if (sourceNode?.data.outputs) {
                sourceNode.data.outputs.forEach((port) => {
                  allOptions.push({
                    value: `${nodeId}:${port.id}`,
                    label: `${sourceNode.data.label || nodeId} / ${port.label || port.id}`,
                    sourceNodeId: nodeId,
                    sourcePortId: port.id,
                  });
                });
              }
            });
            // 如果已有连接，也显示已连接的选项（保持兼容）
            const connectedOptions = buildOptions(incoming);
            // 合并选项，去重
            const optionsMap = new Map<string, typeof allOptions[0]>();
            connectedOptions.forEach((opt) => optionsMap.set(opt.value, opt));
            allOptions.forEach((opt) => optionsMap.set(opt.value, opt));
            const options = Array.from(optionsMap.values());
            
            return (
            <div className="io-row" key={`text-output-source-${idx}`}>
              <div className="io-title">来源 {idx + 1}</div>
              <div className="io-grid">
                <label className="field inline">
                  <span>输入名称</span>
                  <input
                    value={String(source.inputLabel || `Text ${idx + 1}`)}
                    onChange={(e) => {
                      const next = [...sources];
                      next[idx] = { ...next[idx], inputLabel: e.target.value };
                      updateTextOutputSources(next);
                    }}
                  />
                </label>
                <label className="field inline">
                  <span>来源</span>
                  <select
                    value={source.mode || (options.length ? "source" : "const")}
                    onChange={(e) => {
                      const next = [...sources];
                      next[idx] = { ...next[idx], mode: e.target.value };
                      updateTextOutputSources(next);
                    }}
                  >
                    <option value="source">上游</option>
                    <option value="const">常量</option>
                  </select>
                </label>
                {(source.mode || (options.length ? "source" : "const")) === "source" ? (
                  <>
                    <label className="field inline">
                      <span>节点/端口</span>
                      <select
                      value={
                        source.sourceNodeId && source.sourcePortId
                          ? `${source.sourceNodeId}:${source.sourcePortId}`
                          : options[0]?.value || ""
                      }
                      onChange={(e) => {
                        const [sourceNodeId, sourcePortId] = e.target.value.split(":");
                        const next = [...sources];
                          next[idx] = {
                            ...next[idx],
                            sourceNodeId,
                            sourcePortId,
                            mode: "source",
                          };
                          updateTextOutputSources(next);
                        }}
                      >
                        {options.length === 0 && <option value="">无上游连接</option>}
                        {options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field inline">
                      <span>字段路径</span>
                      <input
                        value={String(source.sourcePath || "")}
                        onChange={(e) => {
                          const next = [...sources];
                          next[idx] = { ...next[idx], sourcePath: e.target.value };
                          updateTextOutputSources(next);
                        }}
                        placeholder="a.b.c"
                      />
                    </label>
                    <label className="field inline">
                      <span>默认值</span>
                      <input
                        value={String(source.defaultValue || "")}
                        onChange={(e) => {
                          const next = [...sources];
                          next[idx] = { ...next[idx], defaultValue: e.target.value };
                          updateTextOutputSources(next);
                        }}
                        placeholder="为空时使用"
                      />
                    </label>
                  </>
                ) : (
                  <label className="field inline">
                    <span>常量值</span>
                    <input
                      value={String(source.defaultValue || "")}
                      onChange={(e) => {
                        const next = [...sources];
                        next[idx] = { ...next[idx], defaultValue: e.target.value, mode: "const" };
                        updateTextOutputSources(next);
                      }}
                      placeholder="123 / true / {}"
                    />
                  </label>
                )}
                <label className="field inline">
                  <span>格式</span>
                  <select
                    value={String(source.format || "text")}
                    onChange={(e) => {
                      const next = [...sources];
                      next[idx] = { ...next[idx], format: e.target.value };
                      updateTextOutputSources(next);
                    }}
                  >
                    <option value="text">Text</option>
                    <option value="markdown">Markdown</option>
                    <option value="code">代码块</option>
                  </select>
                </label>
                <div className="field inline">
                  <button
                    className="panel-btn danger"
                    type="button"
                    onClick={() => {
                      const next = sources.filter((_, sIdx) => sIdx !== idx);
                      updateTextOutputSources(next);
                    }}
                  >
                    删除来源
                  </button>
                </div>
              </div>
            </div>
          );
          })}
          <button
            className="panel-btn"
            type="button"
            onClick={() => {
              const next = [
                ...sources,
                {
                  mode: "source",
                  format: "text",
                  sourcePath: "",
                  defaultValue: "",
                  inputLabel: `Text ${sources.length + 1}`,
                  outputLabel: `Text ${sources.length + 1}`,
                },
              ];
              updateTextOutputSources(next);
            }}
          >
            添加来源
          </button>
        </div>
      );
    }

    if (selectedNode.data.nodeType === "image-output") {
      const sources = (cfg.inputSources as Array<Record<string, any>>) || [];
      const incomingAll = edges.filter(
        (e) =>
          e.target === selectedNode.id &&
          typeof e.targetHandle === "string" &&
          e.targetHandle.startsWith("in-image-"),
      );
      const optionsByIndex = new Map<number, typeof incomingAll>();
      incomingAll.forEach((edge) => {
        const idx = Number(String(edge.targetHandle).replace("in-image-", ""));
        if (Number.isNaN(idx)) return;
        const list = optionsByIndex.get(idx) || [];
        list.push(edge);
        optionsByIndex.set(idx, list);
      });
      const buildOptions = (list: typeof incomingAll) =>
        list.map((e) => {
          const sourceNode = nodes.find((n) => n.id === e.source);
          const sourcePortId = (e.sourceHandle || "").replace("out-", "");
          const sourcePort = sourceNode?.data.outputs?.find((p) => p.id === sourcePortId);
          return {
            value: `${e.source}:${sourcePortId}`,
            label: `${sourceNode?.data.label || e.source} / ${sourcePort?.label || sourcePortId}`,
            sourceNodeId: e.source,
            sourcePortId,
          };
        });

      return (
        <div className="form">
          <div className="panel-title">输入来源</div>
          {sources.length === 0 && <div className="panel-text">暂无输入来源</div>}
          {sources.map((source, idx) => {
            const incoming = optionsByIndex.get(idx) || [];
            const options = buildOptions(incoming);
            return (
              <div className="io-row" key={`image-output-source-${idx}`}>
                <div className="io-title">来源 {idx + 1}</div>
                <div className="io-grid">
                  <label className="field inline">
                    <span>输入名称</span>
                    <input
                      value={String(source.inputLabel || `Image ${idx + 1}`)}
                      onChange={(e) => {
                        const next = [...sources];
                        next[idx] = { ...next[idx], inputLabel: e.target.value };
                        updateImageOutputSources(next);
                      }}
                    />
                  </label>
                  <label className="field inline">
                    <span>来源</span>
                    <select
                      value={source.mode || (options.length ? "source" : "const")}
                      onChange={(e) => {
                        const next = [...sources];
                        next[idx] = { ...next[idx], mode: e.target.value };
                        updateImageOutputSources(next);
                      }}
                    >
                      <option value="source">上游</option>
                      <option value="all">所有</option>
                      <option value="const">常量</option>
                    </select>
                  </label>
                  {(source.mode || (options.length ? "source" : "const")) === "source" ? (
                    <>
                      <label className="field inline">
                        <span>节点/端口</span>
                        <select
                          value={
                            source.sourceNodeId && source.sourcePortId
                              ? `${source.sourceNodeId}:${source.sourcePortId}`
                              : options[0]?.value || ""
                          }
                          onChange={(e) => {
                            const [sourceNodeId, sourcePortId] = e.target.value.split(":");
                            const next = [...sources];
                            next[idx] = {
                              ...next[idx],
                              sourceNodeId,
                              sourcePortId,
                              mode: "source",
                            };
                            updateImageOutputSources(next);
                          }}
                        >
                          {options.length === 0 && <option value="">无上游连接</option>}
                          {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field inline">
                        <span>字段路径</span>
                        <input
                          value={String(source.sourcePath || "")}
                          onChange={(e) => {
                            const next = [...sources];
                            next[idx] = { ...next[idx], sourcePath: e.target.value };
                            updateImageOutputSources(next);
                          }}
                          placeholder="a.b.c"
                        />
                      </label>
                      <label className="field inline">
                        <span>默认值</span>
                        <input
                          value={String(source.defaultValue || "")}
                          onChange={(e) => {
                            const next = [...sources];
                            next[idx] = { ...next[idx], defaultValue: e.target.value };
                            updateImageOutputSources(next);
                          }}
                          placeholder="为空时使用"
                        />
                      </label>
                    </>
                  ) : (source.mode || (options.length ? "source" : "const")) === "all" ? (
                    <div className="field inline">
                      <span>上游连接</span>
                      <div className="panel-text">
                        {options.length === 0
                          ? "暂无连接"
                          : options.map((opt) => opt.label).join("、")}
                      </div>
                    </div>
                  ) : (
                    <label className="field inline">
                      <span>常量值</span>
                      <input
                        value={String(source.defaultValue || "")}
                        onChange={(e) => {
                          const next = [...sources];
                          next[idx] = { ...next[idx], defaultValue: e.target.value, mode: "const" };
                          updateImageOutputSources(next);
                        }}
                        placeholder="图片 URL / data:..."
                      />
                    </label>
                  )}
                  <label className="field inline">
                    <span>格式</span>
                    <select value="image" disabled>
                      <option value="image">Image</option>
                    </select>
                  </label>
                  <div className="field inline">
                    <button
                      className="panel-btn danger"
                      type="button"
                      onClick={() => {
                        const next = sources.filter((_, sIdx) => sIdx !== idx);
                        updateImageOutputSources(next);
                      }}
                    >
                      删除来源
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <button
            className="panel-btn"
            type="button"
            onClick={() => {
              const next = [
                ...sources,
                {
                  mode: "source",
                  format: "image",
                  sourcePath: "",
                  defaultValue: "",
                  inputLabel: `Image ${sources.length + 1}`,
                  outputLabel: `Image ${sources.length + 1}`,
                },
              ];
              updateImageOutputSources(next);
            }}
          >
            添加来源
          </button>
        </div>
      );
    }

    if (inputs.length === 0) return <div className="panel-text">无输入端口</div>;

    return (
      <div className="form">
        {inputs.map((port) => {
          const inputMap = (cfg.inputMap as Record<string, any>) || {};
          const mapping = inputMap[port.id] || {};
          const incoming = edges.filter(
            (e) => e.target === selectedNode.id && e.targetHandle === `in-${port.id}`,
          );
          const options = incoming.map((e) => {
            const sourceNode = nodes.find((n) => n.id === e.source);
            const sourcePortId = (e.sourceHandle || "").replace("out-", "");
            const sourcePort = sourceNode?.data.outputs?.find((p) => p.id === sourcePortId);
            return {
              value: `${e.source}:${sourcePortId}`,
              label: `${sourceNode?.data.label || e.source} / ${sourcePort?.label || sourcePortId}`,
              sourceNodeId: e.source,
              sourcePortId,
            };
          });
          const mode = mapping.mode || (options.length ? "source" : "const");

          return (
            <div className="io-row" key={`input-${port.id}`}>
              <div className="io-title">{port.label}</div>
              <div className="io-grid">
                <label className="field inline">
                  <span>输入名称</span>
                  <input
                    value={String(port.label || "")}
                    onChange={(e) => updateInputLabel(port.id, e.target.value)}
                  />
                </label>
                <label className="field inline">
                  <span>来源</span>
                  <select
                    value={mode}
                    onChange={(e) => updateInputMap(port.id, { mode: e.target.value })}
                  >
                    <option value="source">上游</option>
                    <option value="const">常量</option>
                  </select>
                </label>
                {mode === "source" ? (
                  <>
                    <label className="field inline">
                      <span>节点/端口</span>
                      <select
                        value={
                          mapping.sourceNodeId && mapping.sourcePortId
                            ? `${mapping.sourceNodeId}:${mapping.sourcePortId}`
                            : options[0]?.value || ""
                        }
                        onChange={(e) => {
                          const [sourceNodeId, sourcePortId] = e.target.value.split(":");
                          updateInputMap(port.id, { sourceNodeId, sourcePortId, mode: "source" });
                        }}
                      >
                        {options.length === 0 && <option value="">无上游连接</option>}
                        {options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field inline">
                      <span>字段路径</span>
                      <input
                        value={String(mapping.sourcePath || "")}
                        onChange={(e) =>
                          updateInputMap(port.id, { sourcePath: e.target.value, mode: "source" })
                        }
                        placeholder="a.b.c"
                      />
                    </label>
                    <label className="field inline">
                      <span>默认值</span>
                      <input
                        value={String(mapping.defaultValue || "")}
                        onChange={(e) =>
                          updateInputMap(port.id, { defaultValue: e.target.value })
                        }
                        placeholder="为空时使用"
                      />
                    </label>
                  </>
                ) : (
                  <label className="field inline">
                    <span>常量值</span>
                    <input
                      value={String(mapping.defaultValue || "")}
                      onChange={(e) =>
                        updateInputMap(port.id, { defaultValue: e.target.value, mode: "const" })
                      }
                      placeholder="123 / true / {}"
                    />
                  </label>
                )}
              </div>
            </div>
          );
        })}
        {["llm", "llm-file", "llm-generic", "doubao-1-8"].includes(
          selectedNode.data.nodeType,
        ) && (
          <div className="upload-block">
            <div className="panel-title">文件/图片上传</div>
            <input type="file" multiple onChange={(e) => handleUpload(e.target.files)} />
            <div className="upload-list">
              {uploaded.map((f) => (
                <div key={f.url} className="upload-item">
                  <code>{f.url}</code>
                  <div className="muted">{f.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderOutputTab = () => {
    if (!selectedNode) return null;
    const cfg = selectedNode.data.config || {};
    const outputs = selectedNode.data.outputs || [];
    if (outputs.length === 0) return <div className="panel-text">无输出端口</div>;

    return (
      <div className="form">
        {(selectedNode.data.nodeType === "text-output" ||
          selectedNode.data.nodeType === "image-output") && (
          <>
            <div className="panel-title">输出名称</div>
            {(cfg.inputSources as Array<Record<string, any>> | undefined)?.map(
              (source, idx) => (
                <div className="io-row" key={`output-label-${idx}`}>
                  <div className="io-title">{`输出 ${idx + 1}`}</div>
                  <div className="io-grid">
                    <label className="field inline">
                      <span>名称</span>
                      <input
                        value={String(
                          source?.outputLabel ||
                            `${selectedNode.data.nodeType === "text-output" ? "Text" : "Image"} ${
                              idx + 1
                            }`,
                        )}
                        onChange={(e) => {
                          const sources =
                            (cfg.inputSources as Array<Record<string, any>>) || [];
                          const next = [...sources];
                          next[idx] = { ...next[idx], outputLabel: e.target.value };
                          if (selectedNode.data.nodeType === "text-output") {
                            updateTextOutputSources(next);
                          } else {
                            updateImageOutputSources(next);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              ),
            )}
          </>
        )}
        {outputs.map((port) => {
          const outputMap = (cfg.outputMap as Record<string, any>) || {};
          const path = outputMap?.[port.id]?.path || "";
          return (
            <div className="io-row" key={`output-${port.id}`}>
              <div className="io-title">{port.label}</div>
              <div className="io-grid">
                {selectedNode.data.nodeType !== "text-output" &&
                  selectedNode.data.nodeType !== "image-output" && (
                  <label className="field inline">
                    <span>输出名称</span>
                    <input
                      value={String(port.label || "")}
                      onChange={(e) => updateOutputLabel(port.id, e.target.value)}
                    />
                  </label>
                )}
                <label className="field inline">
                  <span>写入路径</span>
                  <input
                    value={path}
                    onChange={(e) => updateOutputMap(port.id, e.target.value)}
                    placeholder={`vars.${selectedNode.id}.${port.id}`}
                  />
                </label>
              </div>
            </div>
          );
        })}
        {nodeRunResult && (
          <div className="node-preview">
            <div className="preview-title">单节点运行结果</div>
            <div className="preview-body">{nodeRunResult}</div>
          </div>
        )}
        {runContext && (
          <div className="node-preview">
            <div className="preview-title">工作流输出</div>
            <div className="preview-body">
              {JSON.stringify(
                (runContext as any)?.vars?.output ?? (runContext as any)?._outputs ?? runContext,
                null,
                2,
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderPropsTab = () => {
    if (!selectedNode) return null;
    const cfg = selectedNode.data.config || {};
    const meta = (cfg.meta as Record<string, any>) || {};
    return (
      <div className="form">
        <label className="field">
          <span>描述</span>
          <input
            value={String(meta.description || "")}
            onChange={(e) =>
              handleConfigChange("meta", { ...meta, description: e.target.value })
            }
          />
        </label>
        <label className="field">
          <span>超时(ms)</span>
          <input
            value={String(meta.timeoutMs || "")}
            onChange={(e) =>
              handleConfigChange("meta", { ...meta, timeoutMs: e.target.value })
            }
          />
        </label>
        <label className="field">
          <span>重试次数</span>
          <input
            value={String(meta.retry || "")}
            onChange={(e) => handleConfigChange("meta", { ...meta, retry: e.target.value })}
          />
        </label>
        <label className="field">
          <span>标签 (逗号分隔)</span>
          <input
            value={String(meta.tags || "")}
            onChange={(e) => handleConfigChange("meta", { ...meta, tags: e.target.value })}
          />
        </label>
      </div>
    );
  };

  // 加载工作流
  useEffect(() => {
    // 如果有id且还没有加载过，或者id变化了，需要加载
    if (id && (!hasLoaded || workflowId !== id)) {
      const loadWorkflow = async () => {
        try {
          setLoadError(null);
          // 先清空旧状态，避免显示旧数据
          setNodes([]);
          setEdges([]);
          
          const fetchWorkflow = async (cacheMode: RequestCache) => {
            const loadUrl = new URL(`${apiBase}/workflows/${id}`);
            // 强制绕过 CDN/浏览器缓存，避免 304 无内容导致空白
            loadUrl.searchParams.set("_ts", Date.now().toString());
            return apiFetch(loadUrl.toString(), {
              cache: cacheMode,
              headers: {
                "cache-control": "no-cache, no-store, must-revalidate",
                pragma: "no-cache",
                expires: "0",
              },
            });
          };

          let res = await fetchWorkflow("no-store");
          if (res.status === 304) {
            // 304 没有响应体，重试一次强制刷新缓存
            res = await fetchWorkflow("reload");
          }
          if (res.status === 404) {
            // 工作流不存在，清理ID，允许重新保存为新项目
            setWorkflowId(null);
            setWorkflowName("我的可视化工作流");
            setHasLoaded(true);
            setLoadError("工作流不存在或已被删除");
            return;
          }
          if (!res.ok) throw new Error("Failed to load workflow");
          const data = await res.json();
          
          console.log("Loading workflow:", data.id, "nodes:", data.nodes?.length, "edges:", data.edges?.length);
          
          setWorkflowName(data.name || "我的可视化工作流");
          setWorkflowId(data.id);
          setHasLoaded(true);
          setLoadError(null);
          
          // 转换节点，分配网格位置
          const GRID_X = 250;
          const GRID_Y = 120;
          const loadedNodes = (data.nodes || []).map((n: any, idx: number) => {
            if (!n || !n.id) {
              console.warn("Invalid node data:", n);
              return null;
            }
            const nodeType =
              n.type ||
              n.nodeType ||
              n.data?.nodeType ||
              n.data?.type ||
              n.data?.node_type;
            if (!nodeType) {
              console.warn("Missing node type, skipping:", n);
              return null;
            }
            const config = n.config || n.data?.config || {};
            let inputs = [{ id: "in", label: "Data" }];
            let outputs = [{ id: "out", label: "Data" }];
            
            // 根据节点类型设置输入输出
            if (nodeType === "text-output") {
              const sources = (config.inputSources as Array<Record<string, any>>) || [];
              const normalized = normalizeTextOutputSources(sources.length > 0 ? sources : [{}]);
              inputs = buildTextOutputInputsFromSources(normalized);
              outputs = buildTextOutputOutputsFromSources(normalized);
            } else if (nodeType === "image-output") {
              const sources = (config.inputSources as Array<Record<string, any>>) || [];
              const normalized = normalizeImageOutputSources(sources.length > 0 ? sources : [{}]);
              inputs = buildImageOutputInputsFromSources(normalized);
              outputs = buildImageOutputOutputsFromSources(normalized);
            } else if (nodeType === "text-input") {
              inputs = [{ id: "in", label: "Data" }];
              outputs = [{ id: "text", label: "Text" }];
            } else if (nodeType === "image-input") {
              inputs = [{ id: "in", label: "Data" }];
              outputs = [{ id: "images", label: "Images" }];
            }
            
            // 从config中恢复位置，如果没有则使用网格布局
            const savedPosition = (config.position as { x?: number; y?: number }) || null;
            const fallbackPosition = n.position as { x?: number; y?: number } | undefined;
            const isValidPosition = (pos?: { x?: number; y?: number }) =>
              typeof pos?.x === "number" && typeof pos?.y === "number";
            const position = isValidPosition(savedPosition)
              ? (savedPosition as { x: number; y: number })
              : isValidPosition(fallbackPosition)
              ? (fallbackPosition as { x: number; y: number })
              : {
                  x: (idx % 4) * GRID_X + 100,
                  y: Math.floor(idx / 4) * GRID_Y + 100,
                };
            
            // 从config或旧数据中恢复variant和badge
            const variant =
              (config.variant as string) || (n.data?.variant as string) || undefined;
            const badge = (config.badge as string) || (n.data?.badge as string) || undefined;
            // 从config中移除variant和badge（它们不应该在config中）
            const { variant: _, badge: __, ...cleanConfig } = config;
            
            return {
              id: n.id,
              type: "default",
              position,
              data: {
                nodeType,
                label: n.name || n.data?.label || n.data?.name || nodeType,
                config: cleanConfig,
                inputs,
                outputs,
                variant,
                badge,
                lastOutput: undefined,
                lastBlocks: [],
                lastImages: [],
                lastImageValues: [],
              },
            };
          }).filter((n: any): n is NonNullable<typeof n> => n !== null);
          
          // 转换边，需要根据实际连接的端口来确定handle
          const loadedEdges = (data.edges || []).map((e: any) => {
            if (!e || !e.id || !e.source || !e.target) {
              console.warn("Invalid edge data:", e);
              return null;
            }
            // 尝试从边的label或其他信息推断端口，如果没有则使用默认值
            const sourceNode = loadedNodes.find((n: any) => n.id === e.source);
            const targetNode = loadedNodes.find((n: any) => n.id === e.target);
            
            // 如果找不到源节点或目标节点，跳过这条边
            if (!sourceNode || !targetNode) {
              console.warn(`Edge ${e.id} references missing node: source=${e.source}, target=${e.target}`);
              return null;
            }
            
            // 对于text-output和image-output节点，需要根据配置确定端口
            let sourceHandle = "out";
            let targetHandle = "in";
            
            if (sourceNode) {
              const outputs = sourceNode.data.outputs || [];
              if (outputs.length > 0) {
                sourceHandle = outputs[0].id;
              }
            }
            
            if (targetNode) {
              const inputs = targetNode.data.inputs || [];
              if (inputs.length > 0) {
                targetHandle = inputs[0].id;
              }
              // 检查是否是LLM节点的input端口
              const isLLM = ["llm", "llm-file", "llm-generic", "doubao-1-8"].includes(
                targetNode.data.nodeType,
              );
              if (isLLM) {
                // LLM节点使用input-0, input-1等
                const sources = (targetNode.data.config?.inputSources as Array<Record<string, any>>) || [];
                const idx = sources.findIndex((s: any) => s.sourceNodeId === e.source);
                if (idx >= 0) {
                  targetHandle = `input-${idx}`;
                } else {
                  targetHandle = "input-0";
                }
              }
            }
            
            return {
              id: e.id,
              source: e.source,
              target: e.target,
              sourceHandle: `out-${sourceHandle}`,
              targetHandle: `in-${targetHandle}`,
              label: e.label,
              markerEnd: { type: MarkerType.ArrowClosed },
              // 恢复边的样式（animated和style）
              animated: (e as any).animated !== undefined ? (e as any).animated : true,
              style: (e as any).style || { stroke: "#60a5fa" },
            };
          }).filter((e: any): e is NonNullable<typeof e> => e !== null);
          
          console.log("Setting nodes:", loadedNodes.length, "edges:", loadedEdges.length);
          setNodes(loadedNodes);
          setEdges(loadedEdges);
        } catch (err) {
          console.error("Error loading workflow:", err);
          // 加载失败时，清空状态
          setNodes([]);
          setEdges([]);
          setWorkflowId(null);
          setWorkflowName("我的可视化工作流");
          setHasLoaded(true);
          setLoadError(err instanceof Error ? err.message : "无法加载工作流");
        }
      };
      loadWorkflow();
    } else if (!id) {
      // 如果从有id的页面导航到无id的页面（新建项目），清空状态
      setHasLoaded(false);
      setLoadError(null);
      if (workflowId) {
        setNodes([]);
        setEdges([]);
        setWorkflowId(null);
        setWorkflowName("我的可视化工作流");
      }
    }
  }, [id, workflowId, hasLoaded, setNodes, setEdges, setWorkflowId, setWorkflowName]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-left">
          <div className="logo-link" onClick={handleGoHome}>
            <div className="logo-icon-small">AW</div>
            <span className="logo-text-small">AAA WorkFlow</span>
          </div>
          {isEditingName ? (
            <input
              className="workflow-name-input"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              onBlur={() => handleNameChange(workflowName)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleNameChange(workflowName);
                } else if (e.key === "Escape") {
                  setIsEditingName(false);
                }
              }}
              autoFocus
            />
          ) : (
            <div 
              className="title workflow-name-editable" 
              onClick={() => setIsEditingName(true)}
              title="点击编辑名称"
            >
              {workflowName} *
            </div>
          )}
        </div>
        <div className="topbar-actions">
          {runMessage && <div className="run-message">{runMessage}</div>}
          {loadError && (
            <div
              className="run-message"
              style={{
                color: "#b91c1c",
                background: "#fef2f2",
                borderColor: "#fecaca",
              }}
            >
              加载失败：{loadError}
            </div>
          )}
          <button className="icon-btn" onClick={() => setShowLogs((v) => !v)}>
            运行日志
          </button>
          <button className="icon-btn" onClick={() => handleSave()} disabled={isSaving}>
            {isSaving ? "保存中" : "保存"}
          </button>
          <button className="icon-btn primary" onClick={handleRun} disabled={isRunning}>
            {isRunning ? "运行中" : "运行"}
          </button>
        </div>
      </header>

      <div className={`layout ${selectedNode ? "has-panel" : ""}`}>
        <aside className="sidebar">
          <div className="sidebar-header">
            <div className="sidebar-title">功能单元</div>
            <input
              className="sidebar-search"
              placeholder="搜索"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {palette.map((section) => (
            <div key={section.title} className="section">
              <div className="section-title">{section.title}</div>
              <div className="section-items">
                {section.items
                  .filter((item) => {
                    if (!searchTerm.trim()) return true;
                    const q = searchTerm.trim().toLowerCase();
                    return (
                      item.name.toLowerCase().includes(q) ||
                      item.detail.toLowerCase().includes(q)
                    );
                  })
                  .map((item) => (
                    <div
                      key={item.name}
                      className={`item ${item.placeholder ? "item-placeholder" : ""}`}
                      onClick={() => addNode(item)}
                    >
                      <div className="item-row">
                        <span className="item-name">{item.name}</span>
                        {item.badge && <span className="badge">{item.badge}</span>}
                      </div>
                      <div className="item-detail">{item.detail}</div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </aside>

        <main className="canvas" ref={canvasRef}>
          <div className="flow-wrapper" ref={flowWrapperRef}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onEdgeDoubleClick={onEdgeDoubleClick}
              onNodeDrag={onNodeDrag}
              onNodeDragStop={onNodeDragStop}
              onInit={(instance) => {
                reactFlowRef.current = instance;
              }}
              fitView
              onNodeClick={(_, n) => setSelectedNodeId(n.id)}
              nodeTypes={nodeTypes}
              deleteKeyCode={["Backspace", "Delete"]}
              edgesFocusable
              snapToGrid
              snapGrid={[20, 20]}
            >
              <Background variant={BackgroundVariant.Lines} color="#e5e7eb" gap={20} />
              <Controls position="bottom-left" />
              <MiniMap
                position="bottom-right"
                pannable
                zoomable
                style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}
              />
              <Guidelines x={guidelines.x} y={guidelines.y} />
            </ReactFlow>
            {showLogs && (
              <div
                className="run-log-panel"
                style={{ left: logPanelPos.x, top: logPanelPos.y }}
              >
                <div
                  className="run-log-header"
                  onMouseDown={(e) => {
                    setIsDraggingLogs(true);
                    dragStartRef.current = {
                      x: logPanelPos.x,
                      y: logPanelPos.y,
                      startX: e.clientX,
                      startY: e.clientY,
                    };
                  }}
                >
                  <div>
                    运行日志 {runStatus ? `(${runStatus})` : ""}{" "}
                    {runId ? `#${runId.slice(0, 6)}` : ""}
                  </div>
                </div>
                <div className="run-log-body">
                  {runLogs.length === 0 && <div className="muted">暂无日志</div>}
                  {runLogs.map((log, idx) => (
                    <div key={idx} className={`log-line ${log.level}`}>
                      <span>{new Date(log.ts).toLocaleTimeString()}</span> — {log.message}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        {selectedNode && (
          <aside className="panel">
            <div className="panel-header">
              <input
                className="panel-title-input"
                value={selectedNode.data.label}
                onChange={(e) => handleLabelChange(e.target.value)}
              />
              <div className="panel-actions">
                <button className="panel-btn" onClick={duplicateNode}>
                  复制
                </button>
                <button className="panel-btn" onClick={runSingleNode}>
                  运行
                </button>
                <button className="panel-btn danger" onClick={deleteNode}>
                  删除
                </button>
              </div>
            </div>
            <div className="panel-tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  className={`panel-tab ${activeTab === tab.id ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="panel-content">
              {activeTab === "config" && renderConfigForm()}
              {activeTab === "input" && renderInputTab()}
              {activeTab === "output" && renderOutputTab()}
              {activeTab === "props" && renderPropsTab()}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <AllProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workflow"
          element={
            <ProtectedRoute>
              <WorkflowEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/workflow/:id"
          element={
            <ProtectedRoute>
              <WorkflowEditor />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
