/**
 * Base API infrastructure - shared HTTP client and query client
 *
 * Supports two modes:
 * - WiFi: Direct HTTP requests to desktop on local network
 * - Relay: HTTP-over-WebSocket through encrypted relay
 */
import { QueryClient } from '@tanstack/react-query';
import { useConnectionStore } from '../stores/connectionStore';
import { signRequest, generateNonce, getTimestamp } from './crypto';
import { isSessionExpired, tokenNeedsRefresh, validateNetworkEndpoint } from './validation';

// Lazy-loaded relay module (to avoid loading crypto at startup)
let relayModule: typeof import('./relay') | null = null;
async function getRelayModule() {
  if (!relayModule) {
    relayModule = await import('./relay');
  }
  return relayModule;
}

// Query client instance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

// Pending HTTP-over-relay requests (for response matching)
const pendingRelayRequests = new Map<
  string,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }
>();

// Request ID counter for HTTP-over-relay
let relayRequestId = 0;

/**
 * Make an HTTP request through the relay (encrypted)
 */
async function apiFetchViaRelay<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { connection, getEncryptionKey } = useConnectionStore.getState();

  if (!connection.relayConfig) {
    throw new Error('Relay not configured');
  }

  const encryptionKey = getEncryptionKey();
  if (!encryptionKey) {
    throw new Error('Failed to derive encryption key');
  }

  const { relayWsManager } = await getRelayModule();

  // Auto-connect if not connected
  if (!relayWsManager.isConnected()) {
    if (__DEV__) {
      console.log('[API] Relay not connected, initiating connection...');
    }

    relayWsManager.connect({
      relayUrl: connection.relayConfig.url,
      mobileId: connection.relayConfig.mobileId,
      desktopId: connection.relayConfig.desktopId,
      encryptionKey,
      token: connection.relayConfig.token,
      publicKey: connection.relayConfig.publicKey,
    });

    // Wait for connection to be established (with timeout)
    const maxWait = 5000;
    const checkInterval = 100;
    let waited = 0;

    while (!relayWsManager.isConnected() && waited < maxWait) {
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }

    if (!relayWsManager.isConnected()) {
      throw new Error('Failed to connect to relay server');
    }

    if (__DEV__) {
      console.log('[API] Relay connected, waiting for peer key exchange...');
    }

    // Wait a bit more for the desktop to receive our PeerConnected event
    // and derive the encryption key before we send requests
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (__DEV__) {
      console.log('[API] Relay ready for requests');
    }
  }

  const requestId = `req_${++relayRequestId}_${Date.now()}`;
  const method = options.method || 'GET';
  const body = options.body as string | undefined;

  // Create the HTTP request message to tunnel through relay
  const httpRequest = {
    type: 'http_request',
    request_id: requestId,
    method,
    endpoint,
    body: body ? JSON.parse(body) : undefined,
  };

  return new Promise<T>((resolve, reject) => {
    // Set up timeout
    const timeout = setTimeout(() => {
      pendingRelayRequests.delete(requestId);
      reject(new Error('Relay request timed out'));
    }, 15000);

    // Register pending request
    pendingRelayRequests.set(requestId, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timeout,
    });

    // Send the encrypted request
    relayWsManager.send(httpRequest);
  });
}

/**
 * Handle HTTP response from relay (called by relay manager)
 */
export function handleRelayHttpResponse(response: {
  request_id: string;
  status: number;
  body?: unknown;
  error?: string;
}): void {
  const pending = pendingRelayRequests.get(response.request_id);
  if (!pending) {
    if (__DEV__) {
      console.warn('[API] Received response for unknown request:', response.request_id);
    }
    return;
  }

  clearTimeout(pending.timeout);
  pendingRelayRequests.delete(response.request_id);

  if (response.error || response.status >= 400) {
    pending.reject(new Error(response.error || `HTTP ${response.status}`));
  } else {
    pending.resolve(response.body);
  }
}

// Base fetch with auth and request signing
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { connection, clearDevice, setStatus, getEncryptionKey } = useConnectionStore.getState();

  // Use relay mode if configured
  if (connection.connectionMode === 'relay' && connection.relayConfig) {
    return apiFetchViaRelay<T>(endpoint, options);
  }

  // WiFi mode - direct connection
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

  // Check if token needs refresh (warn but continue)
  if (tokenNeedsRefresh(pairedAt)) {
    setStatus('connecting'); // Visual indicator that refresh is needed
  }

  const url = `http://${host}:${port}/api/v1${endpoint}`;
  const method = options.method || 'GET';
  const body = options.body as string | undefined;

  // Generate request signing headers
  const timestamp = getTimestamp();
  const nonce = await generateNonce();
  const signature = await signRequest({
    method,
    url,
    timestamp,
    nonce,
    body,
    token,
  });

  // Create abort controller for timeout (AbortSignal.timeout not available in RN)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Request-Timestamp': timestamp.toString(),
        'X-Request-Nonce': nonce,
        'X-Request-Signature': signature,
        ...options.headers,
      },
    });
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Network request timed out');
    }
    throw error;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    // Handle 401 as session expired
    if (response.status === 401) {
      await clearDevice();
      setStatus('error', 'Session expired. Please reconnect.');
      throw new Error('Session expired. Please reconnect.');
    }
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  // Handle empty responses (e.g., 200 OK with no body for PATCH/DELETE)
  // For void-returning operations, undefined is the expected return value
  const contentLength = response.headers.get('content-length');
  const contentType = response.headers.get('content-type');
  if (contentLength === '0' || !contentType?.includes('application/json')) {
    // Type assertion: void operations legitimately return undefined
    return undefined as unknown as T;
  }

  // Try to parse JSON, return undefined if empty
  const text = await response.text();
  if (!text || text.trim() === '') {
    // Type assertion: empty responses for void operations
    return undefined as unknown as T;
  }

  return JSON.parse(text) as T;
}
