import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, StatusBar, TouchableOpacity, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../lib/api';
import C from '../../lib/colors';

interface Approval {
  id: number;
  memberName: string;
  memberNo: string;
  nrp: string | null;
  productName: string;
  amount: number;
  tenor: number;
  purpose: string | null;
  submittedAt: string;
}

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

export default function ApprovalScreen({ navigation: navProp }: any) {
  const navHook = useNavigation<any>();
  const navigation = navProp || navHook;
  const [items, setItems] = useState<Approval[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/api/mobile/approvals');
      setItems(res.data.data || []);
    } catch (err) {
      console.log('Approval fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const handleAction = (item: Approval, action: 'approve' | 'reject') => {
    const label = action === 'approve' ? 'Setujui' : 'Tolak';
    Alert.alert(
      `${label} Pengajuan?`,
      `${item.memberName}\nProduk: ${item.productName}\nJumlah: ${formatRp(item.amount)}\nTenor: ${item.tenor} bulan`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: label,
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await api.patch('/api/mobile/approvals', { id: item.id, action });
              Alert.alert('Berhasil', `Pengajuan berhasil di-${action === 'approve' ? 'setujui' : 'tolak'}`);
              loadData();
            } catch (err: any) {
              Alert.alert('Gagal', err.response?.data?.message || 'Terjadi kesalahan');
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: Approval }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.memberName}>{item.memberName}</Text>
          <Text style={styles.memberInfo}>{item.nrp || item.memberNo}</Text>
        </View>
        <Text style={styles.amount}>{formatRp(item.amount)}</Text>
      </View>
      <View style={styles.cardMeta}>
        <Text style={styles.metaText}>📦 {item.productName} • {item.tenor} bulan</Text>
        {item.purpose && <Text style={styles.metaText}>📝 {item.purpose}</Text>}
        <Text style={styles.metaDate}>{new Date(item.submittedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleAction(item, 'reject')}>
          <Ionicons name="close-circle" size={18} color={C.destructive} />
          <Text style={styles.rejectText}>Tolak</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.approveBtn} onPress={() => handleAction(item, 'approve')}>
          <Ionicons name="checkmark-circle" size={18} color="#FFF" />
          <Text style={styles.approveText}>Setujui</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const canGoBack = navigation.canGoBack?.() ?? false;

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
            <Text style={styles.headerTitle}>Persetujuan Pinjaman</Text>
            <Text style={styles.headerSub}>{items.length} pengajuan menunggu</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}><Text style={styles.emptyText}>Memuat data...</Text></View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyText}>Tidak ada pengajuan yang perlu disetujui</Text>
        </View>
      ) : (
        <FlatList
          data={items}
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
    backgroundColor: C.primary, paddingTop: 56, paddingBottom: 20, paddingHorizontal: 24,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  headerSub: { color: C.accent, fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  memberName: { fontSize: 16, fontWeight: 'bold', color: C.primary },
  memberInfo: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  amount: { fontSize: 18, fontWeight: 'bold', color: C.accent },
  cardMeta: { marginTop: 12 },
  metaText: { fontSize: 13, color: C.mutedForeground, marginBottom: 2 },
  metaDate: { fontSize: 12, color: C.mutedForeground, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: C.destructive,
  },
  rejectText: { fontSize: 14, fontWeight: '600', color: C.destructive },
  approveBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 10, backgroundColor: C.success,
  },
  approveText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 15, color: C.mutedForeground },
});
