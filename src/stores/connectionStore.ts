import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface PairedDevice {
  id: string;
  name: string;
  host: string;
  port: number;
  token: string;
  pairedAt: string;
}

interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  device: PairedDevice | null;
  error?: string;
}

interface ConnectionStore {
  connection: ConnectionState;
  loadSavedDevice: () => Promise<void>;
  saveDevice: (device: PairedDevice) => Promise<void>;
  clearDevice: () => Promise<void>;
  setStatus: (status: ConnectionState['status'], error?: string) => void;
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
        set({
          connection: { status: 'disconnected', device },
        });
      }
    } catch (error) {
      console.error('Failed to load saved device:', error);
    }
  },

  saveDevice: async (device: PairedDevice) => {
    try {
      await SecureStore.setItemAsync(DEVICE_KEY, JSON.stringify(device));
      set({
        connection: { status: 'connected', device },
      });
    } catch (error) {
      console.error('Failed to save device:', error);
    }
  },

  clearDevice: async () => {
    try {
      await SecureStore.deleteItemAsync(DEVICE_KEY);
      set({
        connection: { status: 'disconnected', device: null },
      });
    } catch (error) {
      console.error('Failed to clear device:', error);
    }
  },

  setStatus: (status, error) => {
    set((state) => ({
      connection: { ...state.connection, status, error },
    }));
  },
}));
