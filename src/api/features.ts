/**
 * Additional Features API - Bookmarks, Docs, Templates, Filesystem, Terminal, Preview, Tunnel, Farmwork, Kanban
 */
import { apiFetch } from './base';

// ============================================================================
// Bookmarks
// ============================================================================

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

// Bookmark CRUD
export interface CreateBookmarkInput {
  url: string;
  title: string;
  description?: string;
  faviconUrl?: string;
  collectionId?: string;
}

export async function createBookmark(input: CreateBookmarkInput): Promise<import('../types').Bookmark> {
  const apiBookmark = await apiFetch<ApiBookmark>('/bookmarks', {
    method: 'POST',
    body: JSON.stringify({
      url: input.url,
      title: input.title,
      description: input.description,
      favicon_url: input.faviconUrl,
      collection_id: input.collectionId,
    }),
  });
  return transformBookmark(apiBookmark);
}

export interface UpdateBookmarkInput {
  url?: string;
  title?: string;
  description?: string;
  faviconUrl?: string;
  collectionId?: string | null;
  order?: number;
}

export async function updateBookmark(id: string, input: UpdateBookmarkInput): Promise<void> {
  await apiFetch<void>(`/bookmarks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      url: input.url,
      title: input.title,
      description: input.description,
      favicon_url: input.faviconUrl,
      collection_id: input.collectionId,
      order: input.order,
    }),
  });
}

export async function deleteBookmark(id: string): Promise<void> {
  await apiFetch<void>(`/bookmarks/${id}`, {
    method: 'DELETE',
  });
}

// Bookmark Collection CRUD
export interface CreateBookmarkCollectionInput {
  name: string;
  icon?: string;
  color?: string;
}

export async function createBookmarkCollection(input: CreateBookmarkCollectionInput): Promise<import('../types').BookmarkCollection> {
  const apiCollection = await apiFetch<ApiBookmarkCollection>('/bookmarks/collections', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      icon: input.icon,
      color: input.color,
    }),
  });
  return transformBookmarkCollection(apiCollection);
}

export interface UpdateBookmarkCollectionInput {
  name?: string;
  icon?: string;
  color?: string;
  order?: number;
}

export async function updateBookmarkCollection(id: string, input: UpdateBookmarkCollectionInput): Promise<void> {
  await apiFetch<void>(`/bookmarks/collections/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: input.name,
      icon: input.icon,
      color: input.color,
      order: input.order,
    }),
  });
}

