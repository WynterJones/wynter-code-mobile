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
  logs: LogEntry[];
  progress: number;
  currentIssueId?: string;
  currentPhase?: AutoBuildPhase;
}

// Chat
export interface ChatSession {
  id: string;
  name: string;
  projectId: string;
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
