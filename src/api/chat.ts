/**
 * Chat Sessions and Mobile Chat API
 */
import type { ApiResponse, ChatSession, ChatMessage } from '../types';
import { useConnectionStore } from '../stores/connectionStore';
import { signRequest, generateNonce, getTimestamp } from './crypto';
import { isSessionExpired, validateNetworkEndpoint } from './validation';
import { apiFetch } from './base';

// Chat Sessions
export async function fetchSessions(projectId: string): Promise<ChatSession[]> {
  const response = await apiFetch<ApiResponse<ChatSession[]>>(
    `/projects/${projectId}/sessions`
  );
  return response.data || [];
}

export async function fetchMessages(
  projectId: string,
  sessionId: string
): Promise<ChatMessage[]> {
  const response = await apiFetch<ApiResponse<ChatMessage[]>>(
    `/projects/${projectId}/sessions/${sessionId}/messages`
  );
  return response.data || [];
}

export async function sendMessage(
  projectId: string,
  sessionId: string,
  content: string
): Promise<void> {
  await apiFetch(`/projects/${projectId}/sessions/${sessionId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

export async function approveToolCall(
  projectId: string,
  sessionId: string,
  toolCallId: string
): Promise<void> {
  await apiFetch(
    `/projects/${projectId}/sessions/${sessionId}/tools/${toolCallId}/approve`,
    { method: 'POST' }
  );
}

export async function rejectToolCall(
  projectId: string,
  sessionId: string,
  toolCallId: string
): Promise<void> {
  await apiFetch(
    `/projects/${projectId}/sessions/${sessionId}/tools/${toolCallId}/reject`,
    { method: 'POST' }
  );
}

// Mobile Chat - send message and stream response
export interface MobileChatRequest {
  provider: string;
  model: string;
  mode?: string; // 'normal' | 'plan' | 'auto'
  message: string;
  cwd?: string; // Working directory for CLI processes
  session_id?: string; // Session ID for continuing conversations
  history?: Array<{ role: string; content: string }>;
}

export interface MobileChatChunk {
  type: 'content' | 'tool_start' | 'tool_result' | 'tool_error' | 'thinking' | 'done' | 'error';
  content?: string;
  tool_name?: string;
  tool_id?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: string;
  tool_is_error?: boolean;
  error?: string;
  // File-related tools
  file_path?: string;
  // Bash-related
  command?: string;
  // Search-related
  pattern?: string;
  query?: string;
}

export async function sendMobileChatMessage(
  request: MobileChatRequest,
  onChunk: (chunk: MobileChatChunk) => void
): Promise<void> {
  const { connection, clearDevice, setStatus } = useConnectionStore.getState();

  // Check if connected
  if (!connection.device && !connection.relayConfig) {
    throw new Error('Not connected to desktop');
  }

  // Chat streaming is not supported over relay mode (requires direct HTTP connection for SSE)
  if (connection.connectionMode === 'relay') {
    throw new Error('Mobile chat is not available in relay mode. Please connect via WiFi on the same network as your desktop.');
  }

  if (!connection.device) {
    throw new Error('Not connected to desktop');
  }

  const { host, port, token, pairedAt } = connection.device;

  // Validate network endpoint (defense against DNS/ARP spoofing)
  validateNetworkEndpoint(host, port);

  // Check session expiration
  if (isSessionExpired(pairedAt)) {
    await clearDevice();
    setStatus('error', 'Session expired. Please reconnect.');
    throw new Error('Session expired. Please reconnect.');
  }

  const url = `http://${host}:${port}/api/v1/mobile/chat`;
  const body = JSON.stringify(request);

  // Generate request signing headers
  const timestamp = getTimestamp();
  const nonce = await generateNonce();
  const signature = await signRequest({
    method: 'POST',
    url,
    timestamp,
    nonce,
    body,
    token,
  });

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('X-Request-Timestamp', timestamp.toString());
    xhr.setRequestHeader('X-Request-Nonce', nonce);
    xhr.setRequestHeader('X-Request-Signature', signature);
    xhr.timeout = 120000; // 2 minute timeout for streaming requests

    let buffer = '';
    let lastProcessedIndex = 0;

    xhr.onprogress = () => {
      // Get new data since last progress event
      const newData = xhr.responseText.substring(lastProcessedIndex);
      lastProcessedIndex = xhr.responseText.length;
      buffer += newData;

      // Process complete lines (SSE format)
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            onChunk({ type: 'done' });
            return;
          }
          try {
            const chunk: MobileChatChunk = JSON.parse(data);
            onChunk(chunk);
          } catch (e) {
            if (__DEV__) {
              console.error('[MobileChat] Failed to parse chunk:', data, e);
            }
          }
        }
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // Process any remaining data in buffer
        if (buffer.trim()) {
          const lines = buffer.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                onChunk({ type: 'done' });
              } else {
                try {
                  const chunk: MobileChatChunk = JSON.parse(data);
                  onChunk(chunk);
                } catch (e) {
                  if (__DEV__) {
                    console.error('[MobileChat] Failed to parse final chunk:', data, e);
                  }
                }
              }
            }
          }
        }
        onChunk({ type: 'done' });
        resolve();
      } else {
        try {
          const error = JSON.parse(xhr.responseText);
          reject(new Error(error.error || `HTTP ${xhr.status}`));
        } catch {
          reject(new Error(`HTTP ${xhr.status}: ${xhr.statusText}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Request timeout'));
    };

    xhr.send(body);
  });
}
