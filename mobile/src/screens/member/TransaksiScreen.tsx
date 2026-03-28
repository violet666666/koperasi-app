import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, StatusBar, TouchableOpacity } from 'react-native';
import C from '../../lib/colors';
import api from '../../lib/api';

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  transactionDate: string;
  balanceBefore?: number;
  balanceAfter?: number;
  productName?: string;
  isPaid?: boolean;
}

const TABS = [
  { key: 'savings', label: 'Simpanan' },
  { key: 'unit', label: 'Kredit Unit' },
  { key: 'loan', label: 'Angsuran' },
];

const formatRp = (n: number) => 'Rp ' + Math.abs(n).toLocaleString('id-ID');
const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

export default function TransaksiScreen() {
  const [activeTab, setActiveTab] = useState('savings');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/mobile/transactions?type=${activeTab}&limit=50`);
      setTransactions(res.data.data || []);
    } catch (err) {
      console.log('Transaksi fetch error:', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getIcon = (item: Transaction) => {
    if (activeTab === 'savings') return item.type === 'deposit' ? '⬇️' : '⬆️';
    if (activeTab === 'unit') return item.isPaid ? '✅' : '🛒';
    return '💳';
  };

  const getLabel = (item: Transaction) => {
    if (activeTab === 'savings') return item.type === 'deposit' ? 'Setoran' : 'Penarikan';
    if (activeTab === 'unit') return item.type || 'Kredit Unit';
    return 'Angsuran';
  };

  const getColor = (item: Transaction) => {
    if (activeTab === 'savings') return item.type === 'deposit' ? '#10B981' : '#EF4444';
    if (activeTab === 'unit') return item.isPaid ? '#64748B' : '#F59E0B';
    return '#10B981';
  };

  const renderItem = ({ item }: { item: Transaction }) => (
    <View style={styles.txCard}>
      <View style={styles.txLeft}>
        <Text style={styles.txIcon}>{getIcon(item)}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.txType}>{getLabel(item)}</Text>
          <Text style={styles.txDate}>{formatDate(item.transactionDate)}</Text>
          {item.description ? <Text style={styles.txDesc} numberOfLines={1}>{item.description}</Text> : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.txAmount, { color: getColor(item) }]}>
          {activeTab === 'savings' && item.type === 'deposit' ? '+' : activeTab === 'savings' ? '-' : ''}{formatRp(item.amount)}
        </Text>
        {item.balanceAfter !== undefined && (
          <Text style={styles.txBalance}>Saldo: {formatRp(item.balanceAfter)}</Text>
        )}
        {activeTab === 'unit' && item.isPaid !== undefined && (
          <Text style={[styles.txBadge, { backgroundColor: item.isPaid ? '#ECFDF5' : '#FFFBEB', color: item.isPaid ? '#10B981' : '#F59E0B' }]}>
            {item.isPaid ? 'Lunas' : 'Belum Bayar'}
          </Text>
        )}
      </View>
    </View>
  );

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

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Memuat data...</Text>
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>Belum ada transaksi {TABS.find(t => t.key === activeTab)?.label.toLowerCase()}</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
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
  txCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  txIcon: { fontSize: 24 },
  txType: { fontSize: 14, fontWeight: '600', color: C.primary },
  txDate: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  txDesc: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: 'bold' },
  txBalance: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  txBadge: { fontSize: 10, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginTop: 4, overflow: 'hidden' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: C.mutedForeground },
});
