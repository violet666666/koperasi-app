import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import api from '../../lib/api';
import C from '../../lib/colors';
import { log } from '../../utils/log';

// ============================================================================
// Fase 7b T4 — Generic per-unit laporan screen (read-only V1).
//
// Calls GET /api/mobile/reports/unit-laporan/{unitType}?period=&page=&perPage=
// → axios res.data.data (T3 route → getUnitLaporanData helper). Field names
// below mirror the helper's return object EXACTLY (confirmed against
// src/lib/services/unit-laporan.ts).
//
// KEY off `unitType` (the response field), NOT `unitSlug` (cosmetic echo).
// ============================================================================

// --- UNIT_TYPES (mirrored from src/lib/constants/units.ts — NOT importable
//     into RN). Canonical keys + labels. The screen always keys off the key. ---
type UnitKey =
  | 'toko'
  | 'cafe_lsp'
  | 'resto'
  | 'cuci_mobil'
  | 'barbershop'
  | 'fitness'
  | 'playstation'
  | 'fotocopy'
  | 'laundry'
  | 'haji_umrah';

const UNIT_LIST: { key: UnitKey; label: string }[] = [
  { key: 'toko', label: 'Toko' },
  { key: 'cafe_lsp', label: 'Cafe LSP' },
  { key: 'resto', label: 'Resto & Cafe' },
  { key: 'cuci_mobil', label: 'Cuci Mobil' },
  { key: 'barbershop', label: 'Barbershop' },
  { key: 'fitness', label: 'Fitness' },
  { key: 'playstation', label: 'Play Station' },
  { key: 'fotocopy', label: 'Fotocopy' },
  { key: 'laundry', label: 'Laundry' },
  { key: 'haji_umrah', label: 'Haji & Umrah' },
];

// F&B units (mirrors FB_UNITS in constants/units.ts) → Dine-In/Takeaway/Counter block.
const FB_UNITS: UnitKey[] = ['cafe_lsp', 'resto'];
// Store units → HPP + netProfit block (helper computes HPP/writeoff only for
// `usesStoreSales`, which is all units EXCEPT cuci_mobil/simpan_pinjam/
// investasi_modal_jp — i.e. for our UNIT_LIST that is every unit except
// cuci_mobil + the pure-service units still get totalHPP=0; we only surface
// the card where it is meaningful: toko/resto/cafe_lsp).
const STORE_UNITS_FOR_HPP: UnitKey[] = ['toko', 'resto', 'cafe_lsp'];

const PERIOD_FILTERS = [
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
] as const;

const PER_PAGE = 50;

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

const formatDateTime = (d: string | Date | null | undefined) => {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(d);
  }
};

// --- types (mirror getUnitLaporanData return EXACTLY) --------------------

type UnitLaporanSummary = {
  totalPendapatan: number;
  totalTransaksi: number;
  tunai: number;
  qris: number;
  potongGaji: number;
  dineIn: number;
  takeaway: number;
  counter: number;
  dineInCount: number;
  takeawayCount: number;
  counterCount: number;
  takeawaySurchargeTotal: number;
  totalPengeluaran: number;
  totalPemasukan: number;
  potonganSHUMember: number;
  jumlahCuciAnggota: number;
  shuPerCuci: number;
  laba: number;
  totalHPP: number;
  totalWriteOff: number;
  netProfit: number;
};

type UnitLaporanTx = {
  id: string;
  date: string;
  no: string;
  description: string;
  memberName: string | null;
  memberNrp: string | null;
  paymentMethod: string | null;
  amount: number;
  status: string;
  type: 'unit_transaction' | 'store_sale';
  vehiclePlate: string | null;
};

type UnitLaporanOpsEntry = {
  id: number;
  date: string;
  transactionNo: string;
  description: string;
  amount: number;
  receiptImagePath: string | null;
  paymentMethod: string | null;
};

