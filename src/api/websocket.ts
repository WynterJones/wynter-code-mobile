/**
 * WebSocket client for real-time updates from desktop
 */
import { useConnectionStore } from '../stores/connectionStore';

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

export type StateUpdate = BeadsUpdate | AutoBuildUpdate | ChatStreamUpdate | ToolCallUpdate | AutoBuildAddToQueueUpdate;

type UpdateHandler = (update: StateUpdate) => void;

// WebSocket Manager singleton
class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private handlers: Set<UpdateHandler> = new Set();
  private isConnecting = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Connect to the desktop WebSocket
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    const { connection } = useConnectionStore.getState();
    if (!connection.device) {
      console.warn('[WS] No device connected, cannot establish WebSocket');
      return;
    }

    const { host, port, token } = connection.device;
    const wsUrl = `ws://${host}:${port}/api/v1/ws?token=${encodeURIComponent(token)}`;

    this.isConnecting = true;
    console.log('[WS] Connecting to', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        useConnectionStore.getState().setStatus('connected');
        this.startPingInterval();
      };

      this.ws.onmessage = (event) => {
        try {
          const update = JSON.parse(event.data) as StateUpdate;
          this.notifyHandlers(update);
        } catch (err) {
          console.error('[WS] Failed to parse message:', err);
        }
      };

      this.ws.onclose = (event) => {
        console.log('[WS] Disconnected', event.code, event.reason);
        this.isConnecting = false;
        this.stopPingInterval();
        this.ws = null;

        // Only attempt reconnect if we were previously connected
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
          console.log(`[WS] Reconnecting in ${delay}ms...`);
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connect();
          }, delay);
        } else {
          useConnectionStore.getState().setStatus('error', 'WebSocket connection lost');
        }
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
        this.isConnecting = false;
      };
    } catch (err) {
      console.error('[WS] Failed to create WebSocket:', err);
      this.isConnecting = false;
    }
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
    this.isConnecting = false;
  }

  /**
   * Send a command to the desktop
   */
  send(command: { type: string; [key: string]: unknown }): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command));
    } else {
      console.warn('[WS] Cannot send, socket not open');
    }
  }

  /**
   * Subscribe to a project's updates
   */
  subscribeToProject(projectId: string): void {
    this.send({
      type: 'subscribe_project',
      project_id: projectId,
    });
  }

  /**
   * Approve a tool call
   */
  approveToolCall(sessionId: string, toolCallId: string): void {
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
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private notifyHandlers(update: StateUpdate): void {
    this.handlers.forEach((handler) => {
      try {
        handler(update);
      } catch (err) {
        console.error('[WS] Handler error:', err);
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
