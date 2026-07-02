import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, StatusBar } from 'react-native';
import api from '../../lib/api';
import C from '../../lib/colors';
import { log } from '../../utils/log';

interface Transaction {
  id: number;
  type: string;
  amount: number;
  description: string;
  transactionDate: string;
  balanceBefore?: number;
  balanceAfter?: number;
  productName?: string;
}

const formatRp = (n: number) => 'Rp ' + Math.abs(n).toLocaleString('id-ID');
const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

export default function SimpananScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/api/mobile/transactions?type=savings&limit=50');
      setTransactions(res.data.data || []);
    } catch (err) {
      log.error('Simpanan fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const isDeposit = item.type === 'deposit';
    const isCorrection = item.type === 'correction';

    let icon = isDeposit ? '⬇️' : '⬆️';
    let typeName = isDeposit ? 'Setoran' : 'Penarikan';
    let textColor = isDeposit ? C.success : C.destructive;

    if (isCorrection) {
      icon = '⚠️';
      typeName = 'Koreksi Data';
      textColor = '#F59E0B';
    }

    return (
      <View style={styles.txCard}>
        <View style={styles.txLeft}>
          <Text style={styles.txIcon}>{icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.txType, isCorrection && { color: textColor }]}>{typeName}</Text>
            <Text style={styles.txDate}>{formatDate(item.transactionDate)}</Text>
            {item.productName && <Text style={styles.txDesc}>{item.productName}</Text>}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.txAmount, { color: textColor }]}>
            {(isDeposit || (isCorrection && Number(item.amount) >= 0)) ? '+' : '-'}{formatRp(item.amount)}
          </Text>
          {item.balanceAfter !== undefined && (
            <Text style={styles.txBalance}>Saldo: {formatRp(item.balanceAfter)}</Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mutasi Simpanan</Text>
        <Text style={styles.headerSub}>Riwayat transaksi simpanan Anda</Text>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Memuat data...</Text>
        </View>
      ) : transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>Belum ada transaksi simpanan</Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => String(item.id)}
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
    backgroundColor: C.primary, paddingTop: 56, paddingBottom: 24, paddingHorizontal: 24,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  headerSub: { color: C.mutedForeground, fontSize: 13, marginTop: 4 },
  txCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 16, marginBottom: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  txLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  txIcon: { fontSize: 24 },
  txType: { fontSize: 14, fontWeight: '600', color: C.primary },
  txDate: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  txDesc: { fontSize: 11, color: C.foreground, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: 'bold' },
  txBalance: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: C.mutedForeground },
});
