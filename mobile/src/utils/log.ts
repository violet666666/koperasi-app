// Production-safe logger: no-ops in release builds, logs in dev.
// Replaces raw console.* so the Play Store APK ships no debug output.
declare const __DEV__: boolean;

const isDev = __DEV__;
export const log = {
  log: (...args: unknown[]) => { if (isDev) console.log(...args); },
  warn: (...args: unknown[]) => { if (isDev) console.warn(...args); },
  error: (...args: unknown[]) => { if (isDev) console.error(...args); },
};
