/** @type {import('tailwindcss').Config} */
module.exports = {
  // Scan semua file TSX/TS untuk class Tailwind
  content: [
    './App.tsx',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // ── Warna sistem PRIMKOPPOL — selaras dengan src/lib/colors.ts ──────
      colors: {
        primary: {
          DEFAULT: '#1A2A44',
          light: '#243858',
          dark: '#111d30',
        },
        accent: {
          DEFAULT: '#D4AF37',
          light: '#E8CC6A',
          dark: '#A8892A',
        },
        secondary: '#5B6E8C',
        background: '#F8FAFC',
        card: '#FFFFFF',
        border: '#E2E8F0',
        foreground: '#1E293B',
        muted: '#64748B',
        success: '#22C55E',
        destructive: '#EF4444',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Inter', 'System'],
      },
      borderRadius: {
        xl: '12px',
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};
