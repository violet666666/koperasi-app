import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, StatusBar, TextInput, Alert, Modal, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../lib/api';
import C from '../../lib/colors';

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

interface SaleItem {
  name: string;
  sku: string;
  qty: number;
  price: number;
  subtotal: number;
}

interface Sale {
  id: number;
  saleNo: string;
  unitType: string;
  customerName: string | null;
  member: { id: number; name: string; memberNo: string } | null;
  totalAmount: number;
  paymentMethod: string;
  itemCount: number;
  items: SaleItem[];
  createdBy: { id: number; name: string };
  createdAt: string;
  isVoided: boolean;
  voidPending: boolean;
  voidReason: string | null;
}

const paymentLabel: Record<string, string> = {
  cash: '💵 Tunai',
  qris: '📱 QRIS',
  salary_cut: '✂️ Potong Gaji',
  credit: '✂️ Potong Gaji',
};

export default function RiwayatKasirScreen() {
  const navigation = useNavigation<any>();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Void modal state
  const [voidModal, setVoidModal] = useState(false);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidSubmitting, setVoidSubmitting] = useState(false);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await api.get('/api/mobile/toko/history?limit=50');
      setSales(res.data.data || []);
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message || 'Gagal memuat riwayat');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const onRefresh = () => { setRefreshing(true); fetchHistory(); };

  const openVoidModal = (sale: Sale) => {
    setVoidTarget(sale);
    setVoidReason('');
    setVoidModal(true);
  };

  const submitVoid = async () => {
    if (!voidTarget || !voidReason.trim()) {
      Alert.alert('Error', 'Harap isi alasan pembatalan');
      return;
    }
    setVoidSubmitting(true);
    try {
      const res = await api.post('/api/mobile/toko/history', {
        saleNo: voidTarget.saleNo,
        reason: voidReason.trim(),
      });
      Alert.alert('Berhasil ✅', res.data.message);
      setVoidModal(false);
      fetchHistory();
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message || 'Gagal mengajukan void');
    } finally {
      setVoidSubmitting(false);
    }
  };

  const getStatusBadge = (sale: Sale) => {
    if (sale.isVoided) return { label: 'DIBATALKAN', bg: '#FEE2E2', color: '#DC2626' };
    if (sale.voidPending) return { label: 'MENUNGGU VOID', bg: '#FEF3C7', color: '#D97706' };
    return { label: 'SELESAI', bg: '#DCFCE7', color: '#16A34A' };
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={styles.headerTitle}>📋 Riwayat Transaksi</Text>
          <Text style={styles.headerSub}>{sales.length} transaksi</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('EditNrp')}
          style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Ionicons name="person-add" size={14} color="#D97706" />
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#D97706' }}>Edit NRP</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
      >
        {sales.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={C.mutedForeground} />
            <Text style={{ color: C.mutedForeground, marginTop: 12, fontSize: 15 }}>Belum ada transaksi</Text>
          </View>
        ) : (
          sales.map((sale) => {
            const status = getStatusBadge(sale);
            const isExpanded = expandedId === sale.id;
            const date = new Date(sale.createdAt);

            return (
              <TouchableOpacity
                key={sale.id}
                style={[styles.card, sale.isVoided && { opacity: 0.6, borderColor: '#FCA5A5' }]}
                activeOpacity={0.7}
                onPress={() => setExpandedId(isExpanded ? null : sale.id)}
              >
                {/* Top Row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.saleNo}>{sale.saleNo}</Text>
                    <Text style={styles.dateText}>
                      {date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      {date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: status.bg }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: status.color }}>{status.label}</Text>
                  </View>
                </View>

                {/* Amount & Payment */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <Text style={styles.amount}>{formatRp(sale.totalAmount)}</Text>
                  <Text style={{ fontSize: 12, color: C.mutedForeground }}>{paymentLabel[sale.paymentMethod] || sale.paymentMethod}</Text>
                </View>

                {/* Member / Customer */}
                {(sale.member || sale.customerName) && (
                  <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 4 }}>
                    👤 {sale.member?.name || sale.customerName} {sale.member?.memberNo ? `(${sale.member.memberNo})` : ''}
                  </Text>
                )}

                {/* Items count */}
                <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 2 }}>
                  🛒 {sale.itemCount} item
                </Text>

                {/* Void reason if pending/voided */}
                {sale.voidReason && (
                  <View style={styles.voidReasonBox}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#92400E' }}>Alasan: {sale.voidReason}</Text>
                  </View>
                )}

                {/* Expanded Detail */}
                {isExpanded && (
                  <View style={styles.expandedSection}>
                    <View style={styles.divider} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: C.foreground, marginBottom: 6 }}>Detail Barang</Text>
                    {sale.items.map((item, idx) => (
                      <View key={idx} style={styles.itemRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, color: C.foreground }}>{item.name}</Text>
                          <Text style={{ fontSize: 11, color: C.mutedForeground }}>{item.qty}× @ {formatRp(item.price)}</Text>
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: C.foreground }}>{formatRp(item.subtotal)}</Text>
                      </View>
                    ))}

                    {/* Void Button — only for non-voided, non-pending sales */}
                    {!sale.isVoided && !sale.voidPending && (
                      <TouchableOpacity
                        style={styles.voidBtn}
                        onPress={() => openVoidModal(sale)}
                      >
                        <Ionicons name="close-circle" size={16} color="#DC2626" />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#DC2626', marginLeft: 6 }}>
                          Ajukan Pembatalan (Void)
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Expand indicator */}
                <View style={{ alignItems: 'center', marginTop: 6 }}>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={C.mutedForeground} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ═══ Void Modal ═══ */}
      <Modal visible={voidModal} transparent animationType="slide" onRequestClose={() => setVoidModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ Ajukan Pembatalan</Text>
            <Text style={{ fontSize: 13, color: C.mutedForeground, marginBottom: 4 }}>
              Transaksi: <Text style={{ fontWeight: '700', color: C.foreground }}>{voidTarget?.saleNo}</Text>
            </Text>
            <Text style={{ fontSize: 13, color: C.mutedForeground, marginBottom: 12 }}>
              Total: <Text style={{ fontWeight: '700', color: C.foreground }}>{formatRp(voidTarget?.totalAmount || 0)}</Text>
            </Text>

            <Text style={{ fontSize: 12, fontWeight: '600', color: C.foreground, marginBottom: 6 }}>Alasan Pembatalan *</Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Contoh: Salah input harga, pelanggan batal..."
              placeholderTextColor={C.mutedForeground}
              multiline
              numberOfLines={3}
              value={voidReason}
              onChangeText={setVoidReason}
            />

            <View style={{ backgroundColor: '#FEF3C7', padding: 10, borderRadius: 8, marginBottom: 16 }}>
              <Text style={{ fontSize: 11, color: '#92400E' }}>
                ℹ️ Permintaan void akan dikirim ke Admin/Operator untuk disetujui. Transaksi belum dibatalkan sampai disetujui.
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: C.muted, flex: 1 }]}
                onPress={() => setVoidModal(false)}
              >
                <Text style={{ color: C.foreground, fontWeight: '600' }}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#DC2626', flex: 1, opacity: !voidReason.trim() || voidSubmitting ? 0.5 : 1 }]}
                onPress={submitVoid}
                disabled={!voidReason.trim() || voidSubmitting}
              >
                {voidSubmitting ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={{ color: '#FFF', fontWeight: '700' }}>Kirim Void</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 56, paddingBottom: 16, paddingHorizontal: 16,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginTop: 12 },
  headerSub: { color: '#FFF', fontSize: 12, opacity: 0.7, marginTop: 2 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14,
    padding: 14, marginBottom: 10,
  },
  saleNo: { fontSize: 13, fontWeight: '700', color: C.foreground, fontFamily: 'monospace' },
  dateText: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  amount: { fontSize: 18, fontWeight: '800', color: C.foreground },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  voidReasonBox: {
    backgroundColor: '#FEF3C7', borderRadius: 6, padding: 8, marginTop: 8,
  },
  expandedSection: { marginTop: 8 },
  divider: { height: 1, backgroundColor: C.border, marginBottom: 10 },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border + '60',
  },
  voidBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 12, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2',
  },
  // Modal styles
  modalOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.foreground, marginBottom: 12 },
  reasonInput: {
    backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    padding: 14, fontSize: 14, color: C.foreground, textAlignVertical: 'top',
    minHeight: 80, marginBottom: 12,
  },
  modalBtn: {
    paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
});
