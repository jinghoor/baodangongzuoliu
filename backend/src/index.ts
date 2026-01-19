import cors from "cors";
import crypto from "crypto";
import express, { Request, Response } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import {
  CreditLog,
  ProviderConfig,
  Session,
  User,
  UserRole,
  WorkflowDefinition,
  WorkflowEdge,
  WorkflowNode,
  WorkflowRun,
} from "./types";

type RunLogLevel = "info" | "error";

const PORT = Number(process.env.PORT) || 1888;
const DATA_DIR = path.join(process.cwd(), "data");
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const WORKFLOWS_FILE = path.join(DATA_DIR, "workflows.json");
const RUNS_FILE = path.join(DATA_DIR, "runs.json");
const PROVIDERS_FILE = path.join(DATA_DIR, "providers.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const CREDIT_LOGS_FILE = path.join(DATA_DIR, "credit_logs.json");

const ensureDir = (dir: string) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

ensureDir(DATA_DIR);
ensureDir(UPLOAD_DIR);

const readJson = <T>(file: string, fallback: T): T => {
  if (!fs.existsSync(file)) return fallback;
  try {
    const content = fs.readFileSync(file, "utf8");
    return JSON.parse(content) as T;
  } catch (err) {
    console.error("Failed to read file", file, err);
    return fallback;
  }
};

const writeJson = (file: string, data: unknown) => {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
};

let workflows: WorkflowDefinition[] = readJson(WORKFLOWS_FILE, []);
let runs: WorkflowRun[] = readJson(RUNS_FILE, []);
let providers: ProviderConfig[] = readJson(PROVIDERS_FILE, []);
let users: User[] = readJson(USERS_FILE, []);
let sessions: Session[] = readJson(SESSIONS_FILE, []);
let creditLogs: CreditLog[] = readJson(CREDIT_LOGS_FILE, []);

const saveWorkflows = () => writeJson(WORKFLOWS_FILE, workflows);
const saveRuns = () => writeJson(RUNS_FILE, runs);
const saveProviders = () => writeJson(PROVIDERS_FILE, providers);
const saveUsers = () => writeJson(USERS_FILE, users);
const saveSessions = () => writeJson(SESSIONS_FILE, sessions);
const saveCreditLogs = () => writeJson(CREDIT_LOGS_FILE, creditLogs);

const scheduleMap = new Map<string, NodeJS.Timeout[]>();
const webhookMap = new Map<string, string[]>();

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));
// 禁用缓存，避免浏览器/代理返回 304 导致前端使用旧数据
app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

type AuthRequest = Request & { user?: User };

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const createPasswordHash = (password: string) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, 120000, 64, "sha512")
    .toString("hex");
  return { salt, hash };
};

const verifyPassword = (password: string, salt: string, hash: string) => {
  const nextHash = crypto
    .pbkdf2Sync(password, salt, 120000, 64, "sha512")
    .toString("hex");
  return crypto.timingSafeEqual(Buffer.from(nextHash, "hex"), Buffer.from(hash, "hex"));
};

const createToken = () => crypto.randomBytes(24).toString("hex");

const sanitizeUser = (user: User) => ({
  id: user.id,
  username: user.username,
  email: user.email,
  role: user.role,
  credits: user.credits,
  usedCredits: user.usedCredits,
  profile: user.profile,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

const findUserByIdentifier = (identifier: string) => {
  const normalized = identifier.includes("@")
    ? normalizeEmail(identifier)
    : identifier.trim();
  return users.find((u) =>
    identifier.includes("@") ? normalizeEmail(u.email) === normalized : u.username === normalized,
  );
};

const getUserFromRequest = (req: Request) => {
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return undefined;
  const session = sessions.find((s) => s.token === token);
  if (!session) return undefined;
  const user = users.find((u) => u.id === session.userId);
  if (!user) return undefined;
  session.lastUsedAt = new Date().toISOString();
  return user;
};

const requireAuth = (req: AuthRequest, res: Response, next: () => void) => {
  const user = getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  req.user = user;
  next();
};

const requireAdmin = (req: AuthRequest, res: Response, next: () => void) => {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ message: "Forbidden" });
    return;
  }
  next();
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${uuidv4()}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 30 * 1024 * 1024 },
});

const logRun = (run: WorkflowRun, level: RunLogLevel, message: string) => {
  const entry = { ts: new Date().toISOString(), level, message };
  run.logs.push(entry);
  run.updatedAt = entry.ts;
  saveRuns();
};

const formatBeijingTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
};

const createRun = (
  workflow: WorkflowDefinition,
  context: Record<string, unknown>,
  ownerId: string,
) => {
  const now = new Date().toISOString();
  const run: WorkflowRun = {
    id: uuidv4(),
    workflowId: workflow.id,
    ownerId,
    status: "queued",
    context,
    logs: [{ ts: now, level: "info", message: "Run queued" }],
    createdAt: now,
    updatedAt: now,
  };
  runs.push(run);
  saveRuns();
  setImmediate(() => {
    executeWorkflow(workflow, run).catch((err) => {
      run.status = "failed";
      logRun(run, "error", `Executor error: ${err.message}`);
    });
  });
  return run;
};

const tryParseJson = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed[0] || !["{", "[", "\""].includes(trimmed[0])) return null;
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

const getByPath = (obj: any, pathStr: string) => {
  if (!pathStr) return obj;
  // 支持数组索引语法，如 output[1].content[0].text
  const keys = pathStr.split(".").filter(Boolean);
  let current: any = obj;
  
  // 如果路径不是以 text 开头，且当前值是字符串，先尝试解析为 JSON
  // 这样可以处理字符串化的 JSON 响应
  if (keys.length > 0 && keys[0] !== "text" && typeof current === "string") {
    const parsed = tryParseJson(current);
    if (parsed !== null) {
      current = parsed;
    }
  }
  
  for (let i = 0; i < keys.length; i += 1) {
    let key = keys[i];
    // 在每次迭代前，如果当前值是字符串，尝试解析
    current = unwrapJsonString(current);
    if (current === undefined || current === null) return undefined;
    
    // 处理数组索引，如 output[1] 或 content[0]
    const arrayMatch = key.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch && arrayMatch[1] && arrayMatch[2]) {
      const arrayKey = arrayMatch[1];
      const arrayIndex = parseInt(arrayMatch[2], 10);
      
      // 先获取数组对象
      if (arrayKey) {
        // 如果当前值是字符串，尝试解析
        if (typeof current === "string") {
          const parsed = tryParseJson(current);
          if (parsed !== null) {
            current = parsed;
          } else {
            return undefined;
          }
        }
        if (typeof current !== "object" || current === null) return undefined;
        current = (current as any)[arrayKey];
        // 如果获取到的值还是字符串，继续解析
        if (typeof current === "string") {
          const parsed = tryParseJson(current);
          if (parsed !== null) {
            current = parsed;
          }
        }
      }
      
      // 然后访问数组索引
      if (!Array.isArray(current)) {
        // 如果当前值不是数组，尝试解析
        if (typeof current === "string") {
          const parsed = tryParseJson(current);
          if (parsed !== null && Array.isArray(parsed)) {
            current = parsed;
          } else {
            return undefined;
          }
        } else {
          return undefined;
        }
      }
      current = current[arrayIndex];
    } else {
      // 普通字段访问
      if (typeof current === "string") {
        // 如果是字符串，尝试解析为 JSON
        const parsed = tryParseJson(current);
        if (parsed !== null) {
          current = parsed;
        } else {
          // 如果无法解析且不是 "text" 字段，返回 undefined
          if (key === "text") {
            current = current;
            continue;
          }
          return undefined;
        }
      }
      if (typeof current !== "object" || current === null) return undefined;
      current = (current as any)[key];
    }
  }
  return unwrapJsonString(current);
};

const setByPath = (obj: any, pathStr: string, value: unknown) => {
  const keys = pathStr.split(".");
  let current = obj;
  keys.forEach((key, idx) => {
    if (idx === keys.length - 1) {
      current[key] = value;
    } else {
      if (!current[key] || typeof current[key] !== "object") current[key] = {};
      current = current[key];
    }
  });
};

