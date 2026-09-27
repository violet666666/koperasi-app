import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, StatusBar,
  TouchableOpacity, ScrollView, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import C from '../../lib/colors';
import api from '../../lib/api';
import { formatRp } from '../../lib/constants';
import { log } from '../../utils/log';

// ── Types ──────────────────────────────────────────────────────────────────
interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  transactionDate: string;
  createdAt?: string;        // S1-06: gunakan ini untuk tampil jam akurat
  balanceBefore?: number;
  balanceAfter?: number;
  productName?: string;
  isPaid?: boolean;
  status?: string;
}

const TABS = [
  { key: 'savings', label: 'Simpanan' },
  { key: 'unit', label: 'Kredit Unit' },
  { key: 'loan', label: 'Angsuran' },
];

// S2-03: Filter status — hanya chip yang BERLAKU untuk tab aktif.
// (Sebelumnya 5 chip tampil di semua tab; 2-3 di antaranya diam-diam
// tidak memfilter apa pun → pengguna percaya filternya bohong.)
const CHIP_SETS: Record<string, { key: string; label: string }[]> = {
  savings: [
    { key: 'all', label: 'Semua' },
    { key: 'deposit', label: 'Setoran' },
    { key: 'withdraw', label: 'Penarikan' },
  ],
  unit: [
    { key: 'all', label: 'Semua' },
    { key: 'paid', label: 'Lunas' },
    { key: 'unpaid', label: 'Belum Lunas' },
  ],
  loan: [], // semua angsuran completed — chip tidak relevan
};

