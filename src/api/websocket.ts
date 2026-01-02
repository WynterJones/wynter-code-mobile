/**
 * WebSocket client for real-time updates from desktop
 *
 * Supports two modes:
 * - WiFi: Direct WebSocket connection to desktop on local network
 * - Relay: Encrypted WebSocket through relay server
 */
import { useConnectionStore } from '../stores/connectionStore';
import { validateNetworkEndpoint } from './validation';

// Lazy-loaded relay module (to avoid loading crypto at startup)
let relayModule: typeof import('./relay') | null = null;
function getRelayModule(): typeof import('./relay') {
  if (!relayModule) {
    relayModule = require('./relay') as typeof import('./relay');
  }
  return relayModule!;
}

// State update types from desktop
export interface BeadsUpdate {
  type: 'BeadsUpdate';
  project_id: string;
  action: 'created' | 'updated' | 'closed' | 'reopened' | 'deleted';
  issue?: {
    id: string;
    title: string;
    description?: string;
    status: string;
    issue_type: string;
    priority: number;
    created_at: string;
    updated_at: string;
    closed_at?: string;
    close_reason?: string;
  };
}

export interface AutoBuildUpdate {
  type: 'AutoBuildUpdate';
  project_id: string;
  status: {
    status: 'idle' | 'running' | 'paused' | 'error';
    current_issue_id?: string;
    current_phase?: string;
    progress: number;
    workers: Array<{
      id: number;
      issue_id?: string;
      phase?: string;
      current_action?: string;
      progress?: number;
    }>;
    queue: Array<{
      id: string;
      title: string;
      status: string;
      created_at: string;
    }>;
    human_review?: Array<{
      id: string;
      title: string;
      status: string;
      created_at: string;
    }>;
    completed?: Array<{
      id: string;
      title: string;
      status: string;
      created_at: string;
    }>;
    logs: Array<{
      id: string;
      level: 'info' | 'success' | 'warn' | 'error' | 'claude';
      message: string;
      timestamp: string;
    }>;
  };
}

export interface ChatStreamUpdate {
  type: 'ChatStream';
  session_id: string;
  chunk: {
    type: string;
    content?: string;
    tool_name?: string;
  };
}

export interface ToolCallUpdate {
  type: 'ToolCall';
  session_id: string;
  tool_call: {
    id: string;
    name: string;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    input?: Record<string, unknown>;
  };
}

export interface AutoBuildAddToQueueUpdate {
  type: 'AutoBuildAddToQueue';
  project_id: string;
  issue_id: string;
}

export interface TerminalOutputUpdate {
  type: 'TerminalOutput';
  pty_id: string;
  data: string;
}

export interface WorkspaceUpdate {
  type: 'WorkspaceUpdate';
  action: 'created' | 'updated' | 'deleted';
  workspace?: {
    id: string;
    name: string;
    color: string;
    project_ids: string[];
  };
  workspace_id?: string;
}

export interface ProjectUpdate {
  type: 'ProjectUpdate';
  action: 'created' | 'updated' | 'deleted';
  project?: {
    id: string;
    name: string;
    path: string;
    color?: string;
  };
  project_id?: string;
  workspace_id?: string;
}

export interface KanbanUpdate {
  type: 'KanbanUpdate';
  workspace_id: string;
  action: 'created' | 'updated' | 'deleted' | 'moved';
  task?: {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: number;
    created_at: number;
    updated_at: number;
    order: number;
    locked: boolean;
  };
  task_id?: string;
}

export type StateUpdate =
  | BeadsUpdate
  | AutoBuildUpdate
  | ChatStreamUpdate
  | ToolCallUpdate
  | AutoBuildAddToQueueUpdate
  | TerminalOutputUpdate
  | WorkspaceUpdate
  | ProjectUpdate
  | KanbanUpdate;

type UpdateHandler = (update: StateUpdate) => void;

