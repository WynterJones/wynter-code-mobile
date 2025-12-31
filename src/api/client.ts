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

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Pairing failed' }));
    throw new Error(error.error || 'Invalid pairing code');
  }

  return response.json();
}

// Health check
export async function pingDesktop(host: string, port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://${host}:${port}/api/v1/ping`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// Workspaces & Projects
export async function fetchWorkspaces(): Promise<Workspace[]> {
  const response = await apiFetch<ApiResponse<Workspace[]>>('/workspaces');
  return response.data || [];
}

export async function fetchProjects(workspaceId: string): Promise<Project[]> {
  const response = await apiFetch<ApiResponse<Project[]>>(
    `/workspaces/${workspaceId}/projects`
  );
  return response.data || [];
}

// Issues (Beads) - Note: API expects project_path as query param
export async function fetchIssues(projectPath: string): Promise<Issue[]> {
  const encodedPath = encodeURIComponent(projectPath);
  return apiFetch<Issue[]>(
    `/projects/current/beads?project_path=${encodedPath}`
  );
}

export async function createIssue(
  projectPath: string,
  input: CreateIssueInput
): Promise<Issue> {
  const encodedPath = encodeURIComponent(projectPath);
  return apiFetch<Issue>(
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
}

export async function updateIssue(
  projectPath: string,
  issueId: string,
  input: UpdateIssueInput
): Promise<Issue> {
  const encodedPath = encodeURIComponent(projectPath);
  return apiFetch<Issue>(
    `/projects/current/beads/${issueId}?project_path=${encodedPath}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        project_path: projectPath,
        ...input,
      }),
    }
  );
}

export async function closeIssue(
  projectPath: string,
  issueId: string,
  reason: string
): Promise<Issue> {
  const encodedPath = encodeURIComponent(projectPath);
  return apiFetch<Issue>(
    `/projects/current/beads/${issueId}/close?project_path=${encodedPath}`,
    {
      method: 'POST',
      body: JSON.stringify({ project_path: projectPath, reason }),
    }
  );
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

// Query Keys
export const queryKeys = {
  workspaces: ['workspaces'] as const,
  projects: (workspaceId: string) => ['projects', workspaceId] as const,
  issues: (projectId: string) => ['issues', projectId] as const,
  autoBuild: (projectId: string) => ['autobuild', projectId] as const,
  sessions: (projectId: string) => ['sessions', projectId] as const,
  messages: (projectId: string, sessionId: string) =>
    ['messages', projectId, sessionId] as const,
};
