/**
 * Project Store - manages workspace/project selection
 */
import { create } from 'zustand';
import type { Workspace, Project } from '../types';

interface ProjectStore {
  // Data
  workspaces: Workspace[];
  selectedProject: Project | null;

  // Actions
  setWorkspaces: (workspaces: Workspace[]) => void;
  selectProject: (project: Project | null) => void;
  clearSelection: () => void;

  // Computed
  getProjectById: (id: string) => Project | undefined;
  getAllProjects: () => Project[];
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  workspaces: [],
  selectedProject: null,

  setWorkspaces: (workspaces) => set({ workspaces }),

  selectProject: (project) => set({ selectedProject: project }),

  clearSelection: () => set({ selectedProject: null }),

  getProjectById: (id) => {
    const { workspaces } = get();
    for (const ws of workspaces) {
      const project = ws.projects.find((p) => p.id === id);
      if (project) return project;
    }
    return undefined;
  },

  getAllProjects: () => {
    const { workspaces } = get();
    return workspaces.flatMap((ws) => ws.projects);
  },
}));
