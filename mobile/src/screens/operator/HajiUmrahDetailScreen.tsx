import React, { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';
import { StorageManager } from '../../lib/storage';
import { log } from '../../utils/log';

/**
 * HajiUmrahDetailScreen (Fase 9a.1 T6)
 *
 * Account detail: header card (balance/target/progress/maturity/monthly target) +
 * stats row + transaction history. "Setoran" button (canManage gate) opens the
 * deposit form.
 *
 * Field contract — matches GET /api/mobile/haji-umrah/savings/[accountId] verbatim:
 *   data: { ...account, balance, target, progress, monthlyTarget,
 *           maturityDate, openedDate, accountNo, status,
 *           member: { id, memberNo, name, nrp },
 *           product: { id, name, type, ... },
 *           stats: { totalDeposits, monthlyDeposits, depositCount,
 *                    remaining, monthsRemaining, isTargetReached },
 *           transactions: [ { id, transactionNo, type, amount, balanceBefore,
 *                             balanceAfter, paymentMethod, cashBankAccountId,
 *                             referenceNo, notes, transactionDate,
 *                             createdBy: { id, name } } ] }
 *
 * canManage gate mirrors the list screen + the API write gate (operator always;
 * admin only if unitType === haji_umrah). StorageManager.getFastString('userData').
 */

// Detail GET response shape — only the fields the screen reads.
type AccountDetail = {
  id: number;
  accountNo: string;
  balance: number;
  target: number;
  progress: number;
  monthlyTarget: number;
  status: string;
  maturityDate: string | null;
  openedDate: string | null;
  member: { id: number; memberNo: string; name: string; nrp: string };
  product: { id: number; name: string; type: string };
  stats: {
    totalDeposits: number;
    monthlyDeposits: number;
    depositCount: number;
    remaining: number;
    monthsRemaining: number | null;
    isTargetReached: boolean;
  };
  transactions: HajiUmrahTransaction[];
};

type HajiUmrahTransaction = {
  id: number;
  transactionNo: string;
  type: string; // 'deposit' | 'withdraw' | ...
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  paymentMethod: string | null;
  cashBankAccountId: number | null;
  referenceNo: string | null;
  notes: string | null;
  transactionDate: string;
  createdBy: { id: number; name: string } | null;
};

const formatRp = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return '-';
  }
}

/** Days remaining until maturity (clamped at 0). Returns null if no maturityDate. */
function daysToMaturity(maturity: string | null): number | null {
  if (!maturity) return null;
  const target = new Date(maturity).getTime();
  if (isNaN(target)) return null;
  const diff = target - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: 'Tunai',
  qris: 'QRIS',
  lainnya: 'Lainnya',
};

