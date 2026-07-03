import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  TextInput,
  Modal,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import api, { BASE_URL } from '../../lib/api';
import C from '../../lib/colors';
import { log } from '../../utils/log';
import { StorageManager } from '../../lib/storage';

// --- helpers --------------------------------------------------------------

const formatRp = (n: number) => 'Rp ' + (Number(n || 0)).toLocaleString('id-ID');

const formatDate = (d: string | Date | null | undefined) => {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(d);
  }
};

const PER_PAGE = 25;

// --- types (defensive; backend shapes matched loosely) -------------------

type MemberRow = {
  memberId: number | string;
  nama: string;
  nrp?: string | null;
  pangkat?: string | null;
  piutangToko: number;
  piutangUnit: number;
  pokokSP: number;
  jasaSP: number;
  total: number;
};

type Totals = {
  totalAnggota: number;
  totalToko: number;
  totalUnit: number;
  totalPokokSP: number;
  totalJasaSP: number;
  grandTotal: number;
};

type ListResponse = {
  data?: MemberRow[];
  totals?: Totals;
  pagination?: { page: number; perPage: number; totalPages: number; total: number };
};

type LoanRow = {
  loanNo: string;
  angsuranKe?: number | string;
  pokok: number;
  jasa: number;
  total?: number;
};

type TxRow = {
  date?: string | null;
  source?: 'toko' | 'unit' | string | null;
  description?: string | null;
  amount: number;
};

type DetailResponse = {
  member?: { nama: string; nrp?: string | null; pangkat?: string | null };
  loans?: LoanRow[];
  transactions?: TxRow[];
  totals?: { totalPinjaman: number; totalTransaksi: number; grandTotal: number };
};

// --- component ------------------------------------------------------------

