/**
 * Relay WebSocket Manager
 *
 * Manages encrypted WebSocket communication through a relay server.
 * All messages are end-to-end encrypted - the relay only sees opaque blobs.
 */

import { useConnectionStore } from '../stores/connectionStore';
import {
  encryptMessage,
  decryptMessage,
  EncryptedEnvelope,
} from './relayCrypto';
import type { StateUpdate } from './websocket';
import { handleRelayHttpResponse, handleRelayStreamChunk } from './base';

// Relay protocol message types
interface RelayHandshake {
  type: 'handshake';
  device_id: string;
  peer_id: string;
  token: string;
  public_key: string; // Mobile's X25519 public key for key exchange
}

interface RelayMessage {
  type: 'message';
  envelope: EncryptedEnvelope;
}

interface RelayPing {
  type: 'ping';
}

type ClientMessage = RelayHandshake | RelayMessage | RelayPing;

interface RelayHandshakeAck {
  type: 'handshake_ack';
  success: boolean;
  error?: string;
}

interface RelayIncomingMessage {
  type: 'message';
  envelope: EncryptedEnvelope;
  sender_id: string;
  timestamp: number;
}

interface RelayPeerStatus {
  type: 'peer_status';
  online: boolean;
  pending_count: number;
}

interface RelayPong {
  type: 'pong';
}

type ServerMessage =
  | RelayHandshakeAck
  | RelayIncomingMessage
  | RelayPeerStatus
  | RelayPong;

// HTTP response tunneled through relay
interface HttpResponseMessage {
  type: 'http_response';
  request_id: string;
  status: number;
  body?: unknown;
  error?: string;
}

// HTTP stream chunk for SSE responses via relay (batched delivery)
interface HttpStreamChunkMessage {
  type: 'http_stream_chunk';
  request_id: string;
  sequence: number;
  chunks: string[];
  is_final: boolean;
}

// Type guard for HTTP responses
function isHttpResponse(msg: unknown): msg is HttpResponseMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    (msg as { type: string }).type === 'http_response'
  );
}

// Type guard for HTTP stream chunks
function isHttpStreamChunk(msg: unknown): msg is HttpStreamChunkMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'type' in msg &&
    (msg as { type: string }).type === 'http_stream_chunk'
  );
}

type UpdateHandler = (update: StateUpdate) => void;

/**
 * WebSocket manager for relay mode communication
 */
class RelayWebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private handlers: Set<UpdateHandler> = new Set();
  private isConnecting = false;
  private isAuthenticated = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  // Relay-specific state
  private relayUrl: string | null = null;
  private mobileId: string | null = null;
  private desktopId: string | null = null;
  private encryptionKey: Uint8Array | null = null;
  private token: string | null = null;
  private publicKey: string | null = null;

  /**
   * Connect to the relay server
   */
  connect(config: {
    relayUrl: string;
    mobileId: string;
    desktopId: string;
    encryptionKey: Uint8Array;
    token: string;
    publicKey: string; // Mobile's public key (base64) for key exchange
  }): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.relayUrl = config.relayUrl;
    this.mobileId = config.mobileId;
    this.desktopId = config.desktopId;
    this.encryptionKey = config.encryptionKey;
    this.token = config.token;
    this.publicKey = config.publicKey;

    this.establishConnection();
  }

  private establishConnection(): void {
    if (!this.relayUrl || !this.mobileId || !this.desktopId || !this.token || !this.publicKey) {
      if (__DEV__) {
        console.warn('[Relay] Missing connection config');
      }
      return;
    }

    this.isConnecting = true;
    this.isAuthenticated = false;

    if (__DEV__) {
      console.log('[Relay] Connecting to relay server...');
    }

    try {
      // Relay server expects WebSocket connections at /ws endpoint
      const wsUrl = this.relayUrl!.endsWith('/ws')
        ? this.relayUrl!
        : `${this.relayUrl}/ws`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (__DEV__) {
          console.log('[Relay] Connected, sending handshake...');
        }
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Send handshake to identify ourselves and our peer
        // Include our public key for X25519 key exchange
        this.sendRaw({
          type: 'handshake',
          device_id: this.mobileId!,
          peer_id: this.desktopId!,
          token: this.token!,
          public_key: this.publicKey!,
        });
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage;
          this.handleServerMessage(message);
        } catch (err) {
          if (__DEV__) {
            console.error('[Relay] Failed to parse message:', err);
          }
        }
      };

      this.ws.onclose = (event) => {
        if (__DEV__) {
          console.log('[Relay] Disconnected', event.code, event.reason);
        }
        this.cleanup();

        // Attempt reconnect if we were previously connected
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
          if (__DEV__) {
            console.log(`[Relay] Reconnecting in ${delay}ms...`);
          }
          setTimeout(() => {
            this.reconnectAttempts++;
            this.establishConnection();
          }, delay);
        } else {
          useConnectionStore.getState().setStatus('error', 'Relay connection lost');
        }
      };

      this.ws.onerror = (error) => {
        if (__DEV__) {
          console.error('[Relay] Error:', error);
        }
        this.isConnecting = false;
        const errorMessage = error instanceof Error ? error.message : 'Relay connection error';
        useConnectionStore.getState().setStatus('error', errorMessage);
      };
    } catch (err) {
      if (__DEV__) {
        console.error('[Relay] Failed to create WebSocket:', err);
      }
      this.isConnecting = false;
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to relay';
      useConnectionStore.getState().setStatus('error', errorMessage);
    }
  }

  private handleServerMessage(message: ServerMessage): void {
    switch (message.type) {
      case 'handshake_ack':
        if (message.success) {
          if (__DEV__) {
            console.log('[Relay] Handshake successful');
          }
          this.isAuthenticated = true;
          useConnectionStore.getState().setStatus('connected');
          this.startPingInterval();
        } else {
          if (__DEV__) {
            console.error('[Relay] Handshake failed:', message.error);
          }
          useConnectionStore.getState().setStatus('error', message.error || 'Handshake failed');
          this.disconnect();
        }
        break;

      case 'message':
        this.handleEncryptedMessage(message);
        break;

      case 'peer_status':
        if (__DEV__) {
          console.log('[Relay] Peer status:', message.online ? 'online' : 'offline');
        }
        // Could emit a peer status event here
        break;

      case 'pong':
        // Ping acknowledged
        break;
    }
  }

  private handleEncryptedMessage(message: RelayIncomingMessage): void {
    if (!this.encryptionKey) {
      if (__DEV__) {
        console.error('[Relay] No encryption key available');
      }
      return;
    }

    try {
      // Decrypt the message
      const decrypted = decryptMessage<StateUpdate | HttpResponseMessage | HttpStreamChunkMessage>(
        message.envelope,
        this.encryptionKey
      );

      // Check if this is an HTTP stream chunk (batched SSE)
      if (isHttpStreamChunk(decrypted)) {
        handleRelayStreamChunk(decrypted);
        return;
      }

      // Check if this is an HTTP response
      if (isHttpResponse(decrypted)) {
        handleRelayHttpResponse(decrypted);
        return;
      }

      // Otherwise, it's a state update - notify handlers
      this.notifyHandlers(decrypted as StateUpdate);
    } catch (err) {
      if (__DEV__) {
        console.error('[Relay] Failed to decrypt message:', err);
      }
    }
  }

  /**
   * Disconnect from the relay server
   */
  disconnect(): void {
    this.stopPingInterval();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.cleanup();
  }

  private cleanup(): void {
    this.isConnecting = false;
    this.isAuthenticated = false;
    this.stopPingInterval();
  }

  /**
   * Send a raw message to the relay (no encryption)
   */
  private sendRaw(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send an encrypted message through the relay
   */
  send(command: { type: string; [key: string]: unknown }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (__DEV__) {
        console.warn('[Relay] Cannot send, socket not open');
      }
      return;
    }

    if (!this.encryptionKey) {
      if (__DEV__) {
        console.error('[Relay] No encryption key available');
      }
      return;
    }

    if (!this.mobileId || !this.desktopId) {
      if (__DEV__) {
        console.error('[Relay] Missing mobile or desktop ID');
      }
      return;
    }

    // Encrypt the command with sender/recipient IDs for relay routing
    const envelope = encryptMessage(
      command,
      this.encryptionKey,
      this.mobileId,
      this.desktopId
    );

    // Send through relay
    this.sendRaw({
      type: 'message',
      envelope,
    });
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
    return this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated;
  }

  private notifyHandlers(update: StateUpdate): void {
    this.handlers.forEach((handler) => {
      try {
        handler(update);
      } catch (err) {
        if (__DEV__) {
          console.error('[Relay] Handler error:', err);
        }
      }
    });
  }

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendRaw({ type: 'ping' });
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
export const relayWsManager = new RelayWebSocketManager();
