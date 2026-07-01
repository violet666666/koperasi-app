import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, StatusBar, RefreshControl, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import api from '../../lib/api';
import C from '../../lib/colors';
import { getLoanStatus, formatRp } from '../../lib/constants';

const STATUS_TABS = [
  { key: 'all',        label: 'Semua' },
  { key: 'active',     label: 'Aktif' },
  { key: 'overdue',    label: 'Menunggak' },
  { key: 'paid_off',   label: 'Lunas' },
  { key: 'voided',     label: 'Dibatalkan' },
];

interface Loan {
  id: number;
  loanNo: string;
  memberName: string;
  memberNo: string;
  nrp: string;
  memberId: number;
  productName: string;
  principalAmount: number;
  principalOutstanding: number;
  interestOutstanding: number;
  monthlyInstallment: number;
  tenorMonths: number;
  status: string;
  disbursementDate: string | null;
  lastPaymentDate: string | null;
}

interface Summary {
  [status: string]: { count: number; outstanding: number };
}

export default function DaftarPinjamanScreen() {
  const navigation = useNavigation<any>();
  const [loans, setLoans]           = useState<Loan[]>([]);
  const [summary, setSummary]       = useState<Summary>({});
  const [search, setSearch]         = useState('');
  const [activeTab, setActiveTab]   = useState('all');
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchLoans = useCallback(async (reset = true) => {
    const currentPage = reset ? 1 : page + 1;
    if (!reset && currentPage > totalPages) return;

    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const params = new URLSearchParams({
        status: activeTab,
        page: String(currentPage),
      });
      if (search.trim()) params.set('search', search.trim());

      const res = await api.get(`/api/mobile/loans-operator?${params}`);
      const { data, summary: sum, pagination } = res.data;

      if (reset) {
        setLoans(data);
        setSummary(sum || {});
        setPage(1);
      } else {
        setLoans(prev => [...prev, ...data]);
        setPage(currentPage);
      }
      setTotalPages(pagination?.totalPages ?? 1);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Gagal memuat data pinjaman');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [activeTab, search, page, totalPages]);

  useEffect(() => {
    fetchLoans(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const onSearchSubmit = () => fetchLoans(true);
  const onRefresh = () => { setRefreshing(true); fetchLoans(true); };
  const onLoadMore = () => { if (!loadingMore && page < totalPages) fetchLoans(false); };

  const progressPct = (loan: Loan) => {
    if (!loan.principalAmount) return 0;
    const paid = loan.principalAmount - loan.principalOutstanding;
    return Math.min(100, Math.round((paid / loan.principalAmount) * 100));
  };

  const renderLoan = ({ item }: { item: Loan }) => {
    const pct = progressPct(item);
    const st = getLoanStatus(item.status);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('LoanPayment', { memberId: item.memberId, memberName: item.memberName })}
      >
        {/* Header Row */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.loanNo}>{item.loanNo}</Text>
            <Text style={styles.memberName}>{item.memberName}</Text>
            <Text style={styles.nrp}>{item.nrp} · {item.memberNo}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: st.bg, borderColor: st.color }]}>
            <Text style={[styles.statusText, { color: st.color }]}>{st.text}</Text>
          </View>
        </View>

        {/* Product + Tenor */}
        <View style={styles.metaRow}>
          <Ionicons name="pricetag-outline" size={13} color={C.mutedForeground} />
          <Text style={styles.metaText}>{item.productName}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Ionicons name="calendar-outline" size={13} color={C.mutedForeground} />
          <Text style={styles.metaText}>{item.tenorMonths} bulan</Text>
        </View>

        {/* Amounts */}
        <View style={styles.amountRow}>
          <View style={styles.amountCol}>
            <Text style={styles.amountLabel}>Pokok Awal</Text>
            <Text style={styles.amountValue}>{formatRp(item.principalAmount)}</Text>
          </View>
          <View style={styles.amountColRight}>
            <Text style={styles.amountLabel}>Sisa Pokok</Text>
            <Text style={[styles.amountValue, { color: item.status === 'paid' ? C.success : C.destructive }]}>
              {formatRp(item.principalOutstanding)}
            </Text>
          </View>
        </View>

        {/* Progress Bar */}
        <View style={styles.progressWrap}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: pct >= 100 ? C.success : C.accent }]} />
          </View>
          <Text style={styles.progressText}>{pct}% terbayar</Text>
        </View>

        {/* Monthly installment */}
        <View style={styles.installRow}>
          <Text style={styles.installLabel}>Cicilan / bulan</Text>
          <Text style={styles.installValue}>{formatRp(item.monthlyInstallment)}</Text>
        </View>

        {/* Footer */}
        <View style={styles.cardFooter}>
          {item.disbursementDate && (
            <Text style={styles.footerText}>
              Cair: {new Date(item.disbursementDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
          )}
          {item.lastPaymentDate && (
            <Text style={styles.footerText}>
              Bayar terakhir: {new Date(item.lastPaymentDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
            </Text>
          )}
          {(item.status === 'active' || item.status === 'overdue') ? (
            <TouchableOpacity
              style={styles.payBtn}
              onPress={() => navigation.navigate('LoanPayment', { memberId: item.memberId, memberName: item.memberName })}
            >
              <Ionicons name="cash-outline" size={14} color={C.primary} />
              <Text style={styles.payBtnText}>Input Angsuran</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.payBtn, { backgroundColor: C.card, borderWidth: 1, borderColor: C.border }]}
            onPress={() => navigation.navigate('RiwayatAngsuran', { loanId: item.id, loanNo: item.loanNo })}
          >
            <Ionicons name="time-outline" size={14} color={C.primary} />
            <Text style={[styles.payBtnText, { color: C.primary }]}>Riwayat</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const totalActive    = summary?.active?.count ?? 0;
  const totalOverdue   = summary?.overdue?.count ?? 0;
  const totalPaid      = summary?.paid?.count ?? 0;
  const outstandingAll = (summary?.active?.outstanding ?? 0) + (summary?.overdue?.outstanding ?? 0);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Daftar Pinjaman</Text>
          <Text style={styles.headerSub}>Semua pinjaman anggota</Text>
        </View>
      </View>

      {/* Summary Row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryVal}>{totalActive}</Text>
          <Text style={styles.summaryLabel}>Aktif</Text>
        </View>
        <View style={[styles.summaryCard, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.muted }]}>
          <Text style={[styles.summaryVal, { color: C.destructive }]}>{totalOverdue}</Text>
          <Text style={styles.summaryLabel}>Menunggak</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryVal, { color: C.mutedForeground }]}>{totalPaid}</Text>
          <Text style={styles.summaryLabel}>Lunas</Text>
        </View>
      </View>

      {outstandingAll > 0 && (
        <View style={styles.outstandingBar}>
          <Text style={styles.outstandingLabel}>Total Outstanding Aktif + Menunggak</Text>
          <Text style={styles.outstandingValue}>{formatRp(outstandingAll)}</Text>
        </View>
      )}

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={C.mutedForeground} style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama / NRP / No. Anggota..."
          placeholderTextColor={C.mutedForeground}
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={onSearchSubmit}
          returnKeyType="search"
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => { setSearch(''); fetchLoans(true); }}>
            <Ionicons name="close-circle" size={18} color={C.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Filter */}
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
          <Text style={styles.loadingText}>Memuat data pinjaman...</Text>
        </View>
      ) : (
        <FlatList
          data={loans}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderLoan}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
          onEndReached={onLoadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="document-text-outline" size={48} color={C.muted} />
              <Text style={styles.emptyText}>Tidak ada data pinjaman</Text>
              <Text style={styles.emptySubText}>Coba ubah filter atau kata kunci pencarian</Text>
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
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  headerSub:   { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  summaryRow: {
    flexDirection: 'row',
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  summaryCard: {
    flex: 1, alignItems: 'center', paddingVertical: 12,
  },
  summaryVal:   { fontSize: 22, fontWeight: 'bold', color: C.primary },
  summaryLabel: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },

  outstandingBar: {
    backgroundColor: C.infoBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  outstandingLabel: { fontSize: 12, color: C.info, fontWeight: '600' },
  outstandingValue: { fontSize: 14, fontWeight: 'bold', color: C.info },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    margin: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: { flex: 1, fontSize: 14, color: C.foreground },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  tabActive: { backgroundColor: C.primary, borderColor: C.primary },
  tabText:       { fontSize: 12, color: C.mutedForeground, fontWeight: '600' },
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
  loanNo:     { fontSize: 13, fontWeight: '700', color: C.primary },
  memberName: { fontSize: 15, fontWeight: 'bold', color: C.foreground, marginTop: 2 },
  nrp:        { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, marginLeft: 8,
  },
  statusText: { fontSize: 11, fontWeight: '700' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10 },
  metaText: { fontSize: 12, color: C.mutedForeground },
  metaDot:  { fontSize: 12, color: C.muted, marginHorizontal: 2 },

  amountRow:      { flexDirection: 'row', marginBottom: 10 },
  amountCol:      { flex: 1 },
  amountColRight: { flex: 1, alignItems: 'flex-end' },
  amountLabel:    { fontSize: 11, color: C.mutedForeground },
  amountValue:    { fontSize: 14, fontWeight: '700', color: C.foreground, marginTop: 2 },

  progressWrap: { marginBottom: 8 },
  progressBg:   { height: 6, backgroundColor: C.muted, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressText: { fontSize: 11, color: C.mutedForeground, marginTop: 4, textAlign: 'right' },

  installRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  installLabel: { fontSize: 12, color: C.mutedForeground },
  installValue: { fontSize: 14, fontWeight: '700', color: C.accent },

  cardFooter:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderTopColor: C.muted },
  footerText:  { fontSize: 11, color: C.mutedForeground, flex: 1 },
  payBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  payBtnText:  { fontSize: 12, fontWeight: '700', color: C.primary },

  centered:    { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  loadingText: { marginTop: 12, color: C.mutedForeground, fontSize: 14 },
  emptyWrap:   { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyText:   { fontSize: 16, fontWeight: '700', color: C.foreground, marginTop: 16 },
  emptySubText:{ fontSize: 13, color: C.mutedForeground, marginTop: 6, textAlign: 'center' },
});
