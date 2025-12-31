/**
 * API Client for wynter-code desktop connection
 */
import { QueryClient } from '@tanstack/react-query';
import type {
  ApiResponse,
  Workspace,
  Project,
  Issue,
  CreateIssueInput,
  UpdateIssueInput,
  AutoBuildState,
  ChatSession,
  ChatMessage,
  PairResponse,
} from '../types';
import { useConnectionStore } from '../stores/connectionStore';

// Query client instance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Base fetch with auth
async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { connection } = useConnectionStore.getState();

  if (!connection.device) {
    throw new Error('Not connected to desktop');
  }

  const { host, port, token } = connection.device;
  const url = `http://${host}:${port}/api/v1${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Pairing (no auth required)
export async function pairWithDesktop(
  host: string,
  port: number,
  code: string
): Promise<PairResponse> {
  const url = `http://${host}:${port}/api/v1/pair`;

  // Generate a unique device ID and name
  const deviceId = `mobile-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const deviceName = 'Wynter Code Mobile';

  console.log('[pairWithDesktop] Pairing with:', url, 'code:', code, 'deviceId:', deviceId);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      device_id: deviceId,
      device_name: deviceName,
    }),
  });

  console.log('[pairWithDesktop] Response status:', response.status);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('[pairWithDesktop] Error response:', errorBody);
    try {
      const error = JSON.parse(errorBody).error || 'Pairing failed';
      throw new Error(error);
    } catch {
      throw new Error(errorBody || 'Pairing failed');
    }
  }

  const data = await response.json();
  console.log('[pairWithDesktop] Success:', data);

  // Return in expected format with device info
  return {
    token: data.token,
    device: {
      id: deviceId,
      name: deviceName,
    },
  };
}

// Health check with timeout
export async function pingDesktop(host: string, port: number): Promise<boolean> {
  const url = `http://${host}:${port}/api/v1/ping`;
  console.log('[pingDesktop] Attempting to reach:', url);

  // Create abort controller for timeout (AbortSignal.timeout not available in RN)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    console.log('[pingDesktop] Response status:', response.status);
    return response.ok;
  } catch (error) {
    clearTimeout(timeoutId);
    console.error('[pingDesktop] Error:', error);
    return false;
  }
}

// Workspaces & Projects
export async function fetchWorkspaces(): Promise<Workspace[]> {
  // API returns workspaces directly, not wrapped in ApiResponse
  return apiFetch<Workspace[]>('/workspaces');
}

export async function fetchProjects(workspaceId: string): Promise<Project[]> {
  // API returns projects directly, not wrapped in ApiResponse
  return apiFetch<Project[]>(`/workspaces/${workspaceId}/projects`);
}

// Issues (Beads) - Note: API expects project_path as query param
// API returns snake_case, we need camelCase
interface ApiIssue {
  id: string;
  title: string;
  description?: string;
  status: string;
  issue_type: string;
  priority: number;
  parent_id?: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  close_reason?: string;
}

function transformIssue(apiIssue: ApiIssue): Issue {
  return {
    id: apiIssue.id,
    title: apiIssue.title,
    description: apiIssue.description,
    status: apiIssue.status as Issue['status'],
    type: apiIssue.issue_type as Issue['type'],
    priority: apiIssue.priority as Issue['priority'],
    parentId: apiIssue.parent_id,
    createdAt: apiIssue.created_at,
    updatedAt: apiIssue.updated_at,
    closedAt: apiIssue.closed_at,
    closeReason: apiIssue.close_reason,
  };
}

export async function fetchIssues(projectPath: string): Promise<Issue[]> {
  const encodedPath = encodeURIComponent(projectPath);
  const apiIssues = await apiFetch<ApiIssue[]>(
    `/projects/current/beads?project_path=${encodedPath}`
  );
  return apiIssues.map(transformIssue);
}

export async function createIssue(
  projectPath: string,
  input: CreateIssueInput
): Promise<Issue> {
  const encodedPath = encodeURIComponent(projectPath);
  const apiIssue = await apiFetch<ApiIssue>(
    `/projects/current/beads?project_path=${encodedPath}`,
    {
      method: 'POST',
      body: JSON.stringify({
        project_path: projectPath,
        title: input.title,
        issue_type: input.type,
        priority: input.priority,
        description: input.description,
      }),
    }
  );
  return transformIssue(apiIssue);
}