// S1-06: Gunakan createdAt untuk waktu akurat (bukan transactionDate yang @db.Date)
const formatDateTime = (d: string | undefined, fallback: string) => {
  const dateStr = d || fallback;
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

// ── Main Component ─────────────────────────────────────────────────────────
export default function TransaksiScreen() {
  const [activeTab, setActiveTab] = useState('savings');
  const [statusFilter, setStatusFilter] = useState('all'); // S2-03
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  // Gagal load ≠ data kosong — anggota harus tahu bedanya (jangan tampilkan
  // "Belum ada transaksi" padahal cuma koneksi putus).
  const [error, setError] = useState(false);
  // Pagination: load-more via onEndReached (sebelumnya hard-stop di 50 baris
  // pertama — anggota lama tak pernah bisa lihat history lebih tua).
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/api/mobile/transactions', {
        params: { type: activeTab, page: 1, limit: 50 },
      });
      setTransactions(res.data.data || []);
      setTotalPages(res.data.meta?.totalPages || 1);
      setTotal(res.data.meta?.total || 0);
      setPage(1);
    } catch (err: any) {
      log.error('Transaksi fetch error:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset filter saat ganti tab
  useEffect(() => { setStatusFilter('all'); }, [activeTab]);

  const loadMore = async () => {
    if (loadingMore || loading || error || page >= totalPages) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await api.get('/api/mobile/transactions', {
        params: { type: activeTab, page: nextPage, limit: 50 },
      });
      setTransactions(prev => [...prev, ...(res.data.data || [])]);
      setPage(nextPage);
      setTotalPages(res.data.meta?.totalPages || totalPages);
      setTotal(res.data.meta?.total || total);
    } catch (err: any) {
      log.error('Transaksi loadMore error:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // S2-03: Filter client-side — hanya kriteria yang berlaku untuk tab aktif
  const filteredTransactions = transactions.filter((t) => {
    if (statusFilter === 'all') return true;
    if (activeTab === 'savings') {
      if (statusFilter === 'deposit') return t.type === 'deposit';
      if (statusFilter === 'withdraw') return t.type !== 'deposit';
    }
    if (activeTab === 'unit') {
      if (statusFilter === 'paid') return t.isPaid === true && t.status !== 'voided';
      if (statusFilter === 'unpaid') return t.isPaid === false && t.status !== 'voided';
    }
    return true;
  });

  const getIcon = (item: Transaction): { name: any; color: string } => {
    if (activeTab === 'savings') {
      return item.type === 'deposit'
        ? { name: 'arrow-down-circle', color: C.success }
        : { name: 'arrow-up-circle', color: C.destructive };
    }
    if (activeTab === 'unit') {
      if (item.status === 'voided') return { name: 'close-circle', color: C.mutedForeground };
      if (item.status === 'pending_void') return { name: 'time', color: C.warning };
      return item.isPaid
        ? { name: 'checkmark-circle', color: C.success }
        : { name: 'cart', color: C.warning };
    }
    return { name: 'card', color: C.info };
  };

  const getLabel = (item: Transaction) => {
    if (activeTab === 'savings') return item.type === 'deposit' ? 'Setoran' : 'Penarikan';
    if (activeTab === 'unit') return item.type || 'Kredit Unit';
    return 'Angsuran';
  };

  const getColor = (item: Transaction) => {
    if (activeTab === 'savings') return item.type === 'deposit' ? C.success : C.destructive;
    if (activeTab === 'unit') {
      if (item.status === 'voided') return C.mutedForeground;
      return item.isPaid ? C.mutedForeground : C.warning;
    }
    return C.success;
  };

  const getStatusBadge = (item: Transaction) => {
    if (activeTab !== 'unit') return null;
    if (item.status === 'voided') return { text: 'Dibatalkan', bg: C.muted, color: C.mutedForeground };
    if (item.status === 'pending_void') return { text: 'Menunggu Pembatalan', bg: C.warningBg, color: C.warning };
    if (item.isPaid) return { text: 'Lunas', bg: C.successBg, color: C.success };
    return { text: 'Belum Lunas', bg: C.warningBg, color: C.warning };
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const badge = getStatusBadge(item);
    const icon = getIcon(item);
    return (
      <View style={[styles.txCard, item.status === 'voided' && { opacity: 0.6 }]}>
        <View style={styles.txLeft}>
          <Ionicons name={icon.name} size={24} color={icon.color} style={styles.txIcon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.txType}>{getLabel(item)}</Text>
            {/* S1-06: Gunakan createdAt untuk jam akurat */}
            <Text style={styles.txDate}>{formatDateTime(item.createdAt, item.transactionDate)}</Text>
            {item.description ? <Text style={styles.txDesc} numberOfLines={2}>{item.description}</Text> : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.txAmount, { color: getColor(item) }]}>
            {activeTab === 'savings' && item.type === 'deposit' ? '+' : activeTab === 'savings' ? '-' : ''}{formatRp(item.amount)}
          </Text>
          {item.balanceAfter !== undefined && (
            <Text style={styles.txBalance}>Saldo: {formatRp(item.balanceAfter)}</Text>
          )}
          {badge && (
            <Text style={[styles.txBadge, { backgroundColor: badge.bg, color: badge.color }]}>
              {badge.text}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const chips = CHIP_SETS[activeTab] || [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Riwayat Transaksi</Text>
        <Text style={styles.headerSub}>Mutasi simpanan, kredit unit, dan angsuran</Text>
      </View>

      {/* Tab Filter */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* S2-03: Status Filter Chips — hanya yang berlaku utk tab ini */}
      {chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
        >
          {chips.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                statusFilter === f.key && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(f.key)}
            >
              <Text style={[styles.filterChipText, statusFilter === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {error ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={C.mutedForeground} />
          <Text style={styles.emptyText}>Gagal memuat data. Periksa koneksi Anda.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => loadData()} accessibilityLabel="Coba lagi memuat data">
            <Text style={styles.retryText}>Coba lagi</Text>
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Memuat data...</Text>
        </View>
      ) : filteredTransactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="archive-outline" size={48} color={C.mutedForeground} />
          <Text style={styles.emptyText}>
            {statusFilter === 'all'
              ? `Belum ada transaksi ${TABS.find(t => t.key === activeTab)?.label.toLowerCase()}`
              : `Tidak ada transaksi dengan filter ini`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredTransactions}
          keyExtractor={(item) => `${activeTab}-${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.footer}>
                {loadingMore ? (
                  <ActivityIndicator size="small" color={C.accent} />
                ) : (
                  <Text style={styles.footerText}>
                    Menampilkan {transactions.length} dari {total} transaksi
                  </Text>
                )}
              </View>
            ) : null
          }
          windowSize={10}
          maxToRenderPerBatch={5}
          initialNumToRender={10}
          removeClippedSubviews={true}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 56, paddingBottom: 20, paddingHorizontal: 24,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  headerSub: { color: C.mutedForeground, fontSize: 13, marginTop: 4 },
  tabRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 8,
  },
  tabBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: C.muted,
  },
  tabBtnActive: { backgroundColor: C.accent },
  tabLabel: { fontSize: 13, fontWeight: '600', color: C.mutedForeground },
  tabLabelActive: { color: C.primary },
  // S2-03: Filter chip styles
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999,
    backgroundColor: C.muted, borderWidth: 1, borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: C.primaryLight + '20', borderColor: C.primary,
  },
  filterChipText: { fontSize: 12, fontWeight: '600', color: C.mutedForeground },
  filterChipTextActive: { color: C.primary },
  txCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  txLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flex: 1 },
  txIcon: { marginTop: 2 },
  txType: { fontSize: 14, fontWeight: '600', color: C.primary },
  txDate: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  txDesc: { fontSize: 11, color: C.mutedForeground, marginTop: 2, paddingRight: 8 },
  txAmount: { fontSize: 15, fontWeight: 'bold' },
  txBalance: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  txBadge: { fontSize: 10, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4, overflow: 'hidden' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyText: { fontSize: 15, color: C.mutedForeground, marginTop: 12, textAlign: 'center' },
  retryBtn: {
    marginTop: 16, backgroundColor: C.primary, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 24,
  },
  retryText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  footer: { paddingVertical: 14, alignItems: 'center' },
  footerText: { fontSize: 12, color: C.mutedForeground },
});
