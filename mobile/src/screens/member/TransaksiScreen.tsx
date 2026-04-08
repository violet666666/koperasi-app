import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, StatusBar,
  TouchableOpacity, ScrollView
} from 'react-native';
import C from '../../lib/colors';
import api from '../../lib/api';

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

// S2-03: Filter status
const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'Semua' },
  { key: 'unpaid', label: 'Belum Lunas' },
  { key: 'pending_void', label: 'Pending Void' },
  { key: 'voided', label: 'Dibatalkan' },
  { key: 'completed', label: 'Selesai' },
];

const formatRp = (n: number) => 'Rp ' + Math.abs(n).toLocaleString('id-ID');

// S1-06: Gunakan createdAt untuk waktu akurat (bukan transactionDate yang @db.Date)
const formatDateTime = (d: string | undefined, fallback: string) => {
  const dateStr = d || fallback;
  const date = new Date(dateStr);
  return date.toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }) + ' WIB';
};

// ── Main Component ─────────────────────────────────────────────────────────
export default function TransaksiScreen() {
  const [activeTab, setActiveTab] = useState('savings');
  const [statusFilter, setStatusFilter] = useState('all'); // S2-03
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/mobile/transactions?type=${activeTab}&limit=50`);
      setTransactions(res.data.data || []);
    } catch (err: any) {
      console.log('Transaksi fetch error:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);

  // Reset filter saat ganti tab
  useEffect(() => { setStatusFilter('all'); }, [activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // S2-03: Filter client-side berdasarkan status
  const filteredTransactions = transactions.filter((t) => {
    if (statusFilter === 'all') return true;
    if (activeTab === 'unit') {
      if (statusFilter === 'unpaid') return t.isPaid === false && t.status !== 'voided';
      if (statusFilter === 'pending_void') return t.status === 'pending_void';
      if (statusFilter === 'voided') return t.status === 'voided';
      if (statusFilter === 'completed') return t.isPaid === true || t.status === 'completed';
    }
    if (activeTab === 'savings') {
      if (statusFilter === 'completed') return t.status === 'completed';
      if (statusFilter === 'voided') return t.status === 'voided';
      return true;
    }
    return true;
  });

  const getIcon = (item: Transaction) => {
    if (activeTab === 'savings') return item.type === 'deposit' ? '⬇️' : '⬆️';
    if (activeTab === 'unit') {
      if (item.status === 'voided') return '❌';
      if (item.status === 'pending_void') return '⏳';
      return item.isPaid ? '✅' : '🛒';
    }
    return '💳';
  };

  const getLabel = (item: Transaction) => {
    if (activeTab === 'savings') return item.type === 'deposit' ? 'Setoran' : 'Penarikan';
    if (activeTab === 'unit') return item.type || 'Kredit Unit';
    return 'Angsuran';
  };

  const getColor = (item: Transaction) => {
    if (activeTab === 'savings') return item.type === 'deposit' ? '#10B981' : '#EF4444';
    if (activeTab === 'unit') {
      if (item.status === 'voided') return '#94A3B8';
      return item.isPaid ? '#64748B' : '#F59E0B';
    }
    return '#10B981';
  };

  const getStatusBadge = (item: Transaction) => {
    if (activeTab !== 'unit') return null;
    if (item.status === 'voided') return { text: 'Dibatalkan', bg: '#F1F5F9', color: '#64748B' };
    if (item.status === 'pending_void') return { text: 'Pending Void', bg: '#FFF7ED', color: '#EA580C' };
    if (item.isPaid) return { text: 'Lunas', bg: '#ECFDF5', color: '#10B981' };
    return { text: 'Belum Bayar', bg: '#FFFBEB', color: '#F59E0B' };
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const badge = getStatusBadge(item);
    return (
      <View style={[styles.txCard, item.status === 'voided' && { opacity: 0.6 }]}>
        <View style={styles.txLeft}>
          <Text style={styles.txIcon}>{getIcon(item)}</Text>
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

      {/* S2-03: Status Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 8, gap: 8 }}
      >
        {STATUS_FILTERS.map((f) => (
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

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Memuat data...</Text>
        </View>
      ) : filteredTransactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
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
  txIcon: { fontSize: 24, marginTop: 2 },
  txType: { fontSize: 14, fontWeight: '600', color: C.primary },
  txDate: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  txDesc: { fontSize: 11, color: C.mutedForeground, marginTop: 2, paddingRight: 8 },
  txAmount: { fontSize: 15, fontWeight: 'bold' },
  txBalance: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  txBadge: { fontSize: 10, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4, overflow: 'hidden' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: C.mutedForeground },
});
