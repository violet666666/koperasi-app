/**
 * Koperasi Digital — Mobile Color Palette
 * Synchronized with web globals.css design system
 * 
 * Primary: Navy (#1A2A44) — Header, text, sidebar
 * Accent: Gold (#D4AF37) — Highlights, active tabs, rings
 * Secondary: Burgundy (#5D2E3A) — Alert badges
 * Success: Emerald (#10B981) — Positive values
 * Warning: Amber (#F59E0B) — Pending/caution
 * Info: Blue (#3B82F6) — Informational
 * Destructive: Red (#EF4444) — Errors/logout
 */

const colors = {
  // Primary
  primary: '#1A2A44',         // Navy — main headers, text
  primaryLight: '#2A3C58',    // Lighter navy — sidebar hover
  primaryDark: '#0F172A',     // Darker navy — dark bg

  // Accent
  accent: '#D4AF37',          // Gold — highlights, active tab, ring
  accentLight: '#E8CC6A',     // Light gold
  accentBg: '#FDF8E8',        // Gold tint background

  // Secondary
  secondary: '#5D2E3A',       // Burgundy
  secondaryLight: '#7A4050',

  // Semantic
  success: '#10B981',         // Emerald — positive
  successBg: '#ECFDF5',
  warning: '#F59E0B',         // Amber — caution
  warningBg: '#FFFBEB',
  info: '#3B82F6',            // Blue — informational
  infoBg: '#EFF6FF',
  destructive: '#EF4444',     // Red — danger
  destructiveBg: '#FEF2F2',

  // Neutrals
  background: '#F8F9FA',      // Page bg
  card: '#FFFFFF',            // Cards
  foreground: '#2C3E50',      // Body text
  muted: '#E2E8F0',           // Borders, dividers
  mutedForeground: '#64748B', // Secondary text
  border: '#E2E8F0',

  // Chart / Graph (jika nanti pakai chart)
  chart1: '#1A2A44',
  chart2: '#D4AF37',
  chart3: '#5D2E3A',
  chart4: '#2C3E50',
  chart5: '#10B981',
};

export default colors;
