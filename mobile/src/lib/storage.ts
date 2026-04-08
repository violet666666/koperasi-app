import { MMKV } from 'react-native-mmkv';
import * as SecureStore from 'expo-secure-store';

// Initialize MMKV instance
export const storage = new MMKV();

/**
 * Storage Wrapper
 * Memisahkan penyimpanan secure (token) dan fast storage (preferences, user data)
 */
export const StorageManager = {
  // --- Secure Storage (JWT, Passwords) ---
  setSecureItem: async (key: string, value: string) => {
    await SecureStore.setItemAsync(key, value);
  },
  getSecureItem: async (key: string) => {
    return await SecureStore.getItemAsync(key);
  },
  deleteSecureItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key);
  },

  // --- Fast Storage (User Data, settings, cache) ---
  setFastItem: (key: string, value: string | object | number | boolean) => {
    if (typeof value === 'object') {
      storage.set(key, JSON.stringify(value));
    } else if (typeof value === 'boolean') {
      storage.set(key, value);
    } else if (typeof value === 'number') {
      storage.set(key, value);
    } else {
      storage.set(key, value as string);
    }
  },
  getFastString: (key: string) => storage.getString(key),
  getFastNumber: (key: string) => storage.getNumber(key),
  getFastBoolean: (key: string) => storage.getBoolean(key),
  getFastObject: <T>(key: string): T | null => {
    const data = storage.getString(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  },
  deleteFastItem: (key: string) => {
    storage.delete(key);
  },
  clearAllFastItems: () => {
    storage.clearAll();
  }
};
