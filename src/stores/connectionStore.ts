import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { isSessionExpired, tokenNeedsRefresh, SESSION_TIMEOUT_MS } from '../api/validation';

// Connection mode: WiFi (direct local network) or Relay (through relay server)
export type ConnectionMode = 'wifi' | 'relay';

interface PairedDevice {
  id: string;
  name: string;
  host: string;
  port: number;
  token: string;
  pairedAt: string;
}

// Relay-specific configuration
interface RelayConfig {
  url: string;           // WSS URL of the relay server
  desktopId: string;     // Desktop's device ID for routing
  mobileId: string;      // Our device ID
  publicKey: string;     // Our X25519 public key (base64)
  privateKey: string;    // Our X25519 private key (base64)
  peerPublicKey: string; // Desktop's X25519 public key (base64)
  token: string;         // Relay authentication token
}

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'expired';
  device: PairedDevice | null;
  error?: string;
  sessionExpiresAt?: number;
  // Relay mode additions
  connectionMode: ConnectionMode;
  relayConfig: RelayConfig | null;
}

interface ConnectionStore {
  connection: ConnectionState;
  loadSavedDevice: () => Promise<void>;
  saveDevice: (device: PairedDevice) => Promise<void>;
  clearDevice: () => Promise<void>;
  setStatus: (status: ConnectionState['status'], error?: string) => void;
  checkSessionValidity: () => { valid: boolean; needsRefresh: boolean };
  refreshSession: () => Promise<boolean>;
  // Relay mode methods
  saveRelayConfig: (config: RelayConfig) => Promise<void>;
  clearRelayConfig: () => Promise<void>;
  setConnectionMode: (mode: ConnectionMode) => void;
  getEncryptionKey: () => Uint8Array | null;
}

const DEVICE_KEY = 'paired_device';
const RELAY_CONFIG_KEY = 'relay_config';

