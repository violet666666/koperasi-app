import C from './colors';

// ── Loan Status ────────────────────────────────────────────────
export const LOAN_STATUS: Record<string, { text: string; color: string; bg: string }> = {
  draft:     { text: 'Draft',           color: C.mutedForeground, bg: '#F1F5F9' },
  submitted: { text: 'Diajukan',        color: '#F59E0B',         bg: '#FFFBEB' },
  approved:  { text: 'Disetujui',       color: C.success,         bg: '#ECFDF5' },
  rejected:  { text: 'Ditolak',         color: C.destructive,     bg: '#FEF2F2' },
  disbursed: { text: 'Dicairkan',       color: C.primary,         bg: '#EFF6FF' },
  cancelled: { text: 'Dibatalkan',      color: C.mutedForeground, bg: '#F1F5F9' },
  active:    { text: 'Aktif',           color: C.success,         bg: '#ECFDF5' },
  paid_off:  { text: 'Lunas',           color: C.success,         bg: '#ECFDF5' },
  written_off: { text: 'Hapus Buku',    color: C.destructive,     bg: '#FEF2F2' },
  voided:    { text: 'Dibatalkan (VOID)', color: C.destructive,   bg: '#FEF2F2' },
  overdue:   { text: 'Menunggak',       color: C.destructive,     bg: '#FEF2F2' },
  pending:   { text: 'Menunggu',        color: '#F59E0B',         bg: '#FFFBEB' },
  paid:      { text: 'Lunas',           color: C.mutedForeground, bg: '#F1F5F9' },
};

// Alias for backward compat (mobile API returns 'paid' for 'paid_off' sometimes)
LOAN_STATUS.paid = LOAN_STATUS.paid_off;

// ── Member Status ──────────────────────────────────────────────
export const MEMBER_STATUS: Record<string, { text: string; color: string; bg: string }> = {
  active:   { text: 'Aktif',         color: C.success,     bg: '#ECFDF5' },
  inactive: { text: 'Tidak Aktif',   color: C.mutedForeground, bg: '#F1F5F9' },
  pensiun:  { text: 'Pensiun',       color: '#F59E0B',     bg: '#FFFBEB' },
  resigned: { text: 'Keluar',        color: C.destructive, bg: '#FEF2F2' },
  merged:   { text: 'Digabung',      color: C.mutedForeground, bg: '#F1F5F9' },
};

// ── Helper ─────────────────────────────────────────────────────
export function getLoanStatus(status: string) {
  return LOAN_STATUS[status] || LOAN_STATUS.active;
}

export function getMemberStatus(status: string) {
  return MEMBER_STATUS[status] || MEMBER_STATUS.active;
}

// Format mayoritas screen: signed (minus utk nilai negatif), NaN → 0.
// Sebelumnya Math.abs — input yang pernah lewat sini selalu positif
// (loan/savings amounts), jadi aman diubah ke signed.
export const formatRp = (n: number | string) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return 'Rp 0';
  return 'Rp ' + (num || 0).toLocaleString('id-ID');
};

export const formatDate = (d: string | null | undefined) => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ── Unit labels (canonical — mirror UNIT_LIST di LaporanUnitScreen / web UNIT_TYPES) ──
// Key alias DB (UNIT_TYPE_ALIASES web: resto_cafe/coffe_latar/play_station) wajib ikut,
// else fallback memperlihatkan slug mentah ("resto cafe") di riwayat/laporan.
export const UNIT_LABELS: Record<string, string> = {
  toko: 'Toko',
  cafe_lsp: 'Cafe LSP',
  resto: 'Resto & Cafe',
  resto_cafe: 'Resto & Cafe',
  coffe_latar: 'Resto & Cafe',
  cuci_mobil: 'Cuci Mobil',
  barbershop: 'Barbershop',
  fitness: 'Fitness',
  playstation: 'Play Station',
  play_station: 'Play Station',
  fotocopy: 'Fotocopy',
  laundry: 'Laundry',
  haji_umrah: 'Haji & Umrah',
};

export const unitLabel = (key: string | null | undefined) =>
  key ? UNIT_LABELS[key] || key.replace(/_/g, ' ') : '';
