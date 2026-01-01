import { create } from 'zustand';
import type { Workspace } from '../types';

interface WorkspaceStore {
  workspaces: Workspace[];
  selectedWorkspace: Workspace | null;

  // Actions
  setWorkspaces: (workspaces: Workspace[]) => void;
  setSelectedWorkspace: (workspace: Workspace | null) => void;
  selectWorkspaceById: (id: string) => void;
  addWorkspace: (workspace: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  reset: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  workspaces: [],
  selectedWorkspace: null,

  setWorkspaces: (workspaces) => {
    set({ workspaces });
    // Auto-select first workspace if none selected
    const { selectedWorkspace } = get();
    if (!selectedWorkspace && workspaces.length > 0) {
      set({ selectedWorkspace: workspaces[0] });
    }
  },

  setSelectedWorkspace: (workspace) => {
    set({ selectedWorkspace: workspace });
  },

  selectWorkspaceById: (id) => {
    const workspace = get().workspaces.find((w) => w.id === id);
    if (workspace) {
      set({ selectedWorkspace: workspace });
    }
  },

  addWorkspace: (workspace) => {
    set((state) => ({
      workspaces: [...state.workspaces, workspace],
      selectedWorkspace: state.selectedWorkspace || workspace,
    }));
  },

  updateWorkspace: (id, updates) => {
    set((state) => {
      const workspaces = state.workspaces.map((w) =>
        w.id === id ? { ...w, ...updates } : w
      );
      const selectedWorkspace =
        state.selectedWorkspace?.id === id
          ? { ...state.selectedWorkspace, ...updates }
          : state.selectedWorkspace;
      return { workspaces, selectedWorkspace };
    });
  },

  removeWorkspace: (id) => {
    set((state) => {
      const workspaces = state.workspaces.filter((w) => w.id !== id);
      const selectedWorkspace =
        state.selectedWorkspace?.id === id
          ? workspaces[0] || null
          : state.selectedWorkspace;
      return { workspaces, selectedWorkspace };
    });
  },

  reset: () => {
    set({ workspaces: [], selectedWorkspace: null });
  },
}));