export async function updateIssue(
  projectPath: string,
  issueId: string,
  input: UpdateIssueInput
): Promise<Issue> {
  const encodedPath = encodeURIComponent(projectPath);
  const apiIssue = await apiFetch<ApiIssue>(
    `/projects/current/beads/${issueId}?project_path=${encodedPath}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        project_path: projectPath,
        ...input,
        // Transform type back to issue_type for API
        issue_type: input.type,
        type: undefined,
      }),
    }
  );
  return transformIssue(apiIssue);
}

export async function closeIssue(
  projectPath: string,
  issueId: string,
  reason: string
): Promise<Issue> {
  const encodedPath = encodeURIComponent(projectPath);
  const apiIssue = await apiFetch<ApiIssue>(
    `/projects/current/beads/${issueId}/close?project_path=${encodedPath}`,
    {
      method: 'POST',
      body: JSON.stringify({ project_path: projectPath, reason }),
    }
  );
  return transformIssue(apiIssue);
}

// Auto-Build
export async function fetchAutoBuildStatus(projectId: string): Promise<AutoBuildState> {
  const response = await apiFetch<ApiResponse<AutoBuildState>>(
    `/projects/${projectId}/autobuild/status`
  );
  return response.data || {
    status: 'stopped',
    workers: [],
    queue: [],
    logs: [],
    progress: 0,
  };
}

export async function startAutoBuild(projectId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/autobuild/start`, { method: 'POST' });
}

export async function pauseAutoBuild(projectId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/autobuild/pause`, { method: 'POST' });
}

export async function stopAutoBuild(projectId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/autobuild/stop`, { method: 'POST' });
}

export async function addToAutoBuildQueue(projectId: string, issueId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/autobuild/queue`, {
    method: 'POST',
    body: JSON.stringify({ issue_id: issueId }),
  });
}

export async function removeFromAutoBuildQueue(projectId: string, issueId: string): Promise<void> {
  await apiFetch(`/projects/${projectId}/autobuild/queue/${issueId}`, {
    method: 'DELETE',
  });
}

// Chat Sessions
export async function fetchSessions(projectId: string): Promise<ChatSession[]> {
  const response = await apiFetch<ApiResponse<ChatSession[]>>(
    `/projects/${projectId}/sessions`
  );
  return response.data || [];
}

export async function fetchMessages(
  projectId: string,
  sessionId: string
): Promise<ChatMessage[]> {
  const response = await apiFetch<ApiResponse<ChatMessage[]>>(
    `/projects/${projectId}/sessions/${sessionId}/messages`
  );
  return response.data || [];
}

export async function sendMessage(
  projectId: string,
  sessionId: string,
  content: string
): Promise<void> {
  await apiFetch(`/projects/${projectId}/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function approveToolCall(
  projectId: string,
  sessionId: string,
  toolCallId: string
): Promise<void> {
  await apiFetch(
    `/projects/${projectId}/sessions/${sessionId}/tools/${toolCallId}/approve`,
    { method: 'POST' }
  );
}

export async function rejectToolCall(
  projectId: string,
  sessionId: string,
  toolCallId: string
): Promise<void> {
  await apiFetch(
    `/projects/${projectId}/sessions/${sessionId}/tools/${toolCallId}/reject`,
    { method: 'POST' }
  );
}

// Mobile Chat - send message and stream response
export interface MobileChatRequest {
  provider: string;
  model: string;
  message: string;
  history?: Array<{ role: string; content: string }>;
}

export interface MobileChatChunk {
  type: 'content' | 'tool_start' | 'tool_result' | 'done' | 'error';
  content?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  error?: string;
}

export async function sendMobileChatMessage(
  request: MobileChatRequest,
  onChunk: (chunk: MobileChatChunk) => void
): Promise<void> {
  const { connection } = useConnectionStore.getState();

  if (!connection.device) {
    throw new Error('Not connected to desktop');
  }

  const { host, port, token } = connection.device;
  const url = `http://${host}:${port}/api/v1/mobile/chat`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Handle streaming response
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines (SSE format)
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') {
          onChunk({ type: 'done' });
          return;
        }
        try {
          const chunk: MobileChatChunk = JSON.parse(data);
          onChunk(chunk);
        } catch (e) {
          console.error('[MobileChat] Failed to parse chunk:', data, e);
        }
      }
    }
  }
}

// Overwatch Services
interface ApiOverwatchService {
  id: string;
  workspace_id: string;
  provider: string;
  name: string;
  external_url?: string;
  status?: string;
  link_icon?: string;
  link_color?: string;
  enabled: boolean;
  sort_order: number;
  metrics?: Record<string, unknown>;
  last_updated?: number;
  error?: string;
}

