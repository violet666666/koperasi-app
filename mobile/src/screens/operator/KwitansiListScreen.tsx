import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, StatusBar,
  TouchableOpacity, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import api from '../../lib/api';
import C from '../../lib/colors';
import { log } from '../../utils/log';

interface Receipt {
  id: number;
  receiptNo: string;
  type: string;
  description: string;
  amount: number;
  receivedFrom: string;
  paymentMethod: string;
  status: string;
  receiptDate: string;
  notes?: string;
  member?: { id: number; memberNo: string; nrp?: string; name: string };
  createdBy?: { id: number; name: string };
}

const typeLabels: Record<string, string> = {
  simpanan: 'Setoran Simpanan',
  pinjaman: 'Pencairan Pinjaman',
  angsuran: 'Pembayaran Angsuran',
  unit_transaction: 'Transaksi Unit',
};

const statusConfig: Record<string, { text: string; color: string; bg: string }> = {
  draft: { text: 'Draft', color: '#F59E0B', bg: '#FFFBEB' },
  printed: { text: 'Dicetak', color: '#10B981', bg: '#ECFDF5' },
  void: { text: 'Batal', color: '#EF4444', bg: '#FEF2F2' },
};

const paymentLabels: Record<string, string> = {
  cash: 'Tunai',
  bank_transfer: 'Transfer Bank',
  potong_gaji: 'Potong Gaji',
  debet_simpanan: 'Debet Simpanan',
  qris: 'QRIS / E-Wallet',
};

const formatRp = (n: number) => 'Rp ' + Math.abs(n).toLocaleString('id-ID');
const formatDate = (d: string) =>
  new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

function terbilang(amount: number): string {
  const units = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan'];
  const teens = ['Sepuluh', 'Sebelas', 'Dua Belas', 'Tiga Belas', 'Empat Belas', 'Lima Belas',
    'Enam Belas', 'Tujuh Belas', 'Delapan Belas', 'Sembilan Belas'];

  function convert(n: number): string {
    if (n === 0) return '';
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return units[Math.floor(n / 10)] + ' Puluh' + (n % 10 ? ' ' + units[n % 10] : '');
    if (n < 200) return 'Seratus' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 1000) return units[Math.floor(n / 100)] + ' Ratus' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 2000) return 'Seribu' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 1_000_000) return convert(Math.floor(n / 1000)) + ' Ribu' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 1_000_000_000) return convert(Math.floor(n / 1_000_000)) + ' Juta' + (n % 1_000_000 ? ' ' + convert(n % 1_000_000) : '');
    return convert(Math.floor(n / 1_000_000_000)) + ' Miliar' + (n % 1_000_000_000 ? ' ' + convert(n % 1_000_000_000) : '');
  }

  if (amount === 0) return 'Nol Rupiah';
  return convert(Math.floor(Math.abs(amount))) + ' Rupiah';
}