const safeClone = (value: unknown) => {
  const seen = new WeakSet();
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, val) => {
        if (typeof val === "object" && val !== null) {
          if (seen.has(val)) return "[Circular]";
          seen.add(val);
        }
        return val;
      }),
    );
  } catch {
    return "[Unserializable]";
  }
};

const formatLogValue = (value: unknown, limit = 800) => {
  let text: string;
  if (typeof value === "string") {
    text = value;
  } else {
    try {
      const json = JSON.stringify(safeClone(value));
      text = json === undefined ? String(value) : json;
    } catch {
      text = String(value);
    }
  }
  if (text.length > limit) {
    return `${text.slice(0, limit)}...`;
  }
  return text;
};

const applyTemplate = (tpl: string, ctx: Record<string, unknown>) =>
  tpl.replace(/{{\s*([^}]+)\s*}}/g, (_m, p1) => {
    const value = getByPath(ctx, p1.trim());
    if (value === undefined || value === null) return "";
    if (typeof value === "object") return JSON.stringify(safeClone(value));
    return String(value);
  });

const parseLiteral = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (!Number.isNaN(Number(trimmed))) return Number(trimmed);
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
};

const formatTextBlock = (value: unknown, format: string) => {
  const text = toText(value);
  if (format === "markdown") return text;
  if (format === "code") return `\`\`\`\n${text}\n\`\`\``;
  return text;
};

const toText = (value: unknown) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return JSON.stringify(safeClone(value));
  return String(value);
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

// 将图片 URL 转换为 base64 格式
const convertImageUrlToBase64 = async (url: string): Promise<string | null> => {
  try {
    // 如果是本地文件路径（uploads 目录）
    if (url.startsWith("http://localhost:") || url.startsWith("http://127.0.0.1:")) {
      const urlObj = new URL(url);
      const urlPath = urlObj.pathname;
      const normalizedPath = urlPath.startsWith("/") ? urlPath.slice(1) : urlPath;
      const filePath = path.join(process.cwd(), normalizedPath);
      if (fs.existsSync(filePath)) {
        const imageBuffer = fs.readFileSync(filePath);
        const base64 = imageBuffer.toString("base64");
        // 根据文件扩展名确定 MIME 类型
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes: Record<string, string> = {
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".png": "image/png",
          ".gif": "image/gif",
          ".webp": "image/webp",
        };
        const mimeType = mimeTypes[ext] || "image/jpeg";
        return `data:${mimeType};base64,${base64}`;
      }
    }
    
    // 如果是远程 URL，尝试下载
    if (url.startsWith("http://") || url.startsWith("https://")) {
      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString("base64");
      const contentType = response.headers.get("content-type") || "image/jpeg";
      return `data:${contentType};base64,${base64}`;
    }
    
    // 如果已经是 base64 格式，直接返回
    if (url.startsWith("data:image/")) {
      return url;
    }
    
    return null;
  } catch (error) {
    return null;
  }
};

const resolveInputMap = (node: WorkflowNode, context: Record<string, unknown>) => {
  const inputMap = (node.config?.inputMap as Record<string, any>) || {};
  const mapped: Record<string, unknown> = {};
  Object.entries(inputMap).forEach(([portId, mapping]) => {
    if (!mapping) return;
    let val: unknown;
    if (mapping.mode === "const") {
      val = parseLiteral(mapping.defaultValue);
    } else if (mapping.sourceNodeId && mapping.sourcePortId) {
      val = getByPath(context, `_outputs.${mapping.sourceNodeId}.${mapping.sourcePortId}`);
      if (mapping.sourcePath) {
        val = getByPath(val, mapping.sourcePath);
      }
    }
    if (val === undefined && mapping.defaultValue !== undefined) {
      val = parseLiteral(mapping.defaultValue);
    }
    if (val !== undefined) {
      mapped[portId] = val;
    }
  });
  setByPath(context, `inputs.${node.id}`, mapped);
  return mapped;
};

const writeOutput = (
  node: WorkflowNode,
  portId: string,
  value: unknown,
  context: Record<string, unknown>,
) => {
  setByPath(context, `_outputs.${node.id}.${portId}`, safeClone(value));
  const outputMap = (node.config?.outputMap as Record<string, any>) || {};
  const path = outputMap?.[portId]?.path;
  if (path) setByPath(context, path, value);
};

const clearSchedules = (workflowId: string) => {
  const timers = scheduleMap.get(workflowId);
  if (!timers) return;
  timers.forEach((t) => clearInterval(t));
  scheduleMap.delete(workflowId);
};

const rebuildWebhookMap = () => {
  webhookMap.clear();
  workflows.forEach((wf) => {
    wf.nodes
      .filter((n) => n.type === "webhook")
      .forEach((node) => {
        const key = String(node.config?.key || "");
        if (!key) return;
        const list = webhookMap.get(key) || [];
        list.push(wf.id);
        webhookMap.set(key, list);
      });
  });
};

const registerSchedules = (workflow: WorkflowDefinition) => {
  clearSchedules(workflow.id);
  const timers: NodeJS.Timeout[] = [];
  workflow.nodes
    .filter((n) => n.type === "cron")
    .forEach((node) => {
      const intervalSeconds = Number(node.config?.intervalSeconds || 0);
      if (!intervalSeconds || intervalSeconds < 5) return;
      const timer = setInterval(() => {
        if (!workflow.ownerId) return;
        if (!consumeCredit(workflow.ownerId, "定时触发")) return;
        const context = {
          trigger: {
            type: "cron",
            nodeId: node.id,
            ts: new Date().toISOString(),
            intervalSeconds,
          },
        };
        createRun(workflow, context, workflow.ownerId);
      }, intervalSeconds * 1000);
      timers.push(timer);
    });
  if (timers.length) {
    scheduleMap.set(workflow.id, timers);
  }
};

