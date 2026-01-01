/**
 * React Query hooks for workspace and project data fetching
 */
import { useQuery } from '@tanstack/react-query';
import {
  fetchWorkspaces,
  fetchProjects,
  fetchDocsList,
  fetchDocContent,
  queryKeys,
} from './client';
import { useIsConnected, useSelectedProject } from './hooks';

/**
 * Fetch all workspaces
 */
export function useWorkspaces() {
  const isConnected = useIsConnected();

  return useQuery({
    queryKey: queryKeys.workspaces,
    queryFn: fetchWorkspaces,
    enabled: isConnected,
    staleTime: 60000, // 1 minute
    // Deduplicate workspaces by id to prevent duplicate key errors during cache invalidation race conditions
    select: (data) => {
      const seen = new Set<string>();
      return data.filter((ws) => {
        if (seen.has(ws.id)) return false;
        seen.add(ws.id);
        return true;
      });
    },
  });
}

/**
 * Fetch projects for a workspace
 */
export function useProjects(workspaceId: string) {
  const isConnected = useIsConnected();

  return useQuery({
    queryKey: queryKeys.projects(workspaceId),
    queryFn: () => fetchProjects(workspaceId),
    enabled: isConnected && !!workspaceId,
  });
}

// ============================================================================
// Docs Hooks
// ============================================================================

/**
 * Fetch list of markdown files for the selected project
 */
export function useDocs() {
  const isConnected = useIsConnected();
  const selectedProject = useSelectedProject();
  const projectPath = selectedProject?.path ?? '';

  return useQuery({
    queryKey: queryKeys.docs(projectPath),
    queryFn: () => fetchDocsList(projectPath),
    enabled: isConnected && !!projectPath,
    staleTime: 60000, // 1 minute
  });
}

/**
 * Fetch content of a specific markdown file
 */
export function useDocContent(filePath: string) {
  const isConnected = useIsConnected();
  const selectedProject = useSelectedProject();
  const projectPath = selectedProject?.path ?? '';

  return useQuery({
    queryKey: queryKeys.docContent(projectPath, filePath),
    queryFn: () => fetchDocContent(projectPath, filePath),
    enabled: isConnected && !!projectPath && !!filePath,
    staleTime: 30000, // 30 seconds
  });
}
