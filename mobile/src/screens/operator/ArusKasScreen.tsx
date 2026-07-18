import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar,
  ActivityIndicator, RefreshControl, Modal, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../lib/api';
import C from '../../lib/colors';
import { log } from '../../utils/log';

const formatRp = (n: number) => 'Rp ' + (Number(n) || 0).toLocaleString('id-ID');

const BULAN_LABEL = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

type CashFlowItem = { description: string; amount: number };

type BucketData = {
  inflows: CashFlowItem[];
  outflows: CashFlowItem[];
  net: number;
};

type ArusKasData = {
  openingBalance: number;
  closingBalance: number;
  operating: BucketData;
  investing: BucketData;
  financing: BucketData;
  netChange: number;
};

type ApiResponse = { data: ArusKasData };

export default function ArusKasScreen({ navigation }: any) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<ArusKasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeBucket, setActiveBucket] = useState<{ label: string; items: CashFlowItem[] } | null>(null);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await api.get<ApiResponse>('/api/mobile/reports/arus-kas', {
        params: { month: String(month), year: String(year) },
      });
      setData(res.data.data);
    } catch (err) {
      log.error('Failed to load arus kas:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, year]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = () => { setRefreshing(true); loadData(); };

  const MONTHS = BULAN_LABEL.slice(1);
  const YEARS = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const openBucket = (label: string, items: CashFlowItem[]) => {
    if (items.length === 0) return;
    setActiveBucket({ label, items });
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  const d = data!;

  const BucketCard = ({
    title, color, items, net, icon,
  }: { title: string; color: string; items: CashFlowItem[]; net: number; icon: string }) => (
    <TouchableOpacity
      style={[styles.bucketCard, { borderLeftColor: color }]}
      activeOpacity={0.8}
      onPress={() => openBucket(title, items)}
    >
      <View style={styles.bucketHeader}>
        <View style={[styles.bucketIcon, { backgroundColor: color + '18' }]}>
          <Text style={{ fontSize: 20 }}>{icon}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.bucketTitle}>{title}</Text>
          <Text style={styles.bucketCount}>{items.length} pos</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.bucketNet, { color: net >= 0 ? C.success : C.destructive }]}>
            {net >= 0 ? '+' : ''}{formatRp(net)}
          </Text>
          <Text style={styles.bucketNetLabel}>Net</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const ItemRow = ({ item, isOutflow }: { item: CashFlowItem; isOutflow: boolean }) => (
    <View style={styles.itemRow}>
      <Text style={styles.itemDesc}>{item.description}</Text>
      <Text style={[styles.itemAmount, { color: isOutflow ? C.destructive : C.success }]}>
        {isOutflow ? '- ' : '+ '}{formatRp(Math.abs(item.amount))}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.primary} />
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerTitle}>Arus Kas</Text>
            <Text style={styles.headerSub}>{MONTHS[month - 1]} {year}</Text>
          </View>
        </View>
        <View style={styles.pickerRow}>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowMonthPicker(true)}>
            <Ionicons name="calendar-outline" size={16} color="#FFF" />
            <Text style={styles.pickerText}>{MONTHS[month - 1]}</Text>
            <Ionicons name="chevron-down" size={16} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowYearPicker(true)}>
            <Ionicons name="calendar-outline" size={16} color="#FFF" />
            <Text style={styles.pickerText}>{year}</Text>
            <Ionicons name="chevron-down" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.accent]} />}
      >
        {/* Balance Cards */}
        <View style={styles.balanceRow}>
          <View style={[styles.balanceCard, { borderLeftColor: C.info }]}>
            <Text style={styles.balanceLabel}>Saldo Awal</Text>
            <Text style={styles.balanceValue}>{formatRp(d.openingBalance)}</Text>
          </View>
          <View style={[styles.balanceCard, { borderLeftColor: C.primary }]}>
            <Text style={styles.balanceLabel}>Saldo Akhir</Text>
            <Text style={styles.balanceValue}>{formatRp(d.closingBalance)}</Text>
          </View>
        </View>

        {/* Net Change Banner */}
        <View style={[styles.netBanner, { backgroundColor: d.netChange >= 0 ? C.successBg : C.destructiveBg }]}>
          <Text style={styles.netBannerLabel}>Perubahan Kas Bulan Ini</Text>
          <Text style={[styles.netBannerValue, { color: d.netChange >= 0 ? C.success : C.destructive }]}>
            {d.netChange >= 0 ? '+' : ''}{formatRp(d.netChange)}
          </Text>
        </View>

        {/* Bucket Cards */}
        <BucketCard
          title="Arus Kas Operasional"
          color={C.info}
          items={[...d.operating.inflows, ...d.operating.outflows]}
          net={d.operating.net}
          icon="⚙️"
        />
        <BucketCard
          title="Arus Kas Investasi"
          color={C.success}
          items={[...d.investing.inflows, ...d.investing.outflows]}
          net={d.investing.net}
          icon="🏗️"
        />
        <BucketCard
          title="Arus Kas Finansial"
          color={C.warning}
          items={[...d.financing.inflows, ...d.financing.outflows]}
          net={d.financing.net}
          icon="💰"
        />
      </ScrollView>

      {/* Bucket Detail Modal */}
      <Modal visible={!!activeBucket} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activeBucket?.label}</Text>
              <TouchableOpacity onPress={() => setActiveBucket(null)}>
                <Ionicons name="close-circle" size={28} color={C.mutedForeground} />
              </TouchableOpacity>
            </View>
            {activeBucket && (
              <FlatList
                data={activeBucket.items}
                keyExtractor={(item) => item.description}
                renderItem={({ item }) => <ItemRow item={item} isOutflow={item.amount < 0} />}
                style={{ maxHeight: 400 }}
                ListEmptyComponent={
                  <Text style={{ textAlign: 'center', color: C.mutedForeground, paddingVertical: 20 }}>
                    Tidak ada data
                  </Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Month Picker */}
      <Modal visible={showMonthPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowMonthPicker(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerSheetTitle}>Pilih Bulan</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {MONTHS.map((m, i) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.pickerOption, month === i + 1 && styles.pickerOptionActive]}
                  onPress={() => { setMonth(i + 1); setShowMonthPicker(false); }}
                >
                  <Text style={[styles.pickerOptionText, month === i + 1 && styles.pickerOptionTextActive]}>
                    {m} {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Year Picker */}
      <Modal visible={showYearPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowYearPicker(false)}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerSheetTitle}>Pilih Tahun</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {YEARS.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.pickerOption, year === y && styles.pickerOptionActive]}
                  onPress={() => { setYear(y); setShowYearPicker(false); }}
                >
                  <Text style={[styles.pickerOptionText, year === y && styles.pickerOptionTextActive]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
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
  pickerRow: { flexDirection: 'row', gap: 12, marginTop: 14 },
  pickerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12,
  },
  pickerText: { flex: 1, color: '#FFF', fontSize: 14, fontWeight: '600' },
  balanceRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  balanceCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 16,
    borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  balanceLabel: { fontSize: 11, color: C.mutedForeground },
  balanceValue: { fontSize: 15, fontWeight: '700', color: C.foreground, marginTop: 4 },
  netBanner: {
    borderRadius: 14, padding: 16, marginBottom: 16, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  netBannerLabel: { fontSize: 13, fontWeight: '600', color: C.mutedForeground },
  netBannerValue: { fontSize: 18, fontWeight: '700' },
  bucketCard: {
    backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 12,
    borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  bucketHeader: { flexDirection: 'row', alignItems: 'center' },
  bucketIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  bucketTitle: { fontSize: 15, fontWeight: '700', color: C.foreground },
  bucketCount: { fontSize: 12, color: C.mutedForeground, marginTop: 2 },
  bucketNet: { fontSize: 15, fontWeight: '700' },
  bucketNetLabel: { fontSize: 11, color: C.mutedForeground, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '70%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: C.primary, flex: 1 },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  itemDesc: { flex: 1, fontSize: 14, color: C.foreground, marginRight: 12 },
  itemAmount: { fontSize: 14, fontWeight: '700' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  pickerSheet: { backgroundColor: C.card, borderRadius: 20, padding: 20, width: '80%', maxWidth: 300 },
  pickerSheetTitle: { fontSize: 16, fontWeight: '700', color: C.primary, marginBottom: 12, textAlign: 'center' },
  pickerOption: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8 },
  pickerOptionActive: { backgroundColor: C.primary + '18' },
  pickerOptionText: { fontSize: 15, color: C.foreground },
  pickerOptionTextActive: { color: C.primary, fontWeight: '700' },
});
