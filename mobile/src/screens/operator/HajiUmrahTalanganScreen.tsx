import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl, TextInput, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';
import { log } from '../../utils/log';

const AMBER = '#F59E0B';
const GREEN = '#16A34A';
const BLUE = '#0EA5E9';
const GRAY = '#94A3B8';
const RED = '#EF4444';

type TalanganLoan = {
  loanId: number;
  loanNo: string;
  memberName: string;
  memberNrp: string;
  productType: string | null;
  status: string;
  outstanding: number;
  tenorMonths: number;
  monthlyInstallment: number;
};

type TalanganStats = {
  totalActive: number;
  totalOutstanding: number;
  paidThisMonth: number;
  gapDetected: number;
  totalPaidOff: number;
  totalRecords: number;
};

type FilterChip = { label: string; value: string | null };
const FILTER_CHIPS: FilterChip[] = [
  { label: 'Semua', value: null },
  { label: 'Haji', value: 'talangan_haji' },
  { label: 'Umrah', value: 'talangan_umrah' },
];

const formatRp = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

export default function HajiUmrahTalanganScreen({ navigation }: any) {
  const [loans, setLoans] = useState<TalanganLoan[]>([]);
  const [stats, setStats] = useState<TalanganStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const params: Record<string, string> = { perPage: '100' };
      if (search.trim()) params.search = search.trim();
      if (activeFilter) params.type = activeFilter;
      const listRes = await api.get('/api/mobile/haji-umrah/talangan', { params });
      setLoans(listRes.data.data || []);
      setStats(listRes.data.stats || null);
    } catch (err) {
      log.error('Failed to load talangan data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, activeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const typeBadge = (productType: string | null) =>
    productType === 'talangan_haji'
      ? { label: 'Haji', bg: GREEN }
      : productType === 'talangan_umrah'
      ? { label: 'Umrah', bg: BLUE }
      : { label: 'Lain', bg: GRAY };

  const statusBadge = (status: string) =>
    status === 'active'
      ? { label: 'Aktif', bg: GREEN }
      : status === 'paid_off'
      ? { label: 'Lunas', bg: BLUE }
      : status === 'overdue'
      ? { label: 'Terlambat', bg: RED }
      : { label: status, bg: GRAY };

  const renderItem = ({ item }: { item: TalanganLoan }) => {
    const badge = typeBadge(item.productType);
    const stat = statusBadge(item.status);
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('HajiUmrahTalanganDetail', { loanId: item.loanId })}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.memberName} numberOfLines={1}>
              {item.memberName || '(Tanpa Nama)'}
            </Text>
            <Text style={styles.subLine} numberOfLines={1}>
              {item.loanNo} • {item.memberNrp || '-'}
            </Text>
          </View>
          <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
            <Text style={styles.typeBadgeText}>{badge.label}</Text>
          </View>
        </View>

        <View style={styles.balanceRow}>
          <View>
            <Text style={styles.balanceLabel}>Outstanding</Text>
            <Text style={styles.balanceValue}>{formatRp(item.outstanding)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.balanceLabel}>Angsuran/Bulan</Text>
            <Text style={styles.targetValue}>{formatRp(item.monthlyInstallment)}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>Tenor: {item.tenorMonths} bulan</Text>
          <View style={[styles.statusPill, { backgroundColor: stat.bg }]}>
            <Text style={styles.statusText}>{stat.label}</Text>
          </View>
        </View>
      </TouchableOpacity>
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
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Talangan Haji & Umrah</Text>
            <Text style={styles.headerSub}>{loans.length} pinjaman</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#FFF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama / NRP / no pinjaman..."
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={18} color="#FFF" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsRow}>
          <View style={[styles.statCard, stats.gapDetected > 0 && styles.statCardAmber]}>
            <Ionicons name="alert-circle" size={18} color={stats.gapDetected > 0 ? AMBER : C.mutedForeground} />
            <Text style={[styles.statValue, stats.gapDetected > 0 && { color: AMBER }]}>
              {formatRp(stats.gapDetected)}
            </Text>
            <Text style={styles.statLabel}>Gap</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="airplane" size={18} color={GREEN} />
            <Text style={styles.statValue}>{stats.totalActive}</Text>
            <Text style={styles.statLabel}>Aktif</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="wallet" size={18} color={RED} />
            <Text style={styles.statValue}>{formatRp(stats.totalOutstanding)}</Text>
            <Text style={styles.statLabel}>Outstanding</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle" size={18} color={BLUE} />
            <Text style={styles.statValue}>{stats.totalPaidOff}</Text>
            <Text style={styles.statLabel}>Lunas</Text>
          </View>
        </View>
      )}

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
      >
        {FILTER_CHIPS.map((chip) => {
          const active = activeFilter === chip.value;
          return (
            <TouchableOpacity
              key={chip.label}
              style={[styles.chip, active ? styles.chipActive : null]}
              onPress={() => setActiveFilter(chip.value)}
            >
              <Text style={[styles.chipText, active ? styles.chipTextActive : null]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={loans}
        keyExtractor={(item) => String(item.loanId)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="cash-outline" size={48} color={C.mutedForeground} />
            <Text style={{ color: C.mutedForeground, marginTop: 12, fontSize: 15 }}>
              Belum ada talangan
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.background },
  header: {
    backgroundColor: C.primary, paddingTop: 52, paddingBottom: 14, paddingHorizontal: 16,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: 4 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  headerSub: { color: '#FFF', fontSize: 12, opacity: 0.7, marginTop: 2 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: '#FFF', fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingTop: 14, gap: 8,
  },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 12, padding: 10, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  statCardAmber: {
    borderWidth: 1, borderColor: AMBER,
  },
  statValue: { fontSize: 13, fontWeight: '700', color: C.foreground, marginTop: 4, textAlign: 'center' },
  statLabel: { fontSize: 10, color: C.mutedForeground, marginTop: 2, textAlign: 'center' },
  chipRow: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, marginRight: 8,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: C.mutedForeground },
  chipTextActive: { color: '#FFF' },
  card: {
    backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  memberName: { fontSize: 16, fontWeight: '700', color: C.foreground },
  subLine: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  typeBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  balanceLabel: { fontSize: 11, color: C.mutedForeground },
  balanceValue: { fontSize: 16, fontWeight: '700', color: C.foreground, marginTop: 2 },
  targetValue: { fontSize: 14, fontWeight: '600', color: C.mutedForeground, marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  metaText: { fontSize: 11, color: C.mutedForeground },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
});
