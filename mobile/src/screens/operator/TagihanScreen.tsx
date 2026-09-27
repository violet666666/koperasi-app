import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl, Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';
import { log } from '../../utils/log';

const AMBER = '#F59E0B';
const GREEN = '#16A34A';
const GRAY = '#94A3B8';

const formatRp = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

type BillingItem = {
  id: number;
  memberId: number;
  memberName: string;
  unitType: string | null;
  amount: number;
  isPaid: boolean;
  paidAt: string | null;
};

type PeriodDetail = {
  period: { id: number; periodLabel: string; status: string; totalAmount: number; totalMembers: number };
  items: BillingItem[];
};

type BillingPeriod = {
  id: number;
  periodLabel: string;
  status: string;
  totalMembers: number;
  totalAmount: number;
  processedAt: string | null;
  processedBy?: { name: string } | null;
};

type CurrentPeriod = BillingPeriod & {
  periodStart: string;
  periodEnd: string;
};

export default function TagihanScreen({ navigation }: any) {
  const [current, setCurrent] = useState<CurrentPeriod | null>(null);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [riwayat, setRiwayat] = useState<BillingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailLoading, setDetailLoading] = useState<number | null>(null);
  const [detail, setDetail] = useState<PeriodDetail | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [curRes, riwayatRes] = await Promise.all([
        api.get('/api/mobile/billing/current'),
        api.get('/api/mobile/billing/riwayat', { params: { perPage: '50' } }),
      ]);
      setCurrent(curRes.data.data || null);
      setDaysRemaining(curRes.data.meta?.daysRemaining || 0);
      setRiwayat(riwayatRes.data.data || []);
    } catch (err) {
      log.error('Failed to load tagihan:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const loadDetail = async (periodId: number) => {
    setDetailLoading(periodId);
    try {
      const res = await api.get(`/api/mobile/billing/${periodId}`);
      setDetail(res.data.data || null);
    } catch (err) {
      log.error('Failed to load period detail:', err);
      Alert.alert('Error', 'Gagal memuat detail periode');
    } finally {
      setDetailLoading(null);
    }
  };

  const renderDetailItem = ({ item }: { item: BillingItem }) => (
    <View style={styles.detailItemRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.detailItemName} numberOfLines={1}>{item.memberName || `Anggota #${item.memberId}`}</Text>
        <Text style={styles.detailItemMeta} numberOfLines={1}>
          {item.unitType ? item.unitType.replace(/_/g, ' ') : 'umum'} · {formatRp(item.amount)}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: item.isPaid ? GREEN : GRAY }]}>
        <Text style={styles.badgeText}>{item.isPaid ? 'Lunas' : 'Belum'}</Text>
      </View>
    </View>
  );

  const statusBadge = (status: string) =>
    status === 'processed'
      ? { label: 'Selesai', bg: GREEN }
      : status === 'draft'
      ? { label: 'Draft', bg: AMBER }
      : { label: status, bg: GRAY };

  const renderCurrentCard = () => {
    if (!current) return null;
    const badge = statusBadge(current.status);
    return (
      <TouchableOpacity
        style={styles.currentCard}
        activeOpacity={0.7}
        onPress={() => loadDetail(current.id)}
      >
        <View style={styles.currentHeader}>
          <View>
            <Text style={styles.currentLabel}>Periode Sekarang</Text>
            <Text style={styles.currentPeriod}>{current.periodLabel}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={styles.badgeText}>{badge.label}</Text>
          </View>
        </View>

        <View style={styles.currentStats}>
          <View style={styles.currentStat}>
            <Text style={styles.currentStatValue}>{formatRp(current.totalAmount)}</Text>
            <Text style={styles.currentStatLabel}>Total Tagihan</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.currentStat}>
            <Text style={styles.currentStatValue}>{current.totalMembers ?? '-'}</Text>
            <Text style={styles.currentStatLabel}>Anggota</Text>
          </View>
          {current.status === 'draft' && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.currentStat}>
                <Text style={[styles.currentStatValue, { color: AMBER }]}>{daysRemaining}</Text>
                <Text style={styles.currentStatLabel}>Hari Lagi</Text>
              </View>
            </>
          )}
        </View>

        {current.processedAt && (
          <Text style={styles.currentMeta}>
            Diproses {new Date(current.processedAt).toLocaleDateString('id-ID')}
            {current.processedBy?.name ? ` oleh ${current.processedBy.name}` : ''}
          </Text>
        )}
        <Text style={styles.currentHint}>Ketuk untuk melihat detail</Text>
      </TouchableOpacity>
    );
  };

  const renderRiwayatItem = ({ item }: { item: BillingPeriod }) => {
    const badge = statusBadge(item.status);
    const isLoading = detailLoading === item.id;
    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        disabled={isLoading}
        onPress={() => loadDetail(item.id)}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.periodLabel}>{item.periodLabel}</Text>
            <Text style={styles.cardMeta}>
              {formatRp(item.totalAmount)} &bull; {item.totalMembers ?? 0} anggota
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={styles.badgeText}>{badge.label}</Text>
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
            <Text style={styles.headerTitle}>Tagihan</Text>
            <Text style={styles.headerSub}>Billing Piutang Anggota</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={riwayat}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderRiwayatItem}
        ListHeaderComponent={renderCurrentCard}
        contentContainerStyle={{ padding: 16, paddingBottom: 90 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={C.mutedForeground} />
            <Text style={{ color: C.mutedForeground, marginTop: 12, fontSize: 15 }}>
              Belum ada riwayat tagihan
            </Text>
          </View>
        }
      />

      {/* Detail periode — daftar item + status ceklist lunas */}
      <Modal
        visible={!!detail}
        transparent
        animationType="slide"
        onRequestClose={() => setDetail(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {detail ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{detail.period.periodLabel}</Text>
                  <TouchableOpacity onPress={() => setDetail(null)}>
                    <Ionicons name="close" size={24} color={C.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalMeta}>
                  Total {formatRp(detail.period.totalAmount)} ·{' '}
                  {detail.items.filter((i) => i.isPaid).length}/{detail.items.length} lunas
                </Text>
                <FlatList
                  data={detail.items}
                  keyExtractor={(i) => String(i.id)}
                  renderItem={renderDetailItem}
                  contentContainerStyle={{ paddingBottom: 16 }}
                />
              </>
            ) : null}
          </View>
        </View>
      </Modal>
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
  currentCard: {
    backgroundColor: C.primary + '18',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: C.primary + '40',
  },
  currentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  currentLabel: { fontSize: 11, color: C.primary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  currentPeriod: { fontSize: 20, fontWeight: 'bold', color: C.primary, marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  currentStats: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  currentStat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 30, backgroundColor: C.border },
  currentStatValue: { fontSize: 16, fontWeight: 'bold', color: C.foreground },
  currentStatLabel: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  currentMeta: { fontSize: 11, color: C.mutedForeground, marginTop: 12, textAlign: 'center' },
  currentHint: { fontSize: 11, color: C.primary, marginTop: 6, textAlign: 'center', fontWeight: '500' },
  card: {
    backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  periodLabel: { fontSize: 15, fontWeight: '700', color: C.foreground },
  cardMeta: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  cardFooter: { fontSize: 11, color: C.mutedForeground },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: C.foreground, flex: 1, marginRight: 12 },
  modalMeta: { fontSize: 12, color: C.mutedForeground, marginBottom: 12 },
  detailItemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  detailItemName: { fontSize: 14, fontWeight: '600', color: C.foreground },
  detailItemMeta: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
});