// Lazy import to avoid circular dependencies
let relayCryptoModule: typeof import('../api/relayCrypto') | null = null;
async function getRelayCrypto() {
  if (!relayCryptoModule) {
    relayCryptoModule = await import('../api/relayCrypto');
  }
  return relayCryptoModule;
}

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  connection: {
    status: 'disconnected',
    device: null,
    connectionMode: 'wifi',
    relayConfig: null,
  },

  loadSavedDevice: async () => {
    try {
      // Load WiFi device config
      const stored = await SecureStore.getItemAsync(DEVICE_KEY);
      // Load relay config
      const relayStored = await SecureStore.getItemAsync(RELAY_CONFIG_KEY);

      let device: PairedDevice | null = null;
      let relayConfig: RelayConfig | null = null;
      let connectionMode: ConnectionMode = 'wifi';

      if (stored) {
        device = JSON.parse(stored);

        // Check if session has expired
        if (device && isSessionExpired(device.pairedAt)) {
          await SecureStore.deleteItemAsync(DEVICE_KEY);
          device = null;
        }
      }

      if (relayStored) {
        relayConfig = JSON.parse(relayStored);
        // If relay config exists and no WiFi device, default to relay mode
        if (!device && relayConfig) {
          connectionMode = 'relay';
        }
      }

      // If device session expired
      if (stored && !device) {
        set({
          connection: {
            status: 'expired',
            device: null,
            error: 'Session expired. Please reconnect.',
            connectionMode,
            relayConfig,
          },
        });
        return;
      }

      const expiresAt = device
        ? new Date(device.pairedAt).getTime() + SESSION_TIMEOUT_MS
        : undefined;

      // Determine connection status:
      // - 'connected' if we have a device (WiFi) or relay config
      // - 'disconnected' otherwise
      const hasValidConnection = device !== null || relayConfig !== null;

      set({
        connection: {
          status: hasValidConnection ? 'connected' : 'disconnected',
          device,
          sessionExpiresAt: expiresAt,
          connectionMode,
          relayConfig,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load saved device';
      console.error('Failed to load saved device:', error);
      set({
        connection: {
          status: 'error',
          device: null,
          error: errorMessage,
          connectionMode: 'wifi',
          relayConfig: null,
        },
      });
      throw error;
    }
  },

  saveDevice: async (device: PairedDevice) => {
    try {
      await SecureStore.setItemAsync(DEVICE_KEY, JSON.stringify(device));
      const expiresAt = new Date(device.pairedAt).getTime() + SESSION_TIMEOUT_MS;
      set((state) => ({
        connection: {
          ...state.connection,
          status: 'connected',
          device,
          sessionExpiresAt: expiresAt,
          connectionMode: 'wifi', // WiFi mode when using device pairing
        },
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save device';
      console.error('Failed to save device:', error);
      set((state) => ({
        connection: {
          ...state.connection,
          status: 'error',
          error: errorMessage,
        },
      }));
      throw error;
    }
  },

  clearDevice: async () => {
    try {
      await SecureStore.deleteItemAsync(DEVICE_KEY);
      set((state) => ({
        connection: {
          ...state.connection,
          status: 'disconnected',
          device: null,
        },
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear device';
      console.error('Failed to clear device:', error);
      set((state) => ({
        connection: {
          ...state.connection,
          status: 'error',
          error: errorMessage,
        },
      }));
      throw error;
    }
  },

  setStatus: (status, error) => {
    set((state) => ({
      connection: { ...state.connection, status, error },
    }));
  },

  checkSessionValidity: () => {
    const { connection } = get();
    if (!connection.device) {
      return { valid: false, needsRefresh: false };
    }

    const expired = isSessionExpired(connection.device.pairedAt);
    const needsRefresh = tokenNeedsRefresh(connection.device.pairedAt);

    if (expired) {
      set((state) => ({
        connection: {
          ...state.connection,
          status: 'expired',
          error: 'Session expired. Please reconnect.',
        },
      }));
    }

    return { valid: !expired, needsRefresh };
  },

  refreshSession: async () => {
    const { connection } = get();

    // For relay mode, session refresh works differently
    if (connection.connectionMode === 'relay') {
      // Relay sessions don't expire the same way
      // The relay token is long-lived
      return true;
    }

    if (!connection.device) {
      return false;
    }

    const { host, port, token } = connection.device;

    try {
      // Call refresh endpoint to get a new token
      const response = await fetch(`http://${host}:${port}/api/v1/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const data = await response.json();

      // Update device with new token and timestamp
      const updatedDevice: PairedDevice = {
        ...connection.device,
        token: data.token,
        pairedAt: new Date().toISOString(),
      };

      await SecureStore.setItemAsync(DEVICE_KEY, JSON.stringify(updatedDevice));
      const expiresAt = Date.now() + SESSION_TIMEOUT_MS;

      set((state) => ({
        connection: {
          ...state.connection,
          status: 'connected',
          device: updatedDevice,
          sessionExpiresAt: expiresAt,
        },
      }));

      return true;
    } catch (error) {
      console.error('Failed to refresh session:', error);
      return false;
    }
  },

  // Relay mode methods
  saveRelayConfig: async (config: RelayConfig) => {
    try {
      await SecureStore.setItemAsync(RELAY_CONFIG_KEY, JSON.stringify(config));
      set((state) => ({
        connection: {
          ...state.connection,
          status: 'connected',
          connectionMode: 'relay',
          relayConfig: config,
        },
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save relay config';
      console.error('Failed to save relay config:', error);
      set((state) => ({
        connection: {
          ...state.connection,
          status: 'error',
          error: errorMessage,
        },
      }));
      throw error;
    }
  },

  clearRelayConfig: async () => {
    try {
      await SecureStore.deleteItemAsync(RELAY_CONFIG_KEY);
      set((state) => ({
        connection: {
          ...state.connection,
          relayConfig: null,
          // If we were in relay mode, disconnect
          ...(state.connection.connectionMode === 'relay'
            ? { status: 'disconnected', connectionMode: 'wifi' }
            : {}),
        },
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to clear relay config';
      console.error('Failed to clear relay config:', error);
      set((state) => ({
        connection: {
          ...state.connection,
          status: 'error',
          error: errorMessage,
        },
      }));
      throw error;
    }
  },

  setConnectionMode: (mode: ConnectionMode) => {
    set((state) => ({
      connection: {
        ...state.connection,
        connectionMode: mode,
        // Reset status when switching modes
        status: 'disconnected',
      },
    }));
  },

  getEncryptionKey: () => {
    const { connection } = get();
    if (!connection.relayConfig) {
      return null;
    }

    try {
      // Synchronously derive the encryption key
      // Note: This requires the crypto module to be loaded
      // In practice, the key should be cached after initial derivation
      const { deriveSharedKey, importPublicKey } = require('../api/relayCrypto');

      const privateKey = base64ToUint8Array(connection.relayConfig.privateKey);
      const peerPublicKey = importPublicKey(connection.relayConfig.peerPublicKey);

      return deriveSharedKey(privateKey, peerPublicKey);
    } catch (error) {
      console.error('Failed to derive encryption key:', error);
      return null;
    }
  },
}));

// Helper for getEncryptionKey (synchronous base64 decode)
function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
