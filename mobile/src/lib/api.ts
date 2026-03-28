import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

/**
 * Konfigurasi Base URL
 * 
 * Development : Otomatis mengambil IP dari expo debugger (hostUri)
 * Production  : Gunakan domain hosting koperasi
 * 
 * Jika hostUri tidak tersedia (misalnya di standalone build), fallback ke production URL.
 */
function getBaseUrl(): string {
  // Jika sudah di production build (bukan Expo Go), gunakan domain
  const isProduction = !__DEV__;
  if (isProduction) {
    return 'https://www.primkoppol.online';
  }

  // Development: ambil IP laptop dari Expo debugger
  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:3000`;
  }

  // Fallback jika tidak bisa detect
  return 'http://192.168.1.9:3000';
}

const BASE_URL = getBaseUrl();

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Otomatis sisipkan JWT Token ke setiap request
api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('userToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
