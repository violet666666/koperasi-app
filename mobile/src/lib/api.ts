import axios from 'axios';
import { StorageManager } from './storage';
import Constants from 'expo-constants';

/**
 * Konfigurasi Base URL
 *
 * Development : Otomatis mengambil IP dari expo debugger (hostUri)
 * Production  : Gunakan domain hosting koperasi
 *
 * Override port via EXPO_PUBLIC_API_PORT (default: 3000)
 */
function getBaseUrl(): string {
  // ==========================================================
  // 🔴 KONFIGURASI URL API
  // APK Production otomatis menggunakan domain primkoppol.site
  // Development (Expo Go) otomatis detect IP laptop
  // ==========================================================
  const MANUAL_URL = ''; // Override manual jika diperlukan

  if (MANUAL_URL) return MANUAL_URL;

  // Production build (APK/AAB): selalu gunakan domain publik
  // ⚠ Gunakan BARE domain (primkoppol.site), BUKAN www — subdomain www belum
  // resolve di DNS Hostinger. Bare domain sudah ALIAS → Railway. Jika kelak www
  // dikonfigurasi, proxy.ts (308 www→bare) tetap menjaga canonical URL tunggal.
  const isProduction = !__DEV__;
  if (isProduction) {
    return 'https://primkoppol.site';
  }

  // ── S1-02: Dynamic port dari env variable ──────────────────
  // Ubah di mobile/.env: EXPO_PUBLIC_API_PORT=3001 untuk staging
  const apiPort = process.env.EXPO_PUBLIC_API_PORT || '3000';

  // Development (Di Expo Go): otomatis detect IP laptop
  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:${apiPort}`;
  }

  // Fallback ke domain publik bare (bukan IP lokal)
  return 'https://primkoppol.site';
}

export const BASE_URL = getBaseUrl();

// Fungsi navigasi global — di-set dari App.tsx agar interceptor bisa redirect
let _navigateToLogin: (() => void) | null = null;
export function setNavigateToLogin(fn: () => void) {
  _navigateToLogin = fn;
}

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── S1-01: Request Interceptor — inject JWT ────────────────────────────────
api.interceptors.request.use(async (config) => {
  const token = await StorageManager.getSecureItem('userToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── S1-01: Response Interceptor — Global Error Handling ───────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const code = error.code;

    // 401 Unauthorized → hapus token + paksa logout
    if (status === 401) {
      await StorageManager.deleteSecureItem('userToken');
      StorageManager.deleteFastItem('userData');
      if (_navigateToLogin) {
        _navigateToLogin();
      }
      return Promise.reject(new Error('Sesi telah berakhir. Silakan login kembali.'));
    }

    // 403 Forbidden
    if (status === 403) {
      return Promise.reject(new Error('Akses ditolak. Anda tidak memiliki izin.'));
    }

    // 503 Service Unavailable
    if (status === 503) {
      return Promise.reject(new Error('Server sedang tidak tersedia. Coba beberapa saat lagi.'));
    }

    // Network timeout
    if (code === 'ECONNABORTED' || code === 'ERR_NETWORK') {
      return Promise.reject(new Error('Koneksi timeout. Periksa jaringan Anda.'));
    }

    // Server error (5xx) — tampilkan pesan dari server jika ada
    if (status >= 500) {
      const serverMsg = error.response?.data?.message || 'Terjadi kesalahan server.';
      return Promise.reject(new Error(serverMsg));
    }

    // Lainnya — teruskan error asli
    return Promise.reject(error);
  }
);

export default api;
