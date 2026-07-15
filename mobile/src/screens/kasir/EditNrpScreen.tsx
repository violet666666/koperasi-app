import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, StatusBar, Alert, Modal, TextInput, FlatList, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../lib/api';
import C from '../../lib/colors';

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

interface SaleNoNrp {
  id: number;
  saleNo: string;
  unitType: string;
  customerName: string | null;
  totalAmount: number;
  paymentMethod: string;
  itemPreview: string;
  itemCount: number;
  createdBy: string;
  createdAt: string;
}

interface Member {
  id: number;
  name: string;
  nrp?: string;
  memberNo?: string;
}

const paymentLabel: Record<string, string> = {
  cash: '💵 Tunai',
  qris: '📱 QRIS',
  salary_cut: '✂️ Pot Gaji',
};

export default function EditNrpScreen() {
  const navigation = useNavigation();
  const [sales, setSales] = useState<SaleNoNrp[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Member search modal
  const [assignModal, setAssignModal] = useState(false);
  const [targetSale, setTargetSale] = useState<SaleNoNrp | null>(null);
  const [searchText, setSearchText] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [searching, setSearching] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const fetchSales = useCallback(async () => {
    try {
      const res = await api.get('/api/mobile/edit-nrp?limit=50');
      setSales(res.data.data || []);
    } catch (err: any) {
      Alert.alert('Gagal', err.response?.data?.message || 'Gagal memuat data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const onRefresh = () => { setRefreshing(true); fetchSales(); };

  // Search members with debounce
  useEffect(() => {
    if (searchText.length > 1) {
      const timer = setTimeout(async () => {
        setSearching(true);
        try {
          const res = await api.get(`/api/mobile/members?search=${searchText}&limit=10`);
          setMembers(res.data.data || []);
        } finally {
          setSearching(false);
        }
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setMembers([]);
    }
  }, [searchText]);

  const openAssignModal = (sale: SaleNoNrp) => {
    setTargetSale(sale);
    setSearchText('');
    setMembers([]);
    setAssignModal(true);
  };

  const handleAssign = async (member: Member) => {
    if (!targetSale) return;

    Alert.alert(
      'Konfirmasi Assign NRP',
      `Transaksi: ${targetSale.saleNo}\nTotal: ${formatRp(targetSale.totalAmount)}\n\nAssign ke:\n${member.name} (${member.nrp || member.memberNo})`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: 'Assign',
          onPress: async () => {
            setAssigning(true);
            try {
              const res = await api.post('/api/mobile/edit-nrp', {
                saleId: targetSale.id,
                memberId: member.id,
              });
              Alert.alert('Berhasil ✅', res.data.message);
              setAssignModal(false);
              fetchSales();
            } catch (err: any) {
              Alert.alert('Gagal', err.response?.data?.message || 'Gagal assign NRP');
            } finally {
              setAssigning(false);
            }
          },
        },
      ]
    );
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
          <Text style={styles.headerTitle}>🔗 Edit NRP Transaksi</Text>
          <Text style={{ color: '#FFF', fontSize: 12, opacity: 0.7, marginTop: 2 }}>
            {sales.length} transaksi tanpa NRP
          </Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
      >
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle" size={16} color="#1D4ED8" />
          <Text style={{ fontSize: 12, color: '#1D4ED8', flex: 1, marginLeft: 8 }}>
            Transaksi di bawah ini belum memiliki NRP/anggota. Tap untuk assign anggota.
          </Text>
        </View>

        {sales.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-circle" size={48} color={C.success} />
            <Text style={{ color: C.success, marginTop: 12, fontSize: 15, fontWeight: '600' }}>
              Semua transaksi sudah ada NRP! ✅
            </Text>
            <Text style={{ color: C.mutedForeground, fontSize: 12, marginTop: 4 }}>
              Tidak ada transaksi yang perlu di-assign
            </Text>
          </View>
        ) : (
          sales.map((sale) => {
            const date = new Date(sale.createdAt);
            return (
              <TouchableOpacity
                key={sale.id}
                style={styles.card}
                onPress={() => openAssignModal(sale)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.saleNo}>{sale.saleNo}</Text>
                    <Text style={styles.dateText}>
                      {date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}
                      {date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={styles.assignBadge}>
                    <Ionicons name="person-add" size={12} color="#D97706" />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#D97706', marginLeft: 4 }}>PERLU NRP</Text>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                  <Text style={styles.amount}>{formatRp(sale.totalAmount)}</Text>
                  <Text style={{ fontSize: 12, color: C.mutedForeground }}>
                    {paymentLabel[sale.paymentMethod] || sale.paymentMethod}
                  </Text>
                </View>

                <Text style={{ fontSize: 12, color: C.mutedForeground, marginTop: 4 }}>
                  🛒 {sale.itemPreview || `${sale.itemCount} item`}
                </Text>
                <Text style={{ fontSize: 11, color: C.mutedForeground, marginTop: 2 }}>
                  Kasir: {sale.createdBy}
                </Text>

                <View style={styles.assignHint}>
                  <Ionicons name="hand-right" size={14} color={C.accent} />
                  <Text style={{ fontSize: 12, color: C.accent, fontWeight: '600', marginLeft: 6 }}>
                    Tap untuk assign NRP
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ═══ Assign Member Modal ═══ */}
      <Modal visible={assignModal} transparent animationType="slide" onRequestClose={() => setAssignModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>🔗 Assign NRP</Text>
              <TouchableOpacity onPress={() => setAssignModal(false)}>
                <Ionicons name="close" size={24} color={C.mutedForeground} />
              </TouchableOpacity>
            </View>

            {targetSale && (
              <View style={{ backgroundColor: C.background, padding: 12, borderRadius: 10, marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: C.foreground }}>{targetSale.saleNo}</Text>
                <Text style={{ fontSize: 12, color: C.mutedForeground }}>{formatRp(targetSale.totalAmount)} · {paymentLabel[targetSale.paymentMethod] || targetSale.paymentMethod}</Text>
              </View>
            )}

            <Text style={{ fontSize: 12, fontWeight: '600', color: C.foreground, marginBottom: 6 }}>Cari Anggota</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Ketik nama atau NRP..."
              placeholderTextColor={C.mutedForeground}
              value={searchText}
              onChangeText={setSearchText}
              autoFocus
            />

            {searching && <ActivityIndicator size="small" color={C.accent} style={{ marginVertical: 12 }} />}

            <FlatList
              data={members}
              keyExtractor={(m) => m.id.toString()}
              style={{ maxHeight: 300, marginTop: 8 }}
              ListEmptyComponent={
                searchText.length > 1 && !searching ? (
                  <Text style={{ textAlign: 'center', color: C.mutedForeground, paddingVertical: 20, fontSize: 13 }}>
                    Tidak ditemukan anggota dengan "{searchText}"
                  </Text>
                ) : null
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.memberItem}
                  onPress={() => handleAssign(item)}
                  disabled={assigning}
                >
                  <View style={styles.memberAvatar}>
                    <Ionicons name="person" size={18} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: C.foreground }}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: C.mutedForeground }}>{item.nrp || item.memberNo}</Text>
                  </View>
                  <Ionicons name="arrow-forward-circle" size={22} color={C.accent} />
                </TouchableOpacity>
              )}
            />
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
    flexDirection: 'row', alignItems: 'center',
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF',
    borderWidth: 1, borderColor: '#93C5FD', borderRadius: 10, padding: 12, marginBottom: 12,
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  card: {
    backgroundColor: C.card, borderWidth: 1, borderColor: '#FDE68A', borderRadius: 14,
    padding: 14, marginBottom: 10,
  },
  saleNo: { fontSize: 13, fontWeight: '700', color: C.foreground, fontFamily: 'monospace' },
  dateText: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  amount: { fontSize: 18, fontWeight: '800', color: C.foreground },
  assignBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  assignHint: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border,
  },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36, maxHeight: '80%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.foreground },
  searchInput: {
    backgroundColor: C.background, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: C.foreground,
  },
  memberItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  memberAvatar: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: C.primaryLight,
    justifyContent: 'center', alignItems: 'center',
  },
});
