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
  // ==========================================================
  // 🔴 PENTING UNTUK BUILD APK: 
  // Jika Anda membuild APK untuk dipakai di HP lain, ubah 'MANUAL_URL' di bawah ini menjadi IP Wi-Fi laptop Anda (contoh: 'http://192.168.1.15:3000') 
  // Atau tempel link NGROK Anda (contoh: 'https://xxx.ngrok.app').
  // ==========================================================
  const MANUAL_URL = ''; // CONTOH: 'http://192.168.1.5:3000'

  if (MANUAL_URL) return MANUAL_URL;

  // Jika sudah di production build (bukan Expo Go), gunakan domain remote
  const isProduction = !__DEV__;
  if (isProduction) {
    return 'https://www.primkoppol.online';
  }

  // Development (Di Expo Go): otomatis detect IP laptop
  const debuggerHost = Constants.expoConfig?.hostUri || Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:3000`;
  }

  // Fallback default
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
