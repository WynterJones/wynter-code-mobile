/**
 * Zod schemas for runtime validation of API responses
 *
 * These schemas validate that API responses match expected types,
 * providing better error messages and type safety at runtime.
 */
import { z } from 'zod';

// ============================================================================
// Core Schemas
// ============================================================================

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().optional(),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  workspaceId: z.string(),
  color: z.string().optional(),
});

// ============================================================================
// Issues (Beads) Schemas
// ============================================================================

// API returns snake_case
export const ApiIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  issue_type: z.string(),
  priority: z.number(),
  parent_id: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().optional(),
  close_reason: z.string().optional(),
});

// ============================================================================
// Auto-Build Schemas
// ============================================================================

export const AutoBuildWorkerSchema = z.object({
  id: z.string(),
  status: z.enum(['idle', 'working', 'paused', 'error']),
  currentIssueId: z.string().optional().nullable(),
  progress: z.number().optional(),
});

export const AutoBuildQueueItemSchema = z.object({
  id: z.string(),
  issueId: z.string(),
  priority: z.number(),
  status: z.enum(['queued', 'in_progress', 'completed', 'failed']),
});

export const AutoBuildStateSchema = z.object({
  status: z.enum(['stopped', 'running', 'paused', 'error']),
  workers: z.array(AutoBuildWorkerSchema).optional().default([]),
  queue: z.array(AutoBuildQueueItemSchema).optional().default([]),
  humanReview: z.array(z.string()).optional().default([]),
  completed: z.array(z.string()).optional().default([]),
  logs: z.array(z.string()).optional().default([]),
  progress: z.number().optional().default(0),
});

export const AutoBuildBacklogItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  priority: z.number(),
  issue_type: z.string(),
  created_at: z.string(),
});

export const AutoBuildBacklogSchema = z.object({
  issues: z.array(AutoBuildBacklogItemSchema).default([]),
  completed: z.array(AutoBuildBacklogItemSchema).default([]),
  human_review: z.array(AutoBuildBacklogItemSchema).default([]),
  updated_at: z.string().nullable(),
});

// ============================================================================
// Chat Schemas
// ============================================================================

export const ChatSessionSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ChatMessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string(),
  toolCalls: z.array(z.object({
    id: z.string(),
    name: z.string(),
    status: z.enum(['pending', 'approved', 'rejected', 'completed', 'error']),
    input: z.record(z.unknown()).optional(),
    output: z.string().optional(),
  })).optional(),
});

export const ApiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    data: dataSchema.optional(),
    error: z.string().optional(),
  });

// ============================================================================
// Netlify Schemas
// ============================================================================

export const NetlifyAuthResponseSchema = z.object({
  authenticated: z.boolean(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    full_name: z.string().optional(),
    avatar_url: z.string().optional(),
  }).optional(),
});

export const NetlifySiteSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  ssl_url: z.string(),
  admin_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  screenshot_url: z.string().optional(),
});

export const NetlifyDeploySchema = z.object({
  id: z.string(),
  state: z.string(),
  created_at: z.string(),
  published_at: z.string().optional(),
  deploy_url: z.string(),
  deploy_ssl_url: z.string(),
  error_message: z.string().optional(),
});

// ============================================================================
// Overwatch Schemas
// ============================================================================

export const ApiOverwatchServiceSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  provider: z.string(),
  name: z.string(),
  external_url: z.string().optional(),
  status: z.string().optional(),
  link_icon: z.string().optional(),
  link_color: z.string().optional(),
  enabled: z.boolean(),
  sort_order: z.number(),
  metrics: z.record(z.unknown()).optional(),
  last_updated: z.number().optional(),
  error: z.string().optional(),
});

// ============================================================================
// Subscriptions Schemas
// ============================================================================

export const ApiSubscriptionSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  url: z.string().optional(),
  favicon_url: z.string().optional(),
  monthly_cost: z.number(),
  billing_cycle: z.string(),
  currency: z.string(),
  category_id: z.string().optional(),
  notes: z.string().optional(),
  is_active: z.boolean(),
  sort_order: z.number(),
});

export const ApiSubscriptionCategorySchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  color: z.string().optional(),
  sort_order: z.number(),
});

// ============================================================================
// Bookmarks Schemas
// ============================================================================

export const ApiBookmarkSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  description: z.string().optional(),
  favicon_url: z.string().optional(),
  collection_id: z.string().optional(),
  order: z.number(),
});

export const ApiBookmarkCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
  color: z.string().optional(),
  order: z.number(),
});

// ============================================================================
// Kanban Schemas
// ============================================================================

export const ApiKanbanTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  priority: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
  order: z.number(),
  locked: z.boolean(),
});

// ============================================================================
// Pairing Schemas
// ============================================================================

export const PairResponseSchema = z.object({
  token: z.string(),
  device: z.object({
    id: z.string(),
    name: z.string(),
  }),
});

// ============================================================================
// Workspace/Project CRUD Schemas
// ============================================================================

export const CreateWorkspaceResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
});

export const CreateProjectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  workspaceId: z.string(),
});

// ============================================================================
// Docs Schemas
// ============================================================================

export const DocFileSchema = z.object({
  name: z.string(),
  path: z.string(),
  folder: z.string().optional(),
  size: z.number(),
  modified: z.number().optional(),
});

export const DocsListResponseSchema = z.object({
  docs: z.array(DocFileSchema),
});

export const DocsContentResponseSchema = z.object({
  content: z.string(),
  name: z.string(),
  path: z.string(),
});

// ============================================================================
// Templates Schemas
// ============================================================================

export const ProjectTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  icon: z.string().optional(),
  color: z.string().optional(),
});

export const CategoryInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string().optional(),
});

export const TemplatesResponseSchema = z.object({
  templates: z.array(ProjectTemplateSchema),
  categories: z.array(CategoryInfoSchema),
});

// ============================================================================
// Filesystem Schemas
// ============================================================================

export const FilesystemEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  isDirectory: z.boolean(),
  size: z.number().optional(),
  modified: z.number().optional(),
});

export const FilesystemBrowseResponseSchema = z.object({
  path: z.string(),
  entries: z.array(FilesystemEntrySchema),
  parent: z.string().optional(),
});

// ============================================================================
// Preview Schemas
// ============================================================================

export const PreviewDetectResultSchema = z.object({
  detected: z.boolean(),
  framework: z.string().optional(),
  command: z.string().optional(),
  port: z.number().optional(),
});

export const PreviewServerSchema = z.object({
  id: z.string(),
  projectPath: z.string(),
  port: z.number(),
  url: z.string(),
  status: z.enum(['starting', 'running', 'stopped', 'error']),
  framework: z.string().optional(),
});

export const PreviewStartResponseSchema = z.object({
  server: PreviewServerSchema,
});

// ============================================================================
// Tunnel Schemas
// ============================================================================

export const TunnelCheckResultSchema = z.object({
  available: z.boolean(),
  tool: z.string().optional(),
});

export const TunnelInfoSchema = z.object({
  id: z.string(),
  port: z.number(),
  url: z.string(),
  status: z.enum(['active', 'inactive']),
});

// ============================================================================
// Type exports for convenience
// ============================================================================

export type ValidatedWorkspace = z.infer<typeof WorkspaceSchema>;
export type ValidatedProject = z.infer<typeof ProjectSchema>;
export type ValidatedApiIssue = z.infer<typeof ApiIssueSchema>;
export type ValidatedAutoBuildState = z.infer<typeof AutoBuildStateSchema>;
export type ValidatedAutoBuildBacklog = z.infer<typeof AutoBuildBacklogSchema>;
