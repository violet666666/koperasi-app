import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl, Alert, Modal, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';
import { formatRp, unitLabel } from '../../lib/constants';
import { log } from '../../utils/log';

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
  // Gagal load ≠ data kosong — tampilkan error + retry, bukan list hampa.
  const [listError, setListError] = useState(false);
  const [detailError, setDetailError] = useState(false);
  // Modal detail: cari anggota + filter belum, toggle tandai lunas (draft-only)
  const [search, setSearch] = useState('');
  const [showUnpaidOnly, setShowUnpaidOnly] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setListError(false);
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
      setListError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const openDetail = (periodId: number) => {
    setSearch('');
    setShowUnpaidOnly(false);
    setDetailError(false);
    loadDetail(periodId);
  };

  const loadDetail = async (periodId: number) => {
    setDetailLoading(periodId);
    setDetailError(false);
    try {
      const res = await api.get(`/api/mobile/billing/${periodId}`);
      setDetail(res.data.data || null);
    } catch (err) {
      log.error('Failed to load period detail:', err);
      setDetailError(true);
    } finally {
      setDetailLoading(null);
    }
  };

  const isDraft = detail?.period?.status === 'draft';

  // Toggle isMarkedPaid — mirror web /tagihan (draft-only, di-enforce juga di server).
  const toggleItem = (item: BillingItem) => {
    const name = item.memberName || `Anggota #${item.memberId}`;
    Alert.alert(
      item.isPaid ? 'Batalkan Tanda Lunas' : 'Tandai Lunas',
      item.isPaid ? `Batalkan tanda lunas ${name}?` : `Tandai lunas ${name}?`,
      [
        { text: 'Batal', style: 'cancel' },
        {
          text: item.isPaid ? 'Batalkan' : 'Tandai Lunas',
          onPress: async () => {
            if (!detail) return;
            setTogglingId(item.id);
            try {
              const res = await api.post(
                `/api/mobile/billing/${detail.period.id}/items/${item.id}/toggle`
              );
              const updated = res.data.data;
              setDetail(prev => prev ? {
                ...prev,
                items: prev.items.map(i =>
                  i.id === item.id
                    ? { ...i, isPaid: !!updated.isMarkedPaid, paidAt: updated.paidAt || null }
                    : i
                ),
              } : prev);
            } catch (err) {
              log.error('Failed to toggle billing item:', err);
              Alert.alert('Error', 'Gagal menandai. Coba lagi.');
            } finally {
              setTogglingId(null);
            }
          },
        },
      ]
    );
  };

  const renderDetailItem = ({ item }: { item: BillingItem }) => {
    const name = item.memberName || `Anggota #${item.memberId}`;
    const badge = (
      <View style={[styles.badge, { backgroundColor: item.isPaid ? C.success : C.warning }]}>
        <Text style={styles.badgeText}>{item.isPaid ? 'Lunas' : 'Belum Lunas'}</Text>
      </View>
    );
    const body = (
      <>
        <View style={{ flex: 1 }}>
          <Text style={styles.detailItemName} numberOfLines={1}>{name}</Text>
          <Text style={styles.detailItemMeta} numberOfLines={1}>
            {item.unitType ? unitLabel(item.unitType) : 'umum'} · {formatRp(item.amount)}
          </Text>
        </View>
        {togglingId === item.id ? <ActivityIndicator size="small" color={C.accent} /> : badge}
      </>
    );
    if (!isDraft) return <View style={styles.detailItemRow}>{body}</View>;
    return (
      <TouchableOpacity
        style={styles.detailItemRow}
        activeOpacity={0.6}
        disabled={togglingId === item.id}
        onPress={() => toggleItem(item)}
        accessibilityLabel={`Tandai lunas ${name}`}
      >
        {body}
      </TouchableOpacity>
    );
  };

  const statusBadge = (status: string) =>
    status === 'processed'
      ? { label: 'Selesai', bg: C.success }
      : status === 'draft'
      ? { label: 'Draft', bg: C.warning }
      : { label: status, bg: C.mutedForeground };

  const renderCurrentCard = () => {
    if (!current) return null;
    const badge = statusBadge(current.status);
    return (
      <TouchableOpacity
        style={styles.currentCard}
        activeOpacity={0.7}
        onPress={() => openDetail(current.id)}
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
                <Text style={[styles.currentStatValue, { color: C.warning }]}>{daysRemaining}</Text>
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
        onPress={() => openDetail(item.id)}
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

  // Gagal load total (tidak ada data lama utk ditampilkan) → error + retry
  if (listError && !current && riwayat.length === 0) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="cloud-offline-outline" size={48} color={C.mutedForeground} />
        <Text style={{ color: C.mutedForeground, marginTop: 12, fontSize: 15, textAlign: 'center' }}>
          Gagal memuat data. Periksa koneksi Anda.
        </Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => { setLoading(true); loadData(); }}
          accessibilityLabel="Coba lagi memuat data"
        >
          <Text style={styles.retryText}>Coba lagi</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Filter modal detail: cari nama + "Belum saja"
  const filteredItems = (detail?.items || []).filter((i) => {
    if (showUnpaidOnly && i.isPaid) return false;
    const q = search.trim().toLowerCase();
    if (q && !(i.memberName || '').toLowerCase().includes(q)) return false;
    return true;
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            accessibilityLabel="Kembali"
          >
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
            {detailError ? (
              <View style={styles.modalError}>
                <Ionicons name="cloud-offline-outline" size={40} color={C.mutedForeground} />
                <Text style={styles.modalErrorText}>Gagal memuat detail periode</Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => detail && loadDetail(detail.period.id)}
                  accessibilityLabel="Coba lagi memuat detail periode"
                >
                  <Text style={styles.retryText}>Coba lagi</Text>
                </TouchableOpacity>
              </View>
            ) : detail ? (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{detail.period.periodLabel}</Text>
                  <TouchableOpacity
                    onPress={() => setDetail(null)}
                    style={styles.closeBtn}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Tutup"
                  >
                    <Ionicons name="close" size={24} color={C.mutedForeground} />
                  </TouchableOpacity>
                </View>
                <Text style={styles.modalMeta}>
                  Total {formatRp(detail.period.totalAmount)} ·{' '}
                  {detail.items.filter((i) => i.isPaid).length}/{detail.items.length} lunas
                </Text>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Cari nama anggota…"
                  placeholderTextColor={C.mutedForeground}
                  value={search}
                  onChangeText={setSearch}
                />
                <TouchableOpacity
                  style={[styles.modalChip, showUnpaidOnly && styles.modalChipActive]}
                  onPress={() => setShowUnpaidOnly(v => !v)}
                  accessibilityLabel="Filter hanya yang belum lunas"
                >
                  <Ionicons name="filter" size={13} color={showUnpaidOnly ? '#FFF' : C.primary} />
                  <Text style={[styles.modalChipText, showUnpaidOnly && styles.modalChipTextActive]}>Belum saja</Text>
                </TouchableOpacity>
                {isDraft && (
                  <Text style={styles.modalHint}>Ketuk item untuk menandai / membatalkan lunas</Text>
                )}
                <FlatList
                  data={filteredItems}
                  keyExtractor={(i) => String(i.id)}
                  renderItem={renderDetailItem}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  ListEmptyComponent={
                    <Text style={{ color: C.mutedForeground, textAlign: 'center', paddingVertical: 24, fontSize: 13 }}>
                      Tidak ada item yang cocok
                    </Text>
                  }
                />
              </>
            ) : (
              <View style={styles.modalLoading}>
                <ActivityIndicator size="large" color={C.accent} />
              </View>
            )}
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
  backBtn: { padding: 8, borderRadius: 8 },
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
  closeBtn: { padding: 8, borderRadius: 8 },
  modalMeta: { fontSize: 12, color: C.mutedForeground, marginBottom: 12 },
  searchInput: {
    backgroundColor: C.muted, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 13, color: C.foreground, marginBottom: 8,
  },
  modalChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: C.muted, borderWidth: 1, borderColor: 'transparent',
    marginBottom: 4,
  },
  modalChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  modalChipText: { fontSize: 12, fontWeight: '600', color: C.primary },
  modalChipTextActive: { color: '#FFF' },
  modalHint: { fontSize: 11, color: C.mutedForeground, marginBottom: 8 },
  modalError: { alignItems: 'center', paddingVertical: 40 },
  modalErrorText: { fontSize: 14, color: C.mutedForeground, marginTop: 12, marginBottom: 4 },
  modalLoading: { alignItems: 'center', paddingVertical: 40 },
  retryBtn: {
    marginTop: 16, backgroundColor: C.primary, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 24,
  },
  retryText: { color: '#FFF', fontSize: 14, fontWeight: '600' },
  detailItemRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  detailItemName: { fontSize: 14, fontWeight: '600', color: C.foreground },
  detailItemMeta: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
});
