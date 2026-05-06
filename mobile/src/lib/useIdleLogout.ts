import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, Alert } from 'react-native';
import { StorageManager } from './storage';

// ── Konfigurasi ──────────────────────────────────────────────────────────
const WARNING_BEFORE_MS = 30 * 1000;      // Peringatan 30 detik sebelum logout

// ── Hook ──────────────────────────────────────────────────────────────────
/**
 * useIdleLogout
 *
 * Monitor aktivitas pengguna (AppState background/active + sentuhan layar).
 * Setelah idle IDLE_TIMEOUT_MS milidetik, hapus token dan panggil onLogout().
 *
 * Cara pakai:
 * ```tsx
 * // Di App.tsx, dalam komponen yang hanya mount saat user sudah login
 * useIdleLogout({ onLogout: () => navigation.replace('Login') });
 * ```
 */
export function useIdleLogout({ onLogout }: { onLogout: () => void }) {
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWarningShownRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const getTimeoutForRole = useCallback(() => {
    const userDataStr = StorageManager.getFastString('userData');
    if (!userDataStr) return 0;
    try {
      const user = JSON.parse(userDataStr);
      if (user.role === 'kasir') return -1; // Nonaktif untuk kasir
      if (['operator', 'admin', 'superadmin', 'admin_unit', 'admin_sp'].includes(user.role)) {
        return 30 * 60 * 1000; // 30 menit
      }
      return 15 * 60 * 1000; // 15 menit (Anggota)
    } catch {
      return 15 * 60 * 1000;
    }
  }, []);

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    idleTimerRef.current = null;
    warningTimerRef.current = null;
    isWarningShownRef.current = false;
  }, []);

  const performLogout = useCallback(async () => {
    clearTimers();
    await StorageManager.deleteSecureItem('userToken');
    StorageManager.deleteFastItem('userData');
    onLogout();
  }, [clearTimers, onLogout]);

  const resetTimer = useCallback(() => {
    clearTimers();

    const timeout = getTimeoutForRole();
    if (timeout <= 0) return; // Nonaktifkan timer jika timeout <= 0 (e.g. Kasir)

    // Timer peringatan (muncul 30 detik sebelum logout)
    warningTimerRef.current = setTimeout(() => {
      if (isWarningShownRef.current) return;
      isWarningShownRef.current = true;
      Alert.alert(
        '⏰ Sesi Hampir Berakhir',
        'Anda akan otomatis keluar dalam 30 detik karena tidak ada aktivitas.\n\nTekan OK untuk tetap masuk.',
        [
          {
            text: 'OK, Tetap Masuk',
            onPress: () => {
              isWarningShownRef.current = false;
              resetTimer();
            },
          },
        ],
        { cancelable: false }
      );
    }, timeout - WARNING_BEFORE_MS);

    // Timer logout utama
    idleTimerRef.current = setTimeout(() => {
      performLogout();
    }, timeout);
  }, [clearTimers, performLogout, getTimeoutForRole]);

  useEffect(() => {
    // Mulai timer saat hook mount
    resetTimer();

    // Monitor AppState: saat app kembali ke foreground, reset timer
    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (
        appStateRef.current.match(/background|inactive/) &&
        nextState === 'active'
      ) {
        resetTimer();
      }
      appStateRef.current = nextState;
    });

    return () => {
      clearTimers();
      appStateSub.remove();
    };
  }, [resetTimer, clearTimers]);

  // Kembalikan resetTimer agar bisa dipanggil dari touchable navigator
  return { resetTimer };
}
