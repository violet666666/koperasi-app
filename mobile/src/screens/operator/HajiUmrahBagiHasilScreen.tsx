import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';
import { log } from '../../utils/log';

const AMBER = '#F59E0B';
const GREEN = '#16A34A';
const GRAY = '#94A3B8';
const BLUE = '#0EA5E9';

const formatRp = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

type FilterChip = { label: string; value: string | null };
const FILTER_CHIPS: FilterChip[] = [
  { label: 'Semua', value: null },
  { label: 'Draft', value: 'draft' },
  { label: 'Processed', value: 'processed' },
];

type Distribution = {
  id: number;
  distributionNo: string;
  periodLabel: string;
  status: string;
  memberPoolAmount: number;
  spreadAmount: number;
  itemCount: number;
  processedAt: string | null;
  memberCount: number;
  totalBsiAmount: number;
  totalBalanceSnapshot: number;
};

type DistributionItem = {
  id: number;
  memberId: number;
  memberName: string;
  accountNo: string;
  balanceSnapshot: number;
  amount: number;
};

export default function HajiUmrahBagiHasilScreen({ navigation }: any) {
  const [distributions, setDistributions] = useState<Distribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ distribution: Distribution; items: DistributionItem[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const params: Record<string, string> = { perPage: '50' };
      if (activeFilter) params.status = activeFilter;
      const res = await api.get('/api/mobile/haji-umrah/bagi-hasil', { params });
      setDistributions(res.data.data || []);
    } catch (err) {
      log.error('Failed to load bagi hasil:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const loadDetail = async (id: number) => {
    if (detail?.distribution.id === id) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const res = await api.get(`/api/mobile/haji-umrah/bagi-hasil/${id}`);
      setDetail({ distribution: res.data.distribution, items: res.data.items || [] });
    } catch (err) {
      log.error('Failed to load bagi hasil detail:', err);
      Alert.alert('Error', 'Gagal memuat detail distribusi');
    } finally {
      setDetailLoading(false);
    }
  };

  const statusBadge = (status: string) =>
    status === 'processed'
      ? { label: 'Selesai', bg: GREEN }
      : status === 'draft'
      ? { label: 'Draft', bg: AMBER }
      : { label: status, bg: GRAY };

  const renderItem = ({ item }: { item: Distribution }) => {
    const badge = statusBadge(item.status);
    const isExpanded = detail?.distribution.id === item.id;
    const isLoading = detailLoading && isExpanded;
    return (
      <>
        <TouchableOpacity
          style={[styles.card, isExpanded && styles.cardExpanded]}
          activeOpacity={0.7}
          onPress={() => loadDetail(item.id)}
        >
          <View style={styles.cardHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.periodLabel}>{item.periodLabel}</Text>
              <Text style={styles.subLine}>{item.distributionNo}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: badge.bg }]}>
              <Text style={styles.badgeText}>{badge.label}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatRp(item.memberPoolAmount)}</Text>
              <Text style={styles.statLabel}>Pool Anggota</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatRp(item.spreadAmount)}</Text>
              <Text style={styles.statLabel}>Pool Spread</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{item.itemCount}</Text>
              <Text style={styles.statLabel}>Item</Text>
            </View>
          </View>

          {item.processedAt && (
            <Text style={styles.cardFooter}>
              Diproses {new Date(item.processedAt).toLocaleDateString('id-ID')}
            </Text>
          )}
          {isLoading && (
            <ActivityIndicator size="small" color={C.accent} style={{ position: 'absolute', right: 12, top: 12 }} />
          )}
          <View style={styles.expandHint}>
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={C.mutedForeground}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && detail && (
          <View style={styles.detailSection}>
            {detail.items.length === 0 ? (
              <Text style={styles.emptyDetail}>Belum ada item</Text>
            ) : (
              detail.items.map((it, idx) => (
                <View
                  key={it.id}
                  style={[
                    styles.detailItem,
                    idx === detail.items.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.detailName}>{it.memberName}</Text>
                    <Text style={styles.detailAccount}>{it.accountNo}</Text>
                    <Text style={styles.detailBalance}>
                      Saldo: {formatRp(it.balanceSnapshot)}
                    </Text>
                  </View>
                  <Text style={styles.detailAmount}>{formatRp(it.amount)}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </>
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
            <Text style={styles.headerTitle}>Bagi Hasil</Text>
            <Text style={styles.headerSub}>Distribusi H&U {distributions.length} periode</Text>
          </View>
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
        data={distributions}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="pie-chart-outline" size={48} color={C.mutedForeground} />
            <Text style={{ color: C.mutedForeground, marginTop: 12, fontSize: 15 }}>
              Belum ada distribusi bagi hasil
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
  cardExpanded: {
    borderColor: C.primary + '40',
    borderWidth: 1.5,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  periodLabel: { fontSize: 15, fontWeight: '700', color: C.foreground },
  subLine: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: C.border },
  statValue: { fontSize: 13, fontWeight: 'bold', color: C.foreground },
  statLabel: { fontSize: 10, color: C.mutedForeground, marginTop: 2 },
  cardFooter: { fontSize: 11, color: C.mutedForeground, marginTop: 8 },
  expandHint: { position: 'absolute', right: 12, bottom: 12 },
  detailSection: {
    backgroundColor: C.background,
    borderRadius: 12,
    marginBottom: 12,
    marginTop: -4,
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  detailItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  detailName: { fontSize: 13, fontWeight: '600', color: C.foreground },
  detailAccount: { fontSize: 11, color: C.mutedForeground, marginTop: 1 },
  detailBalance: { fontSize: 11, color: C.mutedForeground, marginTop: 1 },
  detailAmount: { fontSize: 13, fontWeight: '700', color: GREEN },
  emptyDetail: { paddingVertical: 16, textAlign: 'center', color: C.mutedForeground, fontSize: 13 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
});
