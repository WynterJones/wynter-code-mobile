/**
 * Auto-Build Store - manages auto-build state with real-time updates
 */
import { create } from 'zustand';
import { wsManager, AutoBuildUpdate } from '../api/websocket';
import type { AutoBuildState, AutoBuildStatus, AutoBuildPhase, Worker, QueueItem, LogEntry } from '../types';

interface AutoBuildStore {
  // State
  state: AutoBuildState;
  isSubscribed: boolean;

  // Actions
  setStatus: (status: AutoBuildStatus) => void;
  setProgress: (progress: number) => void;
  setWorkers: (workers: Worker[]) => void;
  setQueue: (queue: QueueItem[]) => void;
  setLogs: (logs: LogEntry[]) => void;
  addLog: (log: LogEntry) => void;
  reset: () => void;

  // Real-time
  handleUpdate: (update: AutoBuildUpdate) => void;
  subscribe: (projectId: string) => void;
  unsubscribe: () => void;
}

const initialState: AutoBuildState = {
  status: 'stopped',
  workers: [],
  queue: [],
  logs: [],
  progress: 0,
  currentIssueId: undefined,
  currentPhase: undefined,
};

export const useAutoBuildStore = create<AutoBuildStore>((set, get) => {
  // Register WebSocket handler once
  let unsubscribeWs: (() => void) | null = null;

  return {
    state: initialState,
    isSubscribed: false,

    setStatus: (status) =>
      set((state) => ({
        state: { ...state.state, status },
      })),

    setProgress: (progress) =>
      set((state) => ({
        state: { ...state.state, progress },
      })),

    setWorkers: (workers) =>
      set((state) => ({
        state: { ...state.state, workers },
      })),

    setQueue: (queue) =>
      set((state) => ({
        state: { ...state.state, queue },
      })),

    setLogs: (logs) =>
      set((state) => ({
        state: { ...state.state, logs },
      })),

    addLog: (log) =>
      set((state) => ({
        state: {
          ...state.state,
          logs: [...state.state.logs.slice(-49), log], // Keep last 50 logs
        },
      })),

    reset: () => set({ state: initialState }),

    handleUpdate: (update) => {
      const { status } = update;

      // Map workers from the update format to our format
      const workers: Worker[] = (status.workers || []).map((w) => ({
        id: `worker-${w.id}`,
        name: `Worker ${w.id + 1}`,
        status: w.phase === 'working' ? 'working' :
                w.phase === 'paused' ? 'paused' :
                w.phase ? 'working' : 'idle',
        currentTask: w.current_action,
        progress: w.progress,
      }));

      // Map queue items
      const queue: QueueItem[] = (status.queue || []).map((q) => ({
        id: q.id,
        description: q.title,
        status: q.status === 'pending' ? 'pending' :
                q.status === 'processing' ? 'processing' :
                q.status === 'completed' ? 'completed' : 'failed',
        createdAt: q.created_at,
      }));

      // Map logs
      const logs: LogEntry[] = (status.logs || []).map((l) => ({
        id: l.id,
        level: l.level === 'claude' ? 'info' : l.level,
        message: l.message,
        timestamp: l.timestamp,
      }));

      // Map status and phase to our types
      const mappedStatus: AutoBuildStatus = status.status === 'idle' || status.status === 'error' ||
        status.status === 'running' || status.status === 'paused' || status.status === 'stopped'
        ? status.status : 'stopped';

      const validPhases: AutoBuildPhase[] = ['selecting', 'working', 'selfReviewing', 'auditing', 'testing', 'fixing', 'reviewing', 'committing', undefined];
      const mappedPhase: AutoBuildPhase = validPhases.includes(status.current_phase as AutoBuildPhase)
        ? (status.current_phase as AutoBuildPhase)
        : undefined;

      set({
        state: {
          status: mappedStatus,
          workers,
          queue,
          logs,
          progress: status.progress || 0,
          currentIssueId: status.current_issue_id,
          currentPhase: mappedPhase,
        },
      });
    },

    subscribe: (projectId) => {
      const { isSubscribed, handleUpdate } = get();

      // Already subscribed, just request updates for new project
      if (isSubscribed) {
        wsManager.subscribeToProject(projectId);
        return;
      }

      // Connect WebSocket if not already connected
      wsManager.connect();

      // Register handler for auto-build updates
      unsubscribeWs = wsManager.addHandler((update) => {
        if (update.type === 'AutoBuildUpdate') {
          handleUpdate(update);
        }
      });

      // Subscribe to project updates
      wsManager.subscribeToProject(projectId);

      set({ isSubscribed: true });
    },

    unsubscribe: () => {
      if (unsubscribeWs) {
        unsubscribeWs();
        unsubscribeWs = null;
      }
      set({ isSubscribed: false });
    },
  };
});
