import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../lib/api';
import C from '../../lib/colors';

const STATUS_TABS = [
  { key: 'all',       label: 'Semua' },
  { key: 'draft',     label: 'Draf' },
  { key: 'submitted', label: 'Diajukan' },
  { key: 'approved',  label: 'Disetujui' },
  { key: 'rejected',  label: 'Ditolak' },
];

interface Application {
  id: number;
  applicationNo: string;
  memberName: string;
  memberNo: string;
  nrp: string | null;
  productName: string;
  productCode: string;
  interestRate: number;
  amount: number;
  tenorMonths: number;
  purpose: string | null;
  notes: string | null;
  status: string;
  deductionSource: string;
  rejectionReason: string | null;
  createdAt: string;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
}

const formatRp = (n: number) => 'Rp ' + (n || 0).toLocaleString('id-ID');

function statusBadge(status: string) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    draft:     { bg: '#F1F5F9', color: '#64748B', label: 'Draf' },
    submitted:  { bg: '#EFF6FF', color: '#2563EB', label: 'Diajukan' },
    approved:   { bg: '#F0FDF4', color: '#16A34A', label: 'Disetujui' },
    rejected:   { bg: '#FEF2F2', color: '#DC2626', label: 'Ditolak' },
    disbursed:  { bg: '#F0FDF4', color: '#15803D', label: 'Dicairkan' },
    cancelled:  { bg: '#F1F5F9', color: '#6B7280', label: 'Dibatalkan' },
  };
  return map[status] || { bg: '#F1F5F9', color: '#64748B', label: status };
}

function deductionLabel(src: string) {
  const map: Record<string, string> = { gaji: 'Potong Gaji', tunkin: 'Tunkin', bs: 'Bayar Sendiri' };
  return map[src] || src;
}