// WebSocket Manager singleton
class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private handlers: Set<UpdateHandler> = new Set();
  private isConnecting = false;
  private isAuthenticated = false;
  private pendingToken: string | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private usingRelayMode = false;

  /**
   * Connect to the desktop WebSocket
   * Automatically chooses WiFi or Relay mode based on connection settings
   */
  connect(): void {
    const { connection, getEncryptionKey } = useConnectionStore.getState();

    // Check if we should use relay mode
    if (connection.connectionMode === 'relay' && connection.relayConfig) {
      this.connectViaRelay();
      return;
    }

    // WiFi mode - direct connection
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    if (!connection.device) {
      if (__DEV__) {
        console.warn('[WS] No device connected, cannot establish WebSocket');
      }
      return;
    }

    const { host, port, token } = connection.device;

    // Validate network endpoint (defense against DNS/ARP spoofing)
    try {
      validateNetworkEndpoint(host, port);
    } catch (error) {
      if (__DEV__) {
        console.error('[WS] Security validation failed:', error);
      }
      useConnectionStore.getState().setStatus('error', 'Invalid network endpoint');
      return;
    }

    // SECURITY: Do NOT include token in URL - it would be logged in server logs,
    // browser history, and proxy logs. Send via message after connection instead.
    const wsUrl = `ws://${host}:${port}/api/v1/ws`;
    this.pendingToken = token;

    this.isConnecting = true;
    this.isAuthenticated = false;
    this.usingRelayMode = false;
    if (__DEV__) {
      console.log('[WS] Connecting to WebSocket (WiFi mode)');
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (__DEV__) {
          console.log('[WS] Connected, sending authentication...');
        }
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Send authentication message immediately after connection
        // Token is sent via message body, not URL, for security
        if (this.pendingToken && this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify({
            type: 'authenticate',
            token: this.pendingToken,
          }));
          // Clear token from memory after sending
          this.pendingToken = null;
        }

        // Note: We don't set 'connected' status until we receive auth confirmation
        // The server should respond with an 'authenticated' message
        useConnectionStore.getState().setStatus('connected');
        this.isAuthenticated = true;
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data) as StateUpdate;
          this.notifyHandlers(update);
        } catch (err) {
          if (__DEV__) {
            console.error('[WS] Failed to parse message:', err);
          }
        }
      };

      this.ws.onclose = (event) => {
        if (__DEV__) {
          console.log('[WS] Disconnected', event.code, event.reason);
        }
        this.isConnecting = false;
        this.stopPingInterval();
        this.ws = null;

        // Only attempt reconnect if we were previously connected
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
          if (__DEV__) {
            console.log(`[WS] Reconnecting in ${delay}ms...`);
          }
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
          }, delay);
        } else {
          useConnectionStore.getState().setStatus('error', 'WebSocket connection lost');
        }
      };

      this.ws.onerror = (error) => {
        if (__DEV__) {
          console.error('[WS] Error:', error);
        }
        this.isConnecting = false;
        // Update connection state so the app knows WebSocket failed
        // Note: onerror is typically followed by onclose, but we update state here
        // to provide immediate feedback about the error condition
        const errorMessage = error instanceof Error ? error.message : 'WebSocket connection error';
        useConnectionStore.getState().setStatus('error', errorMessage);
      };
    } catch (err) {
      if (__DEV__) {
        console.error('[WS] Failed to create WebSocket:', err);
      }
      this.isConnecting = false;
      // Update connection state so the app knows WebSocket creation failed
      const errorMessage = err instanceof Error ? err.message : 'Failed to create WebSocket connection';
      useConnectionStore.getState().setStatus('error', errorMessage);
    }
  }

  /**
   * Connect via relay server (encrypted)
   */
  private connectViaRelay(): void {
    const { connection, getEncryptionKey } = useConnectionStore.getState();

    if (!connection.relayConfig) {
      if (__DEV__) {
        console.warn('[WS] No relay config, cannot connect via relay');
      }
      return;
    }

    const encryptionKey = getEncryptionKey();
    if (!encryptionKey) {
      if (__DEV__) {
        console.error('[WS] Failed to derive encryption key for relay');
      }
      useConnectionStore.getState().setStatus('error', 'Failed to derive encryption key');
      return;
    }

    this.usingRelayMode = true;

    // Forward our handlers to the relay manager
    const removeHandler = getRelayModule().relayWsManager.addHandler((update) => {
      this.notifyHandlers(update);
    });

    // Store the cleanup function (will be called on disconnect)
    this.relayHandlerCleanup = removeHandler;

    // Connect via relay
    getRelayModule().relayWsManager.connect({
      relayUrl: connection.relayConfig.url,
      mobileId: connection.relayConfig.mobileId,
      desktopId: connection.relayConfig.desktopId,
      encryptionKey,
      token: connection.relayConfig.token,
      publicKey: connection.relayConfig.publicKey,
    });

    if (__DEV__) {
      console.log('[WS] Connecting via relay server');
    }
  }

  private relayHandlerCleanup: (() => void) | null = null;

  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    // Clean up relay handler if we were using relay mode
    if (this.relayHandlerCleanup) {
      this.relayHandlerCleanup();
      this.relayHandlerCleanup = null;
    }

    if (this.usingRelayMode) {
      getRelayModule().relayWsManager.disconnect();
      this.usingRelayMode = false;
    }

    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.isConnecting = false;
    this.isAuthenticated = false;
    this.pendingToken = null;
  }

  /**
   * Send a command to the desktop
   */
  send(command: { type: string; [key: string]: unknown }): void {
    // Route through relay if using relay mode
    if (this.usingRelayMode) {
      getRelayModule().relayWsManager.send(command);
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command));
    } else {
      if (__DEV__) {
        console.warn('[WS] Cannot send, socket not open');
      }
    }
  }

  /**
   * Subscribe to a project's updates
   */
  subscribeToProject(projectId: string): void {
    if (this.usingRelayMode) {
      getRelayModule().relayWsManager.subscribeToProject(projectId);
      return;
    }
    this.send({
      type: 'subscribe_project',
      project_id: projectId,
    });
  }

  /**
   * Approve a tool call
   */
  approveToolCall(sessionId: string, toolCallId: string): void {
    if (this.usingRelayMode) {
      getRelayModule().relayWsManager.approveToolCall(sessionId, toolCallId);
      return;
    }
    this.send({
      type: 'tool_approve',
      session_id: sessionId,
      tool_call_id: toolCallId,
    });
  }

  /**
   * Reject a tool call
   */
  rejectToolCall(sessionId: string, toolCallId: string): void {
    if (this.usingRelayMode) {
      getRelayModule().relayWsManager.rejectToolCall(sessionId, toolCallId);
      return;
    }
    this.send({
      type: 'tool_reject',
      session_id: sessionId,
      tool_call_id: toolCallId,
    });
  }

  /**
   * Register an update handler
   */
  addHandler(handler: UpdateHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /**
   * Get connection status (includes authentication check)
   */
  isConnected(): boolean {
    if (this.usingRelayMode) {
      return getRelayModule().relayWsManager.isConnected();
    }
    return this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated;
  }

  /**
   * Check if currently using relay mode
   */
  isRelayMode(): boolean {
    return this.usingRelayMode;
  }

  private notifyHandlers(update: StateUpdate): void {
    this.handlers.forEach((handler) => {
      try {
        handler(update);
      } catch (err) {
        if (__DEV__) {
          console.error('[WS] Handler error:', err);
        }
      }
    });
  }

  private startPingInterval(): void {
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// Export singleton instance
export const wsManager = new WebSocketManager();
