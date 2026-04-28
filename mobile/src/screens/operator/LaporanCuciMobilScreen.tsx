import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, RefreshControl, StatusBar, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Toast from 'react-native-toast-message';
import api from '../../lib/api';
import C from '../../lib/colors';

// Types
interface ReportData {
  pendapatanKotor: number;
  bagianKaryawan: number;
  bagianKoperasi: number;
  totalPengeluaran: number;
  labaBersihKoperasi: number;
  period: string;
  unitType: string;
}

interface Transaction {
  id: number;
  transactionNo: string;
  description: string;
  amount: number;
  transactionDate: string;
  notes?: string;
  status: string;
  paymentMethod: string;
  member?: { name: string; nrp: string };
}

const PERIOD_FILTERS = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
];

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');
const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID', {
  day: '2-digit', month: 'short', year: 'numeric'
});

export default function LaporanCuciMobilScreen({ navigation: navProp }: any) {
  const navHook = useNavigation<any>();
  const navigation = navProp || navHook;
  const canGoBack = navigation.canGoBack?.() ?? false;

  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState('month');

  // Transaction list state
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  // Date edit state
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/mobile/reports/unit?unitType=cuci_mobil&period=${period}`);
      setData(res.data.data);
    } catch (err: any) {
      console.log('Report fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const loadTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const res = await api.get(`/api/unit-transactions?unitType=cuci_mobil&perPage=50`);
      const allTxs: Transaction[] = res.data.data || [];
      // Client-side period filter
      const now = new Date();
      const filtered = allTxs.filter((tx) => {
        const d = new Date(tx.transactionDate);
        if (period === 'today') {
          return d.toDateString() === now.toDateString();
        } else if (period === 'week') {
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          return d >= weekAgo && d <= now;
        } else {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        }
      });
      setTransactions(filtered);
    } catch (err: any) {
      console.log('Transaction fetch error:', err);
    } finally {
      setTxLoading(false);
    }
  }, [period]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadTransactions();
    }, [loadData, loadTransactions])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadTransactions()]);
    setRefreshing(false);
  };

  const handleDateChange = async (_event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (!selectedDate || !editingTx) return;

    const newDate = selectedDate.toISOString().split('T')[0];
    const oldDate = new Date(editingTx.transactionDate).toISOString().split('T')[0];
    if (newDate === oldDate) {
      setEditingTx(null);
      return;
    }

    setSaving(true);
    try {
      await api.patch(`/api/unit-transactions/${editingTx.id}/details`, {
        transactionDate: newDate,
      });
      Toast.show({ type: 'success', text1: 'Berhasil', text2: `Tanggal diubah ke ${formatDate(newDate)}` });
      await loadTransactions();
      await loadData();
    } catch (err: any) {
      Toast.show({ type: 'error', text1: 'Gagal', text2: err?.response?.data?.message || 'Gagal mengubah tanggal' });
    } finally {
      setSaving(false);
      setEditingTx(null);
    }
  };

  const openDatePicker = (tx: Transaction) => {
    setEditingTx(tx);
    setShowDatePicker(true);
  };

  const extractPlate = (notes?: string) => {
    if (!notes) return null;
    const match = notes.match(/\[PLAT:([^\]]*)\]/i);
    return match ? match[1] : null;
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const plate = extractPlate(item.notes);
    const isVoided = item.status === 'voided';

    return (
      <View style={[styles.txCard, isVoided && styles.txCardVoided]}>
        <View style={styles.txTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.txDesc, isVoided && styles.txTextVoided]} numberOfLines={1}>
              {item.description}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <Text style={styles.txDate}>{formatDate(item.transactionDate)}</Text>
              {plate && (
                <View style={styles.plateBadge}>
                  <Text style={styles.plateText}>{plate}</Text>
                </View>
              )}
              {item.member && (
                <Text style={styles.txMember}>{item.member.name}</Text>
              )}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <Text style={[styles.txAmount, isVoided && styles.txTextVoided]}>
              {formatRp(Number(item.amount))}
            </Text>
            {!isVoided && (
              <TouchableOpacity
                style={styles.dateEditBtn}
                onPress={() => openDatePicker(item)}
                disabled={saving}
              >
                <Ionicons name="calendar-outline" size={16} color={C.primary} />
                <Text style={styles.dateEditLabel}>Ubah Tgl</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {isVoided && (
          <View style={styles.voidedBadge}>
            <Text style={styles.voidedText}>DIBATALKAN</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {canGoBack && (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
          )}
          <View>
            <Text style={styles.headerTitle}>Laporan Cuci Mobil</Text>
            <Text style={styles.headerSub}>Bagi Hasil PRIMKOPPOL & Karyawan</Text>
          </View>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
        {PERIOD_FILTERS.map(f => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, period === f.key && styles.filterChipActive]}
            onPress={() => setPeriod(f.key)}
          >
            <Text style={[styles.filterChipText, period === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
      >
        {loading ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <ActivityIndicator color={C.primary} />
            <Text style={{ marginTop: 10, color: C.mutedForeground }}>Memuat laporan...</Text>
          </View>
        ) : data ? (
          <>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.iconContainer}><Ionicons name="cash" size={20} color={C.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Pendapatan Kotor</Text>
                  <Text style={styles.valuePrimary}>{formatRp(data.pendapatanKotor)}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Alokasi Bagi Hasil (50:50)</Text>

            <View style={styles.card}>
              <View style={[styles.row, { borderBottomWidth: 1, borderColor: '#F1F5F9', paddingBottom: 12, marginBottom: 12 }]}>
                <View style={[styles.iconContainer, { backgroundColor: '#FEF2F2' }]}><Ionicons name="people" size={20} color="#EF4444" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Bagian Karyawan (50%)</Text>
                  <Text style={[styles.value, { color: '#EF4444' }]}>{formatRp(data.bagianKaryawan)}</Text>
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.iconContainer, { backgroundColor: '#F0FDF4' }]}><Ionicons name="business" size={20} color="#10B981" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Bagian PRIMKOPPOL (50%)</Text>
                  <Text style={[styles.value, { color: '#10B981' }]}>{formatRp(data.bagianKoperasi)}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Pengeluaran & Laba PRIMKOPPOL</Text>

            <View style={[styles.card, { borderColor: C.accent, borderWidth: 1 }]}>
              <View style={[styles.row, { borderBottomWidth: 1, borderColor: '#F1F5F9', paddingBottom: 12, marginBottom: 12 }]}>
                <View style={[styles.iconContainer, { backgroundColor: '#FFFBEB' }]}><Ionicons name="receipt" size={20} color="#F59E0B" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Total Pengeluaran Ops.</Text>
                  <Text style={[styles.value, { color: '#F59E0B' }]}>- {formatRp(data.totalPengeluaran)}</Text>
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.iconContainer, { backgroundColor: C.primaryLight + '20' }]}><Ionicons name="stats-chart" size={20} color={C.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { fontWeight: 'bold' }]}>Laba Bersih PRIMKOPPOL</Text>
                  <Text style={[styles.valuePrimary, { fontSize: 22 }]}>{formatRp(data.labaBersihKoperasi)}</Text>
                </View>
              </View>
            </View>

            {/* Transaction List */}
            <Text style={styles.sectionTitle}>Riwayat Transaksi</Text>
            {txLoading ? (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <ActivityIndicator color={C.primary} size="small" />
              </View>
            ) : transactions.length === 0 ? (
              <View style={styles.emptyTx}>
                <Ionicons name="receipt-outline" size={32} color={C.mutedForeground} />
                <Text style={{ color: C.mutedForeground, marginTop: 8 }}>Tidak ada transaksi di periode ini</Text>
              </View>
            ) : (
              transactions.map((tx) => (
                <View key={tx.id}>{renderTransaction({ item: tx })}</View>
              ))
            )}
          </>
        ) : (
          <Text style={{ textAlign: 'center', color: C.mutedForeground, marginTop: 20 }}>Tidak ada data</Text>
        )}
      </ScrollView>

      {/* Date Picker */}
      {showDatePicker && editingTx && (
        <DateTimePicker
          value={new Date(editingTx.transactionDate)}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      {/* Saving overlay */}
      <Modal visible={saving} transparent animationType="fade">
        <View style={styles.savingOverlay}>
          <View style={styles.savingCard}>
            <ActivityIndicator color={C.primary} size="large" />
            <Text style={{ marginTop: 12, color: C.foreground, fontWeight: '600' }}>Menyimpan...</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 56, paddingBottom: 20, paddingHorizontal: 24,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: C.accent, fontSize: 13, marginTop: 4 },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999,
    backgroundColor: C.muted, borderWidth: 1, borderColor: 'transparent',
    maxHeight: 35
  },
  filterChipActive: { backgroundColor: C.primaryLight + '20', borderColor: C.primary },
  filterChipText: { fontSize: 13, fontWeight: '600', color: C.mutedForeground },
  filterChipTextActive: { color: C.primary },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: C.mutedForeground, marginTop: 16, marginBottom: 8, marginLeft: 4 },
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  value: { fontSize: 18, fontWeight: 'bold' },
  valuePrimary: { fontSize: 18, fontWeight: 'bold', color: C.primary },

  // Transaction list styles
  txCard: {
    backgroundColor: C.card, borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  txCardVoided: { opacity: 0.5, backgroundColor: '#F8FAFC' },
  txTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  txDesc: { fontSize: 14, fontWeight: '600', color: C.foreground },
  txDate: { fontSize: 12, color: C.mutedForeground },
  txMember: { fontSize: 11, color: C.mutedForeground },
  txAmount: { fontSize: 15, fontWeight: 'bold', color: C.primary },
  txTextVoided: { textDecorationLine: 'line-through', color: C.mutedForeground },
  plateBadge: {
    backgroundColor: '#EFF6FF', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  plateText: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },
  dateEditBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.primaryLight + '15', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
  },
  dateEditLabel: { fontSize: 11, fontWeight: '600', color: C.primary },
  voidedBadge: {
    marginTop: 8, alignSelf: 'flex-start',
    backgroundColor: '#FEF2F2', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3,
  },
  voidedText: { fontSize: 10, fontWeight: '700', color: '#DC2626' },
  emptyTx: { alignItems: 'center', padding: 24 },

  // Saving overlay
  savingOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  savingCard: {
    backgroundColor: C.card, borderRadius: 16, padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
});
