import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const memoryStorage: { [key: string]: string } = {};

export const safeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      // Intentar usar AsyncStorage
      const value = await AsyncStorage.getItem(key);
      return value;
    } catch (e) {
      // Fallback a localStorage en Web o memoria en caso de error
      console.warn(`[storage] Fallback al leer key "${key}":`, e);
      if (Platform.OS === 'web' || String(e).includes('Native module is null')) {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      }
      return memoryStorage[key] || null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (e) {
      console.warn(`[storage] Fallback al escribir key "${key}":`, e);
      if (Platform.OS === 'web' || String(e).includes('Native module is null')) {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
          return;
        }
      }
      memoryStorage[key] = value;
    }
  },

  removeItem: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.warn(`[storage] Fallback al remover key "${key}":`, e);
      if (Platform.OS === 'web' || String(e).includes('Native module is null')) {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
          return;
        }
      }
      delete memoryStorage[key];
    }
  }
};