export default function HajiUmrahDetailScreen({ route, navigation }: any) {
  const accountId: number = route?.params?.accountId;

  const [detail, setDetail] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // canManage: operator always, admin only if unitType === haji_umrah.
  // Same gate as the list screen + the API write route.
  const canManage = useMemo(() => {
    const ud = StorageManager.getFastString('userData');
    if (!ud) return false;
    try {
      const p = JSON.parse(ud);
      return p.role === 'operator' || (p.role === 'admin' && p.unitType === 'haji_umrah');
    } catch {
      return false;
    }
  }, []);

  const loadDetail = useCallback(async () => {
    setError(null);
    try {
      const res = await api.get(`/api/mobile/haji-umrah/savings/${accountId}`);
      setDetail(res.data?.data ?? null);
    } catch (err: any) {
      // Surface route messages (400/404/500); api.ts maps 401/403/5xx generically.
      const msg = err?.response?.data?.message || err?.message || 'Gagal memuat detail rekening.';
      log.error('HajiUmrahDetail load failed:', err);
      setError(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accountId]);

  React.useEffect(() => { loadDetail(); }, [loadDetail]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDetail();
  }, [loadDetail]);

  // ── Render gates ──
  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <StatusBar barStyle="light-content" backgroundColor={C.primary} />
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  const typeBadge = (productType: string) =>
    productType === 'tabungan_haji'
      ? { label: 'Haji', bg: '#16A34A', icon: '🛕' as const }
      : { label: 'Umrah', bg: '#0EA5E9', icon: '🕌' as const };

  const renderTransaction = ({ item }: { item: HajiUmrahTransaction }) => {
    const isDeposit = item.type === 'deposit';
    const amt = Number(item.amount) || 0;
    return (
      <View style={styles.txRow}>
        <View style={[styles.txIcon, { backgroundColor: isDeposit ? C.successBg : C.destructiveBg }]}>
          <Ionicons
            name={isDeposit ? 'arrow-down-circle' : 'arrow-up-circle'}
            size={22}
            color={isDeposit ? C.success : C.destructive}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.txType}>
              {isDeposit ? 'Setoran' : 'Penarikan'}
              {item.paymentMethod ? ` • ${PAYMENT_LABEL[item.paymentMethod] || item.paymentMethod}` : ''}
            </Text>
            <Text style={[styles.txAmount, { color: isDeposit ? C.success : C.destructive }]}>
              {isDeposit ? '+' : '-'}{formatRp(amt)}
            </Text>
          </View>
          <Text style={styles.txDate}>{formatDate(item.transactionDate)}</Text>
          <View style={styles.txMetaRow}>
            <Text style={styles.txMeta}>No: {item.transactionNo || '-'}</Text>
            {item.referenceNo ? (
              <Text style={styles.txMeta}>Ref: {item.referenceNo}</Text>
            ) : null}
          </View>
          {item.notes ? (
            <Text style={styles.txNotes} numberOfLines={2}>{item.notes}</Text>
          ) : null}
          <Text style={styles.txBalance}>Saldo: {formatRp(item.balanceAfter)}</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Header (product + member identity) */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {detail?.member?.name || 'Detail Rekening'}
            </Text>
            <Text style={styles.headerSub} numberOfLines={1}>
              {detail?.accountNo || '-'} • {detail?.member?.nrp || detail?.member?.memberNo || '-'}
            </Text>
          </View>
          {detail ? (
            <View style={[styles.typeBadge, { backgroundColor: typeBadge(detail.product?.type).bg }]}>
              <Text style={styles.typeBadgeText}>
                {typeBadge(detail.product?.type).icon} {typeBadge(detail.product?.type).label}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {error || !detail ? (
        <View style={styles.errorState}>
          <Ionicons name="cloud-offline-outline" size={48} color={C.mutedForeground} />
          <Text style={{ color: C.mutedForeground, marginTop: 12, textAlign: 'center' }}>
            {error || 'Rekening tidak ditemukan.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={loadDetail}>
            <Text style={styles.retryBtnText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={detail.transactions}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderTransaction}
          contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
          ListHeaderComponent={
            <View>
              {/* Balance / target / progress card */}
              <View style={styles.balanceCard}>
                <View style={styles.balanceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.balanceLabel}>Saldo Saat Ini</Text>
                    <Text style={styles.balanceValue}>{formatRp(detail.balance)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.balanceLabel}>Target</Text>
                    <Text style={styles.targetValue}>{formatRp(detail.target)}</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressWrap}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, Math.max(0, detail.progress || 0))}%`,
                          backgroundColor: detail.stats?.isTargetReached ? C.success : C.accent,
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.progressMeta}>
                    <Text style={styles.progressPct}>
                      {(detail.progress || 0).toFixed(detail.progress % 1 === 0 ? 0 : 1)}% tercapai
                    </Text>
                    {detail.stats?.isTargetReached ? (
                      <View style={[styles.statusPill, { backgroundColor: C.success }]}>
                        <Text style={styles.statusText}>🎯 Target Tercapai</Text>
                      </View>
                    ) : null}
                  </View>
                </View>

                {/* Monthly target + maturity countdown */}
                <View style={styles.metaGrid}>
                  <View style={styles.metaCell}>
                    <Text style={styles.metaLabel}>Target Bulanan</Text>
                    <Text style={styles.metaValue}>
                      {detail.monthlyTarget > 0 ? formatRp(detail.monthlyTarget) : '-'}
                    </Text>
                  </View>
                  {(() => {
                    const dm = daysToMaturity(detail.maturityDate);
                    if (dm === null) return null;
                    return (
                      <View style={[styles.metaCell, { alignItems: 'flex-end' }]}>
                        <Text style={styles.metaLabel}>Jatuh Tempo</Text>
                        <Text style={styles.metaValue}>
                          {dm > 365
                            ? `${Math.floor(dm / 365)} thn ${Math.round((dm % 365) / 30)} bln`
                            : `${dm} hari`}
                        </Text>
                        <Text style={styles.metaSub}>{formatDate(detail.maturityDate)}</Text>
                      </View>
                    );
                  })()}
                </View>
              </View>

              {/* Stats row */}
              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: C.accentBg }]}>
                  <Text style={styles.statLabel}>TOTAL SETORAN</Text>
                  <Text style={[styles.statValue, { color: C.primary }]}>
                    {formatRp(detail.stats?.totalDeposits ?? 0)}
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: C.infoBg }]}>
                  <Text style={styles.statLabel}>BULAN INI</Text>
                  <Text style={[styles.statValue, { color: C.info }]}>
                    {formatRp(detail.stats?.monthlyDeposits ?? 0)}
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: C.successBg }]}>
                  <Text style={styles.statLabel}>JUMLAH</Text>
                  <Text style={[styles.statValue, { color: C.success }]}>
                    {detail.stats?.depositCount ?? 0}x
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={[styles.statCard, { backgroundColor: C.warningBg }]}>
                  <Text style={styles.statLabel}>SISA TARGET</Text>
                  <Text style={[styles.statValue, { color: C.warning }]}>
                    {formatRp(detail.stats?.remaining ?? 0)}
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: '#F5F3FF' }]}>
                  <Text style={styles.statLabel}>ESTIMASI</Text>
                  <Text style={[styles.statValue, { color: '#7C3AED' }]}>
                    {detail.stats?.monthsRemaining !== null && detail.stats?.monthsRemaining !== undefined
                      ? `${detail.stats.monthsRemaining} bln`
                      : '-'}
                  </Text>
                </View>
              </View>

              {/* Section title */}
              <Text style={styles.sectionTitle}>
                Riwayat Transaksi {detail.transactions.length > 0 ? `(${detail.transactions.length})` : ''}
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={48} color={C.mutedForeground} />
              <Text style={{ color: C.mutedForeground, marginTop: 12, fontSize: 15 }}>
                Belum ada transaksi
              </Text>
            </View>
          }
        />
      )}

      {/* Setoran button — canManage gate */}
      {canManage && detail ? (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('HajiUmrahSetoran', { accountId: detail.id })}
          activeOpacity={0.85}
        >
          <Ionicons name="cash" size={24} color="#FFF" />
          <Text style={styles.fabText}>Setoran</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 52, paddingBottom: 16, paddingHorizontal: 16,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: '#FFF', fontSize: 12, opacity: 0.8, marginTop: 2 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginLeft: 8 },
  typeBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },

  // Balance card
  balanceCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  balanceLabel: { fontSize: 11, color: C.mutedForeground },
  balanceValue: { fontSize: 22, fontWeight: 'bold', color: C.primary, marginTop: 2 },
  targetValue: { fontSize: 15, fontWeight: '600', color: C.mutedForeground, marginTop: 2 },
  progressWrap: { marginTop: 14 },
  progressTrack: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  progressPct: { fontSize: 11, fontWeight: '700', color: C.foreground },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6 },
  statusText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  metaGrid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.muted },
  metaCell: { flex: 1 },
  metaLabel: { fontSize: 10, color: C.mutedForeground, fontWeight: '600' },
  metaValue: { fontSize: 13, color: C.foreground, fontWeight: '700', marginTop: 2 },
  metaSub: { fontSize: 10, color: C.mutedForeground, marginTop: 2 },

  // Stats row
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statCard: { flex: 1, padding: 10, borderRadius: 10 },
  statLabel: { fontSize: 9, fontWeight: 'bold', color: C.mutedForeground },
  statValue: { fontSize: 14, fontWeight: 'bold', marginTop: 4 },

  // Section
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: C.foreground, marginTop: 16, marginBottom: 10, marginLeft: 2 },

  // Transaction rows
  txRow: { flexDirection: 'row', backgroundColor: C.card, borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.muted },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txType: { fontSize: 13, fontWeight: '700', color: C.foreground, flex: 1, marginRight: 8 },
  txAmount: { fontSize: 14, fontWeight: 'bold' },
  txDate: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  txMetaRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  txMeta: { fontSize: 10, color: C.mutedForeground },
  txNotes: { fontSize: 11, color: C.foreground, marginTop: 4, fontStyle: 'italic' },
  txBalance: { fontSize: 10, color: C.mutedForeground, marginTop: 4 },

  // States
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  errorState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 32 },
  retryBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, backgroundColor: C.primary },
  retryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  // FAB (Setoran)
  fab: {
    position: 'absolute', right: 20, bottom: 24, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingHorizontal: 20, height: 52, borderRadius: 26, backgroundColor: C.primary,
    elevation: 4, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
  fabText: { color: '#FFF', fontWeight: 'bold', fontSize: 15, marginLeft: 6 },
});
