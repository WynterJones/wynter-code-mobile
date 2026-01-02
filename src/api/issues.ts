/**
 * Issues (Beads) and AutoBuild API
 */
import type { Issue, CreateIssueInput, UpdateIssueInput, AutoBuildState } from '../types';
import { apiFetch } from './base';

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

export interface FetchIssuesOptions {
  limit?: number;
  offset?: number;
}

export async function fetchIssues(
  projectPath: string,
  options: FetchIssuesOptions = {}
): Promise<Issue[]> {
  const encodedPath = encodeURIComponent(projectPath);
  const { limit = 50, offset = 0 } = options;
  const apiIssues = await apiFetch<ApiIssue[]>(
    `/projects/current/beads?project_path=${encodedPath}&limit=${limit}&offset=${offset}`
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

// Auto-Build API response (snake_case from server)
interface ApiAutoBuildStatus {
  status: string;
  current_issue_id?: string;
  current_phase?: string;
  progress?: number;
  workers?: Array<{
    id: string | number;
    issue_id?: string;
    status?: string;
    current_task?: string;
    progress?: number;
  }>;
  queue?: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
  }>;
  human_review?: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
  }>;
  completed?: Array<{
    id: string;
    title: string;
    status: string;
    created_at: string;
  }>;
  logs?: Array<{
    id: string;
    level: string;
    message: string;
    timestamp: string;
  }>;
  error?: string;
}

// Transform snake_case API response to camelCase AutoBuildState
function transformApiAutoBuildStatus(api: ApiAutoBuildStatus): AutoBuildState {
  return {
    status: (api.status === 'idle' ? 'stopped' : api.status) as AutoBuildState['status'],
    currentIssueId: api.current_issue_id,
    currentPhase: api.current_phase as AutoBuildState['currentPhase'],
    progress: api.progress ?? 0,
    workers: (api.workers ?? []).map((w) => ({
      id: String(w.id),
      status: (w.status ?? 'idle') as 'idle' | 'working' | 'done' | 'error',
      currentTask: w.current_task,
      progress: w.progress ?? 0,
    })),
    queue: (api.queue ?? []).map((q) => ({
      id: q.id,
      description: q.title,
      status: q.status as 'pending' | 'processing' | 'completed',
      createdAt: q.created_at,
    })),
    humanReview: (api.human_review ?? []).map((h) => ({
      id: h.id,
      description: h.title,
      status: h.status as 'pending' | 'processing' | 'completed',
      createdAt: h.created_at,
    })),
    completed: (api.completed ?? []).map((c) => ({
      id: c.id,
      description: c.title,
      status: c.status as 'pending' | 'processing' | 'completed',
      createdAt: c.created_at,
    })),
    logs: (api.logs ?? []).map((l) => ({
      id: l.id,
      level: l.level as 'info' | 'success' | 'warn' | 'error',
      message: l.message,
      timestamp: l.timestamp,
    })),
  };
}

export async function fetchAutoBuildStatus(projectId: string): Promise<AutoBuildState> {
  // API returns the state in snake_case format
  const response = await apiFetch<ApiAutoBuildStatus>(
    `/projects/${projectId}/autobuild/status`
  );

  if (!response) {
    return {
      status: 'stopped',
      workers: [],
      queue: [],
      humanReview: [],
      completed: [],
      logs: [],
      progress: 0,
    };
  }

  return transformApiAutoBuildStatus(response);
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

// Auto-Build Backlog (persistent)
export interface AutoBuildBacklogItem {
  id: string;
  title: string;
  status: string;
  priority: number;
  issue_type: string;
  created_at: string;
}

export interface AutoBuildBacklog {
  issues: AutoBuildBacklogItem[];
  completed: AutoBuildBacklogItem[];
  human_review: AutoBuildBacklogItem[];
  updated_at: string | null;
}

export async function fetchAutoBuildBacklog(projectId: string): Promise<AutoBuildBacklog> {
  const response = await apiFetch<AutoBuildBacklog>(
    `/projects/${projectId}/autobuild/backlog`
  );
  return response || {
    issues: [],
    completed: [],
    human_review: [],
    updated_at: null,
  };
}