export default function LoanApplicationsScreen() {
  const navigation = useNavigation<any>();
  const [apps, setApps] = useState<Application[]>([]);
  const [summary, setSummary] = useState({ submitted: 0, approved: 0, rejected: 0 });
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchApps = useCallback(async (reset = true) => {
    const currentPage = reset ? 1 : page + 1;
    if (!reset && currentPage > totalPages) return;

    if (reset) setLoading(true);
    else setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        status: activeTab,
        page: String(currentPage),
        perPage: '15',
      });
      const res = await api.get(`/api/mobile/loans/applications?${params}`);
      const { data, summary: sum, pagination } = res.data;

      if (reset) {
        setApps(data || []);
        setPage(1);
      } else {
        setApps(prev => [...prev, ...(data || [])]);
        setPage(currentPage);
      }
      if (sum) setSummary(sum);
      setTotalPages(pagination?.totalPages ?? 1);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Gagal memuat data pengajuan');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [activeTab, page, totalPages]);

  useEffect(() => {
    setPage(1);
    fetchApps(true);
  }, [activeTab]);

  const onRefresh = () => { setRefreshing(true); fetchApps(true); };
  const onLoadMore = () => { if (!loadingMore && page < totalPages) fetchApps(false); };

  const renderItem = ({ item }: { item: Application }) => {
    const st = statusBadge(item.status);
    const monthlyInstallment = Math.round(item.amount * (item.interestRate / 100)) + Math.round(item.amount / item.tenorMonths);
    const dateLabel = item.submittedAt
      ? new Date(item.submittedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date(item.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

    return (
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.appNo}>{item.applicationNo}</Text>
            <Text style={styles.memberName}>{item.memberName}</Text>
            <Text style={styles.memberInfo}>{item.nrp || item.memberNo}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg, borderColor: st.color }]}>
            <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
          </View>
        </View>

        {/* Product */}
        <View style={styles.metaRow}>
          <Ionicons name="pricetag-outline" size={13} color={C.mutedForeground} />
          <Text style={styles.metaText}>{item.productName}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Ionicons name="calendar-outline" size={13} color={C.mutedForeground} />
          <Text style={styles.metaText}>{item.tenorMonths} bulan</Text>
          <Text style={styles.metaDot}>·</Text>
          <Ionicons name="wallet-outline" size={13} color={C.mutedForeground} />
          <Text style={styles.metaText}>{deductionLabel(item.deductionSource)}</Text>
        </View>

        {/* Amount */}
        <View style={styles.amountRow}>
          <View>
            <Text style={styles.amountLabel}>Jumlah Pinjaman</Text>
            <Text style={styles.amountValue}>{formatRp(item.amount)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.amountLabel}>Cicilan / bulan</Text>
            <Text style={[styles.amountValue, { color: C.accent }]}>{formatRp(monthlyInstallment)}</Text>
          </View>
        </View>

        {/* Purpose */}
        {item.purpose && (
          <Text style={styles.purpose} numberOfLines={2}>
            <Ionicons name="document-text-outline" size={12} color={C.mutedForeground} /> {item.purpose}
          </Text>
        )}

        {/* Rejection reason */}
        {item.status === 'rejected' && item.rejectionReason && (
          <View style={styles.rejectNote}>
            <Ionicons name="alert-circle" size={14} color={C.destructive} />
            <Text style={styles.rejectText}>{item.rejectionReason}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.footerText}>
            {item.submittedAt ? 'Diajukan' : 'Dibuat'}: {dateLabel}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Pengajuan Pinjaman</Text>
          <Text style={styles.headerSub}>Daftar pengajuan anggota</Text>
        </View>
      </View>

      {/* Summary Row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryVal, { color: '#2563EB' }]}>{summary.submitted}</Text>
          <Text style={styles.summaryLabel}>Diajukan</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.muted }]}>
          <Text style={[styles.summaryVal, { color: '#16A34A' }]}>{summary.approved}</Text>
          <Text style={styles.summaryLabel}>Disetujui</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryVal, { color: C.destructive }]}>{summary.rejected}</Text>
          <Text style={styles.summaryLabel}>Ditolak</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {STATUS_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.loadingText}>Memuat data...</Text>
        </View>
      ) : (
        <FlatList
          data={apps}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="document-text-outline" size={48} color={C.muted} />
              <Text style={styles.emptyText}>Tidak ada pengajuan</Text>
              <Text style={styles.emptySubText}>Coba ubah filter status</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={C.accent} style={{ marginVertical: 16 }} />
            ) : null
          }
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
    backgroundColor: C.primary,
    paddingTop: 48, paddingBottom: 16, paddingHorizontal: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  summaryRow: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  summaryCard: { flex: 1, alignItems: 'center', paddingVertical: 12 },
  summaryVal: { fontSize: 22, fontWeight: 'bold', color: C.primary },
  summaryLabel: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginVertical: 8,
    gap: 6,
  },
  tab: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1, borderColor: C.border,
  },
  tabActive: { backgroundColor: C.primary, borderColor: C.primary },
  tabText: { fontSize: 12, color: C.mutedForeground, fontWeight: '600' },
  tabTextActive: { color: '#FFF' },

  listContent: { paddingHorizontal: 12, paddingBottom: 24 },

  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
    borderWidth: 1,
    borderColor: C.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  appNo: { fontSize: 12, fontWeight: '700', color: C.mutedForeground },
  memberName: { fontSize: 15, fontWeight: 'bold', color: C.foreground, marginTop: 2 },
  memberInfo: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, marginLeft: 8,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  metaText: { fontSize: 12, color: C.mutedForeground },
  metaDot: { fontSize: 12, color: C.muted, marginHorizontal: 2 },

  amountRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  amountLabel: { fontSize: 11, color: C.mutedForeground },
  amountValue: { fontSize: 16, fontWeight: '700', color: C.foreground, marginTop: 2 },

  purpose: { fontSize: 12, color: C.mutedForeground, marginBottom: 8 },

  rejectNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 8,
  },
  rejectText: { flex: 1, fontSize: 12, color: C.destructive },

  cardFooter: { paddingTop: 8, borderTopWidth: 1, borderTopColor: C.muted },
  footerText: { fontSize: 11, color: C.mutedForeground },

  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  loadingText: { marginTop: 12, color: C.mutedForeground, fontSize: 14 },
  emptyWrap: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyText: { fontSize: 16, fontWeight: '700', color: C.foreground, marginTop: 16 },
  emptySubText: { fontSize: 13, color: C.mutedForeground, marginTop: 6, textAlign: 'center' },
});