function transformOverwatchService(api: ApiOverwatchService): import('../types').OverwatchService {
  return {
    id: api.id,
    workspaceId: api.workspace_id,
    provider: api.provider as import('../types').ServiceProvider,
    name: api.name,
    externalUrl: api.external_url,
    status: api.status as import('../types').ServiceStatus,
    linkIcon: api.link_icon,
    linkColor: api.link_color,
    enabled: api.enabled,
    sortOrder: api.sort_order,
    metrics: api.metrics,
    lastUpdated: api.last_updated,
    error: api.error,
  };
}

export async function fetchOverwatchServices(workspaceId?: string): Promise<import('../types').OverwatchService[]> {
  const params = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : '';
  const response = await apiFetch<{ services: ApiOverwatchService[] }>(`/overwatch${params}`);
  return response.services.map(transformOverwatchService);
}

// Subscriptions
interface ApiSubscription {
  id: string;
  workspace_id: string;
  name: string;
  url?: string;
  favicon_url?: string;
  monthly_cost: number;
  billing_cycle: string;
  currency: string;
  category_id?: string;
  notes?: string;
  is_active: boolean;
  sort_order: number;
}

interface ApiSubscriptionCategory {
  id: string;
  workspace_id: string;
  name: string;
  color?: string;
  sort_order: number;
}

function transformSubscription(api: ApiSubscription): import('../types').Subscription {
  return {
    id: api.id,
    workspaceId: api.workspace_id,
    name: api.name,
    url: api.url,
    faviconUrl: api.favicon_url,
    monthlyCost: api.monthly_cost,
    billingCycle: api.billing_cycle as import('../types').BillingCycle,
    currency: api.currency,
    categoryId: api.category_id,
    notes: api.notes,
    isActive: api.is_active,
    sortOrder: api.sort_order,
  };
}

function transformSubscriptionCategory(api: ApiSubscriptionCategory): import('../types').SubscriptionCategory {
  return {
    id: api.id,
    workspaceId: api.workspace_id,
    name: api.name,
    color: api.color,
    sortOrder: api.sort_order,
  };
}

export async function fetchSubscriptions(workspaceId?: string): Promise<{
  subscriptions: import('../types').Subscription[];
  categories: import('../types').SubscriptionCategory[];
}> {
  const params = workspaceId ? `?workspace_id=${encodeURIComponent(workspaceId)}` : '';
  const response = await apiFetch<{
    subscriptions: ApiSubscription[];
    categories: ApiSubscriptionCategory[];
  }>(`/subscriptions${params}`);
  return {
    subscriptions: response.subscriptions.map(transformSubscription),
    categories: response.categories.map(transformSubscriptionCategory),
  };
}

// Bookmarks
interface ApiBookmark {
  id: string;
  url: string;
  title: string;
  description?: string;
  favicon_url?: string;
  collection_id?: string;
  order: number;
}

interface ApiBookmarkCollection {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  order: number;
}

function transformBookmark(api: ApiBookmark): import('../types').Bookmark {
  return {
    id: api.id,
    url: api.url,
    title: api.title,
    description: api.description,
    faviconUrl: api.favicon_url,
    collectionId: api.collection_id,
    order: api.order,
  };
}

function transformBookmarkCollection(api: ApiBookmarkCollection): import('../types').BookmarkCollection {
  return {
    id: api.id,
    name: api.name,
    icon: api.icon,
    color: api.color,
    order: api.order,
  };
}

export async function fetchBookmarks(): Promise<{
  bookmarks: import('../types').Bookmark[];
  collections: import('../types').BookmarkCollection[];
}> {
  const response = await apiFetch<{
    bookmarks: ApiBookmark[];
    collections: ApiBookmarkCollection[];
  }>('/bookmarks');
  return {
    bookmarks: response.bookmarks.map(transformBookmark),
    collections: response.collections.map(transformBookmarkCollection),
  };
}

// Query Keys
export const queryKeys = {
  workspaces: ['workspaces'] as const,
  projects: (workspaceId: string) => ['projects', workspaceId] as const,
  issues: (projectId: string) => ['issues', projectId] as const,
  autoBuild: (projectId: string) => ['autobuild', projectId] as const,
  sessions: (projectId: string) => ['sessions', projectId] as const,
  messages: (projectId: string, sessionId: string) =>
    ['messages', projectId, sessionId] as const,
  overwatch: (workspaceId?: string) => ['overwatch', workspaceId] as const,
  subscriptions: (workspaceId?: string) => ['subscriptions', workspaceId] as const,
  bookmarks: ['bookmarks'] as const,
};
