/**
 * Shared types for wynter-code-mobile
 */

// Workspace & Project
export interface Workspace {
  id: string;
  name: string;
  path: string;
  projects: Project[];
}

export interface Project {
  id: string;
  name: string;
  path: string;
  workspaceId: string;
  lastOpened?: string;
}

// Beads Issues
export type IssueStatus = 'open' | 'in_progress' | 'closed';
export type IssueType = 'bug' | 'feature' | 'task' | 'epic';
export type Priority = 0 | 1 | 2 | 3 | 4;

export interface Issue {
  id: string;
  title: string;
  description?: string;
  status: IssueStatus;
  type: IssueType;
  priority: Priority;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  closeReason?: string;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  type: IssueType;
  priority: Priority;
  parentId?: string;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  status?: IssueStatus;
  type?: IssueType;
  priority?: Priority;
}

// Auto-Build
export type WorkerStatus = 'idle' | 'working' | 'error' | 'paused';
export type AutoBuildStatus = 'stopped' | 'running' | 'paused' | 'idle' | 'error';
export type AutoBuildPhase =
  | 'selecting'
  | 'working'
  | 'selfReviewing'
  | 'auditing'
  | 'testing'
  | 'fixing'
  | 'reviewing'
  | 'committing'
  | undefined;

export interface Worker {
  id: string;
  name: string;
  status: WorkerStatus;
  currentTask?: string;
  progress?: number;
}

export interface QueueItem {
  id: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

export interface LogEntry {
  id: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export interface AutoBuildState {
  status: AutoBuildStatus;
  workers: Worker[];
  queue: QueueItem[];
  humanReview: QueueItem[];
  completed: QueueItem[];
  logs: LogEntry[];
  progress: number;
  currentIssueId?: string;
  currentPhase?: AutoBuildPhase;
}

// AI Provider/Model Types
export type AIProvider = 'claude' | 'openai' | 'gemini';

export type ClaudeModel = 'claude-opus-4-20250514' | 'claude-sonnet-4-20250514' | 'claude-3-5-haiku-20241022';
export type OpenAIModel = 'gpt-5.2-codex' | 'gpt-5.1-codex-max' | 'gpt-5.1-codex-mini';
export type GeminiModel = 'gemini-3-pro-preview' | 'gemini-3-flash-preview' | 'gemini-2.5-flash' | 'gemini-2.5-pro';
export type AIModel = ClaudeModel | OpenAIModel | GeminiModel;

export interface ModelInfo {
  id: AIModel;
  name: string;
  description: string;
  provider: AIProvider;
}

// Chat
export interface ChatSession {
  id: string;
  name: string;
  projectId: string;
  provider?: AIProvider;
  model?: AIModel;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  input?: Record<string, unknown>;
  output?: string;
}

// Connection
export interface PairedDevice {
  id: string;
  name: string;
  host: string;
  port: number;
  token: string;
  pairedAt: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  device: PairedDevice | null;
  error?: string;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PairResponse {
  token: string;
  device: {
    id: string;
    name: string;
  };
}

// Overwatch Types
export type ServiceProvider = 'railway' | 'plausible' | 'netlify' | 'sentry' | 'link';
export type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'unknown' | 'loading';

export interface OverwatchService {
  id: string;
  workspaceId: string;
  provider: ServiceProvider;
  name: string;
  externalUrl?: string;
  status?: ServiceStatus;
  linkIcon?: string;
  linkColor?: string;
  enabled: boolean;
  sortOrder: number;
  metrics?: Record<string, unknown>;
  lastUpdated?: number;
  error?: string;
}

// Subscription Types
export type BillingCycle = 'monthly' | 'yearly' | 'quarterly' | 'weekly' | 'one-time';

export interface Subscription {
  id: string;
  workspaceId: string;
  name: string;
  url?: string;
  faviconUrl?: string;
  monthlyCost: number;
  billingCycle: BillingCycle;
  currency: string;
  categoryId?: string;
  notes?: string;
  isActive: boolean;
  sortOrder: number;
}

export interface SubscriptionCategory {
  id: string;
  workspaceId: string;
  name: string;
  color?: string;
  sortOrder: number;
}

// Bookmark Types
export interface Bookmark {
  id: string;
  url: string;
  title: string;
  description?: string;
  faviconUrl?: string;
  collectionId?: string;
  order: number;
}

export interface BookmarkCollection {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  order: number;
}
