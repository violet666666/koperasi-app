import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl, TextInput, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';
import { StorageManager } from '../../lib/storage';
import { log } from '../../utils/log';

// Field contract: matches GET /api/mobile/haji-umrah/savings enriched[] shape.
// { id, accountNo, balance, target, progress, monthlyTarget, status,
//   member: { id, memberNo, name, nrp }, product: { name, type, ... } }
type HajiUmrahAccount = {
  id: number;
  accountNo: string;
  balance: number;
  target: number;
  progress: number;
  monthlyTarget: number;
  status: string;
  member: { id: number; memberNo: string; name: string; nrp: string };
  product: { name: string; type: string };
};

type FilterChip = { label: string; value: string | null };
const FILTER_CHIPS: FilterChip[] = [
  { label: 'Semua', value: null },
  { label: 'Haji', value: 'tabungan_haji' },
  { label: 'Umrah', value: 'tabungan_umrah' },
];

const formatRp = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

export default function HajiUmrahScreen({ navigation }: any) {
  const [accounts, setAccounts] = useState<HajiUmrahAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // canManage: operator always, admin only if unitType === haji_umrah.
  // Matches the API write gate (POST /api/mobile/haji-umrah/buka-rekening).
  const canManage = useMemo(() => {
    const ud = StorageManager.getFastString('userData');
    if (!ud) return false;
    try {
      const p = JSON.parse(ud);
      return p.role === 'operator' || (p.role === 'admin' && p.unitType === 'haji_umrah');
    } catch { return false; }
  }, []);

  const loadData = useCallback(async () => {
    try {
      const params: Record<string, string> = { perPage: '100' };
      if (search.trim()) params.search = search.trim();
      if (activeFilter) params.type = activeFilter;
      const res = await api.get('/api/mobile/haji-umrah/savings', { params });
      setAccounts(res.data.data || []);
    } catch (err) {
      log.error('Failed to load haji/umrah accounts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, activeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const typeBadge = (productType: string) =>
    productType === 'tabungan_haji'
      ? { label: 'Haji', bg: '#16A34A', icon: '🛕' as const }
      : { label: 'Umrah', bg: '#0EA5E9', icon: '🕌' as const };

  const statusBadge = (status: string) =>
    status === 'closed'
      ? { label: 'Ditutup', bg: '#94A3B8' }
      : { label: 'Aktif', bg: '#10B981' };

  const renderItem = ({ item }: { item: HajiUmrahAccount }) => {
    const badge = typeBadge(item.product?.type);
    const stat = statusBadge(item.status);
    const pct = Math.min(100, Math.max(0, item.progress || 0));
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => navigation.navigate('HajiUmrahDetail', { accountId: item.id })}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.memberName} numberOfLines={1}>
              {item.member?.name || '(Tanpa Nama)'}
            </Text>
            <Text style={styles.subLine} numberOfLines={1}>
              {item.accountNo} • {item.member?.nrp || item.member?.memberNo || '-'}
            </Text>
          </View>
          <View style={[styles.typeBadge, { backgroundColor: badge.bg }]}>
            <Text style={styles.typeBadgeText}>{badge.icon} {badge.label}</Text>
          </View>
        </View>

        <View style={styles.balanceRow}>
          <View>
            <Text style={styles.balanceLabel}>Saldo</Text>
            <Text style={styles.balanceValue}>{formatRp(item.balance)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.balanceLabel}>Target</Text>
            <Text style={styles.targetValue}>{formatRp(item.target)}</Text>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: badge.bg }]} />
          </View>
          <View style={styles.progressMeta}>
            <Text style={styles.progressPct}>{pct.toFixed(pct % 1 === 0 ? 0 : 1)}%</Text>
            <View style={[styles.statusPill, { backgroundColor: stat.bg }]}>
              <Text style={styles.statusText}>{stat.label}</Text>
            </View>
          </View>
        </View>

        {item.monthlyTarget > 0 && (
          <Text style={styles.monthlyHint}>
            Target bulanan: {formatRp(item.monthlyTarget)}
          </Text>
        )}
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
            <Text style={styles.headerTitle}>Haji & Umrah</Text>
            <Text style={styles.headerSub}>{accounts.length} rekening</Text>
          </View>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#FFF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Cari nama / NRP / no rekening..."
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
        data={accounts}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="airplane-outline" size={48} color={C.mutedForeground} />
            <Text style={{ color: C.mutedForeground, marginTop: 12, fontSize: 15 }}>
              Belum ada rekening Haji & Umrah
            </Text>
          </View>
        }
      />

      {/* FAB — operator OR admin haji_umrah */}
      {canManage && (
        <TouchableOpacity
          style={fabStyles.fab}
          onPress={() => navigation.navigate('HajiUmrahBukaRekening')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
      )}
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
  progressWrap: { marginTop: 12 },
  progressTrack: { height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  progressPct: { fontSize: 11, fontWeight: '700', color: C.foreground },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  monthlyHint: { fontSize: 11, color: C.mutedForeground, marginTop: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
});

const fabStyles = StyleSheet.create({
  fab: {
    position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4,
  },
});
