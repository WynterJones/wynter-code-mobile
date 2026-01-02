/**
 * API Client for wynter-code desktop connection
 *
 * This is the main entry point for all API calls. All domain-specific functionality
 * has been extracted to separate modules, but everything is re-exported here to
 * maintain backward compatibility with existing imports.
 */
import type { PairResponse } from '../types';

// ============================================================================
// Re-export base infrastructure
// ============================================================================

export { queryClient } from './base';

// ============================================================================
// Pairing and Health Check (no auth required)
// ============================================================================

export async function pairWithDesktop(
  host: string,
  port: number,
  code: string
): Promise<PairResponse> {
  const url = `http://${host}:${port}/api/v1/pair`;

  // Generate a unique device ID and name
  const deviceId = `mobile-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  const deviceName = 'Wynter Code Mobile';

  if (__DEV__) {
    console.log('[pairWithDesktop] Initiating pairing');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code,
      device_id: deviceId,
      device_name: deviceName,
    }),
  });

  if (__DEV__) {
    console.log('[pairWithDesktop] Response status:', response.status);
  }

  if (!response.ok) {
    const errorBody = await response.text();
    if (__DEV__) {
      console.error('[pairWithDesktop] Error response:', errorBody);
    }
    try {
      const error = JSON.parse(errorBody).error || 'Pairing failed';
      throw new Error(error);
    } catch {
      throw new Error(errorBody || 'Pairing failed');
    }
  }

  const data = await response.json();
  if (__DEV__) {
    console.log('[pairWithDesktop] Success');
  }

  // Return in expected format with device info
  return {
    token: data.token,
    device: {
      id: deviceId,
      name: deviceName,
    },
  };
}

export async function pingDesktop(host: string, port: number): Promise<boolean> {
  const url = `http://${host}:${port}/api/v1/ping`;
  if (__DEV__) {
    console.log('[pingDesktop] Checking desktop connection');
  }

  // Create abort controller for timeout (AbortSignal.timeout not available in RN)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (__DEV__) {
      console.log('[pingDesktop] Response status:', response.status);
    }
    return response.ok;
  } catch (error) {
    clearTimeout(timeoutId);
    if (__DEV__) {
      console.error('[pingDesktop] Error:', error);
    }
    return false;
  }
}

// ============================================================================
// Re-export all domain APIs for backward compatibility
// ============================================================================

// Workspaces
export {
  fetchWorkspaces,
  fetchProjects,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  createProject,
  updateProject,
  deleteProject,
  netlifySetToken,
  netlifyCheckAuth,
  netlifyListSites,
  netlifyCreateSite,
  netlifyListDeploys,
  netlifyDeploy,
  netlifyRollback,
} from './workspaces';

export type {
  CreateWorkspaceInput,
  CreateWorkspaceResponse,
  UpdateWorkspaceInput,
  CreateProjectInput,
  CreateProjectResponse,
  UpdateProjectInput,
  NetlifyAuthResponse,
  NetlifySite,
  NetlifyDeploy,
  NetlifyDeployResponse,
} from './workspaces';

// Issues
export {
  fetchIssues,
  createIssue,
  updateIssue,
  closeIssue,
  fetchAutoBuildStatus,
  startAutoBuild,
  pauseAutoBuild,
  stopAutoBuild,
  addToAutoBuildQueue,
  removeFromAutoBuildQueue,
  fetchAutoBuildBacklog,
} from './issues';

export type {
  FetchIssuesOptions,
  AutoBuildBacklogItem,
  AutoBuildBacklog,
} from './issues';

// Subscriptions
export {
  fetchOverwatchServices,
  fetchSubscriptions,
  getSubscription,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  createSubscriptionCategory,
  updateSubscriptionCategory,
  deleteSubscriptionCategory,
} from './subscriptions';

export type {
  CreateSubscriptionInput,
  UpdateSubscriptionInput,
  CreateSubscriptionCategoryInput,
  UpdateSubscriptionCategoryInput,
} from './subscriptions';

// Chat
export {
  fetchSessions,
  fetchMessages,
  sendMessage,
  approveToolCall,
  rejectToolCall,
  sendMobileChatMessage,
} from './chat';

export type {
  MobileChatRequest,
  MobileChatChunk,
} from './chat';

// Features
export {
  // Bookmarks
  fetchBookmarks,
  createBookmark,
  updateBookmark,
  deleteBookmark,
  createBookmarkCollection,
  updateBookmarkCollection,
  deleteBookmarkCollection,
  // Docs
  fetchDocsList,
  fetchDocContent,
  saveDocContent,
  // Templates
  fetchTemplates,
  // Filesystem
  fetchFilesystemBrowse,
  createDirectory,
  fetchHomeDirectory,
  // Terminal
  createTerminal,
  writeTerminal,
  closeTerminal,
  // Preview
  detectPreviewProject,
  startPreview,
  stopPreview,
  fetchPreviewStatus,
  fetchPreviewList,
  // Tunnel
  checkTunnel,
  startTunnel,
  stopTunnel,
  fetchTunnelList,
  // Farmwork
  checkFarmworkInstalled,
  // Kanban
  fetchKanbanTasks,
  createKanbanTask,
  updateKanbanTask,
  deleteKanbanTask,
  moveKanbanTask,
} from './features';

export type {
  CreateBookmarkInput,
  UpdateBookmarkInput,
  CreateBookmarkCollectionInput,
  UpdateBookmarkCollectionInput,
  DocFile,
  DocsListResponse,
  DocsContentResponse,
  TemplatesResponse,
  TerminalCreateRequest,
  PreviewStartRequest,
  FarmworkCheckResponse,
} from './features';

// ============================================================================
// Query Keys
// ============================================================================

export const queryKeys = {
  workspaces: ['workspaces'] as const,
  projects: (workspaceId: string) => ['projects', workspaceId] as const,
  issues: (projectId: string) => ['issues', projectId] as const,
  autoBuild: (projectId: string) => ['autobuild', projectId] as const,
  autoBuildBacklog: (projectId: string) => ['autobuild-backlog', projectId] as const,
  sessions: (projectId: string) => ['sessions', projectId] as const,
  messages: (projectId: string, sessionId: string) =>
    ['messages', projectId, sessionId] as const,
  overwatch: (workspaceId?: string) => ['overwatch', workspaceId] as const,
  subscriptions: (workspaceId?: string) => ['subscriptions', workspaceId] as const,
  bookmarks: ['bookmarks'] as const,
  docs: (projectPath: string) => ['docs', projectPath] as const,
  docContent: (projectPath: string, filePath: string) => ['doc-content', projectPath, filePath] as const,
  templates: ['templates'] as const,
  filesystem: (path: string) => ['filesystem', path] as const,
  homeDirectory: ['homeDirectory'] as const,
  previewDetect: (projectPath: string) => ['preview-detect', projectPath] as const,
  previewList: ['preview-list'] as const,
  previewStatus: (serverId?: string) => ['preview-status', serverId] as const,
  tunnelCheck: ['tunnel-check'] as const,
  tunnelList: ['tunnel-list'] as const,
  farmworkCheck: (projectPath: string) => ['farmwork-check', projectPath] as const,
  kanban: (workspaceId: string) => ['kanban', workspaceId] as const,
};