export async function deleteBookmarkCollection(id: string): Promise<void> {
  await apiFetch<void>(`/bookmarks/collections/${id}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Docs - List and view markdown files
// ============================================================================

export interface DocFile {
  name: string;
  path: string;
  folder?: string;
  size: number;
  modified?: number;
}

export interface DocsListResponse {
  docs: DocFile[];
}

export interface DocsContentResponse {
  content: string;
  name: string;
  path: string;
}

export async function fetchDocsList(projectPath: string): Promise<DocFile[]> {
  const encodedPath = encodeURIComponent(projectPath);
  const response = await apiFetch<DocsListResponse>(`/docs/list?project_path=${encodedPath}`);
  return response.docs;
}

export async function fetchDocContent(projectPath: string, filePath: string): Promise<DocsContentResponse> {
  const encodedProjectPath = encodeURIComponent(projectPath);
  const encodedFilePath = encodeURIComponent(filePath);
  return apiFetch<DocsContentResponse>(
    `/docs/content?project_path=${encodedProjectPath}&file_path=${encodedFilePath}`
  );
}

export async function saveDocContent(projectPath: string, filePath: string, content: string): Promise<void> {
  await apiFetch<void>('/docs/save', {
    method: 'POST',
    body: JSON.stringify({
      project_path: projectPath,
      file_path: filePath,
      content,
    }),
  });
}

// ============================================================================
// Templates API
// ============================================================================

export interface TemplatesResponse {
  templates: import('../types').ProjectTemplate[];
  categories: import('../types').CategoryInfo[];
}

export async function fetchTemplates(): Promise<TemplatesResponse> {
  return apiFetch<TemplatesResponse>('/templates');
}

// ============================================================================
// Filesystem API
// ============================================================================

export async function fetchFilesystemBrowse(path: string): Promise<import('../types').FilesystemBrowseResponse> {
  const encodedPath = encodeURIComponent(path);
  return apiFetch<import('../types').FilesystemBrowseResponse>(`/filesystem/browse?path=${encodedPath}`);
}

export async function createDirectory(path: string): Promise<{ path: string; created: boolean }> {
  return apiFetch<{ path: string; created: boolean }>('/filesystem/mkdir', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

export async function fetchHomeDirectory(): Promise<{ path: string }> {
  return apiFetch<{ path: string }>('/filesystem/homedir');
}

// ============================================================================
// Terminal API
// ============================================================================

export interface TerminalCreateRequest {
  cwd: string;
  cols?: number;
  rows?: number;
  shell?: string;
}

export async function createTerminal(request: TerminalCreateRequest): Promise<{ pty_id: string }> {
  return apiFetch<{ pty_id: string }>('/terminal/create', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function writeTerminal(ptyId: string, data: string): Promise<void> {
  await apiFetch<void>(`/terminal/${ptyId}/write`, {
    method: 'POST',
    body: JSON.stringify({ data }),
  });
}

export async function closeTerminal(ptyId: string): Promise<void> {
  await apiFetch<void>(`/terminal/${ptyId}`, {
    method: 'DELETE',
  });
}

// ============================================================================
// Live Preview API
// ============================================================================

export async function detectPreviewProject(projectPath: string): Promise<import('../types').PreviewDetectResult> {
  const encodedPath = encodeURIComponent(projectPath);
  return apiFetch<import('../types').PreviewDetectResult>(`/preview/detect?project_path=${encodedPath}`);
}

export interface PreviewStartRequest {
  projectPath: string;
  port?: number;
  useFrameworkServer?: boolean;
}

export async function startPreview(request: PreviewStartRequest): Promise<import('../types').PreviewStartResponse> {
  return apiFetch<import('../types').PreviewStartResponse>('/preview/start', {
    method: 'POST',
    body: JSON.stringify({
      project_path: request.projectPath,
      port: request.port,
      use_framework_server: request.useFrameworkServer,
    }),
  });
}

export async function stopPreview(serverId: string): Promise<void> {
  await apiFetch<void>('/preview/stop', {
    method: 'POST',
    body: JSON.stringify({ server_id: serverId }),
  });
}

export async function fetchPreviewStatus(serverId?: string): Promise<import('../types').PreviewServer | null> {
  const params = serverId ? `?server_id=${serverId}` : '';
  return apiFetch<import('../types').PreviewServer | null>(`/preview/status${params}`);
}

export async function fetchPreviewList(): Promise<import('../types').PreviewServer[]> {
  return apiFetch<import('../types').PreviewServer[]>('/preview/list');
}

// ============================================================================
// Tunnel API
// ============================================================================

export async function checkTunnel(): Promise<import('../types').TunnelCheckResult> {
  return apiFetch<import('../types').TunnelCheckResult>('/tunnel/check');
}

export async function startTunnel(port: number): Promise<{ tunnelId: string }> {
  return apiFetch<{ tunnelId: string }>('/tunnel/start', {
    method: 'POST',
    body: JSON.stringify({ port }),
  });
}

export async function stopTunnel(tunnelId: string): Promise<void> {
  await apiFetch<void>('/tunnel/stop', {
    method: 'POST',
    body: JSON.stringify({ tunnel_id: tunnelId }),
  });
}

export async function fetchTunnelList(): Promise<import('../types').TunnelInfo[]> {
  return apiFetch<import('../types').TunnelInfo[]>('/tunnel/list');
}

// ============================================================================
// Farmwork API
// ============================================================================

export interface FarmworkCheckResponse {
  installed: boolean;
  config_path: string | null;
}

export async function checkFarmworkInstalled(projectPath: string): Promise<FarmworkCheckResponse> {
  const encodedPath = encodeURIComponent(projectPath);
  return apiFetch<FarmworkCheckResponse>(`/farmwork/check?project_path=${encodedPath}`);
}

export interface AuditMetadata {
  score: number;
  open_items: Array<{ priority: string; text: string }>;
  last_updated?: string;
  status?: string;
}

export interface FarmworkStats {
  audit_scores: {
    security: AuditMetadata;
    tests: AuditMetadata;
    performance: AuditMetadata;
    accessibility: AuditMetadata;
    code_quality: AuditMetadata;
    farmhouse: AuditMetadata;
  };
  garden_stats: {
    active_ideas: number;
    planted: number;
    growing: number;
    picked: number;
  };
  compost_stats: {
    rejected_ideas: number;
  };
  beads_stats?: {
    total: number;
    open: number;
    in_progress: number;
    closed: number;
  };
}

export async function fetchFarmworkStats(projectPath: string): Promise<FarmworkStats | null> {
  const encodedPath = encodeURIComponent(projectPath);
  return apiFetch<FarmworkStats | null>(`/farmwork/stats?project_path=${encodedPath}`);
}

// ============================================================================
// Kanban Board API
// ============================================================================

interface ApiKanbanTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: number;
  created_at: number;
  updated_at: number;
  order: number;
  locked: boolean;
}

function transformKanbanTask(api: ApiKanbanTask): import('../types').KanbanTask {
  return {
    id: api.id,
    title: api.title,
    description: api.description,
    status: api.status as import('../types').KanbanStatus,
    priority: api.priority as import('../types').KanbanPriority,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
    order: api.order,
    locked: api.locked,
  };
}

export async function fetchKanbanTasks(workspaceId: string): Promise<import('../types').KanbanTask[]> {
  const tasks = await apiFetch<ApiKanbanTask[]>(`/kanban/${workspaceId}`);
  return tasks.map(transformKanbanTask);
}

export async function createKanbanTask(
  workspaceId: string,
  input: import('../types').CreateKanbanTaskInput
): Promise<import('../types').KanbanTask> {
  const task = await apiFetch<ApiKanbanTask>(`/kanban/${workspaceId}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      priority: input.priority,
    }),
  });
  return transformKanbanTask(task);
}

export async function updateKanbanTask(
  workspaceId: string,
  taskId: string,
  input: import('../types').UpdateKanbanTaskInput
): Promise<void> {
  await apiFetch<void>(`/kanban/${workspaceId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title: input.title,
      description: input.description,
      priority: input.priority,
      locked: input.locked,
    }),
  });
}

export async function deleteKanbanTask(workspaceId: string, taskId: string): Promise<void> {
  await apiFetch<void>(`/kanban/${workspaceId}/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

export async function moveKanbanTask(
  workspaceId: string,
  taskId: string,
  input: import('../types').MoveKanbanTaskInput
): Promise<void> {
  await apiFetch<void>(`/kanban/${workspaceId}/tasks/${taskId}/move`, {
    method: 'POST',
    body: JSON.stringify({
      status: input.status,
      order: input.order,
    }),
  });
}
