export type NodeType =
  | "llm"
  | "llm-file"
  | "llm-generic"
  | "doubao-1-8"
  | "llm-claude"
  | "text"
  | "http"
  | "log"
  | "file"
  | "time"
  | "display"
  | "save-file"
  | "start"
  | "cron"
  | "webhook"
  | "text-input"
  | "image-input"
  | "text-output"
  | "image-output"
  | "end"
  | "condition"
  | "loop"
  | "image-placeholder"
  | "video-placeholder";

export type WorkflowNode = {
  id: string;
  type: NodeType;
  name: string;
  config: Record<string, unknown>;
};

export type WorkflowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: { stroke?: string; [key: string]: unknown };
};

export type WorkflowDefinition = {
  id: string;
  name: string;
  version: number;
  ownerId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
};

export type RunStatus = "queued" | "running" | "completed" | "failed";

export type RunLog = { ts: string; level: "info" | "error"; message: string };

export type WorkflowRun = {
  id: string;
  workflowId: string;
  ownerId: string;
  status: RunStatus;
  context: Record<string, unknown>;
  logs: RunLog[];
  createdAt: string;
  updatedAt: string;
};

export type UserRole = "user" | "admin";

export type UserProfile = {
  avatarUrl?: string;
  bio?: string;
};

export type User = {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  role: UserRole;
  credits: number;
  usedCredits: number;
  profile: UserProfile;
  createdAt: string;
  updatedAt: string;
};

export type Session = {
  token: string;
  userId: string;
  createdAt: string;
  lastUsedAt: string;
};

export type CreditLogType = "consume" | "admin_add";

export type CreditLog = {
  id: string;
  userId: string;
  type: CreditLogType;
  amount: number;
  reason: string;
  balanceAfter: number;
  createdAt: string;
};

export type ProviderConfig = {
  id: string;
  name: string;
  baseURL: string;
  model: string;
  apiKeyAlias: string;
  description?: string;
  createdAt: string;
};
