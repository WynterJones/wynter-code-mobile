/**
 * Subscriptions and Overwatch Services API
 */
import { apiFetch } from './base';

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

// Subscription CRUD
export interface CreateSubscriptionInput {
  workspaceId: string;
  name: string;
  url?: string;
  faviconUrl?: string;
  monthlyCost: number;
  billingCycle?: import('../types').BillingCycle;
  currency?: string;
  categoryId?: string;
  notes?: string;
  isActive?: boolean;
}

export interface UpdateSubscriptionInput {
  name?: string;
  url?: string;
  faviconUrl?: string;
  monthlyCost?: number;
  billingCycle?: import('../types').BillingCycle;
  currency?: string;
  categoryId?: string | null;
  notes?: string | null;
  isActive?: boolean;
  sortOrder?: number;
}

export async function getSubscription(id: string): Promise<import('../types').Subscription> {
  const response = await apiFetch<ApiSubscription>(`/subscriptions/${id}`);
  return transformSubscription(response);
}

export async function createSubscription(input: CreateSubscriptionInput): Promise<import('../types').Subscription> {
  const response = await apiFetch<ApiSubscription>('/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      workspace_id: input.workspaceId,
      name: input.name,
      url: input.url,
      favicon_url: input.faviconUrl,
      monthly_cost: input.monthlyCost,
      billing_cycle: input.billingCycle,
      currency: input.currency,
      category_id: input.categoryId,
      notes: input.notes,
      is_active: input.isActive,
    }),
  });
  return transformSubscription(response);
}

export async function updateSubscription(id: string, input: UpdateSubscriptionInput): Promise<void> {
  await apiFetch<void>(`/subscriptions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: input.name,
      url: input.url,
      favicon_url: input.faviconUrl,
      monthly_cost: input.monthlyCost,
      billing_cycle: input.billingCycle,
      currency: input.currency,
      category_id: input.categoryId,
      notes: input.notes,
      is_active: input.isActive,
      sort_order: input.sortOrder,
    }),
  });
}

export async function deleteSubscription(id: string): Promise<void> {
  await apiFetch<void>(`/subscriptions/${id}`, {
    method: 'DELETE',
  });
}

// Subscription Category CRUD
export interface CreateSubscriptionCategoryInput {
  workspaceId: string;
  name: string;
  color?: string;
}

export interface UpdateSubscriptionCategoryInput {
  name?: string;
  color?: string | null;
  sortOrder?: number;
}

export async function createSubscriptionCategory(input: CreateSubscriptionCategoryInput): Promise<import('../types').SubscriptionCategory> {
  const response = await apiFetch<ApiSubscriptionCategory>('/subscriptions/categories', {
    method: 'POST',
    body: JSON.stringify({
      workspace_id: input.workspaceId,
      name: input.name,
      color: input.color,
    }),
  });
  return transformSubscriptionCategory(response);
}

export async function updateSubscriptionCategory(id: string, input: UpdateSubscriptionCategoryInput): Promise<void> {
  await apiFetch<void>(`/subscriptions/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: input.name,
      color: input.color,
      sort_order: input.sortOrder,
    }),
  });
}

export async function deleteSubscriptionCategory(id: string): Promise<void> {
  await apiFetch<void>(`/subscriptions/categories/${id}`, {
    method: 'DELETE',
  });
}
