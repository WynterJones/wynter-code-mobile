/**
 * Base API infrastructure - shared HTTP client and query client
 */
import { QueryClient } from '@tanstack/react-query';
import { useConnectionStore } from '../stores/connectionStore';
import { signRequest, generateNonce, getTimestamp } from './crypto';
import { isSessionExpired, tokenNeedsRefresh, validateNetworkEndpoint } from './validation';

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

// Base fetch with auth and request signing
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const { connection, clearDevice, setStatus } = useConnectionStore.getState();

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

  const url = `https://${host}:${port}/api/v1${endpoint}`;
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

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Request-Timestamp': timestamp.toString(),
      'X-Request-Nonce': nonce,
      'X-Request-Signature': signature,
      ...options.headers,
    },
  });

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