const executeNode = async (
  node: WorkflowNode,
  context: Record<string, unknown>,
  run: WorkflowRun,
) => {
  const cfg = node.config || {};
  const mappedInputs = resolveInputMap(node, context);
  logRun(run, "info", `[${node.name}] inputs: ${formatLogValue(mappedInputs)}`);
  const effectiveConfig = { ...cfg };
  Object.entries(mappedInputs).forEach(([key, value]) => {
    if (key in effectiveConfig) {
      (effectiveConfig as any)[key] = value;
    }
  });
  switch (node.type) {
    case "start": {
      const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.trigger`;
      const triggerTime = new Date().toISOString();
      const triggerTimeText = formatBeijingTime(triggerTime);
      const payloadText =
        `触发时间：${triggerTimeText}\n` +
        `结束时间：\n` +
        `耗时(ms)：0\n` +
        `状态：运行中\n` +
        `日志：`;
      setByPath(context, outPath, payloadText);
      writeOutput(node, "out", payloadText, context);
      (context as any).trigger = { type: "manual", nodeId: node.id, ts: triggerTime };
      logRun(run, "info", `[${node.name}] start -> ${outPath}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "cron": {
      const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.trigger`;
      const payload =
        (context as any)?.trigger ?? {
          type: "cron",
          ts: new Date().toISOString(),
          intervalSeconds: effectiveConfig.intervalSeconds ?? null,
        };
      setByPath(context, outPath, payload);
      writeOutput(node, "out", payload, context);
      logRun(run, "info", `[${node.name}] cron -> ${outPath}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "webhook": {
      const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.webhook`;
      const payload = (context as any)?.webhook ?? { payload: null };
      setByPath(context, outPath, payload);
      writeOutput(node, "out", payload, context);
      logRun(run, "info", `[${node.name}] webhook -> ${outPath}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "text-input": {
      const value = effectiveConfig.value ?? "";
      const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.text`;
      setByPath(context, outPath, value);
      writeOutput(node, "text", value, context);
      logRun(run, "info", `[${node.name}] text-input -> ${outPath}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "image-input": {
      const images = (effectiveConfig.images as string[]) || [];
      const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.images`;
      setByPath(context, outPath, images);
      writeOutput(node, "images", images, context);
      logRun(run, "info", `[${node.name}] image-input -> ${outPath} (${images.length} images)`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "text-output": {
      const sources = (effectiveConfig.inputSources as Array<Record<string, any>>) || [];
      const blocks = sources.map((source, idx) => {
        if (!source) return { portId: `text-${idx}`, value: "" };
        let val: unknown;
        if (source.mode === "const") {
          val = parseLiteral(source.defaultValue);
        } else if (source.sourceNodeId && source.sourcePortId) {
          val = getByPath(context, `_outputs.${source.sourceNodeId}.${source.sourcePortId}`);
          if (source.sourcePath) {
            // 记录调试信息
            const originalVal = val;
            val = getByPath(val, source.sourcePath);
            // 如果路径解析失败，记录日志以便调试
            if (val === undefined && source.sourcePath) {
              const sourceNode = context._outputs?.[source.sourceNodeId];
              logRun(
                run,
                "info",
                `[${node.name}] Field path "${source.sourcePath}" failed. Source value type: ${typeof originalVal}, isString: ${typeof originalVal === "string"}, preview: ${typeof originalVal === "string" ? originalVal.substring(0, 100) : JSON.stringify(originalVal).substring(0, 100)}`,
              );
            }
          }
        }
        if (val === undefined && source.defaultValue !== undefined) {
          val = parseLiteral(source.defaultValue);
        }
        return {
          portId: `text-${idx}`,
          value: formatTextBlock(val, String(source.format || "text")),
        };
      });
      const formatted = blocks
        .map((block) => block.value)
        .filter((chunk) => chunk !== "")
        .join("\n\n");
      const value =
        formatted ||
        (mappedInputs.text !== undefined ? mappedInputs.text : effectiveConfig.value ?? "");
      const outPath = (effectiveConfig.outputPath as string) || "vars.output.text";
      setByPath(context, outPath, value);
      writeOutput(node, "out", value, context);
      blocks.forEach((block) => {
        writeOutput(node, block.portId, block.value, context);
      });
      logRun(run, "info", `[${node.name}] text-output -> ${outPath}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "image-output": {
      const sources = (effectiveConfig.inputSources as Array<Record<string, any>>) || [];
      const images: string[] = [];
      sources.forEach((source, idx) => {
        if (!source) return;
        let urls: string[] = [];
        if (source.mode === "const") {
          urls = extractImageUrls(parseLiteral(source.defaultValue));
        } else if (source.mode === "all") {
          const refs = Array.isArray(source.sourceRefs) ? source.sourceRefs : [];
          refs.forEach((ref: any) => {
            if (!ref?.sourceNodeId || !ref?.sourcePortId) return;
            let val: unknown = getByPath(
              context,
              `_outputs.${ref.sourceNodeId}.${ref.sourcePortId}`,
            );
            if (source.sourcePath) {
              val = getByPath(val, source.sourcePath);
            }
            urls.push(...extractImageUrls(val));
          });
          if (urls.length === 0 && source.defaultValue !== undefined) {
            urls = extractImageUrls(parseLiteral(source.defaultValue));
          }
        } else if (source.sourceNodeId && source.sourcePortId) {
          let val: unknown = getByPath(
            context,
            `_outputs.${source.sourceNodeId}.${source.sourcePortId}`,
          );
          if (source.sourcePath) {
            val = getByPath(val, source.sourcePath);
          }
          if (val === undefined && source.defaultValue !== undefined) {
            val = parseLiteral(source.defaultValue);
          }
          urls = extractImageUrls(val);
        } else if (source.defaultValue !== undefined) {
          urls = extractImageUrls(parseLiteral(source.defaultValue));
        }
        images.push(...urls);
        const portValue = urls.length > 1 ? urls : urls[0] || "";
        writeOutput(node, `image-${idx}`, portValue, context);
      });
      const outPath = (effectiveConfig.outputPath as string) || "vars.output.images";
      setByPath(context, outPath, images);
      logRun(run, "info", `[${node.name}] image-output -> ${outPath}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "end": {
      const dataPath = (effectiveConfig.dataPath as string) || "";
      const value =
        mappedInputs.data !== undefined
          ? mappedInputs.data
          : dataPath
          ? getByPath(context, dataPath)
          : safeClone(context);
      const outPath = (effectiveConfig.outputPath as string) || "vars.output";
      setByPath(context, outPath, value);
      writeOutput(node, "out", value, context);
      logRun(run, "info", `[${node.name}] end -> ${outPath}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "log": {
      const message =
        mappedInputs.data !== undefined
          ? String(mappedInputs.data)
          : applyTemplate((effectiveConfig.message as string) || "", context);
      logRun(run, "info", `[${node.name}] ${message}`);
      return { contextPatch: {} };
    }
    case "display": {
      const dataPath = (effectiveConfig.dataPath as string) || "";
      const value =
        mappedInputs.data !== undefined
          ? mappedInputs.data
          : dataPath
          ? getByPath(context, dataPath)
          : context;
      const message = formatLogValue(value);
      logRun(run, "info", `[${node.name}] ${message}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "time": {
      const now = new Date();
      const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.time`;
      const payload = {
        timestamp: now.getTime(),
        iso: now.toISOString(),
        formatted: now.toISOString().replace("T", " ").slice(0, 19),
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate(),
      };
      setByPath(context, outPath, payload);
      writeOutput(node, "time", payload, context);
      logRun(run, "info", `[${node.name}] time -> ${outPath}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "text": {
      const template =
        mappedInputs.in !== undefined
          ? toText(mappedInputs.in)
          : (effectiveConfig.template as string) || "";
      const message = applyTemplate(template, context);
      const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.text`;
      setByPath(context, outPath, message);
      writeOutput(node, "out", message, context);
      logRun(run, "info", `[${node.name}] text -> ${outPath}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "condition": {
      const expr = (effectiveConfig.expression as string) || "false";
      const fn = new Function("ctx", `return Boolean(${expr});`);
      const result = Boolean(fn(context));
      writeOutput(node, "true", result, context);
      writeOutput(node, "false", !result, context);
      logRun(run, "info", `[${node.name}] condition = ${result}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: { conditionResult: result }, conditionResult: result };
    }
    case "loop": {
      const itemsPath = (effectiveConfig.itemsPath as string) || "";
      const destPath = (effectiveConfig.destPath as string) || `vars.${node.id}.results`;
      const template = (effectiveConfig.template as string) || "{{item}}";
      const items = getByPath(context, itemsPath);
      if (!Array.isArray(items)) {
        logRun(run, "error", `[${node.name}] loop itemsPath not array`);
        return { contextPatch: {} };
      }
      const results = items.map((item) =>
        applyTemplate(template, { ...context, item }),
      );
      setByPath(context, destPath, results);
      writeOutput(node, "result", results, context);
      logRun(run, "info", `[${node.name}] loop -> ${destPath} (${results.length})`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "http": {
      const url = applyTemplate((effectiveConfig.url as string) || "", context);
      const method = ((effectiveConfig.method as string) || "GET").toUpperCase();
      const headers = (effectiveConfig.headers as Record<string, string>) || {};
      const body = effectiveConfig.body
        ? applyTemplate(JSON.stringify(effectiveConfig.body), context)
        : undefined;
      const requestInit: RequestInit = {
        method,
        headers: {
          "content-type": "application/json",
          ...headers,
        },
      };
      if (method !== "GET" && body !== undefined) {
        requestInit.body = body as any;
      }
      const res = await fetch(url, requestInit);
      const text = await res.text();
      let data: unknown = text;
      try {
        data = JSON.parse(text);
      } catch {
        /* ignore */
      }
      const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.response`;
      setByPath(context, outPath, data);
      writeOutput(node, "response", data, context);
      writeOutput(node, "body", data, context);
      writeOutput(node, "status", res.status, context);
      logRun(run, "info", `[${node.name}] http ${method} ${url} -> ${outPath}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "file":
    case "save-file": {
      const contentTpl =
        mappedInputs.content !== undefined
          ? toText(mappedInputs.content)
          : (effectiveConfig.contentTemplate as string) || "";
      const content = applyTemplate(contentTpl, context);
      const filename =
        mappedInputs.path !== undefined
          ? toText(mappedInputs.path)
          : (effectiveConfig.filename as string) || `${node.id}-${Date.now().toString(16)}.txt`;
      const target = path.join(UPLOAD_DIR, filename);
      fs.writeFileSync(target, content, "utf8");
      const url = `/uploads/${filename}`;
      const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.file`;
      setByPath(context, outPath, { path: target, url });
      const portId = node.type === "file" ? "file" : "result";
      writeOutput(node, portId, { path: target, url }, context);
      logRun(run, "info", `[${node.name}] file saved -> ${outPath}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "image-placeholder": {
      const url = `mock://image/${node.id}-${Date.now()}.png`;
      const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.image`;
      setByPath(context, outPath, { url, note: "placeholder image" });
      writeOutput(node, "out", { url }, context);
      logRun(run, "info", `[${node.name}] image placeholder -> ${outPath}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "video-placeholder": {
      const url = `mock://video/${node.id}-${Date.now()}.mp4`;
      const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.video`;
      setByPath(context, outPath, { url, note: "placeholder video" });
      writeOutput(node, "out", { url }, context);
      logRun(run, "info", `[${node.name}] video placeholder -> ${outPath}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    case "llm":
    case "llm-file":
    case "llm-generic":
    case "doubao-1-8":
    case "llm-claude": {
      const basePrompt = applyTemplate((effectiveConfig.prompt as string) || "", context);
      const rawBaseURL = (effectiveConfig.baseURL as string) || "https://api.openai.com/v1";
      const baseURL = rawBaseURL.replace(/\/+$/, ""); // 去掉末尾多余的 /
      const model = (effectiveConfig.model as string) || "gpt-4o-mini";
      // 检测是否是 Doubao 模型（通过模型名称或 baseURL）
      const isDoubao = /doubao/i.test(model) || /volces\.com/i.test(baseURL);
      const apiKey =
        (effectiveConfig.apiKey as string) ||
        (isDoubao ? process.env.DOUBAO_API_KEY : undefined) ||
        process.env.OPENAI_API_KEY ||
        process.env.DEFAULT_OPENAI_KEY;
      // 检测是否是 Doubao-Seed-1.8 模型（需要分离 Thinking 和 Answer）
      const isDoubaoSeed = /doubao-seed-1-8/i.test(model);
      
      const supportsVision =
        /(gpt-4o|gpt-4-vision|gpt-4\.1|gpt-5|vision|vl|gemini|doubao|qwen-vl|hunyuan|glm-4v|deepseek-vl)/i.test(
          model,
        );

      // 从 inputSources 按顺序收集不同格式的内容
      const inputSources = (effectiveConfig.inputSources as Array<Record<string, any>>) || [];
      
      // Doubao 使用不同的格式
      let doubaoContent: Array<{ type: string; text?: string; image_url?: string }> = [];
      let messageContent: Array<{ type: string; text?: string; image_url?: any }> = [];
      const textParts: string[] = [];
      
      // 如果有 basePrompt，先添加
      if (basePrompt) {
        textParts.push(basePrompt);
      }
      
      // 按顺序处理每个输入来源
      for (let idx = 0; idx < inputSources.length; idx++) {
        const source = inputSources[idx];
        let value: unknown = undefined;
        
        // 优先从 mappedInputs 获取值（兼容旧的 inputMap 方式）
        const portId = `input-${idx}`;
        if (mappedInputs[portId] !== undefined) {
          value = mappedInputs[portId];
        } else {
          // 从 inputSources 配置获取值
          if (source.mode === "const") {
            value = parseLiteral(source.defaultValue);
          } else if (source.sourceNodeId && source.sourcePortId) {
            value = getByPath(context, `_outputs.${source.sourceNodeId}.${source.sourcePortId}`);
            if (source.sourcePath) {
              value = getByPath(value, source.sourcePath);
            }
          }
        }
        
        // 如果值为空，使用默认值
        if (value === undefined && source.defaultValue !== undefined) {
          value = parseLiteral(source.defaultValue);
        }
        
        // 根据格式处理值
        const format = source.format || "text";
        if (format === "text" || format === "file") {
          // 文本或文件格式
          if (value !== undefined && value !== null) {
            let textValue = "";
            if (typeof value === "string") {
              textValue = value;
            } else if (Array.isArray(value)) {
              textValue = value.map((v) => (typeof v === "string" ? v : String(v))).join("\n");
            } else {
              textValue = String(value);
            }
            if (format === "file") {
              textValue = `[file] ${textValue}`;
            }
            if (textValue.trim()) {
              textParts.push(textValue.trim());
            }
          }
        } else if (format === "image") {
          // 如果模型不支持视觉，降级为文本提示
          if (!supportsVision) {
            const count =
              typeof value === "string" ? 1 : Array.isArray(value) ? value.length : value ? 1 : 0;
            textParts.push(
              `[附带 ${count} 张图片，当前模型 ${model} 不支持视觉输入，请使用 gpt-4o 等支持图像的模型]`,
            );
            continue;
          }
          // 图片格式
          if (value !== undefined && value !== null) {
            // 如果有待添加的文本，先添加文本
            if (textParts.length > 0) {
              if (isDoubao) {
                doubaoContent.push({ type: "input_text", text: textParts.join("\n\n") });
              } else {
                messageContent.push({ type: "text", text: textParts.join("\n\n") });
              }
              textParts.length = 0;
            }
            
            // 处理图片
            const processImage = async (imageUrl: string) => {
              if (isDoubao) {
                // Doubao: 本地/不可公网访问 URL 需要转为 base64
                const isLocal =
                  imageUrl.startsWith("http://localhost:") ||
                  imageUrl.startsWith("http://127.0.0.1:") ||
                  imageUrl.startsWith("https://localhost:") ||
                  imageUrl.startsWith("https://127.0.0.1:");
                if (isLocal) {
                  const base64 = await convertImageUrlToBase64(imageUrl);
                  if (base64) {
                    doubaoContent.push({ type: "input_image", image_url: base64 });
                  } else {
                    // 转换失败则回退原始 URL
                    logRun(
                      run,
                      "info",
                      `[${node.name}] Failed to convert local image to base64, using original URL: ${imageUrl}`,
                    );
                    doubaoContent.push({ type: "input_image", image_url: imageUrl });
                  }
                } else {
                  // 公网 URL 直接使用
                  doubaoContent.push({ type: "input_image", image_url: imageUrl });
                }
              } else {
                // 标准格式：转换为 base64
                const base64 = await convertImageUrlToBase64(imageUrl);
                if (base64) {
                  messageContent.push({ type: "image_url", image_url: { url: base64 } });
                } else {
                  // 如果转换失败，尝试使用原始 URL
                  logRun(run, "info", `[${node.name}] Failed to convert image to base64, using original URL: ${imageUrl}`);
                  messageContent.push({ type: "image_url", image_url: { url: imageUrl } });
                }
              }
            };
            
            if (typeof value === "string") {
              await processImage(value);
            } else if (Array.isArray(value)) {
              for (const item of value) {
                const url = typeof item === "string" ? item : (item as any)?.url;
                if (url) {
                  await processImage(url);
                }
              }
            } else if (typeof value === "object" && (value as any).url) {
              await processImage((value as any).url);
            }
          }
        }
      }
      
      // 添加剩余的文本
      if (textParts.length > 0) {
        if (isDoubao) {
          doubaoContent.push({ type: "input_text", text: textParts.join("\n\n") });
        } else {
          messageContent.push({ type: "text", text: textParts.join("\n\n") });
        }
      }
      
      // 兼容旧的配置方式
      const files = (effectiveConfig.files as string[]) || [];
      const images = (effectiveConfig.images as string[]) || [];
      if (files.length > 0 || images.length > 0) {
        files.forEach((url) => {
          if (isDoubao) {
            doubaoContent.push({ type: "input_text", text: `[file] ${url}` });
          } else {
            messageContent.push({ type: "text", text: `[file] ${url}` });
          }
        });
        images.forEach((url) => {
          if (isDoubao) {
            doubaoContent.push({ type: "input_image", image_url: url });
          } else {
            messageContent.push({ type: "image_url", image_url: { url } });
          }
        });
      }

      // 确保内容不为空
      if (isDoubao && doubaoContent.length === 0) {
        doubaoContent.push({ type: "input_text", text: basePrompt || "" });
      } else if (!isDoubao && messageContent.length === 0) {
        messageContent.push({ type: "text", text: basePrompt || "" });
      }

      // 记录内容摘要
      if (isDoubao) {
        const summary = doubaoContent.map((c) => ({
          type: c.type,
          hasText: !!c.text,
          hasImage: !!c.image_url,
        }));
        logRun(run, "info", `[${node.name}] Doubao content: ${JSON.stringify(summary)}`);
      } else {
        const summary = messageContent.map((c) => ({
          type: c.type,
          hasText: !!c.text,
          hasImage: !!c.image_url,
        }));
        logRun(run, "info", `[${node.name}] messageContent: ${JSON.stringify(summary)}`);
      }

      if (!apiKey) {
        const mockText = isDoubao
          ? doubaoContent
              .filter((c) => c.type === "input_text")
              .map((c) => c.text)
              .join("\n\n")
          : messageContent
              .filter((c) => c.type === "text")
              .map((c) => c.text)
              .join("\n\n");
        const mock = `MOCK_LLM(${model}): ${mockText.slice(0, 200)}`;
        const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.text`;
        setByPath(context, outPath, mock);
        writeOutput(node, "text", mock, context);
        logRun(run, "info", `[${node.name}] mock LLM -> ${outPath}`);
        logRun(
          run,
          "info",
          `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
        );
        return { contextPatch: {} };
      }

      let payload: any;
      let endpoint: string;

      if (isDoubao) {
        // Doubao 格式：使用 /v3/responses 端点和 input 数组
        endpoint = `${baseURL}/responses`;
        payload = {
          model,
          input: [
            {
              role: "user",
              content: doubaoContent,
            },
          ],
        };
      } else {
        // 标准 OpenAI 兼容格式
        endpoint = `${baseURL}/chat/completions`;
        payload = {
          model,
          messages: [{ role: "user", content: messageContent }],
          stream: true,
        };
      }

      let fullText = "";

      try {
        logRun(run, "info", `[${node.name}] request -> ${endpoint} model=${model} (${isDoubao ? "Doubao" : "Standard"})`);
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`LLM call failed: ${res.status} ${errText}`);
        }

        // Doubao 可能不支持流式响应，先尝试解析 JSON
        const contentType = res.headers.get("content-type") || "";
        if (isDoubao || !contentType.includes("text/event-stream")) {
          // 非流式响应（Doubao 或标准非流式）
          const data = await res.json();
          const dataAny = data as any;
          if (isDoubao) {
            // Doubao 响应格式：尝试多种可能的字段路径
            // 可能的格式：
            // 1. { output: { text: "..." } }
            // 2. { output: "..." }
            // 3. { text: "..." }
            // 4. { content: "..." }
            // 5. { response: { output: { text: "..." } } }
            let extractedText: unknown = undefined;
            
            // 尝试各种可能的路径
            if (dataAny.output) {
              if (typeof dataAny.output === "string") {
                extractedText = dataAny.output;
              } else if (dataAny.output.text) {
                extractedText = dataAny.output.text;
              } else if (dataAny.output.content) {
                extractedText = dataAny.output.content;
              } else if (Array.isArray(dataAny.output) && dataAny.output.length > 0) {
                // 如果 output 是数组，尝试找到 type: "message" 的元素
                for (const item of dataAny.output) {
                  if (item?.type === "message" && Array.isArray(item.content)) {
                    // 在 content 数组中查找 type: "output_text" 的元素
                    for (const contentItem of item.content) {
                      if (contentItem?.type === "output_text" && contentItem.text) {
                        extractedText = contentItem.text;
                        break;
                      }
                    }
                    if (extractedText !== undefined) break;
                    // 如果没有找到 output_text，尝试直接取第一个 content 的 text
                    if (item.content.length > 0 && item.content[0]?.text) {
                      extractedText = item.content[0].text;
                      break;
                    }
                  }
                }
                // 如果还没找到，尝试取第一个元素的文本
                if (extractedText === undefined) {
                  const first = dataAny.output[0];
                  if (typeof first === "string") {
                    extractedText = first;
                  } else if (first?.text) {
                    extractedText = first.text;
                  } else if (first?.content) {
                    if (Array.isArray(first.content) && first.content.length > 0) {
                      const firstContent = first.content[0];
                      if (firstContent?.text) {
                        extractedText = firstContent.text;
                      } else if (typeof firstContent === "string") {
                        extractedText = firstContent;
                      }
                    } else if (typeof first.content === "string") {
                      extractedText = first.content;
                    }
                  }
                }
              }
            }
            
            // 如果还没找到，尝试其他字段
            if (extractedText === undefined) {
              extractedText = dataAny.text || dataAny.content || dataAny.message;
            }
            
            // 如果还是没找到，尝试 response 字段
            if (extractedText === undefined && dataAny.response) {
              if (typeof dataAny.response === "string") {
                extractedText = dataAny.response;
              } else if (dataAny.response.output) {
                if (typeof dataAny.response.output === "string") {
                  extractedText = dataAny.response.output;
                } else if (dataAny.response.output.text) {
                  extractedText = dataAny.response.output.text;
                }
              }
            }
            
            // 如果找到了文本，使用它；否则序列化整个响应对象
            if (extractedText !== undefined) {
              if (typeof extractedText === "string") {
                fullText = extractedText;
              } else {
                fullText = JSON.stringify(extractedText);
              }
            } else {
              // 保存完整响应以便调试，同时尝试提取任何可能的文本字段
              logRun(run, "info", `[${node.name}] Doubao response structure: ${JSON.stringify(Object.keys(dataAny as object))}`);
              // 如果 data.text 是字符串化的 JSON，尝试解析并提取
              if (dataAny.text && typeof dataAny.text === "string") {
                const parsedText = tryParseJson(dataAny.text);
                if (parsedText && typeof parsedText === "object") {
                  // 尝试从解析后的对象中提取文本
                  const parsedAny = parsedText as any;
                  if (Array.isArray(parsedAny.output)) {
                    for (const item of parsedAny.output) {
                      if (item?.type === "message" && Array.isArray(item.content)) {
                        for (const contentItem of item.content) {
                          if (contentItem?.type === "output_text" && contentItem.text) {
                            fullText = contentItem.text;
                            logRun(run, "info", `[${node.name}] Extracted text from stringified JSON`);
                            break;
                          }
                        }
                        if (fullText) break;
                      }
                    }
                  }
                }
              }
              // 如果还是没找到，使用完整响应
              if (!fullText) {
                fullText = JSON.stringify(data, null, 2);
              }
            }
            
            // 如果是 Doubao-Seed-1.8，分离 Thinking 和 Answer
            if (isDoubaoSeed && Array.isArray(dataAny.output)) {
              let thinkingText = "";
              let answerText = "";
              
              for (const item of dataAny.output) {
                if (item?.type === "reasoning") {
                  // 提取思考过程
                  // summary 是数组，包含 { type: "summary_text", text: "..." }
                  if (Array.isArray(item.summary) && item.summary.length > 0) {
                    // 提取所有 summary_text 的内容并合并
                    const summaryTexts = item.summary
                      .filter((s: any) => s?.type === "summary_text" && s?.text)
                      .map((s: any) => s.text);
                    if (summaryTexts.length > 0) {
                      thinkingText = summaryTexts.join("\n\n");
                    } else {
                      // 如果没有 summary_text，尝试直接取第一个元素的 text
                      const firstSummary = item.summary[0];
                      if (firstSummary?.text) {
                        thinkingText = firstSummary.text;
                      }
                    }
                  } else if (item.summary && typeof item.summary === "object" && !Array.isArray(item.summary)) {
                    // 如果 summary 是对象（非数组）且有 text 字段
                    if (item.summary.text) {
                      thinkingText = item.summary.text;
                    }
                  } else if (item.text) {
                    thinkingText = item.text;
                  } else if (typeof item === "string") {
                    thinkingText = item;
                  }
                } else if (item?.type === "message") {
                  // 提取最终回答
                  if (Array.isArray(item.content)) {
                    for (const contentItem of item.content) {
                      if (contentItem?.type === "output_text" && contentItem.text) {
                        answerText = contentItem.text;
                        break;
                      } else if (contentItem?.text) {
                        answerText = contentItem.text;
                        break;
                      }
                    }
                  } else if (item.content?.text) {
                    answerText = item.content.text;
                  } else if (item.text) {
                    answerText = item.text;
                  }
                }
              }
              
              // 写入 Thinking 和 Answer 输出
              const thinkingPath = `vars.${node.id}.thinking`;
              const answerPath = `vars.${node.id}.answer`;
              setByPath(context, thinkingPath, thinkingText);
              setByPath(context, answerPath, answerText);
              writeOutput(node, "thinking", thinkingText, context);
              writeOutput(node, "answer", answerText, context);
              
              // 同时保存完整响应
              const fullResponsePath = `vars.${node.id}.fullResponse`;
              setByPath(context, fullResponsePath, data);
              writeOutput(node, "fullResponse", data, context);
              
              logRun(run, "info", `[${node.name}] Doubao-Seed: thinking length=${thinkingText.length}, answer length=${answerText.length}`);
            } else {
              // 同时保存完整响应到上下文中，方便调试和访问
              const fullResponsePath = `vars.${node.id}.fullResponse`;
              setByPath(context, fullResponsePath, data);
              writeOutput(node, "fullResponse", data, context);
            }
          } else {
            // 标准非流式响应
            fullText = dataAny.choices?.[0]?.message?.content || dataAny.content || JSON.stringify(dataAny);
            if (typeof fullText !== "string") {
              fullText = JSON.stringify(fullText);
            }
          }
          const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.text`;
          setByPath(context, outPath, fullText);
          writeOutput(node, "text", fullText, context);
          logRun(run, "info", `[${node.name}] LLM response received -> ${outPath} (text length: ${fullText.length})`);
        } else {
          // 流式响应（标准 OpenAI 格式）
          if (!res.body) {
            throw new Error("Response body is null");
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.trim() === "") continue;
                if (line.startsWith("data: ")) {
                  const data = line.slice(6);
                  if (data === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta?.content;
                    if (delta) {
                      fullText += delta;
                      // 实时更新输出
                      const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.text`;
                      setByPath(context, outPath, fullText);
                      writeOutput(node, "text", fullText, context);
                      // 触发更新事件
                      if ((run as any).onStreamUpdate) {
                        (run as any).onStreamUpdate(node.id, fullText);
                      }
                    }
                  } catch {
                    // 忽略解析错误
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        }
      } catch (err: any) {
        const errMsg = `LLM request failed: ${err?.message || err}`;
        const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.text`;
        setByPath(context, outPath, errMsg);
        writeOutput(node, "text", errMsg, context);
        logRun(run, "error", `[${node.name}] ${errMsg}`);
        throw err;
      }

      const outPath = (effectiveConfig.outputPath as string) || `vars.${node.id}.text`;
      setByPath(context, outPath, fullText);
      writeOutput(node, "text", fullText, context);
      logRun(run, "info", `[${node.name}] LLM ${isDoubao ? "response" : "stream"} completed -> ${outPath}`);
      logRun(
        run,
        "info",
        `[${node.name}] outputs: ${formatLogValue(getByPath(context, `_outputs.${node.id}`))}`,
      );
      return { contextPatch: {} };
    }
    default:
      logRun(run, "error", `[${node.name}] unsupported node type ${node.type}`);
      return { contextPatch: {} };
  }
};

const executeWorkflow = async (workflow: WorkflowDefinition, run: WorkflowRun) => {
  run.status = "running";
  saveRuns();
  logRun(run, "info", "Workflow started");

  const context = { ...run.context };
  const nodeMap = new Map<string, WorkflowNode>();
  const inEdges = new Map<string, WorkflowEdge[]>();
  const outEdges = new Map<string, WorkflowEdge[]>();

  workflow.nodes.forEach((n) => nodeMap.set(n.id, n));
  workflow.edges.forEach((e) => {
    if (!outEdges.has(e.source)) outEdges.set(e.source, []);
    if (!inEdges.has(e.target)) inEdges.set(e.target, []);
    outEdges.get(e.source)!.push(e);
    inEdges.get(e.target)!.push(e);
  });

  const triggerTypes = new Set(["start", "cron", "webhook"]);
  const desiredTriggerType =
    (context as any)?.trigger?.type === "cron"
      ? "cron"
      : (context as any)?.webhook
      ? "webhook"
      : "start";
  const triggerNodes = workflow.nodes.filter(
    (n) => triggerTypes.has(n.type) && n.type === desiredTriggerType,
  );

  if (triggerNodes.length === 0 && workflow.nodes.length > 0) {
    run.status = "failed";
    logRun(run, "error", `No trigger nodes found for type "${desiredTriggerType}"`);
    run.context = context;
    saveRuns();
    return;
  }

  // 计算从触发器可达的节点集合（先向下游遍历）
  const reachable = new Set<string>();
  const stack = triggerNodes.map((n) => n.id);
  while (stack.length) {
    const current = stack.pop()!;
    if (reachable.has(current)) continue;
    reachable.add(current);
    const edges = outEdges.get(current) || [];
    edges.forEach((e) => {
      if (!reachable.has(e.target)) stack.push(e.target);
    });
  }

  // 再向上游补齐依赖（让 LLM 等节点能拿到上游输入）
  const upstreamStack = [...reachable];
  while (upstreamStack.length) {
    const current = upstreamStack.pop()!;
    const incoming = inEdges.get(current) || [];
    incoming.forEach((e) => {
      if (!reachable.has(e.source)) {
        reachable.add(e.source);
        upstreamStack.push(e.source);
      }
    });
  }

  // 依赖计数仅考虑可达节点之间的边
  const pendingDeps = new Map<string, number>();
  reachable.forEach((nodeId) => {
    const deps = (inEdges.get(nodeId) || []).filter((e) => reachable.has(e.source)).length;
    pendingDeps.set(nodeId, deps);
  });

  // 初始队列：可达子图中所有依赖为 0 的节点
  let queue = Array.from(pendingDeps.entries())
    .filter(([, deps]) => deps === 0)
    .map(([nodeId]) => nodeId);

  const completed = new Set<string>();
  const failedNodes: string[] = [];

  if (queue.length === 0 && workflow.nodes.length > 0) {
    run.status = "failed";
    logRun(
      run,
      "error",
      "No executable nodes in trigger subgraph. Check trigger connections.",
    );
    run.context = context;
    saveRuns();
    return;
  }

  while (queue.length) {
    const batch = [...queue];
    queue = [];

    const results = await Promise.all(
      batch.map(async (nodeId) => {
        const node = nodeMap.get(nodeId);
        if (!node) return { nodeId, ok: false, error: new Error("node not found") };
        try {
          logRun(run, "info", `[${node.name}] start`);
          const result = await executeNode(node, context, run);
          completed.add(nodeId);
          logRun(run, "info", `[${node.name}] done`);
          return { nodeId, ok: true, result, node };
        } catch (err: any) {
          failedNodes.push(nodeId);
          logRun(run, "error", `[${node?.name ?? nodeId}] failed: ${err.message}`);
          return { nodeId, ok: false, error: err, node };
        }
      }),
    );

    results.forEach((res) => {
      if (!res.ok || !res.node) return;
      const node = res.node;
      const result = (res as any).result;
      const nextEdges = (outEdges.get(res.nodeId) || []).filter((edge) => {
        if (node.type === "condition" && result?.conditionResult !== undefined) {
          const label = (edge.label || "").toLowerCase();
          return label === String(result.conditionResult).toLowerCase();
        }
        return true;
      });

      nextEdges.forEach((edge) => {
        if (!reachable.has(edge.target)) return;
        const deps = pendingDeps.get(edge.target);
        if (deps === undefined) return;
        pendingDeps.set(edge.target, deps - 1);
        if (deps - 1 <= 0 && !completed.has(edge.target)) {
          queue.push(edge.target);
        }
      });
    });
  }

  if (failedNodes.length) {
    run.status = "failed";
    logRun(run, "error", `Workflow failed on nodes: ${failedNodes.join(", ")}`);
  } else {
    run.status = "completed";
    logRun(run, "info", "Workflow completed");
  }
  if (desiredTriggerType === "start" && triggerNodes.length) {
    const endTime = new Date().toISOString();
    const startTime = (context as any)?.trigger?.ts || run.createdAt;
    const durationMs = Math.max(0, new Date(endTime).getTime() - new Date(startTime).getTime());
    const statusLabel = run.status === "completed" ? "完成" : "异常";
    let logText = "无";
    if (failedNodes.length) {
      const failedNames = failedNodes.map((id) => nodeMap.get(id)?.name || id);
      const reasons = failedNames.map((name) => {
        const match = [...run.logs]
          .reverse()
          .find((entry) => entry.level === "error" && entry.message.startsWith(`[${name}] failed:`));
        if (!match) return `${name}: 未知原因`;
        return `${name}: ${match.message.replace(`[${name}] failed: `, "")}`;
      });
      logText = `失败节点: ${failedNames.join(", ")}。原因: ${reasons.join("；")}`;
    }

    triggerNodes.forEach((node) => {
      const outPath = (node.config?.outputPath as string) || `vars.${node.id}.trigger`;
      const startTimeText = formatBeijingTime(startTime);
      const endTimeText = formatBeijingTime(endTime);
      const payloadText =
        `触发时间：${startTimeText}\n` +
        `结束时间：${endTimeText}\n` +
        `耗时(ms)：${durationMs}\n` +
        `状态：${statusLabel}\n` +
        `日志：${logText}`;
      setByPath(context, outPath, payloadText);
      writeOutput(node, "out", payloadText, context);
    });
  }
  const remaining = workflow.nodes.filter((n) => !completed.has(n.id));
  if (remaining.length) {
    logRun(run, "info", `Skipped nodes: ${remaining.map((n) => n.name).join(", ")}`);
  }
  run.context = context;
  saveRuns();
};

const addCreditLog = (user: User, type: "consume" | "admin_add", amount: number, reason: string) => {
  const now = new Date().toISOString();
  const log: CreditLog = {
    id: uuidv4(),
    userId: user.id,
    type,
    amount,
    reason,
    balanceAfter: user.credits,
    createdAt: now,
  };
  creditLogs.push(log);
  saveCreditLogs();
};

const consumeCredit = (userId: string, reason: string) => {
  const user = users.find((u) => u.id === userId);
  if (!user) return false;
  if (user.credits < 1) return false;
  user.credits -= 1;
  user.usedCredits += 1;
  user.updatedAt = new Date().toISOString();
  saveUsers();
  addCreditLog(user, "consume", -1, reason);
  return true;
};

// Initialize triggers from persisted workflows
workflows.forEach((wf) => registerSchedules(wf));
rebuildWebhookMap();

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.post("/auth/register", (req, res) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ message: "username, email, password are required" });
  }
  const trimmedName = String(username).trim();
  const normalizedEmail = normalizeEmail(String(email));
  if (!trimmedName || !normalizedEmail || String(password).length < 6) {
    return res.status(400).json({ message: "Invalid registration data" });
  }
  if (users.some((u) => u.username === trimmedName)) {
    return res.status(409).json({ message: "username already exists" });
  }
  if (users.some((u) => normalizeEmail(u.email) === normalizedEmail)) {
    return res.status(409).json({ message: "email already exists" });
  }
  const { salt, hash } = createPasswordHash(String(password));
  const now = new Date().toISOString();
  const role: UserRole = users.length === 0 ? "admin" : "user";
  const user: User = {
    id: uuidv4(),
    username: trimmedName,
    email: normalizedEmail,
    passwordHash: hash,
    passwordSalt: salt,
    role,
    credits: 10000,
    usedCredits: 0,
    profile: {},
    createdAt: now,
    updatedAt: now,
  };
  users.push(user);
  saveUsers();
  const token = createToken();
  sessions.push({ token, userId: user.id, createdAt: now, lastUsedAt: now });
  saveSessions();
  res.status(201).json({ token, user: sanitizeUser(user) });
});

app.post("/auth/login", (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ message: "identifier and password are required" });
  }
  const user = findUserByIdentifier(String(identifier));
  if (!user || !verifyPassword(String(password), user.passwordSalt, user.passwordHash)) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  const now = new Date().toISOString();
  const token = createToken();
  sessions.push({ token, userId: user.id, createdAt: now, lastUsedAt: now });
  saveSessions();
  res.json({ token, user: sanitizeUser(user) });
});

app.get("/auth/me", requireAuth, (req: AuthRequest, res) => {
  res.json({ user: sanitizeUser(req.user!) });
});

app.post("/auth/logout", requireAuth, (req: AuthRequest, res) => {
  const auth = req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token) {
    sessions = sessions.filter((s) => s.token !== token);
    saveSessions();
  }
  res.json({ ok: true });
});

app.put("/users/me", requireAuth, (req: AuthRequest, res) => {
  const { username, avatarUrl, bio } = req.body || {};
  const user = req.user!;
  if (username) {
    const trimmed = String(username).trim();
    if (!trimmed) return res.status(400).json({ message: "username cannot be empty" });
    if (users.some((u) => u.username === trimmed && u.id !== user.id)) {
      return res.status(409).json({ message: "username already exists" });
    }
    user.username = trimmed;
  }
  user.profile = {
    ...user.profile,
    ...(avatarUrl !== undefined ? { avatarUrl: String(avatarUrl) } : {}),
    ...(bio !== undefined ? { bio: String(bio) } : {}),
  };
  user.updatedAt = new Date().toISOString();
  saveUsers();
  res.json({ user: sanitizeUser(user) });
});

app.put("/users/me/password", requireAuth, (req: AuthRequest, res) => {
  const { currentPassword, nextPassword } = req.body || {};
  const user = req.user!;
  if (!currentPassword || !nextPassword) {
    return res.status(400).json({ message: "currentPassword and nextPassword are required" });
  }
  if (!verifyPassword(String(currentPassword), user.passwordSalt, user.passwordHash)) {
    return res.status(400).json({ message: "current password incorrect" });
  }
  if (String(nextPassword).length < 6) {
    return res.status(400).json({ message: "password too short" });
  }
  const { salt, hash } = createPasswordHash(String(nextPassword));
  user.passwordSalt = salt;
  user.passwordHash = hash;
  user.updatedAt = new Date().toISOString();
  saveUsers();
  res.json({ ok: true });
});

app.get("/users/me/credits/logs", requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const logs = creditLogs.filter((log) => log.userId === user.id);
  res.json({ items: logs });
});

app.get("/admin/users", requireAuth, requireAdmin, (_req, res) => {
  res.json({ items: users.map((u) => sanitizeUser(u)) });
});

app.post("/admin/users/:id/credits", requireAuth, requireAdmin, (req, res) => {
  const { amount, reason } = req.body || {};
  const delta = Number(amount);
  if (!Number.isFinite(delta) || delta <= 0) {
    return res.status(400).json({ message: "amount must be > 0" });
  }
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: "user not found" });
  user.credits += delta;
  user.updatedAt = new Date().toISOString();
  saveUsers();
  addCreditLog(user, "admin_add", delta, String(reason || "管理员加分"));
  res.json({ user: sanitizeUser(user) });
});

app.post("/admin/users/:id/role", requireAuth, requireAdmin, (req, res) => {
  const { role } = req.body || {};
  if (role !== "admin" && role !== "user") {
    return res.status(400).json({ message: "role must be admin or user" });
  }
  const user = users.find((u) => u.id === req.params.id);
  if (!user) return res.status(404).json({ message: "user not found" });
  user.role = role;
  user.updatedAt = new Date().toISOString();
  saveUsers();
  res.json({ user: sanitizeUser(user) });
});

app.get("/workflows", requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const items =
    user.role === "admin"
      ? workflows
      : workflows.filter((wf) => wf.ownerId === user.id);
  res.json({ items });
});

app.post("/workflows", requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const { name, nodes, edges, thumbnail } = req.body;
  if (!name || !Array.isArray(nodes) || !Array.isArray(edges)) {
    return res
      .status(400)
      .json({ message: "name, nodes[], edges[] are required" });
  }

  const now = new Date().toISOString();
  const workflow: WorkflowDefinition = {
    id: uuidv4(),
    name,
    version: 1,
    ownerId: user.id,
    nodes,
    edges,
    ...(thumbnail ? { thumbnail } : {}),
    createdAt: now,
    updatedAt: now,
  };
  workflows.push(workflow);
  saveWorkflows();
  registerSchedules(workflow);
  rebuildWebhookMap();
  res.status(201).json(workflow);
});

app.put("/workflows/:id", requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const idx = workflows.findIndex((w) => w.id === req.params.id);
  if (idx === -1) return res.status(404).json({ message: "workflow not found" });
  const { name, nodes, edges, thumbnail } = req.body;
  if (!name || !Array.isArray(nodes) || !Array.isArray(edges)) {
    return res
      .status(400)
      .json({ message: "name, nodes[], edges[] are required" });
  }
  const now = new Date().toISOString();
  const current = workflows[idx];
  if (!current) return res.status(404).json({ message: "workflow not found" });
  if (current.ownerId && current.ownerId !== user.id && user.role !== "admin") {
    return res.status(404).json({ message: "workflow not found" });
  }
  const updated: WorkflowDefinition = {
    ...current,
    name,
    ownerId: current.ownerId || user.id,
    nodes,
    edges,
    ...(thumbnail !== undefined ? { thumbnail } : {}),
    updatedAt: now,
  };
  workflows[idx] = updated;
  saveWorkflows();
  registerSchedules(updated);
  rebuildWebhookMap();
  res.json(workflows[idx]);
});

app.get("/workflows/:id", requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const workflow = workflows.find((w) => w.id === req.params.id);
  if (!workflow) {
    return res.status(404).json({ message: "workflow not found" });
  }
  if (workflow.ownerId && workflow.ownerId !== user.id && user.role !== "admin") {
    return res.status(404).json({ message: "workflow not found" });
  }
  res.json(workflow);
});

app.delete("/workflows/:id", requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const idx = workflows.findIndex((w) => w.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ message: "workflow not found" });
  }
  const workflow = workflows[idx];
  if (workflow && workflow.ownerId && workflow.ownerId !== user.id && user.role !== "admin") {
    return res.status(404).json({ message: "workflow not found" });
  }
  workflows.splice(idx, 1);
  saveWorkflows();
  // 取消相关的定时任务和webhook
  if (workflow) {
    const schedules = scheduleMap.get(workflow.id);
    if (schedules) {
      schedules.forEach((timeout) => clearTimeout(timeout));
      scheduleMap.delete(workflow.id);
    }
  }
  rebuildWebhookMap();
  res.json({ message: "workflow deleted", id: req.params.id });
});

app.post("/workflows/:id/run", requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const workflow = workflows.find((w) => w.id === req.params.id);
  if (!workflow) {
    return res.status(404).json({ message: "workflow not found" });
  }
  if (workflow.ownerId && workflow.ownerId !== user.id && user.role !== "admin") {
    return res.status(404).json({ message: "workflow not found" });
  }
  if (!consumeCredit(user.id, "运行工作流")) {
    return res.status(400).json({ message: "Insufficient credits" });
  }
  const run = createRun(workflow, req.body?.context ?? {}, user.id);
  res.status(202).json({ runId: run.id, status: run.status, credits: user.credits });
});

app.post("/nodes/run", requireAuth, async (req: AuthRequest, res) => {
  const user = req.user!;
  if (!consumeCredit(user.id, "运行单节点")) {
    return res.status(400).json({ message: "Insufficient credits" });
  }
  const node = req.body?.node as WorkflowNode | undefined;
  const context = (req.body?.context ?? {}) as Record<string, unknown>;
  if (!node || !node.id || !node.type) {
    return res.status(400).json({ message: "node.id and node.type are required" });
  }
  const now = new Date().toISOString();
  const run: WorkflowRun = {
    id: uuidv4(),
    workflowId: "single-node",
    ownerId: user.id,
    status: "running",
    context,
    logs: [{ ts: now, level: "info", message: "Single node run" }],
    createdAt: now,
    updatedAt: now,
  };
  try {
    await executeNode(node, context, run);
    run.status = "completed";
  } catch (err: any) {
    run.status = "failed";
    logRun(run, "error", `Single node error: ${err.message}`);
  }
  const outputs = getByPath(context, `_outputs.${node.id}`) || {};
  res.json({ status: run.status, outputs, logs: run.logs, context, credits: user.credits });
});

app.get("/runs/:id", requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const run = runs.find((r) => r.id === req.params.id);
  if (!run) {
    return res.status(404).json({ message: "run not found" });
  }
  if (run.ownerId && run.ownerId !== user.id && user.role !== "admin") {
    return res.status(404).json({ message: "run not found" });
  }
  res.json(run);
});

app.get("/runs/:id/logs", requireAuth, (req: AuthRequest, res) => {
  const user = req.user!;
  const run = runs.find((r) => r.id === req.params.id);
  if (!run) {
    return res.status(404).json({ message: "run not found" });
  }
  if (run.ownerId && run.ownerId !== user.id && user.role !== "admin") {
    return res.status(404).json({ message: "run not found" });
  }
  res.json({ runId: run.id, logs: run.logs, status: run.status, context: run.context });
});

app.post("/triggers/webhook/:key", (req, res) => {
  const key = req.params.key;
  const workflowIds = webhookMap.get(key) || [];
  if (!workflowIds.length) {
    return res.status(404).json({ message: "webhook key not found" });
  }
  const runsTriggered: string[] = [];
  workflowIds.forEach((id) => {
    const workflow = workflows.find((w) => w.id === id);
    if (!workflow) return;
    if (!workflow.ownerId) return;
    if (!consumeCredit(workflow.ownerId, "Webhook 触发")) return;
    const context = {
      webhook: {
        key,
        ts: new Date().toISOString(),
        payload: req.body,
        headers: req.headers,
        query: req.query,
      },
    };
    const run = createRun(workflow, context, workflow.ownerId);
    runsTriggered.push(run.id);
  });
  res.json({ key, runs: runsTriggered });
});

app.post("/providers", requireAuth, (req, res) => {
  const { name, baseURL, model, apiKeyAlias, description } = req.body;
  if (!name || !baseURL || !model || !apiKeyAlias) {
    return res
      .status(400)
      .json({ message: "name, baseURL, model, apiKeyAlias are required" });
  }

  const provider: ProviderConfig = {
    id: uuidv4(),
    name,
    baseURL,
    model,
    apiKeyAlias,
    description,
    createdAt: new Date().toISOString(),
  };
  providers.push(provider);
  saveProviders();
  res.status(201).json(provider);
});

app.get("/providers", requireAuth, (_req, res) => {
  res.json({ items: providers });
});

app.post("/uploads", requireAuth, upload.array("files", 5), (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  const mapped = files.map((file) => ({
    id: uuidv4(),
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: file.path,
    url: `/uploads/${path.basename(file.path)}`,
  }));
  res.status(201).json({ files: mapped });
});

app.use("/uploads", express.static(UPLOAD_DIR));

const frontendDist = path.join(process.cwd(), "..", "frontend", "dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  // 如果没有前端静态文件，提供 API 根路径响应（用于健康检查）
  app.get("/", (_req, res) => {
    res.json({ status: "ok", service: "cross-border-workflow-api", uptime: process.uptime() });
  });
}

app.use((err: Error, _req: Request, res: Response, _next: () => void) => {
  console.error(err);
  res.status(500).json({ message: "Internal server error", detail: err.message });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[api] listening on http://0.0.0.0:${PORT}`);
});
