/**
 * Beads Store - manages issues for the selected project
 */
import { create } from 'zustand';
import type { Issue, IssueStatus } from '../types';

interface BeadsStore {
  // Data
  issues: Issue[];
  isLoading: boolean;
  error: string | null;

  // Selected issue for detail view
  selectedIssue: Issue | null;

  // Actions
  setIssues: (issues: Issue[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  selectIssue: (issue: Issue | null) => void;

  // Optimistic updates
  addIssue: (issue: Issue) => void;
  updateIssue: (id: string, updates: Partial<Issue>) => void;
  removeIssue: (id: string) => void;

  // Computed
  getIssuesByStatus: (status: IssueStatus) => Issue[];
  getOpenCount: () => number;
  getInProgressCount: () => number;
}

export const useBeadsStore = create<BeadsStore>((set, get) => ({
  issues: [],
  isLoading: false,
  error: null,
  selectedIssue: null,

  setIssues: (issues) => set({ issues, error: null }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  selectIssue: (selectedIssue) => set({ selectedIssue }),

  addIssue: (issue) =>
    set((state) => ({
      issues: [issue, ...state.issues],
    })),

  updateIssue: (id, updates) =>
    set((state) => ({
      issues: state.issues.map((issue) =>
        issue.id === id ? { ...issue, ...updates } : issue
      ),
      selectedIssue:
        state.selectedIssue?.id === id
          ? { ...state.selectedIssue, ...updates }
          : state.selectedIssue,
    })),

  removeIssue: (id) =>
    set((state) => ({
      issues: state.issues.filter((issue) => issue.id !== id),
      selectedIssue: state.selectedIssue?.id === id ? null : state.selectedIssue,
    })),

  getIssuesByStatus: (status) => {
    return get().issues.filter((issue) => issue.status === status);
  },

  getOpenCount: () => {
    return get().issues.filter((issue) => issue.status === 'open').length;
  },

  getInProgressCount: () => {
    return get().issues.filter((issue) => issue.status === 'in_progress').length;
  },
}));