export default function LaporanPiutangGabunganScreen({ navigation: navProp }: any) {
  const navHook = useNavigation<any>();
  const navigation = navProp || navHook;

  const [rows, setRows] = useState<MemberRow[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // search (debounced)
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // export
  const [exporting, setExporting] = useState(false);

  // drill-down
  const [detailMember, setDetailMember] = useState<MemberRow | null>(null);
  const [detail, setDetail] = useState<DetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // --- fetch list --------------------------------------------------------
  const fetchList = useCallback(
    async (targetPage: number, searchTerm: string, mode: 'replace' | 'append' | 'silent') => {
      if (mode === 'replace') setLoading(true);
      else if (mode === 'append') setLoadingMore(true);
      if (mode !== 'silent') setError(null);
      try {
        const params = { page: String(targetPage), perPage: String(PER_PAGE) };
        const qs = new URLSearchParams(params);
        if (searchTerm.trim()) qs.set('search', searchTerm.trim());
        const res = await api.get(`/mobile/reports/piutang-gabungan?${qs.toString()}`);
        const body: ListResponse = res?.data ?? {};
        const incoming = Array.isArray(body.data) ? body.data : [];
        setRows((prev) =>
          mode === 'append' ? [...prev, ...incoming] : incoming,
        );
        setTotals(body.totals ?? null);
        // L1: pagination may be absent on the empty path — guard it.
        const tp = body.pagination?.totalPages;
        setTotalPages(typeof tp === 'number' && tp > 0 ? tp : 1);
        setPage(targetPage);
      } catch (err: any) {
        log.error('Piutang gabungan: fetchList gagal:', err);
        setError(err?.message || 'Gagal memuat data piutang gabungan.');
        if (mode === 'replace') setRows([]);
      } finally {
        if (mode === 'replace') setLoading(false);
        else if (mode === 'append') setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchList(1, '', 'replace');
  }, [fetchList]);

  // --- search debounce ---------------------------------------------------
  const onSearchChange = (text: string) => {
    setSearchInput(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(text);
      fetchList(1, text, 'replace');
    }, 400);
  };

  // --- refresh -----------------------------------------------------------
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchList(1, search, 'replace');
    setRefreshing(false);
  };

  // --- pagination --------------------------------------------------------
  const onEndReached = () => {
    if (loadingMore || loading) return;
    if (page >= totalPages) return;
    fetchList(page + 1, search, 'append');
  };

  // --- drill-down --------------------------------------------------------
  const openDetail = async (member: MemberRow) => {
    setDetailMember(member);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await api.get(
        `/mobile/reports/piutang-gabungan/${member.memberId}`,
      );
      setDetail(res?.data ?? null);
    } catch (err: any) {
      log.error('Piutang gabungan: fetchDetail gagal:', err);
      setDetailError(err?.message || 'Gagal memuat detail piutang.');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailMember(null);
    setDetail(null);
    setDetailError(null);
  };

  // --- export (server-built CSV) ----------------------------------------
  const writeCsvAndShare = async (csv: string) => {
    // SDK 55 expo-file-system: top-level writeAsStringAsync is deprecated and
    // throws at runtime; use the File + Paths API instead.
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `piutang-gabungan-${date}.csv`;
    const file = new File(Paths.cache, fileName);
    if (file.exists) file.delete();
    file.write(csv);
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export Piutang Gabungan',
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // The shared `api` axios client sets Content-Type: application/json and
      // its response interceptor returns the full AxiosResponse; for a
      // text/csv body we request responseType:'text' so axios skips JSON
      // parsing and hands us the raw string on res.data.
      const res = await api.get('/mobile/reports/piutang-gabungan?format=csv', {
        responseType: 'text',
        transformResponse: [(d: unknown) => d], // do not parse CSV as JSON
      });
      const csv: string =
        typeof res === 'string' ? res : (res as any)?.data ?? '';
      if (!csv) throw new Error('CSV kosong');
      await writeCsvAndShare(csv);
      Toast.show({ type: 'success', text1: 'Export berhasil' });
    } catch (err: any) {
      // Fallback: raw fetch in case the axios interceptor ever mangles the
      // CSV body (defensive — keeps export working if api.ts changes).
      try {
        const token = await StorageManager.getSecureItem('userToken');
        const r = await fetch(
          `${BASE_URL}/mobile/reports/piutang-gabungan?format=csv`,
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const text = await r.text();
        await writeCsvAndShare(text);
        Toast.show({ type: 'success', text1: 'Export berhasil' });
      } catch (err2) {
        log.error('Export piutang gabungan gagal:', err2);
        Toast.show({ type: 'error', text1: 'Export gagal' });
      }
    } finally {
      setExporting(false);
    }
  };

  // --- derived summary values -------------------------------------------
  const t = totals;
  const sumAnggota = t?.totalAnggota ?? rows.length;
  const sumToko = t?.totalToko ?? 0;
  const sumUnit = t?.totalUnit ?? 0;
  const sumPokokSP = t?.totalPokokSP ?? 0;
  const sumJasaSP = t?.totalJasaSP ?? 0;
  const sumSP = sumPokokSP + sumJasaSP;
  const grandTotal = t?.grandTotal ?? sumToko + sumUnit + sumSP;

  // --- render ------------------------------------------------------------
  const renderRow = ({ item }: { item: MemberRow }) => (
    <TouchableOpacity
      style={styles.memberCard}
      onPress={() => openDetail(item)}
      activeOpacity={0.7}
    >
      <View style={styles.memberHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.memberNama} numberOfLines={1}>
            {item.nama || '(Tanpa Nama)'}
          </Text>
          <Text style={styles.memberSub}>
            {item.nrp ? `NRP ${item.nrp}` : ''}
            {item.nrp && item.pangkat ? ' · ' : ''}
            {item.pangkat || ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.mutedForeground} />
      </View>

      <View style={styles.miniGrid}>
        <MiniCell label="Toko" value={formatRp(item.piutangToko)} color={C.warning} />
        <MiniCell label="Unit" value={formatRp(item.piutangUnit)} color="#7C3AED" />
        <MiniCell label="Pokok SP" value={formatRp(item.pokokSP)} color={C.info} />
        <MiniCell label="Jasa SP" value={formatRp(item.jasaSP)} color="#06B6D4" />
      </View>

      <View style={[styles.rowBetween, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }]}>
        <Text style={styles.labelBold}>Total Piutang</Text>
        <Text style={styles.valueBold}>{formatRp(item.total)}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>Piutang Gabungan</Text>
              <Text style={styles.headerSubtitle}>Toko · Unit · Simpan Pinjam</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={handleExport}
            disabled={exporting}
            style={[styles.headerBtn, exporting && { opacity: 0.5 }]}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="download-outline" size={22} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={C.mutedForeground} style={{ marginHorizontal: 4 }} />
        <TextInput
          value={searchInput}
          onChangeText={onSearchChange}
          placeholder="Cari nama / NRP anggota…"
          placeholderTextColor={C.mutedForeground}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {searchInput.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              setSearchInput('');
              setSearch('');
              fetchList(1, '', 'replace');
            }}
          >
            <Ionicons name="close-circle" size={18} color={C.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {/* Summary cards (horizontal) */}
      {!loading && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryRow}
        >
          <SummaryCard label="Total Anggota" value={String(sumAnggota)} color={C.primary} icon="people" />
          <SummaryCard label="Piutang Toko" value={formatRp(sumToko)} color={C.warning} icon="storefront" />
          <SummaryCard label="Piutang Unit" value={formatRp(sumUnit)} color="#7C3AED" icon="cube" />
          <SummaryCard label="Piutang SP" value={formatRp(sumSP)} color="#06B6D4" icon="cash" />
          <SummaryCard label="Grand Total" value={formatRp(grandTotal)} color={C.success} icon="trophy" />
        </ScrollView>
      )}

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.centerText}>Memuat piutang gabungan…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={C.mutedForeground} />
          <Text style={styles.centerText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchList(1, search, 'replace')}>
            <Text style={styles.retryText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={48} color={C.mutedForeground} />
          <Text style={styles.centerText}>Tidak ada piutang</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, idx) => `${item.memberId ?? idx}`}
          renderItem={renderRow}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color={C.accent} />
              </View>
            ) : page >= totalPages && rows.length >= PER_PAGE ? (
              <Text style={styles.listEndText}>— Data terakhir —</Text>
            ) : null
          }
        />
      )}

      {/* Drill-down modal */}
      <Modal
        visible={detailMember !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={closeDetail}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Detail Piutang</Text>
              <Text style={styles.modalSub} numberOfLines={1}>
                {detailMember?.nama}
                {detailMember?.nrp ? ` · NRP ${detailMember.nrp}` : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={closeDetail} style={{ padding: 8 }}>
              <Ionicons name="close" size={26} color="#FFF" />
            </TouchableOpacity>
          </View>

          {detailLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={C.accent} />
              <Text style={styles.centerText}>Memuat detail…</Text>
            </View>
          ) : detailError ? (
            <View style={styles.center}>
              <Ionicons name="alert-circle-outline" size={48} color={C.destructive} />
              <Text style={styles.centerText}>{detailError}</Text>
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Header card */}
              <View style={styles.detailHeaderCard}>
                <Text style={styles.detailNama}>{detail?.member?.nama || detailMember?.nama}</Text>
                <Text style={styles.detailSub}>
                  {detail?.member?.nrp || detailMember?.nrp ? `NRP ${detail?.member?.nrp ?? detailMember?.nrp}` : ''}
                  {(detail?.member?.pangkat || detailMember?.pangkat) ? ` · ${detail?.member?.pangkat ?? detailMember?.pangkat}` : ''}
                </Text>
                <View style={[styles.rowBetween, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.border }]}>
                  <Text style={styles.labelBold}>Total Piutang</Text>
                  <Text style={[styles.valueBold, { color: C.success }]}>
                    {formatRp(detail?.totals?.grandTotal ?? detailMember?.total ?? 0)}
                  </Text>
                </View>
              </View>

              {/* Loans section */}
              <Text style={styles.sectionTitle}>Pinjaman SP Aktif</Text>
              {(!detail?.loans || detail.loans.length === 0) ? (
                <Text style={styles.emptyText}>Tidak ada pinjaman aktif.</Text>
              ) : (
                detail.loans.map((l, i) => (
                  <View key={l.loanNo || i} style={styles.subCard}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.loanNo}>{l.loanNo}</Text>
                      {l.angsuranKe != null && (
                        <Text style={styles.angsuranBadge}>Angs. ke-{l.angsuranKe}</Text>
                      )}
                    </View>
                    <View style={[styles.rowBetween, { marginTop: 6 }]}>
                      <Text style={styles.label}>Pokok</Text>
                      <Text style={styles.value}>{formatRp(l.pokok)}</Text>
                    </View>
                    <View style={styles.rowBetween}>
                      <Text style={styles.label}>Jasa</Text>
                      <Text style={styles.value}>{formatRp(l.jasa)}</Text>
                    </View>
                    {l.total != null && (
                      <View style={[styles.rowBetween, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: C.border }]}>
                        <Text style={styles.labelBold}>Total</Text>
                        <Text style={styles.valueBold}>{formatRp(l.total)}</Text>
                      </View>
                    )}
                  </View>
                ))
              )}

              {/* Transactions section */}
              <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
                Transaksi Potong Gaji Belum Lunas
              </Text>
              {(!detail?.transactions || detail.transactions.length === 0) ? (
                <Text style={styles.emptyText}>Tidak ada transaksi tertunda.</Text>
              ) : (
                detail.transactions.map((tx, i) => {
                  const src = (tx.source || '').toLowerCase();
                  const isToko = src === 'toko';
                  const isUnit = src === 'unit';
                  return (
                    <View key={i} style={styles.subCard}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.label}>{formatDate(tx.date)}</Text>
                        {tx.source && (
                          <View
                            style={[
                              styles.sourceBadge,
                              { backgroundColor: isToko ? C.warningBg : isUnit ? '#F3E8FF' : C.infoBg },
                            ]}
                          >
                            <Text
                              style={[
                                styles.sourceText,
                                { color: isToko ? C.warning : isUnit ? '#7C3AED' : C.info },
                              ]}
                            >
                              {String(tx.source).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      {tx.description ? (
                        <Text style={styles.txDesc} numberOfLines={2}>
                          {tx.description}
                        </Text>
                      ) : null}
                      <View style={[styles.rowBetween, { marginTop: 4 }]}>
                        <Text style={styles.label}>Jumlah</Text>
                        <Text style={styles.value}>{formatRp(tx.amount)}</Text>
                      </View>
                    </View>
                  );
                })
              )}

              {/* Totals footer */}
              {detail?.totals && (
                <View style={styles.totalFooter}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.label}>Total Pinjaman SP</Text>
                    <Text style={styles.value}>{formatRp(detail.totals.totalPinjaman)}</Text>
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.label}>Total Potong Gaji</Text>
                    <Text style={styles.value}>{formatRp(detail.totals.totalTransaksi)}</Text>
                  </View>
                  <View style={[styles.rowBetween, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.border }]}>
                    <Text style={styles.labelBold}>Grand Total</Text>
                    <Text style={[styles.valueBold, { color: C.success, fontSize: 16 }]}>
                      {formatRp(detail.totals.grandTotal)}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// --- small subcomponents --------------------------------------------------

function MiniCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.miniCell, { borderLeftColor: color }]}>
      <Text style={styles.miniLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.miniValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

function SummaryCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap | string;
}) {
  return (
    <View style={[styles.summaryCard, { borderLeftColor: color }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.summaryLabel} numberOfLines={1}>{label}</Text>
        <Ionicons name={icon as any} size={16} color={C.mutedForeground} />
      </View>
      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

// --- styles ---------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary,
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },
  headerBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    color: C.foreground,
    fontSize: 14,
  },
  summaryRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  summaryCard: {
    width: 160,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    marginRight: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryLabel: { fontSize: 11, color: C.mutedForeground, fontWeight: '600', flex: 1, marginRight: 4 },
  summaryValue: { fontSize: 15, fontWeight: 'bold', color: C.foreground, marginTop: 8 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  centerText: { color: C.mutedForeground, marginTop: 12, textAlign: 'center', fontSize: 14 },
  retryBtn: {
    marginTop: 12,
    backgroundColor: C.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: '#FFF', fontWeight: '600' },

  memberCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  memberHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  memberNama: { fontSize: 15, fontWeight: 'bold', color: C.primary },
  memberSub: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },

  miniGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  miniCell: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 6,
    paddingLeft: 8,
    borderLeftWidth: 3,
  },
  miniLabel: { fontSize: 10, color: C.mutedForeground },
  miniValue: { fontSize: 13, fontWeight: '600', color: C.foreground, marginTop: 2 },

  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 13, color: C.mutedForeground },
  value: { fontSize: 13, color: C.foreground, fontWeight: '500' },
  labelBold: { fontSize: 13, color: C.primary, fontWeight: '600' },
  valueBold: { fontSize: 14, color: C.foreground, fontWeight: 'bold' },

  listEndText: { textAlign: 'center', color: C.mutedForeground, fontSize: 12, paddingVertical: 12 },

  // ---- modal ----
  modalContainer: { flex: 1, backgroundColor: C.background },
  modalHeader: {
    backgroundColor: C.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  modalSub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },

  detailHeaderCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  detailNama: { fontSize: 18, fontWeight: 'bold', color: C.primary },
  detailSub: { fontSize: 13, color: C.mutedForeground, marginTop: 4 },

  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.primary, marginTop: 12, marginBottom: 8 },
  emptyText: { color: C.mutedForeground, fontSize: 13, fontStyle: 'italic' },

  subCard: {
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  loanNo: { fontSize: 13, fontWeight: 'bold', color: C.primary, fontFamily: 'monospace' },
  angsuranBadge: {
    backgroundColor: C.accentBg,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    color: C.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  txDesc: { fontSize: 12, color: C.foreground, marginTop: 4 },

  sourceBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  sourceText: { fontSize: 10, fontWeight: 'bold' },

  totalFooter: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
});
