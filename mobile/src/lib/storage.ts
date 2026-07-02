import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { log } from '../utils/log';

// In-memory cache for synchronous reads (to maintain backwards compatibility with MMKV sync APIs)
const memoryCache: Record<string, string | boolean | number> = {};

/**
 * Storage Wrapper
 * Memisahkan penyimpanan secure (token) dan fast storage (preferences, user data)
 */
export const StorageManager = {
  // Hydrate memory from AsyncStorage on app startup
  hydrateFastStorage: async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const pairs = await AsyncStorage.multiGet(keys);
      pairs.forEach(([key, value]) => {
        if (value !== null) {
          if (value === 'true') memoryCache[key] = true;
          else if (value === 'false') memoryCache[key] = false;
          else memoryCache[key] = value;
        }
      });
    } catch (err) {
      log.error('Failed to hydrate fast storage:', err);
    }
  },

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
    let strValue = '';
    if (typeof value === 'object') {
      strValue = JSON.stringify(value);
      memoryCache[key] = strValue;
    } else if (typeof value === 'boolean') {
      strValue = value ? 'true' : 'false';
      memoryCache[key] = value;
    } else if (typeof value === 'number') {
      strValue = String(value);
      memoryCache[key] = value;
    } else {
      strValue = value as string;
      memoryCache[key] = value as string;
    }
    // Fire and forget async write
    AsyncStorage.setItem(key, strValue).catch(() => {});
  },
  getFastString: (key: string): string | undefined => {
    const val = memoryCache[key];
    return val !== undefined ? String(val) : undefined;
  },
  getFastNumber: (key: string): number | undefined => {
    const val = memoryCache[key];
    return val !== undefined ? Number(val) : undefined;
  },
  getFastBoolean: (key: string): boolean | undefined => {
    const val = memoryCache[key];
    if (val === 'true' || val === true) return true;
    if (val === 'false' || val === false) return false;
    return undefined;
  },
  getFastObject: <T>(key: string): T | null => {
    const data = StorageManager.getFastString(key);
    if (!data) return null;
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  },
  deleteFastItem: (key: string) => {
    delete memoryCache[key];
    AsyncStorage.removeItem(key).catch(() => {});
  },
  clearAllFastItems: () => {
    for (const key in memoryCache) {
      delete memoryCache[key];
    }
    AsyncStorage.clear().catch(() => {});
  }
};
