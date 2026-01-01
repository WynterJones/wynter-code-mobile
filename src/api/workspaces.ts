/**
 * Workspace and Project API
 */
import type { Workspace, Project } from '../types';
import { apiFetch } from './base';

// Workspaces & Projects
export async function fetchWorkspaces(): Promise<Workspace[]> {
  // API returns workspaces directly, not wrapped in ApiResponse
  return apiFetch<Workspace[]>('/workspaces');
}

export async function fetchProjects(workspaceId: string): Promise<Project[]> {
  // API returns projects directly, not wrapped in ApiResponse
  return apiFetch<Project[]>(`/workspaces/${workspaceId}/projects`);
}

// Workspace CRUD
export interface CreateWorkspaceInput {
  name: string;
  color?: string;
}

export interface CreateWorkspaceResponse {
  id: string;
  name: string;
  color: string;
}

export async function createWorkspace(input: CreateWorkspaceInput): Promise<CreateWorkspaceResponse> {
  return apiFetch<CreateWorkspaceResponse>('/workspaces', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface UpdateWorkspaceInput {
  name?: string;
  color?: string;
}

export async function updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput): Promise<void> {
  await apiFetch<void>(`/workspaces/${workspaceId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  await apiFetch<void>(`/workspaces/${workspaceId}`, {
    method: 'DELETE',
  });
}

// Project CRUD
export interface CreateProjectInput {
  name: string;
  path: string;
  color?: string;
}

export interface CreateProjectResponse {
  id: string;
  name: string;
  path: string;
  workspaceId: string;
}

export async function createProject(workspaceId: string, input: CreateProjectInput): Promise<CreateProjectResponse> {
  return apiFetch<CreateProjectResponse>(`/workspaces/${workspaceId}/projects`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export interface UpdateProjectInput {
  name?: string;
  color?: string;
}

export async function updateProject(projectId: string, input: UpdateProjectInput): Promise<void> {
  await apiFetch<void>(`/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteProject(projectId: string): Promise<void> {
  await apiFetch<void>(`/projects/${projectId}`, {
    method: 'DELETE',
  });
}

// Netlify API
export interface NetlifyAuthResponse {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
  };
}

export interface NetlifySite {
  id: string;
  name: string;
  url: string;
  ssl_url: string;
  admin_url: string;
  created_at: string;
  updated_at: string;
  screenshot_url?: string;
}

export interface NetlifyDeploy {
  id: string;
  state: string; // 'ready' | 'building' | 'error' | 'enqueued'
  created_at: string;
  published_at?: string;
  deploy_url: string;
  deploy_ssl_url: string;
  error_message?: string;
}

export async function netlifySetToken(token: string): Promise<NetlifyAuthResponse> {
  return apiFetch<NetlifyAuthResponse>('/netlify/auth', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function netlifyCheckAuth(): Promise<NetlifyAuthResponse> {
  return apiFetch<NetlifyAuthResponse>('/netlify/auth');
}

export async function netlifyListSites(): Promise<NetlifySite[]> {
  return apiFetch<NetlifySite[]>('/netlify/sites');
}

export async function netlifyCreateSite(name: string): Promise<NetlifySite> {
  return apiFetch<NetlifySite>('/netlify/sites', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function netlifyListDeploys(siteId: string): Promise<NetlifyDeploy[]> {
  return apiFetch<NetlifyDeploy[]>(`/netlify/sites/${siteId}/deploys`);
}

export interface NetlifyDeployResponse {
  deploy: NetlifyDeploy;
}

export async function netlifyDeploy(siteId: string, projectPath: string): Promise<NetlifyDeployResponse> {
  return apiFetch<NetlifyDeployResponse>('/netlify/deploy', {
    method: 'POST',
    body: JSON.stringify({ site_id: siteId, project_path: projectPath }),
  });
}

export async function netlifyRollback(siteId: string, deployId: string): Promise<NetlifyDeploy> {
  return apiFetch<NetlifyDeploy>('/netlify/rollback', {
    method: 'POST',
    body: JSON.stringify({ site_id: siteId, deploy_id: deployId }),
  });
}
