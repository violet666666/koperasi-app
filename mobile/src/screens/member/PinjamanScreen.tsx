import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, StatusBar, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../lib/api';
import C from '../../lib/colors';
import { getLoanStatus, formatRp, formatDate } from '../../lib/constants';
import { log } from '../../utils/log';

interface Loan {
  id: number;
  loanNumber: string;
  principalAmount: number;
  principalOutstanding: number;
  interestRate: number;
  monthlyInstallment: number;
  tenor: number;
  status: string;
  disbursedAt: string | null;
  recentPayments: { id: number; amount: number; paymentDate: string }[];
}

export default function PinjamanScreen() {
  const navigation = useNavigation<any>();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/api/mobile/loans');
      setLoans(res.data.data || []);
    } catch (err) {
      log.error('Pinjaman fetch error:', err);
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

  const renderItem = ({ item }: { item: Loan }) => {
    const st = getLoanStatus(item.status);
    return (
      <View style={styles.loanCard}>
        <View style={styles.loanHeader}>
          <Text style={styles.loanNumber}>{item.loanNumber || `#${item.id}`}</Text>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.color }]}>{st.text}</Text>
          </View>
        </View>
        <View style={styles.loanBody}>
          <View style={styles.loanStat}>
            <Text style={styles.loanLabel}>Pokok Pinjaman</Text>
            <Text style={styles.loanValue}>{formatRp(item.principalAmount)}</Text>
          </View>
          <View style={styles.loanStat}>
            <Text style={styles.loanLabel}>Sisa Pokok</Text>
            <Text style={[styles.loanValue, { color: '#EF4444' }]}>{formatRp(item.principalOutstanding)}</Text>
          </View>
        </View>
        <View style={styles.loanMeta}>
          <Text style={styles.loanRate}>Bunga: {item.interestRate}%</Text>
          <Text style={styles.loanRate}>Angsuran: {formatRp(item.monthlyInstallment)}/bln</Text>
        </View>

        {item.recentPayments?.length > 0 && (
          <View style={styles.paymentsSection}>
            <Text style={styles.paymentTitle}>Pembayaran Terakhir:</Text>
            {item.recentPayments.slice(0, 3).map((p) => (
              <View key={p.id} style={styles.paymentRow}>
                <Text style={styles.paymentDate}>{formatDate(p.paymentDate)}</Text>
                <Text style={styles.paymentAmount}>{formatRp(p.amount)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pinjaman Saya</Text>
        <Text style={styles.headerSub}>Daftar pinjaman dan riwayat angsuran</Text>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Memuat data...</Text>
        </View>
      ) : loans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏦</Text>
          <Text style={styles.emptyText}>Belum ada pinjaman</Text>
        </View>
      ) : (
        <FlatList
          data={loans}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
          windowSize={10}
          maxToRenderPerBatch={5}
          initialNumToRender={10}
          removeClippedSubviews={true}
        />
      )}

      {/* FAB — Ajukan Pinjaman (mirip web: tombol pengajuan di halaman pinjaman) */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('LoanApplication')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={24} color="#FFF" />
        <Text style={styles.fabText}>Ajukan Pinjaman</Text>
      </TouchableOpacity>
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
  loanCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 20, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  loanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  loanNumber: { fontSize: 16, fontWeight: 'bold', color: C.primary },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  loanBody: { flexDirection: 'row', justifyContent: 'space-between' },
  loanStat: { flex: 1 },
  loanLabel: { fontSize: 12, color: C.mutedForeground, marginBottom: 4 },
  loanValue: { fontSize: 16, fontWeight: 'bold', color: C.foreground },
  loanMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  loanRate: { fontSize: 12, color: C.mutedForeground },
  paymentsSection: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  paymentTitle: { fontSize: 12, fontWeight: '600', color: C.mutedForeground, marginBottom: 8 },
  paymentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  paymentDate: { fontSize: 12, color: C.mutedForeground },
  paymentAmount: { fontSize: 12, fontWeight: '600', color: C.success },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: C.mutedForeground },
  fab: {
    position: 'absolute', bottom: 90, right: 20, left: 20,
    backgroundColor: C.accent, borderRadius: 16, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  fabText: { color: C.primary, fontSize: 16, fontWeight: 'bold' },
});
