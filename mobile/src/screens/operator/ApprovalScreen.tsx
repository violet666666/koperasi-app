import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, StatusBar,
  TouchableOpacity, Alert, ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../lib/api';
import C from '../../lib/colors';

// ── Types ──────────────────────────────────────────────────────────────────
type RequestType = 'loan_application' | 'unit_void' | 'void_store_sale';

interface ApprovalItem {
  id: number;
  requestType: RequestType;
  requestNo?: string;
  status: string;
  amount: number;
  submittedAt: string;
  submittedBy?: string;

  // Loan application fields
  memberName?: string;
  memberNo?: string;
  nrp?: string | null;
  productName?: string;
  tenor?: number;
  interestRate?: number;
  purpose?: string | null;

  // Void fields
  transactionNo?: string;
  unitType?: string;
  voidReason?: string;
  description?: string;
}

const formatRp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

// ── Label helpers ──────────────────────────────────────────────────────────
function getRequestTypeLabel(type: RequestType): string {
  switch (type) {
    case 'loan_application': return '🏦 Pengajuan Pinjaman';
    case 'unit_void': return '🔄 Void Transaksi Unit';
    case 'void_store_sale': return '🔄 Void Transaksi Toko';
    default: return '📋 Permintaan';
  }
}

function getRequestTypeBadgeColor(type: RequestType): string {
  switch (type) {
    case 'loan_application': return '#EFF6FF';
    case 'unit_void':
    case 'void_store_sale': return '#FFF7ED';
    default: return '#F1F5F9';
  }
}

function getRequestTypeBadgeTextColor(type: RequestType): string {
  switch (type) {
    case 'loan_application': return '#2563EB';
    case 'unit_void':
    case 'void_store_sale': return '#EA580C';
    default: return '#64748B';
  }
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function ApprovalScreen({ navigation: navProp }: any) {
  const navHook = useNavigation<any>();
  const navigation = navProp || navHook;
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get('/api/mobile/approvals');
      setItems(res.data.data || []);
    } catch (err: any) {
      console.log('Approval fetch error:', err);
      Alert.alert('Error', err.message || 'Gagal memuat data approval');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => { setRefreshing(true); await loadData(); setRefreshing(false); };

  const handleAction = (item: ApprovalItem, action: 'approve' | 'reject') => {
    const key = `${item.requestType}-${item.id}`;
    if (processingId === key) return;
    const label = action === 'approve' ? 'Setujui' : 'Tolak';
    const typeLabel = getRequestTypeLabel(item.requestType);

    // Detail sesuai tipe
    let detailLines = '';
    if (item.requestType === 'loan_application') {
      detailLines = `Peminjam: ${item.memberName || '-'}\nProduk: ${item.productName || '-'}\nJumlah: ${formatRp(item.amount)}\nTenor: ${item.tenor || '-'} bulan`;
    } else {
      // void_store_sale atau unit_void
      detailLines = `No. Transaksi: ${item.transactionNo || item.requestNo || '-'}\nUnit: ${item.unitType || '-'}\nJumlah: ${formatRp(item.amount)}`;
      if (item.voidReason) detailLines += `\nAlasan: ${item.voidReason}`;
    }

    Alert.alert(
      `${label} ${typeLabel}?`,
      detailLines,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: label,
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: async () => {
            setProcessingId(key);
            try {
              if (item.requestType === 'loan_application') {
                // Loan approval endpoint
                await api.patch('/api/mobile/approvals', { id: item.id, action });
              } else {
                // Void approval endpoint — gunakan ApprovalRequest ID
                await api.post('/api/unit-transactions/void-approve', {
                  approvalId: item.id,
                  action: action === 'approve' ? 'approved' : 'rejected',
                });
              }
              Alert.alert('Berhasil', `${typeLabel} berhasil di-${action === 'approve' ? 'setujui' : 'tolak'}`);
              loadData();
            } catch (err: any) {
              Alert.alert('Gagal', err.message || err.response?.data?.message || 'Terjadi kesalahan');
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: ApprovalItem }) => {
    const isLoan = item.requestType === 'loan_application';
    const isVoid = item.requestType === 'unit_void' || item.requestType === 'void_store_sale';
    const isProcessing = processingId === `${item.requestType}-${item.id}`;

    return (
      <View style={styles.card}>
        {/* Badge tipe */}
        <View style={[styles.typeBadge, { backgroundColor: getRequestTypeBadgeColor(item.requestType) }]}>
          <Text style={[styles.typeBadgeText, { color: getRequestTypeBadgeTextColor(item.requestType) }]}>
            {getRequestTypeLabel(item.requestType)}
          </Text>
        </View>

        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            {isLoan && (
              <>
                <Text style={styles.memberName}>{item.memberName || '-'}</Text>
                <Text style={styles.memberInfo}>{item.nrp || item.memberNo || '-'}</Text>
              </>
            )}
            {isVoid && (
              <>
                <Text style={styles.memberName}>{item.transactionNo || item.requestNo || 'No. Transaksi'}</Text>
                <Text style={styles.memberInfo}>Unit: {item.unitType || '-'}</Text>
              </>
            )}
          </View>
          <Text style={styles.amount}>{formatRp(item.amount)}</Text>
        </View>

        <View style={styles.cardMeta}>
          {isLoan && (
            <>
              <Text style={styles.metaText}>📦 {item.productName || '-'} • {item.tenor || '-'} bulan</Text>
              {item.purpose && <Text style={styles.metaText}>📝 {item.purpose}</Text>}
            </>
          )}
          {isVoid && item.voidReason && (
            <Text style={styles.metaText}>📝 Alasan: {item.voidReason}</Text>
          )}
          {item.submittedBy && (
            <Text style={styles.metaText}>👤 Diajukan: {item.submittedBy}</Text>
          )}
          <Text style={styles.metaDate}>
            {new Date(item.submittedAt).toLocaleDateString('id-ID', {
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            })}
          </Text>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.rejectBtn, isProcessing && { opacity: 0.5 }]} onPress={() => handleAction(item, 'reject')} disabled={isProcessing}>
            <Ionicons name="close-circle" size={18} color={C.destructive} />
            <Text style={styles.rejectText}>Tolak</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.approveBtn, isProcessing && { opacity: 0.5 }]} onPress={() => handleAction(item, 'approve')} disabled={isProcessing}>
            {isProcessing ? <ActivityIndicator color="#FFF" size="small" /> : <Ionicons name="checkmark-circle" size={18} color="#FFF" />}
            <Text style={styles.approveText}>{isProcessing ? 'Memproses...' : 'Setujui'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

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
            <Text style={styles.headerTitle}>Persetujuan</Text>
            <Text style={styles.headerSub}>{items.length} permintaan menunggu</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.emptyContainer}><Text style={styles.emptyText}>Memuat data...</Text></View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={styles.emptyText}>Tidak ada permintaan yang perlu disetujui</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.requestType}-${item.id}`}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
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
  headerSub: { color: C.accent, fontSize: 13, marginTop: 4 },
  card: {
    backgroundColor: C.card, borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  typeBadge: {
    alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10,
  },
  typeBadgeText: { fontSize: 12, fontWeight: '700' },
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