type UnitLaporanResult = {
  unitType: string;
  unitSlug: string;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  summary: UnitLaporanSummary;
  transactions: UnitLaporanTx[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
  operationalExpenses: UnitLaporanOpsEntry[];
  operationalIncomes: UnitLaporanOpsEntry[];
};

// --- component -----------------------------------------------------------

export default function LaporanUnitScreen({ navigation: navProp }: any) {
  const navHook = useNavigation<any>();
  const navigation = navProp || navHook;
  const canGoBack = navigation.canGoBack?.() ?? false;

  const [unitKey, setUnitKey] = useState<UnitKey>('toko');
  const [period, setPeriod] = useState<string>('month');
  // Custom month (YYYY-MM) → period=custom with first..last day of that month.
  const [customYear, setCustomYear] = useState<number>(new Date().getFullYear());
  const [customMonth, setCustomMonth] = useState<number>(new Date().getMonth()); // 0-based
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const [summary, setSummary] = useState<UnitLaporanSummary | null>(null);
  const [periodLabel, setPeriodLabel] = useState<string>('');
  const [transactions, setTransactions] = useState<UnitLaporanTx[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTx, setTotalTx] = useState(0);
  const [operationalExpenses, setOperationalExpenses] = useState<UnitLaporanOpsEntry[]>([]);
  const [operationalIncomes, setOperationalIncomes] = useState<UnitLaporanOpsEntry[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Collapsible sections
  const [showExpenses, setShowExpenses] = useState(false);
  const [showIncomes, setShowIncomes] = useState(false);

  // --- build query params for the current selection ---------------------
  const buildQuery = useCallback(
    (targetPage: number) => {
      const params: Record<string, string> = {
        period,
        page: String(targetPage),
        perPage: String(PER_PAGE),
      };
      if (period === 'custom') {
        // First + last day of the chosen month (YYYY-MM-DD).
        const y = customYear;
        const m = customMonth; // 0-based
        const firstDay = new Date(y, m, 1);
        const lastDay = new Date(y, m + 1, 0); // day 0 of next month = last day
        const pad = (n: number) => String(n).padStart(2, '0');
        params.dateFrom = `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-${pad(firstDay.getDate())}`;
        params.dateTo = `${lastDay.getFullYear()}-${pad(lastDay.getMonth() + 1)}-${pad(lastDay.getDate())}`;
      }
      const qs = new URLSearchParams(params);
      return qs.toString();
    },
    [period, customYear, customMonth],
  );

  // --- fetch -------------------------------------------------------------
  const fetchPage = useCallback(
    async (targetPage: number, mode: 'replace' | 'append') => {
      if (mode === 'replace') setLoading(true);
      else setLoadingMore(true);
      if (mode === 'replace') setError(null);
      try {
        const res = await api.get(
          `/api/mobile/reports/unit-laporan/${unitKey}?${buildQuery(targetPage)}`,
        );
        const payload: UnitLaporanResult | undefined = res?.data?.data;
        if (!payload) throw new Error('Respon server kosong.');
        if (mode === 'replace') {
          setSummary(payload.summary);
          setPeriodLabel(payload.periodLabel);
          setTransactions(payload.transactions || []);
          setOperationalExpenses(payload.operationalExpenses || []);
          setOperationalIncomes(payload.operationalIncomes || []);
        } else {
          setTransactions((prev) => [...prev, ...(payload.transactions || [])]);
        }
        setTotalPages(payload.pagination?.totalPages ?? 1);
        setTotalTx(payload.pagination?.total ?? (payload.transactions?.length || 0));
        setPage(targetPage);
      } catch (err: any) {
        log.error('LaporanUnitScreen: fetch gagal:', err);
        if (mode === 'replace') {
          setError(err?.message || 'Gagal memuat laporan unit.');
          setSummary(null);
          setTransactions([]);
        }
      } finally {
        if (mode === 'replace') setLoading(false);
        else setLoadingMore(false);
      }
    },
    [unitKey, buildQuery],
  );

  // Initial + on unit/period change → reset to page 1.
  useEffect(() => {
    fetchPage(1, 'replace');
  }, [fetchPage]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPage(1, 'replace');
    setRefreshing(false);
  };

  const onEndReached = () => {
    if (loadingMore || loading) return;
    if (page >= totalPages) return;
    fetchPage(page + 1, 'append');
  };

  const selectUnit = (k: UnitKey) => {
    if (k === unitKey) return;
    setUnitKey(k);
    // fetchPage re-fires via the unitKey dep in useCallback → useEffect.
  };

  const selectPeriod = (p: string) => {
    if (p === period) return;
    setPeriod(p);
    if (p !== 'custom') setShowMonthPicker(false);
  };

  const onMonthPick = (_event: any, selected?: Date) => {
    setShowMonthPicker(false);
    if (!selected) return;
    setCustomYear(selected.getFullYear());
    setCustomMonth(selected.getMonth());
    setPeriod('custom');
  };

  // --- derived unit-class flags (key off `unitType`, not unitSlug) ------
  const activeUnitType = unitKey; // canonical key the user selected
  const isFb = FB_UNITS.includes(activeUnitType as UnitKey);
  const isCuciMobil = activeUnitType === 'cuci_mobil';
  const showHppCard = STORE_UNITS_FOR_HPP.includes(activeUnitType as UnitKey);

  const activeUnitLabel = useMemo(
    () => UNIT_LIST.find((u) => u.key === unitKey)?.label || unitKey,
    [unitKey],
  );

  // --- render: transaction row ------------------------------------------
  const renderTx = ({ item }: { item: UnitLaporanTx }) => {
    const isVoided = item.status === 'voided';
    const method = item.paymentMethod;
    const methodLabel =
      method === 'cash' ? 'Tunai' : method === 'qris' ? 'QRIS' : method === 'salary_cut' ? 'Potong Gaji' : method ? method : '-';
    const methodColor =
      method === 'cash' ? C.success : method === 'qris' ? C.info : method === 'salary_cut' ? C.warning : C.mutedForeground;
    return (
      <View style={[styles.txCard, isVoided && styles.txCardVoided]}>
        <View style={styles.txTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.txDesc, isVoided && styles.txTextVoided]} numberOfLines={2}>
              {item.description || '(Tanpa keterangan)'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              <Text style={styles.txDate}>{formatDateTime(item.date)}</Text>
              {isCuciMobil && item.vehiclePlate ? (
                <View style={styles.plateBadge}>
                  <Text style={styles.plateText}>{item.vehiclePlate}</Text>
                </View>
              ) : null}
              {item.memberName ? (
                <Text style={styles.txMember} numberOfLines={1}>
                  {item.memberName}
                  {item.memberNrp ? ` · ${item.memberNrp}` : ''}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={[styles.txAmount, isVoided && styles.txTextVoided]}>
              {formatRp(item.amount)}
            </Text>
            {method && method !== '-' ? (
              <View style={[styles.methodBadge, { backgroundColor: methodColor + '20' }]}>
                <Text style={[styles.methodText, { color: methodColor }]}>{methodLabel}</Text>
              </View>
            ) : null}
          </View>
        </View>
        {isVoided ? (
          <View style={styles.voidedBadge}>
            <Text style={styles.voidedText}>DIBATALKAN</Text>
          </View>
        ) : null}
      </View>
    );
  };

  // --- render: ops entry (expense/income) -------------------------------
  const renderOpsEntry = ({ item, kind }: { item: UnitLaporanOpsEntry; kind: 'expense' | 'income' }) => {
    const amount = Number(item.amount || 0);
    const method = item.paymentMethod;
    const methodLabel =
      method === 'cash' ? 'Tunai' : method === 'qris' ? 'QRIS' : method === 'lainnya' ? 'Lainnya' : method ? method : '-';
    const sign = kind === 'expense' ? '-' : '+';
    const color = kind === 'expense' ? C.destructive : C.success;
    return (
      <View style={styles.opsCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.opsDesc} numberOfLines={2}>
            {item.description || '(Tanpa keterangan)'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <Text style={styles.opsDate}>{formatDate(item.date)}</Text>
            {item.transactionNo ? <Text style={styles.opsNo} numberOfLines={1}>· {item.transactionNo}</Text> : null}
            {method && method !== '-' ? <Text style={styles.opsMethod}>· {methodLabel}</Text> : null}
          </View>
        </View>
        <Text style={[styles.opsAmount, { color }]}>
          {sign} {formatRp(amount)}
        </Text>
      </View>
    );
  };

  // --- header + selectors (always visible, outside FlatList) ------------
  const headerContent = (
    <>
      {/* Period chips + custom month picker */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}
      >
        {PERIOD_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.chip, period === f.key && styles.chipActive]}
            onPress={() => selectPeriod(f.key)}
          >
            <Text style={[styles.chipText, period === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.chip, period === 'custom' && styles.chipActive]}
          onPress={() => {
            setPeriod('custom');
            setShowMonthPicker(true);
          }}
        >
          <Ionicons name="calendar-outline" size={14} color={period === 'custom' ? C.primary : C.mutedForeground} />
          <Text style={[styles.chipText, period === 'custom' && styles.chipTextActive]}>
            {period === 'custom'
              ? `${customMonth + 1}/${customYear}`
              : 'Pilih Bulan'}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {periodLabel ? (
        <Text style={styles.periodLabel}>{periodLabel}</Text>
      ) : null}

      {/* Summary + breakdown (only when we have data) */}
      {summary ? (
        <View>
          {/* Universal summary cards */}
          <Text style={styles.sectionTitle}>Ringkasan</Text>
          <View style={styles.summaryGrid}>
            <SummaryCell label="Total Pendapatan" value={formatRp(summary.totalPendapatan)} color={C.primary} icon="trending-up" />
            <SummaryCell label="Pengeluaran Ops" value={formatRp(summary.totalPengeluaran)} color={C.warning} icon="trending-down" />
            <SummaryCell label="Laba Bersih" value={formatRp(summary.laba)} color={C.success} icon="stats-chart" />
            <SummaryCell label="Jumlah Transaksi" value={String(summary.totalTransaksi)} color={C.info} icon="receipt" />
          </View>

          {/* Payment-method breakdown */}
          <Text style={styles.sectionTitle}>Metode Pembayaran</Text>
          <View style={styles.card}>
            <View style={styles.breakdownRow}>
              <View style={[styles.dot, { backgroundColor: C.success }]} />
              <Text style={styles.breakdownLabel}>Tunai</Text>
              <Text style={styles.breakdownValue}>{formatRp(summary.tunai)}</Text>
            </View>
            <View style={styles.breakdownRow}>
              <View style={[styles.dot, { backgroundColor: C.info }]} />
              <Text style={styles.breakdownLabel}>QRIS</Text>
              <Text style={styles.breakdownValue}>{formatRp(summary.qris)}</Text>
            </View>
            <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
              <View style={[styles.dot, { backgroundColor: C.warning }]} />
              <Text style={styles.breakdownLabel}>Potong Gaji</Text>
              <Text style={styles.breakdownValue}>{formatRp(summary.potongGaji)}</Text>
            </View>
          </View>

          {/* F&B specific: Dine-In / Takeaway / Counter */}
          {isFb ? (
            <>
              <Text style={styles.sectionTitle}>Tipe Pesanan</Text>
              <View style={styles.summaryGrid}>
                <SummaryCell
                  label={`Dine-In (${summary.dineInCount})`}
                  value={formatRp(summary.dineIn)}
                  color={C.primary}
                  icon="restaurant"
                />
                <SummaryCell
                  label={`Takeaway (${summary.takeawayCount})`}
                  value={formatRp(summary.takeaway)}
                  color={C.secondary}
                  icon="bag-handle"
                />
                <SummaryCell
                  label={`Counter (${summary.counterCount})`}
                  value={formatRp(summary.counter)}
                  color={C.info}
                  icon="storefront"
                />
                <SummaryCell
                  label="Surcharge Takeaway"
                  value={formatRp(summary.takeawaySurchargeTotal)}
                  color={C.warning}
                  icon="add-circle"
                />
              </View>
            </>
          ) : null}

          {/* Cuci Mobil specific: Bagi Hasil 50/50 + Potongan SHU */}
          {isCuciMobil ? (
            <>
              <Text style={styles.sectionTitle}>Bagi Hasil (50:50)</Text>
              <View style={styles.card}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Pendapatan Kotor</Text>
                  <Text style={styles.breakdownValue}>{formatRp(summary.totalPendapatan)}</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Bagian Karyawan (50%)</Text>
                  <Text style={[styles.breakdownValue, { color: C.destructive }]}>
                    - {formatRp(Math.round(summary.totalPendapatan / 2))}
                  </Text>
                </View>
                <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.breakdownLabel}>Bagian Koperasi (50%)</Text>
                  <Text style={[styles.breakdownValue, { color: C.success }]}>
                    {formatRp(Math.round(summary.totalPendapatan / 2))}
                  </Text>
                </View>
              </View>

              <Text style={styles.sectionTitle}>Potongan SHU Anggota</Text>
              <View style={styles.card}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Jumlah Cuci Anggota</Text>
                  <Text style={styles.breakdownValue}>{summary.jumlahCuciAnggota}x</Text>
                </View>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>SHU per Cuci</Text>
                  <Text style={styles.breakdownValue}>{formatRp(summary.shuPerCuci)}</Text>
                </View>
                <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.breakdownLabel, { fontWeight: 'bold' }]}>Total Potongan SHU</Text>
                  <Text style={[styles.breakdownValue, { color: C.primary, fontWeight: 'bold' }]}>
                    {formatRp(summary.potonganSHUMember)}
                  </Text>
                </View>
              </View>
            </>
          ) : null}

          {/* Store units: HPP + Laba Bersih Akurat */}
          {showHppCard ? (
            <>
              <Text style={styles.sectionTitle}>HPP & Laba Akurat</Text>
              <View style={styles.card}>
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>Total HPP</Text>
                  <Text style={[styles.breakdownValue, { color: C.warning }]}>- {formatRp(summary.totalHPP)}</Text>
                </View>
                {summary.totalWriteOff > 0 ? (
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>Write-off Stock</Text>
                    <Text style={[styles.breakdownValue, { color: C.destructive }]}>- {formatRp(summary.totalWriteOff)}</Text>
                  </View>
                ) : null}
                <View style={[styles.breakdownRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.breakdownLabel, { fontWeight: 'bold' }]}>Laba Bersih Akurat</Text>
                  <Text style={[styles.breakdownValue, { color: C.success, fontWeight: 'bold' }]}>
                    {formatRp(summary.netProfit)}
                  </Text>
                </View>
              </View>
            </>
          ) : null}
        </View>
      ) : null}

      {/* Operational Incomes (collapsible) */}
      {operationalIncomes.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setShowIncomes((v) => !v)}
          >
            <Text style={styles.sectionTitleInline}>
              Pemasukan Operasional ({operationalIncomes.length})
            </Text>
            <Ionicons name={showIncomes ? 'chevron-up' : 'chevron-down'} size={18} color={C.primary} />
          </TouchableOpacity>
          {showIncomes
            ? operationalIncomes.map((e) => (
                <View key={`inc-${e.id}`}>
                  {renderOpsEntry({ item: e, kind: 'income' })}
                </View>
              ))
            : null}
        </View>
      ) : null}

      {/* Operational Expenses (collapsible) */}
      {operationalExpenses.length > 0 ? (
        <View style={{ marginTop: 4 }}>
          <TouchableOpacity
            style={styles.collapseHeader}
            onPress={() => setShowExpenses((v) => !v)}
          >
            <Text style={styles.sectionTitleInline}>
              Pengeluaran Operasional ({operationalExpenses.length})
            </Text>
            <Ionicons name={showExpenses ? 'chevron-up' : 'chevron-down'} size={18} color={C.primary} />
          </TouchableOpacity>
          {showExpenses
            ? operationalExpenses.map((e) => (
                <View key={`exp-${e.id}`}>
                  {renderOpsEntry({ item: e, kind: 'expense' })}
                </View>
              ))
            : null}
        </View>
      ) : null}

      {/* Transaction list section header */}
      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>
        Riwayat Transaksi{totalTx > 0 ? ` (${totalTx})` : ''}
      </Text>
    </>
  );

  // --- render ------------------------------------------------------------
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {canGoBack ? (
            <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Laporan Unit</Text>
            <Text style={styles.headerSub}>{activeUnitLabel}</Text>
          </View>
        </View>
      </View>

      {/* Unit selector (horizontal chips) */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}
      >
        {UNIT_LIST.map((u) => (
          <TouchableOpacity
            key={u.key}
            style={[styles.chip, unitKey === u.key && styles.chipActive]}
            onPress={() => selectUnit(u.key)}
          >
            <Text style={[styles.chipText, unitKey === u.key && styles.chipTextActive]}>{u.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Custom month picker */}
      {showMonthPicker ? (
        <DateTimePicker
          value={new Date(customYear, customMonth, 1)}
          mode="date"
          display="default"
          onChange={onMonthPick}
          maximumDate={new Date()}
        />
      ) : null}

      {/* Body */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.accent} />
          <Text style={styles.centerText}>Memuat laporan {activeUnitLabel}…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={48} color={C.mutedForeground} />
          <Text style={styles.centerText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPage(1, 'replace')}>
            <Text style={styles.retryText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item, idx) => `${item.id ?? idx}-${idx}`}
          renderItem={renderTx}
          ListHeaderComponent={headerContent}
          ListEmptyComponent={
            <View style={styles.emptyTx}>
              <Ionicons name="receipt-outline" size={32} color={C.mutedForeground} />
              <Text style={{ color: C.mutedForeground, marginTop: 8 }}>
                Tidak ada transaksi di periode ini
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color={C.accent} />
              </View>
            ) : page >= totalPages && transactions.length >= PER_PAGE ? (
              <Text style={styles.listEndText}>— Data terakhir —</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

// --- small subcomponents -------------------------------------------------

function SummaryCell({
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
    <View style={[styles.summaryCell, { borderLeftColor: color }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={styles.summaryLabel} numberOfLines={1}>{label}</Text>
        <Ionicons name={icon as any} size={14} color={C.mutedForeground} />
      </View>
      <Text style={styles.summaryValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

// --- styles --------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary,
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 4 },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: C.muted,
    borderWidth: 1,
    borderColor: 'transparent',
    maxHeight: 35,
  },
  chipActive: { backgroundColor: C.accentBg, borderColor: C.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: C.mutedForeground },
  chipTextActive: { color: C.primary },

  periodLabel: {
    fontSize: 12,
    color: C.mutedForeground,
    textAlign: 'center',
    marginBottom: 4,
    fontStyle: 'italic',
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: C.mutedForeground,
    marginTop: 16,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionTitleInline: {
    fontSize: 14,
    fontWeight: 'bold',
    color: C.primary,
    flex: 1,
  },
  collapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },

  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  summaryCell: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 8,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryLabel: { fontSize: 11, color: C.mutedForeground, fontWeight: '600', flex: 1, marginRight: 4 },
  summaryValue: { fontSize: 15, fontWeight: 'bold', color: C.foreground, marginTop: 6 },

  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },

  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  breakdownLabel: { flex: 1, fontSize: 13, color: C.foreground },
  breakdownValue: { fontSize: 13, fontWeight: '600', color: C.foreground },

  // transaction cards
  txCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  txCardVoided: { opacity: 0.5, backgroundColor: '#F8FAFC' },
  txTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  txDesc: { fontSize: 14, fontWeight: '600', color: C.foreground },
  txDate: { fontSize: 12, color: C.mutedForeground },
  txMember: { fontSize: 11, color: C.mutedForeground, maxWidth: 180 },
  txAmount: { fontSize: 15, fontWeight: 'bold', color: C.primary },
  txTextVoided: { textDecorationLine: 'line-through', color: C.mutedForeground },
  methodBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  methodText: { fontSize: 10, fontWeight: '700' },
  plateBadge: {
    backgroundColor: '#EFF6FF',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  plateText: { fontSize: 11, fontWeight: '700', color: '#1D4ED8' },
  voidedBadge: {
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: C.destructiveBg,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  voidedText: { fontSize: 10, fontWeight: '700', color: '#DC2626' },

  // ops entries
  opsCard: {
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  opsDesc: { fontSize: 13, fontWeight: '600', color: C.foreground },
  opsDate: { fontSize: 11, color: C.mutedForeground },
  opsNo: { fontSize: 11, color: C.mutedForeground, fontFamily: 'monospace' },
  opsMethod: { fontSize: 11, color: C.mutedForeground },
  opsAmount: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' },

  // states
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
  emptyTx: { alignItems: 'center', padding: 24 },
  listEndText: { textAlign: 'center', color: C.mutedForeground, fontSize: 12, paddingVertical: 12 },
});