export default function KwitansiListScreen() {
  const navigation = useNavigation<any>();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { perPage: 50 };
      if (filter !== 'all') params.status = filter;
      const res = await api.get('/api/receipts', { params });
      setReceipts(res.data.data || []);
    } catch (err) {
      log.error('Kwitansi fetch error:', err);
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Reload when screen is focused (after create/edit)
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ---- ACTIONS ----
  const handleDelete = (receipt: Receipt) => {
    Alert.alert(
      'Hapus Kwitansi?',
      `Hapus kwitansi ${receipt.receiptNo} secara permanen?\n\nData tidak dapat dikembalikan.`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Hapus',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/api/receipts/${receipt.id}`);
              Alert.alert('Berhasil', 'Kwitansi berhasil dihapus');
              loadData();
            } catch (err: any) {
              Alert.alert('Gagal', err.response?.data?.message || 'Gagal menghapus kwitansi');
            }
          },
        },
      ]
    );
  };

  const handleVoid = (receipt: Receipt) => {
    Alert.alert(
      'Batalkan Kwitansi?',
      `Batalkan (void) kwitansi ${receipt.receiptNo}?\n\nKwitansi tetap tercatat untuk audit namun tidak dapat dicetak ulang.`,
      [
        { text: 'Tidak', style: 'cancel' },
        {
          text: 'Ya, Batalkan',
          onPress: async () => {
            try {
              await api.put(`/api/receipts/${receipt.id}`, { status: 'void' });
              Alert.alert('Berhasil', 'Kwitansi berhasil dibatalkan');
              loadData();
            } catch (err: any) {
              Alert.alert('Gagal', err.response?.data?.message || 'Gagal membatalkan kwitansi');
            }
          },
        },
      ]
    );
  };

  // ---- RENDER ----
  const renderItem = ({ item }: { item: Receipt }) => {
    const st = statusConfig[item.status] || statusConfig.draft;
    const isExpanded = expandedId === item.id;
    const isDraft = item.status === 'draft';
    const isPrinted = item.status === 'printed';
    const isVoid = item.status === 'void';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
      >
        {/* Top Row */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.receiptNo}>{item.receiptNo}</Text>
            <Text style={styles.receiptDate}>{formatDate(item.receiptDate)}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: st.bg }]}>
            <Text style={[styles.badgeText, { color: st.color }]}>{st.text}</Text>
          </View>
        </View>

        {/* Identity */}
        <View style={styles.cardBody}>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberName}>{item.receivedFrom}</Text>
            <Text style={styles.memberNrp}>{item.member?.nrp || item.member?.memberNo || '-'}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amount}>{formatRp(item.amount)}</Text>
            <Text style={styles.typeLabel}>{typeLabels[item.type] || item.type}</Text>
          </View>
        </View>

        {/* Expanded Detail */}
        {isExpanded && (
          <View style={styles.expandSection}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Keterangan</Text>
              <Text style={styles.detailValue}>{item.description}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Metode Bayar</Text>
              <Text style={styles.detailValue}>{paymentLabels[item.paymentMethod] || item.paymentMethod}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Terbilang</Text>
              <Text style={[styles.detailValue, { fontStyle: 'italic', fontSize: 11 }]}>{terbilang(item.amount)}</Text>
            </View>
            {item.notes ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Catatan</Text>
                <Text style={styles.detailValue}>{item.notes}</Text>
              </View>
            ) : null}
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Dibuat oleh</Text>
              <Text style={styles.detailValue}>{item.createdBy?.name || '-'}</Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              {isDraft && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: C.infoBg }]}
                  onPress={() => navigation.navigate('KwitansiForm', { receiptId: item.id })}
                >
                  <Ionicons name="create-outline" size={16} color={C.info} />
                  <Text style={[styles.actionText, { color: C.info }]}>Edit</Text>
                </TouchableOpacity>
              )}

              {isPrinted && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: C.warningBg }]}
                  onPress={() => handleVoid(item)}
                >
                  <Ionicons name="ban-outline" size={16} color={C.warning} />
                  <Text style={[styles.actionText, { color: C.warning }]}>Void</Text>
                </TouchableOpacity>
              )}

              {(isDraft || isVoid) && (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: C.destructiveBg }]}
                  onPress={() => handleDelete(item)}
                >
                  <Ionicons name="trash-outline" size={16} color={C.destructive} />
                  <Text style={[styles.actionText, { color: C.destructive }]}>Hapus</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Expand indicator */}
        <View style={styles.expandIndicator}>
          <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.mutedForeground} />
        </View>
      </TouchableOpacity>
    );
  };

  const FILTERS = [
    { key: 'all', label: 'Semua' },
    { key: 'draft', label: 'Draft' },
    { key: 'printed', label: 'Dicetak' },
    { key: 'void', label: 'Void' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Kwitansi</Text>
            <Text style={styles.headerSub}>Kelola dan monitoring kwitansi PRIMKOPPOL</Text>
          </View>
        </View>

        {/* Stats chips */}
        <View style={styles.statsRow}>
          <View style={[styles.statChip, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
            <Text style={styles.statValue}>{receipts.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: 'rgba(212,175,55,0.2)' }]}>
            <Text style={[styles.statValue, { color: C.accent }]}>{receipts.filter(r => r.status === 'draft').length}</Text>
            <Text style={styles.statLabel}>Draft</Text>
          </View>
          <View style={[styles.statChip, { backgroundColor: 'rgba(16,185,129,0.2)' }]}>
            <Text style={[styles.statValue, { color: C.success }]}>{receipts.filter(r => r.status === 'printed').length}</Text>
            <Text style={styles.statLabel}>Cetak</Text>
          </View>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]}
            onPress={() => { setFilter(f.key); setLoading(true); }}
          >
            <Text style={[styles.filterLabel, filter === f.key && styles.filterLabelActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.emptyText}>Memuat data...</Text>
        </View>
      ) : receipts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🧾</Text>
          <Text style={styles.emptyText}>Belum ada kwitansi</Text>
        </View>
      ) : (
        <FlatList
          data={receipts}
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

      {/* FAB — Buat Kwitansi */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('KwitansiForm', {})}
      >
        <Ionicons name="add" size={24} color={C.primary} />
        <Text style={styles.fabText}>Buat Kwitansi</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 48, paddingBottom: 20, paddingHorizontal: 20,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  headerSub: { color: C.mutedForeground, fontSize: 13, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 10 },
  statChip: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  statValue: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: C.mutedForeground, fontSize: 11, marginTop: 2 },
  filterRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  filterBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: C.muted },
  filterBtnActive: { backgroundColor: C.accent },
  filterLabel: { fontSize: 12, fontWeight: '600', color: C.mutedForeground },
  filterLabelActive: { color: C.primary },
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  receiptNo: { fontSize: 14, fontWeight: 'bold', color: C.primary, fontFamily: 'monospace' },
  receiptDate: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  memberName: { fontSize: 15, fontWeight: '600', color: C.foreground },
  memberNrp: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  amount: { fontSize: 16, fontWeight: 'bold', color: C.success },
  typeLabel: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  expandSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border },
  detailRow: { flexDirection: 'row', marginBottom: 8 },
  detailLabel: { width: 100, fontSize: 12, color: C.mutedForeground, fontWeight: '500' },
  detailValue: { flex: 1, fontSize: 12, color: C.foreground },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  actionText: { fontSize: 13, fontWeight: '600' },
  expandIndicator: { alignItems: 'center', marginTop: 6 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: C.mutedForeground, marginTop: 8 },
  fab: {
    position: 'absolute', bottom: 20, right: 20, left: 20,
    backgroundColor: C.accent, borderRadius: 16, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  fabText: { color: C.primary, fontSize: 16, fontWeight: 'bold' },
});
