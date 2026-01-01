import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { isSessionExpired, tokenNeedsRefresh, SESSION_TIMEOUT_MS } from '../api/validation';

interface PairedDevice {
  id: string;
  name: string;
  host: string;
  port: number;
  token: string;
  pairedAt: string;
}

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'expired';
  device: PairedDevice | null;
  error?: string;
  sessionExpiresAt?: number;
}

interface ConnectionStore {
  connection: ConnectionState;
  loadSavedDevice: () => Promise<void>;
  saveDevice: (device: PairedDevice) => Promise<void>;
  clearDevice: () => Promise<void>;
  setStatus: (status: ConnectionState['status'], error?: string) => void;
  checkSessionValidity: () => { valid: boolean; needsRefresh: boolean };
  refreshSession: () => Promise<boolean>;
}

const DEVICE_KEY = 'paired_device';

export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  connection: {
    status: 'disconnected',
    device: null,
  },

  loadSavedDevice: async () => {
    try {
      const stored = await SecureStore.getItemAsync(DEVICE_KEY);
      if (stored) {
        const device: PairedDevice = JSON.parse(stored);

        // Check if session has expired
        if (isSessionExpired(device.pairedAt)) {
          await SecureStore.deleteItemAsync(DEVICE_KEY);
          set({
            connection: {
              status: 'expired',
              device: null,
              error: 'Session expired. Please reconnect.',
            },
          });
          return;
        }

        const expiresAt = new Date(device.pairedAt).getTime() + SESSION_TIMEOUT_MS;
        set({
          connection: {
            status: 'disconnected',
            device,
            sessionExpiresAt: expiresAt,
          },
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load saved device';
      console.error('Failed to load saved device:', error);
      set({
        connection: {
          status: 'error',
          device: null,
          error: errorMessage,
        },
      });
      throw error;
    }
  },

  saveDevice: async (device: PairedDevice) => {
    try {
      await SecureStore.setItemAsync(DEVICE_KEY, JSON.stringify(device));
      const expiresAt = new Date(device.pairedAt).getTime() + SESSION_TIMEOUT_MS;
      set({
        connection: {
          status: 'connected',
          device,
          sessionExpiresAt: expiresAt,
        },
      });
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
      set({
        connection: { status: 'disconnected', device: null },
      });
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

      set({
        connection: {
          status: 'connected',
          device: updatedDevice,
          sessionExpiresAt: expiresAt,
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to refresh session:', error);
      return false;
    }
  },
}));
